# Production Root Cause Analysis & Forensics

## Executive Summary
Following a reported outage in production where:
1. Customer order for Instagram link `https://www.instagram.com/p/DeBAAntkpNd/` was invisible in the admin panel,
2. Admin "Sync" changed nothing,
3. Provider balance and related API amounts failed to reflect,

Direct container forensics and reproduction tests were conducted across Railway services (`smm`, `worker`, `web`, `Postgres`, `Redis`). All root causes were isolated, reproduced with automated tests, and permanently corrected.

---

## 1. Symptom 1: Customer Order Invisible in Admin Panel

### Forensic Finding
- **Customer Order In Database**: Order `#6ad6ccfa-5667-45a6-b1d1-bde1a61706df` existed in PostgreSQL with target `https://www.instagram.com/p/DeBAAntkpNd/`, user `vaibhavrishabh40@gmail.com`, charge `₹17.32`, status `PENDING`.
- **Admin Query Result**: Calling `GET /api/v1/orders` with an admin JWT returned `[]`.

### Mechanism & Exact Lines
- **File**: [`apps/api/src/modules/orders/orders.controller.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/orders/orders.controller.ts#L43-L52)
  - Prior implementation passed `user.id` into `this.ordersService.findAll(user.id, user.role, query.status, ...)`.
  - In [`apps/api/src/modules/orders/orders.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/orders/orders.service.ts#L33-L45), the code evaluated:
    ```typescript
    const where: any = {};
    if (userId) where.userId = userId;
    ```
    Because `userId` was always set to the authenticated admin's user ID, Prisma generated `SELECT * FROM "Order" WHERE "userId" = 'usr_admin_001'`, effectively filtering out all customer orders and only showing orders placed by the admin.
- **File**: [`apps/api/src/modules/orders/orders.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/orders/orders.service.ts#L38-L43)
  - `include: { provider: requesterRole === "ADMIN" ? { select: ... } : false }`.
  - In Prisma Client, passing `provider: false` inside `include` throws a runtime schema validation error: `Unknown field or invalid value for provider in include`. The enclosing `catch` block caught the error and returned an empty array `[]`.

### Solution & Test
- **Controller Fix**: Passed `targetUserId = user.role === Role.ADMIN ? (queryUserId || undefined) : user.id`. Only filter by `userId` if explicitly supplied in query params by admin.
- **Service Fix**: Conditionally defined `include.provider` and added `include.user` so user email and provider details populate safely without invalid boolean fields in Prisma includes.
- **Verification Test**: `apps/api/src/modules/orders/production-forensics-repro.spec.ts` ("should allow ADMIN to view all orders across all customers").

---

## 2. Symptom 2: Upstream Provider Order Dispatch Failure & Stuck PENDING Orders

### Forensic Finding
- The outbox event `1ba528f9-d7af-485a-8664-1c20e1148a64` was marked `PUBLISHED`.
- Worker container log showed: `Upstream provider dispatch failed for #6ad6ccfa-5667-45a6-b1d1-bde1a61706df: Upstream provider error: Missing username`.
- The BullMQ job failed, but the outbox event was already `PUBLISHED`. The order remained stuck in `PENDING` indefinitely with 0 retries and no automated refund.

### Mechanism & Exact Lines
- **File**: [`apps/worker/src/main.ts`](file:///d:/projects/internship%20projects/SMM/apps/worker/src/main.ts#L100-L135)
  - Upstream provider service `6285` (`❤️Instagram Auto Likes [Speed 10K/H] [Start: INSTANT] 🔥`) is defined as `"type": "Subscriptions"` by CheapestSMMPanels.
  - The provider API expects `action: "add"`, `service: 6285`, and parameter `username: "<username>"`, NOT `link: "<url>"`.
  - The link parsing regex `instagram\.com\/(?:p\/|reel\/)?([A-Za-z0-9_.-]+)` extracted `"p"` as the username from `https://www.instagram.com/p/DeBAAntkpNd/`.
  - Furthermore, when upstream dispatch failed with a non-retryable provider error, BullMQ threw an unhandled failure without invoking `handleFinalOrderFailure`, leaving the customer's balance debited and the order orphaned in `PENDING`.

### Solution & Test
- **Parser Fix**: Implemented distinct regexes for Instagram post shortcodes (`/p/:shortcode`, `/reel/:shortcode`) vs profile usernames (`instagram.com/:username`). For subscription services requiring `username`, extract handle or fallback safely.
- **Worker Failure Handler**: Wrapped upstream dispatch in BullMQ worker with catch block. If upstream provider rejects dispatch permanently, immediately execute `handleFinalOrderFailure(orderId, err.message)`, crediting the user's wallet via double-entry ledger refund and updating order status to `FAILED` with explicit `failReason`.
- **Verification Test**: `apps/api/src/modules/orders/production-forensics-repro.spec.ts` ("should refund customer wallet if upstream dispatch encounters unrecoverable error").

---

## 3. Symptom 3: Admin Catalog Sync & Balance Sync Ineffective / Crashing

### Forensic Finding
- Calling provider sync in the admin panel changed nothing in the service catalog and balance was unresponsive.
- Calling `POST /api/v1/providers/:id/import` previously failed with HTTP 500: `PostgresError 22003: numeric field overflow (Precision 10, scale 2)`.

### Mechanism & Exact Lines
- **File**: [`apps/api/src/modules/providers/providers.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/providers/providers.service.ts#L140-L195)
  - `sync(id)` only called `getBalance` and returned `{ balance }`, completely omitting catalog synchronization.
  - When full catalog import was attempted, upstream service `4227` returned rate `1336542900.00`, exceeding PostgreSQL's `Decimal(10, 2)` limit (`max 99,999,999.99`). Because import was executed in a single unshielded batch without per-item error isolation, the single overflow crashed the entire import with HTTP 500.

### Solution & Test
- **Sync Fix**: Combined live balance query with catalog synchronization inside `sync(id)`.
- **Numeric Overflow Clamping**: Implemented rate sanitization and clamping: rates exceeding `99999999.99` are clamped and flagged.
- **Fault-Tolerant Import**: Each service item upsert is isolated in a per-item try-catch, allowing 1000+ services to import smoothly even if upstream sends corrupted records.
- **Verification Test**: Tested live against cheapestsmmpanels API with 1005 services.

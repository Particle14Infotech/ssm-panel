# DRIP-FEED IMPLEMENTATION SPECIFICATION & ARCHITECTURE

**Status:** IMPLEMENTED & TESTED  
**Date:** 2026-10-19  
**Source of Truth:** `@smm/contracts`, `prisma/schema.prisma`  

---

## 1. Architectural Overview: Dual-Mode Drip-Feed

The platform provides a dual-mode drip-feed architecture:

```
┌────────────────────────────────────────────────────────┐
│                   Customer Order Form                  │
│       Selects Service + Enables Drip-Feed Toggle       │
└───────────────────────────┬────────────────────────────┘
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
   service.dripFeedSupported?    service.allowManagedDrip?
        [YES: 20 services]           [YES: Allowlisted]
               │                         │
               ▼                         ▼
      dripMode: NATIVE          dripMode: MANAGED
               │                         │
               ▼                         ▼
   Single Order Record       Parent Order + OrderRun Records
   Pass runs/interval        (runIndex 0..N-1, scheduledAt,
   in upstream action=add    chargeShare, status: SCHEDULED)
               │                         │
               ▼                         ▼
   Upstream schedules        Background Worker Polls Runs
   executions internally     (FOR UPDATE SKIP LOCKED LIMIT 50)
                             Dispatches run 0 immediately,
                             run 1..N-1 at scheduled intervals.
```

---

## 2. Modes Comparison Matrix

| Feature | `dripMode: NATIVE` | `dripMode: MANAGED` |
|:---|:---|:---|
| **Applicability** | Only services where provider returns `dripfeed: true` (20 Likes/Views/Story services) | Any service allowlisted by Admin (`allowManagedDrip = true`), including Followers |
| **Database Structure** | 1 `Order` row (`isDripFeed: true`, `runs`, `intervalMinutes`) | 1 `Order` row + N `OrderRun` rows (`runIndex`, `quantity`, `chargeShare`, `scheduledAt`, `status`) |
| **Upstream Dispatch** | 1 API call with `runs` & `interval` | N independent API calls dispatched sequentially over time |
| **Min / Max Runs** | 2 / 100 | 2 / 30 (`DRIPFEED_MANAGED_MAX_RUNS`) |
| **Min Interval** | 5 minutes | 30 minutes (`DRIPFEED_MANAGED_MIN_INTERVAL`) |
| **Link Overlap Safety**| Handled upstream | Automated detection via `isLinkRestrictionError` with 10-minute postponement |
| **Partial Cancellation**| Request upstream cancel | Customer can cancel remaining scheduled runs with instant wallet refund |
| **Refill Policy** | Allowed if service supports refill | Disabled (`refillable = false`) to prevent link collision and provider conflicts |

---

## 3. Data Model & Migrations

### 3.1 Schema (`prisma/schema.prisma`)
```prisma
enum DripMode {
  NONE
  NATIVE
  MANAGED
}

enum OrderRunStatus {
  SCHEDULED
  DISPATCHING
  UNCERTAIN
  PROCESSING
  COMPLETED
  PARTIAL
  FAILED
  CANCELED
}

model Order {
  // Existing order columns ...
  dripMode        DripMode        @default(NONE)
  runsList        OrderRun[]
}

model OrderRun {
  id              String          @id @default(uuid())
  orderId         String
  order           Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  runIndex        Int
  quantity        Int
  scheduledAt     DateTime
  status          OrderRunStatus  @default(SCHEDULED)
  providerOrderId String?
  attempts        Int             @default(0)
  nextAttemptAt   DateTime?
  lastError       String?
  delivered       Int             @default(0)
  chargeShare     Decimal         @db.Decimal(12, 2)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([orderId, runIndex])
  @@index([status, scheduledAt])
  @@index([providerOrderId])
}

model Service {
  // Existing columns ...
  allowManagedDrip  Boolean       @default(false)
  rawMeta           Json?
}
```

### 3.2 Migration SQL File
Generated at `prisma/migrations/20261019020000_panel_managed_dripfeed/migration.sql` for controlled execution via `prisma migrate deploy`.

---

## 4. Financial Integrity: Exact Mathematical Split

Customer charge is debited **once upfront** during order creation:
$$\text{Total Charge} = \text{ceil2}\left(\frac{\text{sellRate} \times \text{quantity} \times \text{runs}}{1000}\right)$$

To guarantee **zero rounding leakage** or unallocated fractions:
1. `baseShare = floor(totalCharge / runs * 100) / 100`
2. Runs $0 \dots (N-2)$ receive `baseShare`.
3. Run $(N-1)$ receives $\text{totalCharge} - \sum_{i=0}^{N-2} \text{share}_i$.
4. **Invariant:** $\sum_{i=0}^{N-1} \text{share}_i \equiv \text{Total Charge}$ exactly.

---

## 5. Background Scheduler & Worker Concurrency

The background worker (`apps/worker/src/main.ts`) runs every 15 seconds:

```sql
SELECT * FROM "OrderRun"
WHERE "status" = 'SCHEDULED'
  AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
  AND "scheduledAt" <= NOW()
ORDER BY "scheduledAt" ASC
LIMIT 50
FOR UPDATE SKIP LOCKED;
```

### 5.1 Concurrency & Worker Fault Isolation
- **`FOR UPDATE SKIP LOCKED`**: Multiple worker nodes or cluster workers never pick up or dispatch the same run.
- **Persist `DISPATCHING` Before Call**: Status is committed to the database before the upstream network call is initiated.
- **Timeout Protection**: If an HTTP call aborts or times out, the run is flagged as `UNCERTAIN` instead of retrying blindly. It alerts the admin supervisor.
- **HTTP 200 + Error Handling**: Upstream SMM v2 APIs return HTTP 200 with `{ "error": "..." }`. The adapter parses `res.data.error` as a definitive failure or postponement.

---

## 6. Provider Link Restriction Postponement

Many upstream providers reject consecutive orders on identical links (e.g., *"There is already an active order with this link"*):
- Detected strings: `active order exists`, `order on this link`, `active order with this link`, `link is already in progress`, `order already in progress`, `duplicate link`, `processing queue`.
- **Action**: When detected, the worker increments `attempts` and sets `nextAttemptAt = now + 10 minutes`.
- **Exhaustion**: After 5 attempts, the run transitions to `FAILED`, and its exact `chargeShare` is refunded once to the user's wallet.

---

## 7. Customer Cancellation Mid-Schedule

If a customer cancels a managed drip-feed order:
1. All runs with `status = 'SCHEDULED'` are immediately updated to `status = 'CANCELED'`.
2. The exact sum of their `chargeShare` amounts is credited back to the customer's wallet in a single atomic database transaction.
3. Runs that are already `DISPATCHING`, `PROCESSING`, or `COMPLETED` are preserved without disruption.
4. The parent order status transitions to `PARTIAL` (if any run succeeded) or `CANCELLED` (if run 0 failed or was canceled).

---

## 8. Supervisor Health & Telemetry

Surfaced via `GET /api/v1/health/system` and rendered in `/admin/health`:
- **Due Runs**: `status = 'SCHEDULED'` and `scheduledAt <= now`.
- **Late Runs**: `status = 'SCHEDULED'` and `scheduledAt <= now - 10m` (indicates queue starvation or worker stall).
- **Uncertain Runs**: `status = 'UNCERTAIN'` (network timeout during upstream call, requires verification).
- **Failed Runs**: Total runs that failed all retries and were refunded.

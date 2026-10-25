# DESIGN.md: Package Engine Architecture (HLD & LLD)

**System:** SMM Automated Multi-Platform Social Media Marketing Panel  
**Feature:** Platform + Handle Package Engine (`feature/package-engine`)  
**Specification Level:** High-Level Design (HLD) & Low-Level Design (LLD)  
**Status:** COMPLETE & VERIFIED  
**Date:** October 24, 2026  

---

## 1. High-Level Design (HLD)

### 1.1 Objective & Architectural Pivot
The Package Engine replaces legacy brittle drip-feed systems and deprecated OAuth integrations with a deterministic, platform-agnostic, handle-driven scheduling engine.
- **Platform + Handle Architecture**: Packages bind to `(platform, handle)` without requiring OAuth connection credentials or social token permissions.
- **Two Package Modalities**:
  1. `PROFILE`: Multi-day gradual growth services (e.g. Followers, Subscribers) precomputed at purchase into deterministic `TIME_DRIP` executions.
  2. `POST`: Content engagement bundles (Likes, Views, Shares, Comments) applied per post link via idempotent customer triggers.
- **Strict Financial Invariant**:
  $$\text{purchased} \equiv \text{consumed} + \text{refunded} + \text{remaining}$$
  All calculations operate with integer paise precision and explicit rounding rules (`Decimal.ROUND_CEIL`).
- **Feature Flag Isolation**: Gated behind `PACKAGES_ENABLED` (default `false`), protected in production until all automated verification criteria pass.

### 1.2 System Context Diagram

```
+---------------------------------------------------------------------------------+
|                                 CUSTOMER CLIENT                                 |
|   - /new-order [Single | Package Tabs]      - /packages/:id [Progress & Timelines] |
|   - PackageOrderBuilder (Quote Preview)     - Per-Post Trigger Flow             |
+---------------------------------------------------------------------------------+
                                       |
                                       | HTTPS (REST / OpenAPI DTOs)
                                       v
+---------------------------------------------------------------------------------+
|                               API SERVICE (NestJS)                              |
|   + PackagesController                                                          |
|     - POST /packages/quote       (Pure honest quote, zero side effects)        |
|     - POST /packages             (Atomic purchase, wallet lock, idempotency)   |
|     - POST /packages/:id/triggers (Atomic post schedule creation)               |
|     - POST /packages/:id/pause, resume, cancel                                 |
|   + PackagesService & PackagesQuoteService                                      |
|     - Pure math schedule generation (calculateFollowersDrip, calculatePerPostDrip)|
|     - Link validation via PlatformConfig regex rules                            |
+---------------------------------------------------------------------------------+
                                       |
                                       | PostgreSQL (Prisma ORM)
                                       v
+---------------------------------------------------------------------------------+
|                             PERSISTENCE TIER (Postgres)                         |
|   - Package, PackageRule, PackageExecution, PlatformConfig                      |
|   - Wallet, LedgerEntry, Refund, Order, OutboxEvent                             |
+---------------------------------------------------------------------------------+
                                       ^
                                       | Polling & Atomic Claims
                                       v
+---------------------------------------------------------------------------------+
|                              WORKER ENGINE (Node.js)                            |
|   - pollAndDispatchPackageExecutions()                                          |
|     - Atomically claims due executions (FOR UPDATE SKIP LOCKED)                 |
|     - Creates prepaid child Order and OutboxEvent transactionally               |
|     - Sequential rule enforcement (waits for non-final prior runs)              |
|     - Error circuit breaker & UNCERTAIN failure isolation                       |
+---------------------------------------------------------------------------------+
```

---

## 2. Low-Level Design (LLD)

### 2.1 Database Schema & Data Models

#### 2.1.1 `Package` Table
Represents an active multi-day package subscription bound to a creator handle.
```prisma
model Package {
  id              String         @id @default(uuid())
  userId          String
  platform        String         // instagram, tiktok, youtube, facebook, x, telegram
  handle          String         // Normalized handle without leading @
  timezone        String         @default("UTC") // IANA timezone
  kind            PackageRuleKind @default(TIME_DRIP)
  status          PackageStatus  @default(ACTIVE) // ACTIVE, PAUSED, COMPLETED, CANCELLED
  startAt         DateTime       @default(now())
  endAt           DateTime
  pausedDays      Int            @default(0)
  reserveTotal    Decimal        @db.Decimal(12, 2) // Total escrowed amount
  idempotencyKey  String?        @unique
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  user            User           @relation(fields: [userId], references: [id])
  rules           PackageRule[]
  executions      PackageExecution[]
  refunds         Refund[]

  @@index([userId, status])
  @@index([platform, handle, status])
}
```

#### 2.1.2 `PackageRule` Table
Defines component rules and service quotas within a package.
```prisma
model PackageRule {
  id                String          @id @default(uuid())
  packageId         String
  kind              PackageRuleKind // TIME_DRIP or POST_TRIGGERED
  serviceId         String
  quantityPerPost   Int
  maxPosts          Int             @default(1)
  usedCount         Int             @default(0)
  unitCharge        Decimal         @db.Decimal(10, 2)
  rateSnapshot      Decimal         @db.Decimal(10, 2)
  reserve           Decimal         @db.Decimal(12, 2)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  package           Package         @relation(fields: [packageId], references: [id], onDelete: Cascade)
  service           Service         @relation(fields: [serviceId], references: [id])
  executions        PackageExecution[]
}
```

#### 2.1.3 `PackageExecution` Table
Tracks individual scheduled batch dispatches.
```prisma
model PackageExecution {
  id                String                 @id @default(uuid())
  packageId         String
  ruleId            String
  orderId           String?                @unique
  source            ExecutionSource        // SCHEDULE or MEDIA
  seq               Int
  quantity          Int
  remainingQuantity Int?
  allocatedCharge   Decimal                @db.Decimal(10, 2)
  executeAt         DateTime
  status            PackageExecutionStatus // SCHEDULED, DISPATCHING, SENT, COMPLETED, PARTIAL, FAILED, CANCELLED, SKIPPED_PAUSED, UNCERTAIN, STALLED
  skipReason        String?
  targetUrl         String?
  mediaKey          String?
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt

  package           Package                @relation(fields: [packageId], references: [id], onDelete: Cascade)
  rule              PackageRule            @relation(fields: [ruleId], references: [id])
  order             Order?                 @relation(fields: [orderId], references: [id])

  @@index([status, executeAt])
  @@index([packageId, seq])
}
```

### 2.2 Package Execution State Machine

```
               +-----------------------------------------------------+
               |                     SCHEDULED                       |
               +-----------------------------------------------------+
                       |                          |             |
           (worker claim)                         | (pause)     | (cancel/expire)
                       v                          v             v
               +---------------+          +--------------+  +-----------+
               |  DISPATCHING  |          |SKIPPED_PAUSED|  | CANCELLED |
               +---------------+          +--------------+  +-----------+
                 /           \                   |
        (success)             (failure/timeout)  | (resume reschedule)
               v               v                 v
         +-----------+   +-----------+     +-----------+
         |   SENT    |   | UNCERTAIN |     | SCHEDULED |
         +-----------+   +-----------+     +-----------+
          /    |    \
 (provider callbacks & status sync)
        v      v     v
+---------+ +-------+ +--------+
|COMPLETED| |PARTIAL| | FAILED |
+---------+ +-------+ +--------+
```

### 2.3 Mathematical Scheduling Algorithm (`drip-engine.util.ts`)

#### 2.3.1 Bounded Run Calculation
For a total quantity $Q$, service minimum $M_{\min}$, service maximum $M_{\max}$, duration $D$ days, and interval $I$ hours:
$$R_{\text{qty}} = \lfloor Q / M_{\min} \rfloor$$
$$R_{\text{time}} = \lfloor (D \times 24) / I \rfloor$$
$$R_{\min} = \lceil Q / M_{\max} \rceil$$
$$R = \text{clamp}(\min(R_{\text{qty}}, R_{\text{time}}), R_{\min}, \text{maxCaps})$$

#### 2.3.2 Remainder Distribution
To avoid fractional units, the integer division remainder is distributed sequentially:
$$q_{\text{base}} = \lfloor Q / R \rfloor, \quad q_{\text{rem}} = Q \pmod R$$
$$q_i = \begin{cases} q_{\text{base}} + 1, & \text{if } i < q_{\text{rem}} \\ q_{\text{base}}, & \text{otherwise} \end{cases}$$
Invariant:
$$\sum_{i=1}^R q_i \equiv Q$$

#### 2.3.3 Charge Conservation
$$\text{totalCharge} = \lceil Q \times \text{ratePer1000} / 1000 \rceil$$
$$\text{allocatedCharge}_i = \begin{cases} \text{round}(q_i \times \text{ratePer1000} / 1000), & i < R \\ \text{totalCharge} - \sum_{j=1}^{R-1} \text{allocatedCharge}_j, & i = R \end{cases}$$
Invariant:
$$\sum_{i=1}^R \text{allocatedCharge}_i \equiv \text{totalCharge}$$

---

## 3. Concurrency & High-Availability Guarantees

### 3.1 Exactly-Once Atomic Claim
Execution batches are claimed concurrently by workers without contention using PostgreSQL row locks:
```sql
SELECT e.id, e."packageId", e."ruleId", e.quantity, e."allocatedCharge"
FROM "PackageExecution" e
JOIN "Package" p ON p.id = e."packageId"
WHERE e.status = 'SCHEDULED' AND e."executeAt" <= NOW()
FOR UPDATE OF e SKIP LOCKED
LIMIT 25;
```
Once locked, the state transitions atomically:
```sql
UPDATE "PackageExecution"
SET status = 'DISPATCHED', "remainingQuantity" = quantity
WHERE id = $1 AND status = 'SCHEDULED' AND "orderId" IS NULL;
```
If `count !== 1`, another concurrent transaction claimed the row; the worker immediately bails.

### 3.2 Prepaid Child Order Pipeline
Child orders created by the worker carry:
- `isPrepaid = true`
- `charge = execution.allocatedCharge`
This prevents double wallet debit while allowing upstream provider reconciliation routines to issue proportional refunds on `PARTIAL` or `CANCELLED` completions.

---

## 4. Operational Invariants Verified

| Invariant Code | Name | Implementation Gate |
|---|---|---|
| **INV-PKG-01** | Escrow Conservation | $\text{purchased} = \text{consumed} + \text{refunded} + \text{remaining}$ |
| **INV-PKG-02** | Exactly-Once Dispatch | Atomic `SKIP LOCKED` claim prevents duplicate execution |
| **INV-PKG-03** | Honest Quote Match | `quote.totalCharge === savedPackage.reserveTotal` |
| **INV-PKG-04** | Unique Settlement | DB constraint `UNIQUE(packageId, reason)` rejects duplicate refund |
| **INV-PKG-05** | Production Guard | Direct wallet crediting routes return 404 in production |

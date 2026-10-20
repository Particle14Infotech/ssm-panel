# Package Engine Documentation (SMM Panel)

## 1. Overview & Architecture

The **Package Engine** provides automated multi-service growth bundles combining:
- **`POST_TRIGGERED` Rules**: Monitoring of new Instagram posts and reels for automated likes, views, and engagement. Supports manual triggers via official Instagram post/reel links without requiring live Meta API credentials.
- **`TIME_DRIP` Rules**: Spread total quantities (e.g. followers or profile-level services) evenly over configured duration days with bounded random jitter ($\pm 15\%$).
- **Escrow-Style Financial Model**: Integer paise precision with upfront wallet reservation, immutable ledger logging, and guaranteed reconciliation invariant:
  $$\text{purchased} \equiv \text{consumed} + \text{refunded} + \text{remaining}$$

---

## 2. Database Schema & Relational Model

The Package Engine utilizes five core database entities in PostgreSQL:

1. **`SourceConnection`**:
   - `id`, `userId`, `platform` (`INSTAGRAM`), `providerAccountId` (immutable), `username`, `status` (`ACTIVE`, `NEEDS_RECONNECT`, `REVOKED`), `tokenEnc` (AES-256-GCM), `tokenExpiresAt`, `baselineAt`, `nextPollAt`, `pollIntervalSec`, `failureCount`.
   - **Constraint 1**: `UNIQUE(platform, providerAccountId)` prevents account collision across multiple users.

2. **`Package`**:
   - `id`, `userId`, `connectionId` (nullable), `handle`, `kind` (`POST_TRIGGERED`, `TIME_DRIP`), `status` (`ACTIVE`, `PAUSED`, `COMPLETED`, `EXPIRED`, `CANCELLED`), `startAt`, `endAt`, `pausedDays`, `reserveTotal`, `idempotencyKey`.
   - **Constraint 6**: Partial unique index enforcing at most one `ACTIVE` package per `(handle, kind)`.

3. **`PackageRule`**:
   - `id`, `packageId`, `kind`, `serviceId`, `quantityPerPost`, `mediaTypes`, `delayMinutes`, `deliveryWindowMin`, `maxPosts`, `maxPerDay`, `minSpacingMin`, `usedCount`, `unitCharge`, `rateSnapshot`, `reserve`.
   - **Constraint 5**: Database CHECK constraint `CHECK ("usedCount" <= "maxPosts")`.

4. **`MonitoredMedia`**:
   - `id`, `connectionId`, `mediaKey`, `publishedAt`, `state` (`BASELINE`, `NEW`, `DELETED`), `permalink`, `mediaType`.
   - **Constraint 2**: `UNIQUE(connectionId, mediaKey)` prevents duplicate post processing.

5. **`PackageExecution`**:
   - `id`, `packageId`, `ruleId`, `mediaId` (nullable), `source` (`MEDIA`, `SCHEDULE`), `seq`, `quantity`, `allocatedCharge`, `executeAt`, `status` (`DETECTED`, `SCHEDULED`, `DISPATCHED`, `COMPLETED`, `PARTIAL`, `FAILED`, `CANCELLED`, `SKIPPED_PAUSED`, `SKIPPED_QUOTA`, `SKIPPED_TYPE`, `SKIPPED_DELETED`, `SKIPPED_LIMIT`), `orderId` (unique), `skipReason`.
   - **Constraint 3**: `UNIQUE(ruleId, mediaId)` prevents duplicate executions per media.
   - **Constraint 4**: `UNIQUE(orderId)` guarantees one child order per execution.

6. **`Refund`**:
   - **Constraint 7**: Partial unique index `UNIQUE(packageId, reason)` guarantees idempotent refunds per cancellation or settlement.

---

## 3. Financial Model & Pricing Math

All calculations operate in integer paise (₹0.01) using Decimal arithmetic:

1. **Unit Charge**:
   $$\text{unitCharge} = \left\lceil \frac{\text{rateSnapshot} \times \text{quantityPerPost}}{1000} \right\rceil$$
2. **`POST_TRIGGERED` Reserve**:
   $$\text{reserve} = \text{unitCharge} \times \text{maxPosts}$$
3. **`TIME_DRIP` Reserve**:
   $$\text{reserve} = \left\lceil \frac{\text{rateSnapshot} \times \text{totalQuantity}}{1000} \right\rceil$$
   The reserve is split across runs, and the remainder is assigned to the final run so the sum of individual run charges exactly equals the item charge.
4. **Prepaid Child Orders**:
   - Child orders carry the **real `allocatedCharge`** with `isPrepaid = true`.
   - Child orders bypass wallet debit at dispatch time (avoiding double-charging).
   - Because `charge > 0`, standard partial fulfillment refunds continue to work accurately:
     $$\text{partialRefund} = \left\lfloor \frac{\text{charge} \times \text{remains}}{\text{quantity}} + 0.5 \right\rfloor$$
5. **Settlement & Cancellation**:
   - On cancellation or expiry at `endAt`, unused reserve is credited back to the customer's wallet via `PACKAGE_REFUND`.

---

## 4. Execution Flows

### 4.1 Manual Post Trigger
- Endpoint: `POST /packages/:id/trigger` with `{ url: string, mediaType?: string }`.
- Validates URL against strict Instagram regex (`INSTAGRAM_URL_REGEX`); never fetches arbitrary external URLs.
- Executes an atomic quota update:
  ```sql
  UPDATE "PackageRule"
  SET "usedCount" = "usedCount" + 1
  WHERE id = $1 AND "usedCount" < "maxPosts"
  RETURNING id, "usedCount"
  ```
- Evaluates minimum spacing (`minSpacingMin`) and daily cap (`maxPerDay`).
- Inserts `PackageExecution` with `executeAt = max(now, publishedAt + delayMinutes)`.

### 4.2 TIME_DRIP Precomputation
- Computed at purchase:
  $$\text{runs} = \text{clamp}\left(\left\lfloor \frac{Q}{\text{serviceMin}} \right\rfloor, 1, \text{durationDays} \times \text{runsPerDay}\right)$$
- Precomputes all `PackageExecution` rows upfront with bounded jitter ($\pm 15\%$).

### 4.3 Worker Scheduler Dispatch
- Reuses single-owner polling loop with concurrency safety:
  ```sql
  SELECT * FROM "PackageExecution"
  WHERE status = 'SCHEDULED' AND "executeAt" <= NOW()
  ORDER BY "executeAt" ASC
  LIMIT 25
  FOR UPDATE OF e SKIP LOCKED
  ```
- Re-verifies media existence. If media is marked `DELETED`, sets execution `SKIPPED_DELETED` and automatically credits the slot reserve back to the user's wallet via `PACKAGE_REFUND`.
- Creates prepaid child order and Outbox event (`ORDER_CREATED`) in one atomic transaction.

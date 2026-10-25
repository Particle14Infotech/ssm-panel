# SMM Panel Package Engine Documentation

## 1. System Overview & Architecture

The **Package Engine** provides multi-service automated delivery schedules across 6 supported platforms without requiring OAuth connections or private platform tokens.

### Core Architecture Principles
- **No Third-Party Platform Credentials**: The system operates purely on public handles and customer-provided post URLs.
- **Offline Link & Handle Validation**: Handles and URLs are validated and normalized locally using deterministic regex and host allowlists before any processing.
- **Deterministic Time-Interval Drip Engine**: Quantity and charge distributions are mathematically computed upfront with zero drift. Every run satisfies:
  $$\sum q = Q, \quad \sum \text{allocatedCharge} = \text{charge}, \quad \text{gap} \ge \text{minGap}$$
- **Prepaid Escrow & Single Source of Truth**: All package funds are reserved in customer wallets at checkout. Child orders dispatched to upstream providers carry the true `allocatedCharge` and bypass duplicate wallet debit.
- **Transparent Reconciliation**: Complete adherence to the financial invariant:
  $$\text{purchased} \equiv \text{consumed} + \text{refunded} + \text{remaining}$$
- **Disclaimer**: We do not verify account ownership. Customers provide their target handle and confirm that platform delivery terms and risks are understood.

---

## 2. Platform Configurations & Supported Rules

The platform engine manages 6 platform configurations via `PlatformConfig` records:

| Platform | Display Name | Handle Regex | Handle Length | Allowed Hosts | Short-Link Handling |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `instagram` | Instagram | `^[a-zA-Z0-9._]{1,30}$` | 30 | `instagram.com`, `www.instagram.com` | Rejected |
| `tiktok` | TikTok | `^[a-zA-Z0-9._]{2,24}$` | 24 | `tiktok.com`, `www.tiktok.com` | `vt.tiktok.com` rejected |
| `youtube` | YouTube | `^[a-zA-Z0-9._-]{3,30}$` | 30 | `youtube.com`, `www.youtube.com` | `youtu.be` rejected |
| `facebook` | Facebook | `^[a-zA-Z0-9.]{5,50}$` | 50 | `facebook.com`, `www.facebook.com`, `fb.watch` | Short links rejected |
| `x` | X (Twitter) | `^[a-zA-Z0-9_]{1,15}$` | 15 | `x.com`, `www.x.com`, `twitter.com` | `t.co` rejected |
| `telegram` | Telegram | `^[a-zA-Z0-9_]{5,32}$` | 32 | `t.me`, `telegram.me` | Short links rejected |

### Link Normalization & MediaKey Extraction
1. **Offline Validation**: URLs are checked against host allowlists and path patterns. No network requests are made to scrape or fetch target media.
2. **MediaKey Uniqueness**:
   - Instagram: `/p/{key}/`, `/reel/{key}/` -> canonical `POST_{key}` or `REEL_{key}`.
   - TikTok: `/@user/video/{id}` -> canonical `VIDEO_{id}`.
   - YouTube: `/watch?v={id}`, `/shorts/{id}` -> canonical `VIDEO_{id}` or `SHORTS_{id}`.
   - Facebook: `/watch/?v={id}`, `/{user}/posts/{id}` -> canonical `POST_{id}`.
   - X: `/{user}/status/{id}` -> canonical `STATUS_{id}`.
   - Telegram: `/{channel}/{msgId}` -> canonical `POST_{channel}_{msgId}`.
3. **Anti-Collusion Blocklist**: Handles in `PlatformHandleBlocklist` are rejected during quote calculation and checkout.

---

## 3. Quote & Purchase Flow

### 3.1 Pure Quote Calculation
Endpoint: `POST /packages/quote`
- Validates handle format against target `PlatformConfig`.
- Enforces service applicability: profile services (followers/subscribers) require `PROFILE` target type; post services (likes/views) require `POST_OR_REEL`.
- Computes item charges in integer paise:
  $$\text{itemCharge} = \left\lceil \frac{\text{rateSnapshot} \times \text{totalQuantity}}{1000} \right\rceil$$
- Calculates total reserve as the sum of all item charges.
- Returns pure quote without mutating database state.
- Generates a cryptographically secure, deterministic canonical payload hash:
  `quoteHash`: `qh_v1_<expiresAtMs>_<hmac>` with a default 15-minute time-to-live.

### 3.2 Purchase Flow
Endpoint: `POST /packages`
- Requires explicit consent: `consentRulesUnderstood: true`.
- Requires `idempotencyKey` per user.
- **Quote Hash Integrity**: When `quoteHash` is provided (or when `PACKAGES_REQUIRE_QUOTE_HASH=true`), the backend recomputes the authoritative quote from database pricing and verifies that the quote has not expired and that service pricing, parameters, or schedule have not been tampered with. Tampered or expired quotes return HTTP 409 Conflict.
- Enforces active package constraints:
  - Max 5 distinct handles per user.
  - At most 1 `ACTIVE` package per `(platform, handle)` tuple.
- Atomically locks wallet, checks `balance >= reserveTotal`, debits wallet, creates `Package` row, `PackageRule` rows, and records `PACKAGE_PURCHASE` in the ledger.

### 3.3 Financial Correctness & Double-Refund Prevention
The package lifecycle uses a single canonical accounting utility (`package-accounting.util.ts`) that enforces the invariant:
$$\text{reserveTotal} \equiv \text{totalConsumed} + \text{totalAlreadyRefunded} + \text{netRefundDue}$$
- Partially delivered child orders (`remains > 0`) have their consumed charge computed as:
  $$\text{consumed} = \frac{\text{quantity} - \text{remains}}{\text{quantity}} \times \text{allocatedCharge}$$
- All prior refunds are tracked and subtracted from `netRefundDue`.
- Cancellation, expiry, or provider reconciliation will never refund more than the remaining refundable balance, making double refunds impossible.

### 3.4 Worker Concurrency & Execution Ownership
Worker dispatch claims use a PostgreSQL atomic transaction:
```sql
SELECT ... FROM "PackageExecution" e ...
WHERE e.id = $1 AND e."packageId" = $2 AND e.status = 'SCHEDULED' AND e."executeAt" <= $3
FOR UPDATE OF e SKIP LOCKED;
```
Combined with a compare-and-swap update (`if (claim.count !== 1) return false;`), concurrent workers skip locked rows without blocking or duplicating child orders.

### 3.5 Admin Queue & Monitoring
Endpoint: `GET /packages/admin/executions/queue`
- Protected by `JwtAuthGuard` and `RolesGuard(ADMIN)`.
- Supports pagination (`page`, `limit`), status filtering (`status`), and stable execution ordering (`executeAt ASC, id ASC`).
- Exposes operational execution data without leaking secrets, tokens, or customer wallet balances.

---

## 4. Drip Algorithms

### 4.1 Followers / Profile Drip Engine (`calculateFollowersDrip`)
- Input: `totalQuantity`, `durationDays`, `serviceMin`, `serviceMax`, `runsPerDay`, `minGapMinutes`.
- Runs calculation:
  $$\text{runs} = \min(\text{durationDays} \times \text{runsPerDay}, \lfloor \text{totalQuantity} / \text{serviceMin} \rfloor)$$
- Quantity per run: base quantity $\lfloor \text{totalQuantity} / \text{runs} \rfloor$, remainder added to the final run.
- Charge per run: base charge $\lfloor \text{totalCharge} / \text{runs} \rfloor$, remainder added to the final run.
- Schedule: timestamps spaced by intervals $\ge \text{minGapMinutes}$.

### 4.2 Per-Post Drip Engine (`calculatePerPostDrip`)
- Triggered upon customer post URL submission.
- Distributes chosen post quantity over `windowMinutes` across up to `maxRunsPerPost` runs.
- First run executes at `now`. Subsequent runs execute at `now + i * intervalMinutes`.
- Strict mathematical invariant: $\sum q_i = Q$, $\sum \text{allocatedCharge}_i = \text{charge}$.

---

## 5. Per-Post Start Flow

### 5.1 Preview Endpoint
`POST /packages/:id/triggers/preview`
- Validates package ownership and `ACTIVE` status.
- Validates post URL host and extracts `mediaKey`.
- Checks for duplicate trigger (`UNIQUE(packageId, mediaKey)`).
- Checks quota availability (`usedCount < maxPosts`) across applicable rules.
- Returns calculated delivery parameters, minimum gap, and run count for customer confirmation.

### 5.2 Start Execution Endpoint
`POST /packages/:id/triggers`
- Idempotent via `idempotencyKey` and `UNIQUE(packageId, mediaKey)`.
- Re-checks atomic quota inside a database transaction:
  ```sql
  UPDATE "PackageRule"
  SET "usedCount" = "usedCount" + 1
  WHERE id = $1 AND "usedCount" < "maxPosts"
  RETURNING id, "usedCount"
  ```
- Creates `PackageTrigger` record.
- Generates `PackageExecution` records with status `SCHEDULED`.

---

## 6. Worker Scheduler & Order Dispatch

A background worker scans due scheduled executions:
```sql
SELECT e.*, p.platform, p.handle, p.status as "packageStatus", p."endAt" as "packageEndAt"
FROM "PackageExecution" e
JOIN "Package" p ON e."packageId" = p.id
WHERE e.status = 'SCHEDULED' AND e."executeAt" <= NOW()
ORDER BY e."executeAt" ASC
LIMIT 25
FOR UPDATE OF e SKIP LOCKED;
```
- Dispatches child order with `isPrepaid = true` and `allocatedCharge = execution.allocatedCharge`.
- Marks execution `DISPATCHED`.

---

## 7. Financial Invariant & Settlement

Across all lifecycle phases (Active, Completed, Cancelled, Expired):
$$\text{purchased} \equiv \text{consumed} + \text{refunded} + \text{remaining}$$

### Cancellation
- `POST /packages/:id/cancel`
- Locks package row `FOR UPDATE`.
- Marks undispatched executions `CANCELLED`.
- Computes consumed amount from `DISPATCHED` and `COMPLETED` executions.
- Unused reserve $\max(0, \text{reserveTotal} - \text{consumed})$ is refunded to the customer wallet once.
- Idempotent refund record inserted into `Refund` table (`reason = "PACKAGE_CANCEL_UNUSED_RESERVE"`).

### Duration Expiry & Settlement
- When `NOW() >= package.endAt`:
- Remaining undispatched executions are marked `CANCELLED`.
- Unused reserve is refunded to the customer wallet once (`reason = "PACKAGE_SETTLEMENT_UNUSED_RESERVE"`).

### Prepaid Child Partial Refunds
If an upstream provider delivers partial fulfillment:
$$\text{partialRefund} = \left\lfloor \frac{\text{charge} \times \text{remains}}{\text{quantity}} + 0.5 \right\rfloor$$
Because `allocatedCharge > 0`, the partial refund is non-zero and accurately credited to the customer wallet.

---

## 8. Root Cause Documentation: Internal Server Error

All internal errors within the package lifecycle adhere to structured logging and error responses.

### Request Format
```http
POST /packages/pkg_abc123/triggers HTTP/1.1
Host: api.smm-panel.internal
Authorization: Bearer <token>
Content-Type: application/json
X-Request-Id: req_7f9b8c2d1e0a

{
  "url": "https://www.instagram.com/p/DF123456789/",
  "idempotencyKey": "idem_trigger_987",
  "chosenQuantity": 500
}
```

### Response Format (500 Error)
```json
{
  "statusCode": 500,
  "timestamp": "2026-10-21T05:30:00.000Z",
  "path": "/packages/pkg_abc123/triggers",
  "requestId": "req_7f9b8c2d1e0a",
  "message": "Internal server error"
}
```

### Log Line Structure (Server Console)
```json
{
  "timestamp": "2026-10-21T05:30:00.000Z",
  "level": "error",
  "requestId": "req_7f9b8c2d1e0a",
  "context": "PackagesService.triggerStart",
  "userId": "usr_998877",
  "packageId": "pkg_abc123",
  "mediaKey": "POST_DF123456789",
  "errorMessage": "Database transaction deadlock during parallel start allocation",
  "stack": "Error: ... at PackagesService.triggerStart (packages.service.ts:512)"
}
```

### User vs System Error Mapping
- **Validation Failures (400)**: Malformed URL, handle regex failure, or quantity out of bounds.
- **Unauthorized / Forbidden (401 / 403)**: Access token missing, invalid, or IDOR package access attempt.
- **Resource Not Found (404)**: Unknown package ID or target service ID.
- **Conflict / Concurrency (409)**: Media key already started or duplicate idempotency key.
- **Server Faults (500)**: Database connection failure or unexpected transaction abort with `requestId` preserved for log trace correlation.

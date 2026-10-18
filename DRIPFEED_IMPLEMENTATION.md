# Drip-Feed Provider-Native Implementation

## 1. Overview & Architectural Philosophy

The SMM platform implements **Provider-Native Drip-Feed** fulfillment. 

### Why Provider-Native?
A panel-side cron or scheduler that splits orders and dispatches individual runs manually introduces severe operational hazards:
- **Double-dispatch risks**: Worker crashes or restarts during run transitions can re-dispatch runs or miss runs.
- **Partial synchronization failures**: If run $k$ succeeds on upstream but the panel network blips before recording the ID, run $k$ is retried or left unmonitored.
- **Clock and Drift Hazards**: Jitter and race conditions across multiple scheduler instances.

In the **Provider-Native** approach:
1. The customer configures:
   - **Quantity per run** ($Q_{run}$)
   - **Number of runs** ($R$)
   - **Interval** ($I_{min}$, in minutes)
2. Total quantity is defined as:
   $$\text{TotalQuantity} = Q_{run} \times R$$
3. The panel passes `action=add`, `service`, `link`, `quantity` ($= Q_{run}$), `runs`, and `interval` directly to the upstream provider in a single atomic dispatch request.
4. The upstream provider executes the runs natively on its network and returns **one single upstream order ID**.
5. The panel monitors the aggregate progress via status polling and logs provider interactions in the `OrderProviderEvent` ledger.

---

## 2. Data Model & Schema Fields

### 2.1 Database Entities (`prisma/schema.prisma`)

#### `Service` Model
- `dripFeedSupported`: `Boolean` (default `false`). Set automatically from upstream provider `dripfeed: true` during catalog sync, admin can manually override.
- `dripFeedMinRuns`: `Int?` (nullable). Service-specific override for minimum allowable runs.
- `dripFeedMaxRuns`: `Int?` (nullable). Service-specific override for maximum allowable runs.
- `dripFeedMinInterval`: `Int?` (nullable). Service-specific override for minimum interval (minutes).
- `dripFeedMaxInterval`: `Int?` (nullable). Service-specific override for maximum interval (minutes).

#### `Order` Model
- `isDripFeed`: `Boolean` (default `false`). Indicates whether order is dispatched as a native drip-feed.
- `runs`: `Int?` (nullable). Number of runs requested ($R$).
- `intervalMinutes`: `Int?` (nullable). Interval between runs in minutes ($I_{min}$).
- `quantityPerRun`: `Int?` (nullable). Per-run quantity ($Q_{run}$).
- `totalQuantity`: `Int`. Total units delivered across all runs ($Q_{run} \times R$ for drip-feed, $Q$ for standard orders).
- `quantity`: Existing column repurposed to hold $Q_{run}$ for drip orders, preserving upstream API parameter mapping where `quantity` represents the per-run amount.

#### `OrderProviderEvent` Model
Audit trail of provider interactions:
- `id`: `String` (CUID/UUID primary key).
- `orderId`: Foreign key to `Order`.
- `providerId`: Foreign key to `Provider`.
- `eventType`: `DISPATCH_REQUEST`, `DISPATCH_RESPONSE`, `STATUS_SYNC`, `CANCEL_REQUEST`, or `REFILL_REQUEST`.
- `payload`: Redacted request parameters (API tokens replaced with `[REDACTED]`).
- `response`: Upstream provider JSON response.
- `errorMessage`: Sanitized upstream error string if rejected.
- `createdAt`: `DateTime`.

---

## 3. Limits & Global Settings

Global limits are managed via `SettingsService` and editable by administrators:
- `DRIPFEED_ENABLED`: Feature flag (`Boolean`, default `true`).
- `DRIPFEED_MIN_RUNS`: Default `2` runs.
- `DRIPFEED_MAX_RUNS`: Default `100` runs.
- `DRIPFEED_MIN_INTERVAL`: Default `5` minutes.
- `DRIPFEED_MAX_INTERVAL`: Default `1440` minutes (24 hours).

### Validation Fallback Cascade
When validating an order, the system evaluates:
1. `effectiveMinRuns = service.dripFeedMinRuns ?? global.DRIPFEED_MIN_RUNS`
2. `effectiveMaxRuns = service.dripFeedMaxRuns ?? global.DRIPFEED_MAX_RUNS`
3. `effectiveMinInterval = service.dripFeedMinInterval ?? global.DRIPFEED_MIN_INTERVAL`
4. `effectiveMaxInterval = service.dripFeedMaxInterval ?? global.DRIPFEED_MAX_INTERVAL`

---

## 4. Financial Calculation & Rounding Rules

All monetary calculations use `decimal.js` with 18 decimal places of internal precision and round **UP** (`Decimal.ROUND_UP`) to 2 decimal places to guarantee the business never undercharges:

```typescript
export function calculateOrderCharge(ratePer1000: string | number, quantity: number, runs?: number): string {
  const unitsPerRun = new Decimal(quantity);
  const totalUnits = runs && runs > 1 ? unitsPerRun.times(runs) : unitsPerRun;
  const rate = new Decimal(ratePer1000);
  const rawCharge = totalUnits.times(rate).dividedBy(1000);
  return rawCharge.toDecimalPlaces(2, Decimal.ROUND_UP).toFixed(2);
}
```

### Example Calculations:
- Rate: ₹70.00 / 1000, 100 units/run, 5 runs = 500 units total:
  $$\text{Charge} = \frac{500 \times 70.00}{1000} = ₹35.00$$
- Rate: ₹26.05 / 1000, 88 units/run, 2 runs = 176 units total:
  $$\text{Raw} = \frac{176 \times 26.05}{1000} = 4.5848 \implies ₹4.59 \text{ (Rounded UP)}$$

---

## 5. Refunds & Remainder Semantics

### 5.1 Provider Behavior & Remainder Semantics
In standard upstream SMM APIs (e.g. cheapestsmmpanels, JAP, SMM-World):
- When an upstream order is returned with status `Partial`, the provider's `remains` field represents the **total undelivered units across all runs**, not the per-run undelivered amount.
- For example, if an order of 100 units x 5 runs (500 total) delivered 3 runs (300 units) and then stalled, upstream reports `remains: 200`.

### 5.2 Proportional Refund Math
Refunds are calculated strictly against `totalQuantity`:
$$\text{ProportionalRefund} = \min\left(\text{Charge}, \frac{\text{Remains}}{\text{TotalQuantity}} \times \text{Charge}\right)$$

Calculated with Decimal and rounded **DOWN** (`Decimal.ROUND_DOWN`) to prevent over-crediting:
```typescript
const proportionalRefund = new Decimal(remains)
  .dividedBy(new Decimal(totalQuantity))
  .times(new Decimal(order.charge))
  .toDecimalPlaces(2, Decimal.ROUND_DOWN);
```

### 5.3 Provider Rejection Auto-Refund
If the upstream provider rejects the dispatch (e.g. `Incorrect quantity`, `Interval too small`, or `Service does not support drip-feed`), the worker:
1. Records the rejection reason in `OrderProviderEvent`.
2. Marks the order `FAILED`.
3. Issues a 100% full refund of the order charge back to the customer's wallet via the atomic double-entry ledger.

---

## 6. Watchdog & Stuck Order Protection

Standard orders have a 24-hour stuck-in-processing threshold. Because drip-feed orders take hours or days to complete naturally:
$$\text{WatchdogThreshold} = 24\text{h} + ((\text{runs} - 1) \times \text{intervalMinutes})$$
This prevents legitimate ongoing drip campaigns from being prematurely flagged as stalled or refunded while runs are actively executing upstream.

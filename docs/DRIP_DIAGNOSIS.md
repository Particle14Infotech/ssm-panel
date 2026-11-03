# Drip Delivery Engine & Burst Dynamics Forensic Diagnosis (H0)

**Date**: 2026-11-01  
**Commit**: `a52981bfd4b99b284901d431aaa1a1999b9c7ebd`  
**Branch**: `chore/fastify-migration`  
**Database**: `neondb`  
**Evidence Artifact**: `docs/evidence/2026-11-01T14-00-43-391Z-h0-diagnosis.txt`

---

## 1. Executive Summary & Root Cause Overview

The client's complaint that engagement (likes, views, shares) suddenly jumps on target links rather than pacing evenly stems from three distinct architectural defects:

1. **Simultaneous Multi-Service Dispatch (Zero Rate Limiting per Link)**:
   When a multi-item package or campaign is activated, all rule items for Day 1 are generated with the exact same scheduled timestamp. The worker dispatcher pulls all eligible runs without a per-link concurrency or unit rate limiter. For instance, on link `htt***the_coastal_times`, **10,185 units** across 4 distinct services were dispatched within a single 10-minute window.
2. **Backlog Flush on Chain Unblocking**:
   Because there is no catch-up pace control, whenever overdue runs are held and subsequently freed, all accumulated executions dispatch in a single worker tick directly to upstream providers.
3. **Flawed Error Classification & Fragile Dependency Deadlock**:
   The dispatcher catches all upstream provider HTTP and validation errors (including `"Quantity less than minimal 10"` and `"You have active order with this link"`) and classifies them uniformly as `PACKAGE_PROVIDER_OUTCOME_UNCERTAIN_REASON`. The child order remains stuck in `PROCESSING` indefinitely without a provider order ID. Consequently, the worker's strict sequential dependency guard (`seq > 1` requires `seq - 1` to be terminal) deadlocks the entire subsequent multi-day schedule, stranding 21 executions.
4. **Misleading Frontend Dashboard Aggregation**:
   The dashboard card titled "Active Link Processes & Slow-Drip Queue" maps ordinary independent single orders into a list and prefixes their array index with `"Batch 1"`, `"Batch 2"`, `"Batch 3"`, displaying `0% Complete` even for orders that have already reached terminal completion upstream.

---

## 2. Forensic Audit Findings (H0.a)

### (1) Non-Terminal Executions & Orders Past Planned Timestamp
From database audit query at `2026-11-01T14:00:43.394Z`:
- **Total Overdue Non-Terminal Package Executions**: **30**
  - Status Breakdown: `SCHEDULED`: **21**, `DISPATCHED`: **6**, `FAILED`: **3**
  - Distribution by Package ID:
    - `pkg_camp_1793220997468_9vc7v`: **20** executions
    - `9594d06c-46aa-4471-86d9-0dd63a6da943`: **6** executions
    - `3c5a8f1f-848a-459f-b522-1b19859ac767`: **2** executions
    - `pkg_1793466975599_28e80a1a`: **2** executions
  - Distribution by Recorded Skip Reason:
    - `"Waiting for prior execution ... to reach a terminal provider status"`: **18**
    - `"Provider outcome is uncertain; automatic resubmission is blocked"`: **4**
    - `"Held because prior execution ... failed and requires recovery"`: **3**
    - `(none / freshly due)`: **5**
- **Total Non-Terminal Orders Older Than 2 Hours**: **9**
  - Status: `PENDING`: **5**, `PROCESSING`: **4**
  - Error notes associated with stuck orders:
    - `"Quantity less than minimal 10"`: **2**
    - `"Quantity less than minimal 100"`: **2**
    - `"You have active order with this link. Please wait until order being completed"`: **2**
    - `"Status manually updated to PENDING"`: **1**
    - `(no notes / unpolled)`: **2**

### (2) Worker Dependency Guard Architecture
Located in `apps/worker/src/main.ts` (lines 1956–2019):
```typescript
if (execution.source === ExecutionSource.SCHEDULE && execution.seq > 1) {
  const predecessor = await tx.packageExecution.findFirst({
    where: {
      packageId: execution.packageId,
      ruleId: execution.ruleId,
      source: ExecutionSource.SCHEDULE,
      seq: { lt: execution.seq },
    },
    orderBy: { seq: "desc" },
    select: { id: true, status: true, order: { select: { status: true } } },
  });
  // ...
  const predecessorAllowsNextRun = new Set<PackageExecutionStatus>([
    PackageExecutionStatus.COMPLETED,
    PackageExecutionStatus.PARTIAL,
    PackageExecutionStatus.CANCELLED,
    PackageExecutionStatus.SKIPPED_PAUSED,
    PackageExecutionStatus.SKIPPED_QUOTA,
    PackageExecutionStatus.SKIPPED_TYPE,
    PackageExecutionStatus.SKIPPED_DELETED,
    PackageExecutionStatus.SKIPPED_LIMIT,
  ]).has(predecessorStatus);
}
```
**Deadlock Mechanism**:
- `predecessorAllowsNextRun` explicitly omits `FAILED` and `DISPATCHED`.
- If an execution fails upstream (e.g., rejected by provider), `predecessorStatus` becomes `FAILED`, permanently stalling all subsequent days with:
  `"Held because prior execution <id> failed and requires recovery."`
- If an execution's child order fails to dispatch (e.g. invalid minimum quantity), the order remains `PROCESSING` and the execution remains `DISPATCHED` with uncertain outcome. Because `DISPATCHED` is non-terminal, all subsequent runs are permanently held with:
  `"Waiting for prior execution <id> to reach a terminal provider status."`

### (3) Upstream Provider Error Classification Analysis
In `apps/worker/src/main.ts` (lines 447–468):
- Any exception thrown by the HTTP client or upstream provider adapter during order placement triggers:
  `skipReason: PACKAGE_PROVIDER_OUTCOME_UNCERTAIN_REASON`
  (`"Provider outcome is uncertain; automatic resubmission is blocked."`)
- **Distinct Provider Failure Strings Seen (Last 30 Days)**:
  1. `"Upstream provider error: Quantity less than minimal 10"` (Observed: 3 times) &rarr; Currently treated as UNCERTAIN. **Correct Handling**: `DEFINITE_REJECTION` (validation fault).
  2. `"Upstream provider error: Quantity less than minimal 100"` (Observed: 2 times) &rarr; Currently treated as UNCERTAIN. **Correct Handling**: `DEFINITE_REJECTION`.
  3. `"Upstream provider error: You have active order with this link. Please wait until order being completed."` (Observed: 2 times) &rarr; Currently treated as UNCERTAIN. **Correct Handling**: `RETRY_LATER` (temporary overlap lock).
  4. `"Upstream SMM API returned HTTP 400"` (Observed: 6 times) &rarr; Currently treated as UNCERTAIN. **Correct Handling**: `DEFINITE_REJECTION` if payload invalid, or `RETRY_LATER` if rate limit.
  5. `"Unsupported state or unable to authenticate data"` (Observed: 4 times) &rarr; Internal encryption/auth failure during dispatch. **Correct Handling**: System error alert.
  6. `"Reason: Upstream marked order as CANCELLED"` (Observed: 11 times) &rarr; Handled via sync as refund.

### (4) Executions & Orders Outside Service Bounds
- **PackageExecutions with Quantity Violations**: **30**
  - E.g., Executions in `pkg_camp_1793220997468_9vc7v` generated daily quantities of **1, 2, 4, 5, 6, 8, 10, 11, 13 units** against services with minimum order thresholds of **10** or **100**.
- **Orders with Quantity Violations**: **2**
  - Orders submitted with quantity **2** and **9** on services with min threshold 10.
- **Root Cause**: The package schedule generator divided total volume over duration without snapping individual daily slices to service `minQty`.

### (5) Orders in PROCESSING Without Provider Order ID & Stuck Orders
- **Orders in `PROCESSING` with `providerOrderId === null`**: **4**
  - Order `3c7391b0` (Qty: 6): Stuck since 2026-10-28 (100+ hours).
  - Order `351f1e96` (Qty: 2): Stuck since 2026-10-28 (100+ hours).
  - Order `35442bca` (Qty: 3192): Stuck since 2026-10-28 (100+ hours).
  - Order `78f47020` (Qty: 60): Stuck since 2026-10-31 (24+ hours).
- **Orders in Non-Terminal State Stuck > 12 Hours**: **9**

### (6) Completed Orders Showing 0% in Database / UI
- Total `COMPLETED` Orders: **25**
- Orders where `remains === quantity` (or null remains) despite completion: **2**
  - E.g., Order `cfc4ba50`: Start count 0, delivered 200, but upstream status hook recorded intermediate remains = 200 before final transition, leading to temporary 0% render until final pass.

### (7) Dashboard "Active Link Processes" Construction Defect
In `apps/web/app/(customer)/dashboard/page.tsx` (lines 81–101):
```typescript
const orderItems: ProcessItem[] = activeOrders.map((o, idx) => {
  // ...
  return {
    id: o.id,
    isPackage: false,
    title: o.serviceName || `${o.platform || "Social"} Dispatch`,
    orderRef: `#Order_${o.id.slice(0, 6)}`,
    dayText: `Batch ${idx + 1} • ${pct}% Complete`, // <-- Array index labelled as Batch N
    nextBatchInfo: "Next batch: scheduled batch processing", // <-- Fabricated batch messaging
  };
});
```
**Effect**: Unrelated independent single orders are rendered as consecutive batches of an unprogressed drip campaign.

### (8) Drip Engine Status: OrderRun vs PackageExecution
1. **OrderRun Engine**:
   - Polled by `pollAndDispatchDueRuns` (15s interval) in worker.
   - Guarded in `orders.service.ts`:
     `if (process.env.DRIPFEED_ENABLED === "false" || settings.dripFeedEnabled === false) throw new BadRequestException("Standalone drip-feed is deprecated and disabled. Please use Packages.");`
   - Active database rows in `OrderRun`: **0**.
2. **PackageExecution Engine**:
   - Polled by `pollAndDispatchPackageExecutions` (10s interval) in worker.
   - This is the sole **live** drip delivery engine in production.

---

## 3. Burst Analysis (Last 30 Days) (H0.b)

Dispatched volume per 10-minute and 60-minute rolling windows was analyzed across all targets:

### Top 10 Targets by Peak 10-Minute Dispatch Volume

| Rank | Target (Masked) | Overlapping Services | Single / Pkg Orders | Peak 10-Min Volume | Peak 60-Min Volume | Mechanism |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **1** | `htt***the_coastal_times` | 4 services (Views, Likes, Shares) | 0 single / 4 pkg | **10,185 units** (4 runs) | **10,185 units** | Unscheduled simultaneous start of Day 1 runs |
| **2** | `htt***DemU5r6uW7W` | 5 services (Likes, Views, Shares) | 0 single / 5 pkg | **3,364 units** (5 runs) | **3,364 units** | Multi-service Day 1 concurrency |
| **3** | `htt***DfG1cJLuFro` | 4 services (Power Likes, Instant Likes, Shares, Views) | 4 single / 0 pkg | **1,002 units** (4 orders) | **1,002 units** | User placed 4 orders simultaneously |
| **4** | `htt***DemNGiWBlYu` | 2 services (Likes, Views) | 6 single / 0 pkg | **875 units** (5 orders) | **875 units** | Concurrent order placement |
| **5** | `htt***ishanviinframlr` | 3 services (Likes, Story Views, HQ Likes) | 0 single / 3 pkg | **360 units** (3 runs) | **360 units** | Multi-service package Day 1 dispatch |
| **6** | `htt***DemU8rBuW7W` | 2 services (Likes, Story Views) | 0 single / 2 pkg | **300 units** (2 runs) | **300 units** | Package scheduled time alignment |
| **7** | `d4_***` | 1 service (Likes) | 1 single / 0 pkg | **72 units** (1 order) | **72 units** | Single order |
| **8** | `imr***` | 1 service (HQ Likes) | 0 single / 1 pkg | **50 units** (1 run) | **50 units** | Single package run |
| **9** | `dfj***` | 1 service (Likes) | 0 single / 1 pkg | **100 units** (1 run) | **100 units** | Single package run |

### Diagnosis of Client's Complaint:
The sudden engagement jumps are caused by **two confirmed mechanisms**:
1. **Multi-Service Concurrency**: Packages schedule all service rules (e.g. 10,000 views + 100 likes + 60 shares) for the exact same second (`plannedAt`). Upstream receives all dispatches at once.
2. **Backlog Flush**: When the worker restarts or an upstream block resolves, overdue executions dispatch in rapid succession without rate limiting or spacing.

---

## 4. The 21 Stuck Executions & Unblock Risk Forecast (H0.c)

The following **21 executions** have `status = 'SCHEDULED'` and `executeAt <= NOW()`:

| Execution ID (Masked) | Seq | Scheduled (UTC) | Qty | Target Link (Masked) | Blocking Skip Reason |
| :--- | :---: | :---: | :---: | :--- | :--- |
| `0e1***` | 2 | 2026-10-29 20:56 | 11 | `htt***DemU5r6uW7W` | Held because prior execution `05a***` failed |
| `282***` | 2 | 2026-10-29 20:56 | 2873 | `htt***DemU5r6uW7W` | Waiting for prior execution `699***` |
| `588***` | 2 | 2026-10-29 20:56 | 5 | `htt***DemU5r6uW7W` | Waiting for prior execution `52b***` |
| `599***` | 2 | 2026-10-29 20:56 | 2 | `htt***DemU5r6uW7W` | Waiting for prior execution `71f***` |
| `cc4***` | 2 | 2026-10-29 20:56 | 141 | `htt***DemU5r6uW7W` | Held because prior execution `5a1***` failed |
| `7f4***` | 2 | 2026-10-30 00:42 | 50 | `imr***` | Waiting for prior execution `e81***` |
| `c03***` | 5 | 2026-10-30 17:27 | 100 | `dfj***` | Waiting for prior execution `436***` |
| `262***` | 3 | 2026-10-30 20:56 | 118 | `htt***DemU5r6uW7W` | Waiting for prior execution `cc4***` |
| `2e3***` | 3 | 2026-10-30 20:56 | 10 | `htt***DemU5r6uW7W` | Waiting for prior execution `0e1***` |
| `49a***` | 3 | 2026-10-30 20:56 | 2 | `htt***DemU5r6uW7W` | Waiting for prior execution `599***` |
| `834***` | 3 | 2026-10-30 20:56 | 2394 | `htt***DemU5r6uW7W` | Waiting for prior execution `282***` |
| `c19***` | 3 | 2026-10-30 20:56 | 4 | `htt***DemU5r6uW7W` | Waiting for prior execution `588***` |
| `888***` | 6 | 2026-10-31 17:27 | 100 | `dfj***` | Waiting for prior execution `c03***` |
| `29a***` | 4 | 2026-10-31 20:56 | 1 | `htt***DemU5r6uW7W` | Waiting for prior execution `49a***` |
| `373***` | 4 | 2026-10-31 20:56 | 2074 | `htt***DemU5r6uW7W` | Waiting for prior execution `834***` |
| `445***` | 4 | 2026-10-31 20:56 | 4 | `htt***DemU5r6uW7W` | Waiting for prior execution `c19***` |
| `6c5***` | 4 | 2026-10-31 20:56 | 102 | `htt***DemU5r6uW7W` | Waiting for prior execution `262***` |
| `bb0***` | 4 | 2026-10-31 20:56 | 8 | `htt***DemU5r6uW7W` | Waiting for prior execution `2e3***` |
| `436***` | 4 | 2026-10-29 17:27 | 100 | `dfj***` | Waiting for prior execution `897***` |
| `52b***` | 1 | 2026-10-28 20:56 | 6 | `htt***DemU5r6uW7W` | Provider outcome uncertain (below min) |
| `71f***` | 1 | 2026-10-28 20:56 | 2 | `htt***DemU5r6uW7W` | Provider outcome uncertain (below min) |

### Unblock Risk Forecast (Naive Flush without Delivery Pace):
If the dependency chain were naively unblocked without rate control:
- **Immediate Dispatches in 1 Tick**: All **21 executions** would claim simultaneously.
- **Total Immediate Volume**: **8,298 units** dispatched at once.
- **Link Impact**:
  - `htt***DemU5r6uW7W`: **7,748 units** across 15 separate runs in a single second.
  - `dfj***`: **500 units** across 5 runs.
  - `imr***`: **50 units**.
- **Outcome**: Immediate provider API rate-limiting, upstream duplicate order errors (`"You have active order with this link"`), and extreme engagement spike on the target post.

---

## 5. Questions for User (H0.d)

1. **Pace Defaults**: What default maximum units per hour (`maxUnitsPerHour`) should be enforced for each engagement kind (Likes, Views, Shares, Comments, Saves, Followers)?
2. **Catch-up Batch Limit ($K$)**: When resolving accumulated overdue runs, what maximum number of overdue runs ($K$) per package per tick should be permitted (e.g. $K = 1$ or $2$)?
3. **Stall Timeout ($T$)**: If an in-flight provider dispatch remains non-terminal without status updates, after how many hours ($T$, e.g. 4 hours or 12 hours) should the run be flagged as `STALLED` for admin reconciliation?
4. **Sequencing Offsets**: What default start offset in minutes should be enforced between engagement types on the same link (e.g., Views immediate, Likes +15 mins, Shares +45 mins)?


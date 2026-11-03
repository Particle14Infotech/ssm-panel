# INCIDENT REPORT: Package Dispatch Queue Starvation & Operator 42883

**Date:** 2026-11-02  
**Incident Severity:** P0 (Queue Dispatch Stalled Across All Multi-Day Packages)  
**Git Commit:** `a52981bfd4b99b284901d431aaa1a1999b9c7ebd`  
**Git Branch:** `chore/fastify-migration`  
**Database:** `neondb` (PostgreSQL AWS ap-southeast-1)  
**Status:** I0 CONFIRM, READ-ONLY INVESTIGATION COMPLETE (STOP POINT REACHED)

---

## 1. Error 42883 Telemetry & Origin

- **First Occurrence in Worker Logs:** `2026-11-01T20:32:39.225Z` (79 seconds after the per-link delivery limiter deployment).
- **Most Recent Occurrence:** `2026-11-02T14:53:09.183Z`.
- **Total Error Occurrences:** **5,863 times** (repeating every ~30 seconds per candidate).
- **Per-Hour Incident Breakdown:**
  - `2026-11-01 20:00 - 21:00 UTC`: 237 errors
  - `2026-11-01 21:00 - 22:00 UTC`: 360 errors
  - `2026-11-01 22:00 - 23:00 UTC`: 360 errors
  - `2026-11-01 23:00 - 00:00 UTC`: 360 errors
  - `2026-11-02 00:00 - 01:00 UTC`: 360 errors
  - `2026-11-02 01:00 - 02:00 UTC`: 360 errors
  - `2026-11-02 02:00 - 03:00 UTC`: 360 errors
  - `2026-11-02 03:00 - 04:00 UTC`: 360 errors
  - `2026-11-02 04:00 - 05:00 UTC`: 360 errors
  - `2026-11-02 05:00 - 06:00 UTC`: 360 errors
  - `2026-11-02 06:00 - 07:00 UTC`: 360 errors
  - `2026-11-02 07:00 - 08:00 UTC`: 360 errors
  - `2026-11-02 08:00 - 09:00 UTC`: 360 errors
  - `2026-11-02 09:00 - 10:00 UTC`: 360 errors
  - `2026-11-02 10:00 - 11:00 UTC`: 360 errors
  - `2026-11-02 11:00 - 12:00 UTC`: 360 errors
  - `2026-11-02 12:00 - 13:00 UTC`: 360 errors
  - `2026-11-02 13:00 - 14:00 UTC`: 360 errors
  - `2026-11-02 14:00 - 15:00 UTC`: 316 errors (up to script check)
- **Originating Commit & Deploy:** Introduced during commit `a52981b` in `apps/worker/src/main.ts` line 2201 within `canDispatchUnitsOnLink` verification block.
- **Evidence Reference:** [20261102-i0-worker-error-42883.txt](file:///d:/projects/internship%20projects/SMM/docs/evidence/20261102-i0-worker-error-42883.txt)

---

## 2. Overdue Executions & Queue Window Starvation

- **Total Overdue `SCHEDULED` Executions:** **35 executions** currently have `executeAt <= NOW()`.
- **Breakdown of the First 25 Queue Candidates (`take: 25`, `orderBy: executeAt ASC`):**
  - **Non-dispatchable (22 executions):** 22 executions are blocked by predecessor dependency (`Waiting for prior execution ... to reach a terminal provider status`). Because their predecessors are neither completed nor cancelled, these 22 executions evaluate to `false` in the dispatch loop, but **remain in `status: 'SCHEDULED'` with `executeAt` unchanged in the past**.
  - **Dispatchable (3 executions):** Exactly 3 executions have completed predecessors and are ready for dispatch (`pkg_1793542883478_2a21679b` Day 2 batches #04, #05, #06).
- **The Starvation Mechanism:**
  1. Every 30 seconds, `database.packageExecution.findMany({ where: { status: 'SCHEDULED', executeAt: { lte: now } }, take: 25, orderBy: { executeAt: 'asc' } })` selects the exact same 25 rows.
  2. The 22 blocked executions return `false` without updating `executeAt`.
  3. The 3 dispatchable executions hit the raw SQL query with un-cast enum comparison, raising error `42883`. The transaction rolls back, leaving their status as `SCHEDULED` and `executeAt` unchanged.
  4. The candidate window of 25 is 100% saturated. Any newer customer package executions (at positions 26+) are completely starved and never queried.
- **Oldest Dispatchable Execution per Real Customer Package:**
  - `pkg_1793542883478_2a21679b` (User `Bho...`, target `ins.../dfmallpsocm`):
    - Batch #04 (`cly...4`): Position 23 in queue, age ~19.5 hours overdue.
    - Batch #05 (`cly...5`): Position 24 in queue, age ~19.5 hours overdue.
    - Batch #06 (`cly...6`): Position 25 in queue, age ~19.5 hours overdue.
  - Subsequent packages (positions 26–35): 10 executions starved behind the top 25 window.
- **Evidence Reference:** [20261102-i0-overdue-executions.txt](file:///d:/projects/internship%20projects/SMM/docs/evidence/20261102-i0-overdue-executions.txt)

---

## 3. Tick Code Path Analysis

- **File & Function:** `apps/worker/src/main.ts` lines 1970–2275 (`processPackageExecutions`).
- **Loop Concurrency & Isolation:**
  - Candidates are iterated sequentially: `for (const candidate of (dueCandidates || []))`.
  - **Each candidate executes in its own isolated transaction:** `await database.$transaction(async (tx) => { ... })`.
  - **Error Isolation:** The loop wraps each candidate in `try { ... } catch (err: any) { errorsCount++; logger.error(...) }`. An unhandled exception or SQL error in candidate $i$ does NOT terminate the loop; processing continues to candidate $i+1$.
- **The Fatal Flaw in Error Handling:**
  - In the `catch` block (line 2272), there is **zero state mutation** on the failing execution:
    - `candidate.status` is NOT changed.
    - `candidate.attempts` is NOT incremented.
    - `candidate.nextAttemptAt` is NOT set.
    - `candidate.skipReason` is NOT recorded.
  - As a result, the failing candidate remains eligible on the next tick 30 seconds later, permanently blocking the `take: 25` queue.
- **Evidence Reference:** [20261102-i0-code-audit.txt](file:///d:/projects/internship%20projects/SMM/docs/evidence/20261102-i0-code-audit.txt)

---

## 4. Backlog Analysis & Burst Forecast if Only Cast is Fixed

- **Execution Origins:**
  - 10 executions belong to historical test campaigns (User `usr_admin_test...` / `dev_test...`) created during development between Oct 27 and Nov 1.
  - 25 executions belong to customer packages (including Bholu's package `pkg_1793542883478_2a21679b`).
- **Forecast: What Happens in Tick 1 if ONLY Typecast is Fixed?**
  - **Tick 1 Dispatch:**
    - The 3 dispatchable executions at positions 23, 24, and 25 (Bholu Day 2 batches #04, #05, #06) will pass the limiter and dispatch immediately:
      - Batch #04: 40 units Likes -> upstream provider.
      - Batch #05: 1,000 units Views -> upstream provider.
      - Batch #06: 11 units Shares -> upstream provider.
    - However, the 22 non-dispatchable executions at positions 1–22 **will still remain `SCHEDULED` in the `take: 25` window**!
    - Only 3 slots will be freed in the 25-slot window. Positions 26, 27, and 28 will enter the window, while positions 1–22 continue to consume 88% of the selection capacity every tick.
  - **Upstream Balance & Cost Risk:**
    - If historical test executions are left un-gated, once their predecessors are unlocked or cleaned, they will dispatch to real provider endpoints and consume real prepaid funds.
- **Evidence Reference:** [20261102-i0-forecast-backlog.txt](file:///d:/projects/internship%20projects/SMM/docs/evidence/20261102-i0-forecast-backlog.txt)

---

## 5. Predecessor Hold Rule & Sequential Blocking

- **File & Location:** `apps/worker/src/main.ts` lines 2087–2151.
- **Logic:**
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
      ...
    });
    ...
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

    if (!predecessorAllowsNextRun) {
      // Sets skipReason but leaves status as SCHEDULED and returns false
      return false;
    }
  }
  ```
- **Consequences:**
  - `FAILED` is NOT an allowed predecessor status. If Batch $N$ fails, Batch $N+1 \dots M$ are permanently held.
  - Because held executions remain `status: SCHEDULED` with `executeAt` in the past, they are perpetually re-fetched by `take: 25`, clogging the queue indefinitely.
- **Evidence Reference:** [20261102-i0-code-audit.txt](file:///d:/projects/internship%20projects/SMM/docs/evidence/20261102-i0-code-audit.txt)

---

## 6. Watchdog Unconfirmed Order Auto-Recovery

- **File & Location:** `apps/worker/src/main.ts` lines 746–785 (`syncNonFinalOrders`).
- **Logic:**
  - Queries `Order` where `packageExecutionId != null`, `status IN ('PENDING', 'PROCESSING')`, `providerOrderId == null`, and `createdAt <= NOW() - 5 minutes`.
  - Marks the child order as `CANCELLED`.
  - Resets the `PackageExecution` back to `status: SCHEDULED, orderId: null, executeAt: new Date(), skipReason: "Auto-recovered..."`.
- **Double-Delivery Risk:**
  - **The watchdog does NOT query the provider before cancelling and re-queueing!**
  - If a network timeout occurred after the upstream provider accepted the order but before the worker saved `providerOrderId`, cancelling and re-queueing will send a **duplicate order**, causing double delivery and charging the wallet twice.
- **Evidence Reference:** [20261102-i0-code-audit.txt](file:///d:/projects/internship%20projects/SMM/docs/evidence/20261102-i0-code-audit.txt)

---

## 7. Raw SQL Audit ($queryRaw, $executeRaw, Unsafe)

- **Total Raw SQL Invocations Across Repository:** **44 call sites** (apps/worker: 8 sites; apps/api: 36 sites).
- **Audit Findings on Types & Enums:**
  - `apps/worker/src/main.ts:2201`: `AND s.kind = $2`
    - Column `s.kind` is PostgreSQL enum `"ServiceKind"`.
    - Bound parameter `$2` is JavaScript string (`execution.kind || "DEFAULT"`).
    - **CRITICAL REPRODUCTION FINDING:** Casting as `$2::"ServiceKind"` fails with `22P02: invalid input value for enum "ServiceKind": "DEFAULT"` whenever the fallback string `"DEFAULT"` is supplied.
    - Explicit cast `s.kind::text = $2` safely succeeds for all valid enum members and avoids type comparison crashes.
  - `apps/worker/src/main.ts:269`: `OutboxEvent` claim using `FOR UPDATE SKIP LOCKED` (Clean parameter types: integers).
  - `apps/worker/src/main.ts:656, 1147, 1483`: `Wallet` row lock (`WHERE "userId" = $1 FOR UPDATE`) (Clean string uuid).
  - `apps/worker/src/main.ts:2036`: `PackageExecution` row lock with `FOR UPDATE OF e SKIP LOCKED` (Clean uuid/timestamp parameters).
  - `apps/api/src/modules/packages/packages.service.ts`: Multiple row lock queries (`FOR UPDATE`) on `Package`, `PackageExecution`, `Order`, `Wallet` using string UUID parameters (Clean).
- **Evidence Reference:** [20261102-i0-code-audit.txt](file:///d:/projects/internship%20projects/SMM/docs/evidence/20261102-i0-code-audit.txt), [20261102-i0-reproduce-42883.txt](file:///d:/projects/internship%20projects/SMM/docs/evidence/20261102-i0-reproduce-42883.txt) & [20261102-i0-failing-test-gate.txt](file:///d:/projects/internship%20projects/SMM/docs/evidence/20261102-i0-failing-test-gate.txt)

---

## 8. Customer UI Stepper Logic & Lack of Delay Awareness

- **File & Location:** `apps/web/app/(customer)/packages/[id]/page.tsx` lines 1317–1345.
- **Logic:**
  ```tsx
  const nextTodayExec = executions.find((e: any) => e.status === "SCHEDULED" && e.executeAt);
  const todayTimeStr = nextTodayExec?.executeAt
    ? new Date(nextTodayExec.executeAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true })
    : null;
  ...
  {isPast ? "Completed" : isCurrent ? (todayTimeStr ? `Active (${todayTimeStr})` : "Active Today") : "Scheduled"}
  ```
- **Why Customer Sees "Active (At 7:51 PM)" When Nothing Is Dispatching:**
  - The UI stepper looks for the first execution with `status === "SCHEDULED"` and extracts its `executeAt` time (`7:51 PM`).
  - It displays `Active (At 7:51 PM)` regardless of whether current time is `8:30 PM`, `11:00 PM`, or the next day!
  - It has zero delay awareness: it does not check if `executeAt` is overdue (`executeAt <= Date.now()`), nor does it check if the queue is stalled.
- **Evidence Reference:** [20261102-i0-code-audit.txt](file:///d:/projects/internship%20projects/SMM/docs/evidence/20261102-i0-code-audit.txt)

---

## Conclusion & Stop Point Confirmation

Phase **I0 CONFIRM, READ-ONLY** is complete. All 8 items are verified with empirical evidence generated from the real PostgreSQL database and worker logs without modifying production state.

**Credential Disclosure:** The agent holds no production write credentials or active deployment processes. All actions have been executed strictly read-only.

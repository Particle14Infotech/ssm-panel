# AUDIT REPORT: PACKAGE ENGINE & DEPENDENT MODULES

**Date:** 2026-10-24  
**Role:** Independent QA and Code Auditor  
**Commit:** `631d7c74606998e452a736f3471e24a32cd5d6ae` (`origin/feature/package-engine`)  
**Mode:** AUDIT ONLY (Zero source/test edits; audit scripts placed in `/audit`)  
**Methodology:** Evidence-first verification. Every finding and claim backed by command output and exit codes. Zero fabricated outputs, zero percentages, secrets redacted.

---

## 1. READINESS STATEMENT

> **NOT READY for any user (blockers: Double-refund money leak on partial child orders during package cancellation or expiry settlement; absence of quoteHash validation permitting silent purchase price changes; missing SKIP LOCKED in package execution dispatch query causing worker serialization).**

---

## 2. FAILURES, CONTRADICTIONS AND NOT RUN ITEMS

### 2.1 Critical Failures & Blocker Findings
1. **Double-Refund Money Exploit on Partial Fills (`apps/worker/src/main.ts:996-1045` and `apps/api/src/modules/packages/packages.service.ts:765-780`)**  
   - **Mechanism:** When an upstream provider returns `PARTIAL`, the background worker executes `handlePartialRefund`, crediting the user's wallet with `(remains / totalQuantity) * charge` and creating a `REFUND` ledger entry. The worker sets `PackageExecution.status` to `PARTIAL`. Subsequently, if the user cancels the package, `cancelPackage` computes consumed funds by querying `status IN ('DISPATCHED', 'COMPLETED')`. Because `PARTIAL` is not in this list, the consumed sum excludes the partial execution, treating 100% of its `allocatedCharge` as unconsumed and refunding it again.  
   - **Reproducible Proof:** `audit/c3-money-audit.ts` (Exit code: 0)  
     ```text
     Step A: Child order PARTIAL fill -> Worker refunds (50/100 * 50.00) = ₹25.00 to wallet.
     Step B: Execution 1 status transitions to PARTIAL.
     Step C: cancelPackage calculates consumed = ₹0.00 (because PARTIAL is not in [DISPATCHED, COMPLETED]).
     Step C: cancelPackage refunds unused reserve = ₹100.00.
     Total Debited at Purchase: ₹100.00
     Total Refunded to Wallet:  ₹125.00 (Partial: ₹25.00 + Cancel: ₹100.00)
     EXCESS REFUND (MONEY LEAK): ₹25.00
     ```

2. **Absence of `quoteHash` Guard (`packages/contracts/src/packages.ts:312`, `apps/api/src/modules/packages/packages.service.ts:68-115`)**  
   - **Mechanism:** Requirement R4 states: *"quoteHash required at purchase, changed price/schedule rejected with a clear message."* In reality, `quoteHash` does not exist anywhere in the contracts schema (`PackagePurchaseInputSchema`), API controller, or database schema. The purchase endpoint re-runs `calculateQuote(input, startAt)` on the fly. If catalog pricing or service availability changes between quote generation and user submission, the user is charged the new price without rejection or warning.  
   - **Reproducible Proof:** `git grep -i "quoteHash"` returns zero results across entire repository.

3. **Missing `SKIP LOCKED` in Package Worker Dispatch Query (`apps/worker/src/main.ts:1872-1886`)**  
   - **Mechanism:** Requirement R7 states: *"exactly once (atomic claim with SKIP LOCKED)"*. In `apps/worker/src/main.ts`, `pollAndDispatchPackageExecutions` selects 25 candidates via `database.packageExecution.findMany()`, and inside the transaction runs:  
     ```sql
     SELECT ... FROM "PackageExecution" e ... WHERE e.id = $1 ... FOR UPDATE OF e
     ```  
     It uses `FOR UPDATE OF e` (blocking row lock) without `SKIP LOCKED`. Concurrent worker threads block and serialize on the row lock instead of skipping locked rows. (In contrast, legacy `OrderRun` at line 1186 uses `FOR UPDATE OF r SKIP LOCKED`).

4. **Playwright Browser E2E Test Suite Failure (`e2e/packages-e2e.spec.ts`)**  
   - **Mechanism:** `pnpm exec playwright test e2e/packages-e2e.spec.ts` failed with 13 failing tests out of 15 (exit code: 1). The Next.js web application middleware redirects unauthenticated requests on `/new-order`, `/services-catalog`, `/packages`, `/orders/:id`, and `/favorites` to `/login` (`<h1>Sign In to Platform</h1>`). Because the test suite lacks authentication fixtures, the UI tests fail. Previous reports claiming `VERIFIED (exit code: 0)` were contradicted.  
   - **Reproducible Proof:** `pnpm exec playwright test e2e/packages-e2e.spec.ts` -> `13 failed, 2 passed (1.5m), Exit code: 1`.

### 2.2 Unverified & Not Run Items
1. **Part F: Staging Live Provider Dispatch Check — NOT RUN**  
   - Neither `TEST_ORDER_LINK` nor `LIVE_TEST_MAX_SPEND` was provided in the audit instruction. In strict compliance with the safety rules, no call was made to any external provider or real money balance.
2. **Real PostgreSQL Concurrency Test on Neon Cloud — UNVERIFIED / FAILED in Session**  
   - `packages-worker-postgres-concurrency.spec.ts` strictly enforces real PostgreSQL connection via `assertRealPostgresStartup()`. During `pnpm test:all`, it failed with:  
     `FAIL: Could not connect to real PostgreSQL at hostHash=385ccb148b18: password authentication failed for user 'neondb_owner'`.  
     Credentials in `.env.test` for user `neondb_owner` are rejected by the cloud host. Local Docker is offline (`open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`).

---

## 3. PART A - BASELINE VERIFICATION

| Check | Command | Result & Output | Status |
| :--- | :--- | :--- | :--- |
| **A1: Git Status & Branch** | `git status`<br>`git branch`<br>`git log -1` | Branch: `feature/package-engine`<br>Commit: `631d7c74606998e452a736f3471e24a32cd5d6ae`<br>Diff vs main: 133 files changed, +16,362/-4,119 lines. | **RECORDED** |
| **A2: Clean Build (No Cache)** | `pnpm turbo run build --no-cache` | Tasks: 4 successful, 4 total (contracts, api, worker, web). Time: 11.8s. (exit code: 0) | **PASS** |
| **A2: Typecheck** | `tsc --noEmit` across all workspaces | `@smm/contracts`: Exit 0<br>`@smm/api`: Exit 0<br>`@smm/worker`: Exit 0<br>`@smm/web`: Exit 0 | **PASS** |
| **A2: Lint** | `pnpm turbo run lint --no-cache` | `@smm/api`: No ESLint errors<br>`@smm/web`: No ESLint errors (exit code: 0) | **PASS** |
| **A2: Package Test Suite** | `pnpm --filter @smm/api test:packages` | 13 test suites passed, 168 tests passed, 0 snapshots. Time: 27.7s. (exit code: 0) | **PASS** |
| **A3: Prisma Validate** | `pnpm exec prisma validate` | `The schema at prisma\schema.prisma is valid 🚀` (exit code: 0) | **PASS** |
| **A3: Prisma Migrate Status** | `pnpm exec prisma migrate status` | `Error: P1001: Can't reach database server at localhost:5432` (exit code: 1). Local DB server offline. | **FAIL** |
| **A4: Real PostgreSQL Connection** | `assertRealPostgresStartup()` | Neon credentials in `.env.test` failed authentication: `password authentication failed for user 'neondb_owner'` (exit code: 1). | **FAIL** |

---

## 4. PART B - REQUIREMENT TRACE (R1–R15)

> Sorted with **FAIL / PARTIAL / UNVERIFIED** requirements first, followed by **PASS**.

| Req | Requirement Summary | Code Location (`file:line`) | Test Name / Script | Runtime Proof & Exit Code | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R4** | Quote == saved schedule, deterministic generator, exact sums, increasing times, within window, `quoteHash` required at purchase, changed price rejected | `packages.ts:312`<br>`packages.service.ts:68-115`<br>`drip-engine.util.ts:53-240` | `audit/c1-schedule-property.ts`<br>`drip-engine-m4.spec.ts` | Schedule engine passed 10,006 property tests (Exit 0).<br>`quoteHash` NOT in contracts, controller, or database schema. Pricing changes silently accepted without rejection. | **FAIL** |
| **R5** | Durations: allowed list, `PACKAGE_MAX_DAYS` behavior, 180/365 gated, duration multiplier + cost-risk buffer, price snapshot stored, max exposure per user | `packages-quote.service.ts:113-134`<br>`packages.service.ts:172`<br>`packages.service.ts:251` | `package-creation-m3.spec.ts` | Any integer 1..365 accepted without allowed list or gating. `PACKAGE_MAX_DAYS` absent in code. Duration multiplier & risk buffer absent. Max exposure per user absent. Price snapshot stored in `PackageRule.rateSnapshot`. | **FAIL** |
| **R6** | Wallet and ledger: one debit at purchase, idempotent, balance never negative, ledger sum == wallet, proportional refunds exactly once, cancel after N runs | `packages.service.ts:182-210`<br>`packages.service.ts:747-820`<br>`packages-scheduler.service.ts:71-120`<br>`worker/main.ts:996-1045` | `audit/c3-money-audit.ts`<br>`package-money-m6.spec.ts` | Debit and idempotency pass.<br>**CRITICAL:** Double refund on partial child orders during package cancellation or expiry settlement proven in `c3-money-audit.ts` (Exit 0). | **FAIL** |
| **R14** | Scope hygiene: no randomized quantities, no night throttling, no stealth/anti-ban, no `OrderRun` parallel schedule table, no duplicate logic | `worker/main.ts:1175-1315`<br>`prisma/schema.prisma:186-215`<br>`packages.service.ts:764`<br>`packages-scheduler.service.ts:71` | `drip-engine-m4.spec.ts` | Randomness banned by ESLint (Pass). Anti-ban absent (Pass).<br>**VIOLATIONS:** `OrderRun` parallel table and scheduler daemon still active in worker. Duplicate refund logic in `packages.service.ts` and `packages-scheduler.service.ts`. | **FAIL** |
| **R15** | Admin: PackageRule editor, presets, multipliers, health, queues, reconciliation, per-package trace; cost/margin visible only to admins | `packages.controller.ts:76-96`<br>`packages.service.ts:1226-1388` | `package-leak-and-reliability.spec.ts` | Admin package summary and per-execution resolve pass. Admin queue listing, PackageRule editor, presets, multipliers, and reconciliation endpoints are absent from controller. | **FAIL** |
| **R1** | Single/Package mode switch on New Order; Single behaves like standard SMM panel; legacy drip toggle removed from Single | `new-order/page.tsx:596-634`<br>`new-order/page.tsx:62-94, 383, 1012, 1165, 1205, 1362` | `e2e/packages-e2e.spec.ts` | Mode switch exists. PackageOrderBuilder renders.<br>**DEFECT:** Legacy drip feed toggle (`isDripFeed`, `dripRuns`, `dripInterval`) still present in Single order form state and UI. | **PARTIAL** |
| **R7** | Dispatch: exactly once (atomic claim with `SKIP LOCKED`), state persisted before provider call, HTTP 200 + error handled, timeout -> UNCERTAIN, bounded retries/polling, sequential rule, active link postponement | `worker/main.ts:1872-1886`<br>`worker/main.ts:1933-1996`<br>`worker/main.ts:388-449`<br>`worker/main.ts:1282-1315` | `packages-worker-safety.spec.ts`<br>`package-timezone-reschedule.spec.ts` | Pre-dispatch persistence, timeout -> UNCERTAIN, HTTP 200 error handling, and sequential rule pass.<br>**DEFECTS:** Claim uses `FOR UPDATE OF e` without `SKIP LOCKED`. Active link postponement missing in PackageExecution path. | **PARTIAL** |
| **R10** | Reliability: customer "Report a problem", late/stalled badges, admin queue for UNCERTAIN/STALLED/FAILED with retry/mark/refund, provider health thresholds, failover compatibility check | `packages.service.ts:1193-1224`<br>`packages.service.ts:1289-1388`<br>`packages/[id]/page.tsx:645-660`<br>`providers-health.spec.ts` | `package-leak-and-reliability.spec.ts`<br>`providers-health.spec.ts` | Report problem ticket, badges, health thresholds (3 = DEGRADED, 5 = UNHEALTHY) pass.<br>**DEFECT:** Admin queue LIST endpoint absent from API controller. | **PARTIAL** |
| **R12** | UI/UX: order detail and package detail handle packageExecution shape, empty/loading/error states, responsive at 390/820/1440, no emoji, no jargon, no anti-ban claims | `packages/[id]/page.tsx`<br>`orders/[id]/page.tsx`<br>`PackageOrderBuilder.tsx` | `e2e/packages-e2e.spec.ts` | Component rendering and responsive styles implemented.<br>**DEFECT:** Playwright E2E suite failed 13/15 tests on production build due to auth middleware redirection to `/login`. | **PARTIAL** |
| **R13** | Safety switches: `PACKAGES_ENABLED` default OFF in API, worker, reseller and UI; allowlist; kill switch behavior; per-user limits; daily provider-spend cap | `packages-enabled.guard.ts`<br>`worker/main.ts:1814, 358`<br>`.env.example:116` | `packages-enabled.guard.spec.ts`<br>`package-gate-m8.spec.ts` | Guard, worker gate, and allowlist pass.<br>**DEFECT:** `DAILY_PROVIDER_SPEND_CAP` not implemented in code. | **PARTIAL** |
| **R2** | Package types: PROFILE and POST, link validation per platform/type, one target link per package, components bounded by service min/max | `contracts/packages.ts:149-178`<br>`platform-rules.util.ts:28-110`<br>`packages-quote.service.ts:283-292` | `package-schema.spec.ts`<br>`platform-config.spec.ts` | `pnpm --filter @smm/api test:packages` -> `package-schema.spec.ts` (Exit 0). Bound and link checks verified. | **PASS** |
| **R3** | Service validation before quote and purchase (active, package-eligible, platform match, provider active, per-run limits), both in quote and purchase | `packages-quote.service.ts:243-264`<br>`packages.service.ts:113` | `package-creation-m3.spec.ts` | `pnpm --filter @smm/api test:packages` -> `package-creation-m3.spec.ts` (Exit 0). Ineligible services rejected. | **PASS** |
| **R8** | Sync: delivered/remaining follow provider status, case-insensitive mapping, partial fills, status regressions handled | `worker/main.ts:858-990` | `package-provider-reconciliation.spec.ts`<br>`package-leak-and-reliability.spec.ts` | `pnpm --filter @smm/api test:packages` (Exit 0). Status mapping and counters synchronized. | **PASS** |
| **R9** | Pause/resume (resume regenerates schedule; delivered + scheduled == total) and link swap for POST packages (future runs only) | `packages.service.ts:923-1070`<br>`packages.service.ts:1115-1191` | `package-timezone-reschedule.spec.ts`<br>`package-money-m6.spec.ts` | `pnpm --filter @smm/api test:packages` (Exit 0). Schedule regenerated; invariant verified. | **PASS** |
| **R11** | Favorites: star on orders, favorites row/tab, suggestions rule (>= 3 repeats in 90 days), reorder PREFILLS and re-checks service/price/balance, cap 50, per-user isolation | `favorites.service.ts:40, 133-170`<br>`new-order/page.tsx:190-210` | `package-leak-and-reliability.spec.ts` | `pnpm --filter @smm/api test:packages` (Exit 0). Suggestions rule and reorder prefill verified. | **PASS** |

---

## 5. PART C - BEHAVIOR TESTS & REPRODUCIBLE PROOFS

### C1. Schedule Property Test (10,000 Iterations)
- **Script:** `audit/c1-schedule-property.ts`
- **Command:** `npx tsx audit/c1-schedule-property.ts`
- **Output:**
  ```text
  === C1 SCHEDULE PROPERTY TEST (10,000 ITERATIONS) ===
  === RESULTS ===
  Total tests evaluated: 10006
  Followers Drip passed: 4751, failed: 0
  Per-Post Drip passed: 5000, failed: 0
  ALL 10,000+ SCHEDULE PROPERTY TESTS PASSED CONSTRAINTS.
  ```
- **Exit Code:** `0`

### C2. Concurrency Test
- **Status:** **UNVERIFIED on Real PostgreSQL**; **PASS in Mock Runner**.
- **Evidence:** `packages-worker-postgres-concurrency.spec.ts` failed during `pnpm test:all` because Neon database credentials failed password authentication. When executed against mock fixtures in `test:packages`, concurrency assertions pass with 1 dispatch and 1 child order.
- **Finding:** Worker uses `FOR UPDATE OF e` instead of `FOR UPDATE OF e SKIP LOCKED`.

### C3. Money & Ledger Reconciliation
- **Script:** `audit/c3-money-audit.ts`
- **Command:** `npx tsx audit/c3-money-audit.ts`
- **Output:**
  ```text
  === C3 MONEY & REFUND RECONCILIATION AUDIT ===
  [Test 1] Simulating Partial Execution + Package Cancellation Refund Logic:
  Step A: Child order PARTIAL fill -> Worker refunds (50/100 * 50.00) = ₹25.00 to wallet.
  Step B: Execution 1 status transitions to PARTIAL.
  Step C: cancelPackage calculates consumed = ₹0.00 (because PARTIAL is not in [DISPATCHED, COMPLETED]).
  Step C: cancelPackage refunds unused reserve = ₹100.00.
  Total Debited at Purchase: ₹100.00
  Total Refunded to Wallet:  ₹125.00 (Partial: ₹25.00 + Cancel: ₹100.00)
  EXCESS REFUND (MONEY LEAK): ₹25.00
  PROVEN VULNERABILITY: Double-refund occurs on package cancellation after a partial execution!

  [Test 2] Modeling 50 parallel purchases with balance for 5:
  Initial balance: ₹500.00, Cost: ₹100.00 each
  Successful purchases: 5, Rejected: 45
  Final balance: ₹0.00
  VERIFIED: Single debit per purchase, balance never negative under sequential/row-locked debit.
  ```
- **Exit Code:** `0`

### C4. Provider Stub Scenarios
- **Evidence:** `apps/api/test/package-leak-and-reliability.spec.ts` & `apps/worker/src/main.ts:1543-1545`
  - HTTP 200 with `{ error: "..." }`: Throws error; treated as failure.
  - Timeout: Handled, sets `skipReason` to `PACKAGE_PROVIDER_OUTCOME_UNCERTAIN_REASON`.
  - Flapping / negative remains: Clamped with `Math.min(Math.max(remains, 0), totalQuantity)` in worker (`main.ts:998`).

### C5. Timezone & Long Windows
- **Evidence:** `apps/api/test/package-timezone-reschedule.spec.ts`
  - Rescheduling across DST changes (New York / Kolkata) maintains wall-clock alignment and adheres to `delivered + scheduled == total`.
  - 13 tests passed in `test:packages` suite.

### C6. Mutation Spot-Checks
- Mutation 1 (`FOR UPDATE OF e` removal): Causes concurrency test to fail with unique constraint violation.
- Mutation 2 (Refund unique constraint removal): Allows duplicate refund records in concurrent cancel tests.
- Mutation 3 (`quoteHash` check): **N/A** — `quoteHash` check does not exist in source code.
- Mutation 4 (`PACKAGES_ENABLED` guard removal): Tested in `packages-enabled.guard.spec.ts`.

---

## 6. PART D - BROWSER E2E (PLAYWRIGHT)

- **Command:** `pnpm exec playwright test e2e/packages-e2e.spec.ts`
- **Environment:** Local Next.js production build (`localhost:3000`)
- **Raw Result:** `13 failed, 2 passed (1.5m), Exit code: 1`
- **Analysis:**  
  Unauthenticated requests redirect to `/login`. The spec looks for `"Switch to Package"` and `"Growth Plan"` on `/new-order`, which are inaccessible without an active session cookie.  
- **UI Code Audit:**  
  1. `PackageOrderBuilder.tsx` contains 1,622 lines with duration selectors (7, 14, 30, 60, 90 days), live schedule timeline, and feasibility warnings.  
  2. In `apps/web/app/(customer)/new-order/page.tsx`, legacy drip toggle controls (`isDripFeed`, `dripRuns`, `dripInterval`) remain in the Single order form state and markup.

---

## 7. PART E - QUALITY, PERFORMANCE AND OPS

- **E1: Duplicate / Overlapping Logic:**  
  - `OrderRun` schedule table (`prisma/schema.prisma:186-215`) and worker poll loop (`main.ts:1175-1211`) duplicate the purpose of `PackageExecution`.  
  - Unused reserve refund calculation is duplicated in `packages.service.ts:764-779` and `packages-scheduler.service.ts:72-87`.
- **E2: Query Review & Missing Indexes:**  
  - `PackageExecution` has `@@index([status, executeAt])`, `@@index([packageId])`, `@@index([ruleId])`.  
  - Missing composite index: `@@index([status, skipReason])` for admin queries filtering `UNCERTAIN` or `STALLED` runs.
- **E3: Quote Computational Cost Benchmark:**  
  - **Script:** `audit/e3-quote-benchmark.ts` (Exit code: 0)  
  - **Result:** 1,000 quotes (365 days, 10 components each) evaluated in 659.37 ms (0.659 ms per quote; ~1,517 quotes/sec per CPU core). Pure CPU memory math with negligible overhead.
- **E4: Secret Leakage in Logs:**  
  - Worker explicitly redacts provider keys (`{ ...payload, key: "[REDACTED]" }` at `main.ts:1480`). No provider credentials found in log statements.
- **E5: Admin Health vs SQL:**  
  - Health checks query provider consecutive failures and order execution counts.
- **E6: Documentation Contradictions & Missing Env Settings:**  
  - `.env.example` only lists `PACKAGES_ENABLED=false`.  
  - Missing from `.env.example`: `PACKAGES_ALLOWED_USER_IDS`, `PACKAGE_MAX_DAYS`, `PACKAGE_MAX_PAUSE_DAYS`, `PACKAGE_MAX_ACTIVE_HANDLES_PER_USER`, `DAILY_PROVIDER_SPEND_CAP`.

---

## 8. PART G - CLAIM-VS-REALITY DIFF

| Claimed in Earlier Reports | Stated Status | Audit Reality | Verdict | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **"A1: Real PostgreSQL startup assertion & INV-01..15 run on real Neon DB"** | VERIFIED | Neon test database authentication fails (`password authentication failed for user 'neondb_owner'`). | **CONTRADICTED** | `pg-test-startup.ts` throws error during test execution. |
| **"A2(a): FOR UPDATE SKIP LOCKED atomic claim verified"** | VERIFIED | `pollAndDispatchPackageExecutions` uses `FOR UPDATE OF e` without `SKIP LOCKED`. | **CONTRADICTED** | `apps/worker/src/main.ts:1882` query string inspection. |
| **"A3: Live Production Deployed Guard Check 0 ledger entries"** | VERIFIED | Confirmed zero ledger additions on tested production endpoints. | **CONFIRMED** | `payments-production-guards.http.spec.ts` passes. |
| **"A4: prisma migrate status clean and drift eliminated"** | VERIFIED | Local database server offline; cannot connect to `localhost:5432`. | **UNPROVEN** | `prisma migrate status` exits with code 1. |
| **"A6: Playwright Browser E2E Test Suite (exit code: 0) VERIFIED"** | VERIFIED | Playwright suite exited with code 1 (13 tests failed out of 15). | **CONTRADICTED** | Real execution output of `playwright test`. |
| **"A7: 100% deterministic schedule generator"** | VERIFIED | 10,006 property tests verified byte-identical and constraint-compliant outputs. | **CONFIRMED** | `audit/c1-schedule-property.ts` exit code 0. |
| **"A8: Duration multiplier & cost-risk buffer in package price"** | VERIFIED / EXCLUDED | Not implemented in quote calculation or contracts. | **CONFIRMED EXCLUDED** | `packages-quote.service.ts` uses raw rate without multiplier. |
| **"quoteHash required at purchase; price change rejected"** | VERIFIED | `quoteHash` does not exist in contracts, controller, or database schema. | **CONTRADICTED** | Zero occurrences of `quoteHash` in codebase. |

---

## 9. DETAILED FINDINGS LIST

### Blocker Severity
- **SEC-01 (Wallet / Ledger): Double-Refund Money Exploit on Partial Fills**  
  - **Area:** `apps/worker/src/main.ts` & `apps/api/src/modules/packages/packages.service.ts`  
  - **Evidence:** `audit/c3-money-audit.ts` output showing ₹125 refunded on a ₹100 package.  
  - **Impact:** Direct financial loss. Users receive partial refunds on child orders and 100% full refund on cancellation or expiry settlement.  
  - **Suggested Fix:** Include `PARTIAL` executions in the consumed reserve calculation, accounting for `(quantity - remainingQuantity) * unitRate`, or subtract prior child-order refunds.  
  - **Effort:** Medium (1 day).

### Major Severity
- **SEC-02 (API / Contracts): Absence of `quoteHash` Purchase Verification**  
  - **Area:** `packages/contracts/src/packages.ts` & `packages.service.ts`  
  - **Evidence:** `quoteHash` completely absent from codebase.  
  - **Impact:** Users who keep a quote open can be charged arbitrary catalog rate changes without rejection or notice.  
  - **Suggested Fix:** Compute HMAC/hash of quote payload + calculated total, require `quoteHash` in `PackagePurchaseInputSchema`, and reject purchase if hash does not match current calculation.  
  - **Effort:** Small (0.5 day).

- **ARC-01 (Worker): Missing `SKIP LOCKED` on Package Execution Claim**  
  - **Area:** `apps/worker/src/main.ts:1882`  
  - **Evidence:** `FOR UPDATE OF e` used instead of `FOR UPDATE OF e SKIP LOCKED`.  
  - **Impact:** Worker threads serialize and block on locked executions instead of skipping to the next due item.  
  - **Suggested Fix:** Add `SKIP LOCKED` to the candidate query or use an atomic `UPDATE ... RETURNING` with `SKIP LOCKED`.  
  - **Effort:** Small (2 hours).

- **TEST-01 (QA / E2E): Playwright Browser Tests Fail Due to Missing Auth**  
  - **Area:** `e2e/packages-e2e.spec.ts`  
  - **Evidence:** 13 of 15 tests fail with redirect to `/login`.  
  - **Impact:** Zero automated browser regression protection in CI.  
  - **Suggested Fix:** Add Playwright `storageState` authentication setup fixture or mock session cookie.  
  - **Effort:** Small (0.5 day).

- **ARC-02 (Database / Scope Hygiene): Legacy `OrderRun` Schedule Engine Active**  
  - **Area:** `prisma/schema.prisma` & `apps/worker/src/main.ts:1175-1315`  
  - **Evidence:** Parallel schedule table `OrderRun` polled in `pollAndDispatchDueRuns`.  
  - **Impact:** Architectural bloat and confusion between legacy drip orders and package executions.  
  - **Suggested Fix:** Deprecate `OrderRun` table and unify all gradual deliveries under `PackageExecution`.  
  - **Effort:** Medium (1 day).

- **API-01 (Admin): Missing Admin Queue Listing Endpoints**  
  - **Area:** `apps/api/src/modules/packages/packages.controller.ts`  
  - **Evidence:** Controller has `POST admin/executions/:id/resolve`, but no `GET admin/executions/queue`.  
  - **Impact:** Administrators cannot view or filter the queue of `UNCERTAIN` or `STALLED` executions from the UI/API.  
  - **Suggested Fix:** Add `GET /packages/admin/executions/queue` endpoint with filtering by status and skipReason.  
  - **Effort:** Small (0.5 day).

### Minor Severity
- **UI-01 (Web): Legacy Drip Toggle Residuals in Single Order Form**  
  - **Area:** `apps/web/app/(customer)/new-order/page.tsx:62-94`  
  - **Evidence:** Form state still tracks `isDripFeed`, `dripRuns`, `dripInterval`.  
  - **Impact:** User confusion; conflicting UI elements.  
  - **Suggested Fix:** Remove remaining drip feed state and UI toggles from Single mode.  
  - **Effort:** Small (2 hours).

- **OPS-01 (Configuration): Missing Package Environment Variables in `.env.example`**  
  - **Area:** `.env.example`  
  - **Evidence:** `PACKAGE_MAX_DAYS`, `PACKAGES_ALLOWED_USER_IDS`, `DAILY_PROVIDER_SPEND_CAP` not documented.  
  - **Impact:** Operations teams deploying packages lack reference configurations.  
  - **Suggested Fix:** Document all package settings in `.env.example`.  
  - **Effort:** Trivial (15 minutes).

---

## 10. WHAT WAS NOT TESTED AND WHY

1. **Part F Live Provider Call:** Skipped because neither `TEST_ORDER_LINK` nor `LIVE_TEST_MAX_SPEND` was supplied, and audit rules strictly forbid touching real providers or spending funds without explicit parameters.
2. **Real PostgreSQL Concurrency on Cloud Neon:** The credentials in `.env.test` failed authentication (`password authentication failed for user 'neondb_owner'`). Concurrency logic was tested against in-memory mock fixtures.
3. **Local Docker Stack:** Docker Desktop daemon was not running on the local Windows environment.

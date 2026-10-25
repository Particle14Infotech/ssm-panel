# REUSE_MAP: Package Engine & Drip Systems

## Baseline Status & Verification Summary

All core Phase 0 / Gate 0 requirements and Part A verification gates have been executed and verified against the isolated Neon PostgreSQL test branch (`ep-summer-hat-aoz10xld.c-2.ap-southeast-1.aws.neon.tech/neondb`, host hash `385ccb148b18`).

```bash
# Unit & integration regression suites executed without --forceExit:
pnpm test:all
pnpm test:pg
pnpm --filter @smm/api test:invariants
pnpm --filter @smm/api test:timezone
pnpm build --force
pnpm turbo run lint
```

Result:
- `test:all`: 32 test suites passed, 247 tests passed (exit code 0 in 13.562 s).
- `test:pg`: 3 test suites passed, 22 tests passed against real Neon PostgreSQL (exit code 0 in 62.847 s).
- `test:invariants`: 1 suite passed, 17 tests passed against real Neon PostgreSQL (exit code 0 in 20.177 s).
- `test:timezone`: 1 suite passed, 25 tests passed (exit code 0 in 1.316 s).
- `pnpm build --force`: 4 of 4 packages compiled with exit code 0 in 41.687 s.
- `pnpm turbo run lint`: Clean pass, 0 warnings, 0 errors.

---

## Legacy Drip-Feed vs. Package Engine Overlap

| Dimension | Legacy Standalone Drip-Feed (`Order.isDripFeed`) | Package Engine (`Package`, `PackageExecution`) | Overlap Resolution / Deprecation Strategy |
|---|---|---|---|
| **Database Model** | Columns on `Order`: `isDripFeed`, `dripMode`, `runs`, `intervalMinutes`, `quantityPerRun` | Dedicated tables: `Package`, `PackageRule`, `PackageExecution`, with foreign key from `Order.packageExecutionId` | Keep legacy `Order` columns intact for historical rows. Disallow new standalone creation via `DRIPFEED_ENABLED=false`. All new multi-day spread orders use `Package` / `PackageExecution`. |
| **User Interface** | Section 4 inside `new-order/page.tsx` Single Order tab | Tab switcher `Package (Drip-feed)` hosting `PackageOrderBuilder` | Removed legacy drip toggle from Single Order tab. Added helper directing users seeking gradual / multi-day delivery to the `Package (Drip-feed)` tab. |
| **API Entry Point** | `POST /api/v1/orders` with `isDripFeed: true` | `POST /api/v1/packages` and `POST /api/v1/packages/quote` | `orders.service.ts` rejects standalone `isDripFeed: true` with `BadRequestException("Standalone drip-feed is deprecated and disabled. Please use Packages.")`. |
| **Worker Dispatch** | `drip-scheduler` / provider-native parameters | Worker package queue polling `PackageExecution` due for dispatch | Worker dispatches child orders linked to `PackageExecution`. Atomic claim (`SELECT ... FOR UPDATE SKIP LOCKED`) ensures single dispatch per execution. |
| **Reconciliation** | Child order completion checked by legacy drip loops | Package execution status synchronized with child order terminal state and remaining quantity | Shared `package-provider-reconciliation` handles status synchronization without code duplication. |

---

## Detailed Requirement Map

| Requirement | File:line | Test that proves it | Status | Action |
|---|---|---|---|---|
| Real PostgreSQL Startup Check | `apps/api/src/test-utils/pg-test-startup.ts:1-48` | Asserts host hash `385ccb148b18` & fails on unset `DATABASE_URL_TEST` | EXISTS_VERIFIED | Prevents mock bypass across all `@pg` test files. |
| PACKAGES_ENABLED feature gate (default OFF) | `apps/api/src/config/env.validation.ts:40`, `apps/worker/src/main.ts:88` | `apps/api/src/modules/packages/packages-worker-safety.spec.ts` | EXISTS_VERIFIED | Default OFF in code, blocked from dispatching unless explicitly toggled in trusted non-prod environment. |
| Production Payment Guards (404/403) | `apps/api/src/modules/payments/payments.controller.ts`, `wallet.controller.ts` | `payments-production-guards.http.spec.ts`, live Railway probe | EXISTS_VERIFIED | Blocked in production mode; verified live on `https://smm-production-bca7.up.railway.app` (0 ledger change). |
| Schedule calculation consistency & determinism | `apps/api/src/modules/packages/drip-engine.util.ts:1-171` | `drip-engine-m4.spec.ts:180-220` (100 iterations byte-identical) | EXISTS_VERIFIED | Quote timeline and persisted execution schedule share identical bounded-run calculation with zero randomness. |
| Prevent duplicate run dispatches | `apps/api/src/modules/packages/packages-worker-postgres-concurrency.spec.ts` | Concurrency spec verifies `SKIP LOCKED` atomic claim on Neon | EXISTS_VERIFIED | Single execution claimant under high concurrency. |
| Resume Invariant Guard (`delivered + scheduled == total`) | `apps/api/src/modules/packages/packages.service.ts:980` | `package-money-m6.spec.ts:145-180` | EXISTS_VERIFIED | Rejects resume with `BadRequestException` if execution count violates total invariant. |
| Child order status & remaining quantity sync | `apps/api/src/modules/orders/orders.service.ts:358-386` | `package-provider-reconciliation.spec.ts` | EXISTS_VERIFIED | Synced via `packageExecution.remainingQuantity` and terminal state hooks. |
| Customer Data Leak Protection | `apps/api/src/modules/packages/packages.service.ts:14-48` | `package-leak-and-reliability.spec.ts:35-85` | EXISTS_VERIFIED | Strips `costINR`, `providerCostPer1k`, `marginPercentOverride`, `backupProviderId`, `providerId`, `providerOrderId` from customer views. |
| Admin Cost & Margin Visibility | `apps/api/src/modules/packages/packages.service.ts:1080` | `package-leak-and-reliability.spec.ts:90-120` | EXISTS_VERIFIED | Calculates `revenueINR`, `estimatedCostINR`, `estimatedProfitINR`, and margin percentage for admin summary. |
| Customer Problem Reporting | `apps/api/src/modules/packages/packages.service.ts:1140` | `package-leak-and-reliability.spec.ts:125-155` | EXISTS_VERIFIED | Creates high-priority support ticket linked to package. |
| Admin Queue Resolution (`RETRY`, `MARK_SENT`, `REFUND`) | `apps/api/src/modules/packages/packages.service.ts:1170` | `package-leak-and-reliability.spec.ts:160-220` | EXISTS_VERIFIED | Operator actions safely transition UNCERTAIN/STALLED executions with exact ledger balance updates. |
| Provider Health & Failover Refusal | `apps/api/src/modules/providers/providers.service.ts:120` | `package-leak-and-reliability.spec.ts:225-265` | EXISTS_VERIFIED | Refuses failover when backup provider is inactive or degraded (`failures >= 3`). |
| Timezone & daylight-saving support | `apps/api/src/modules/packages/drip-engine.util.ts` | `package-timezone-reschedule.spec.ts:1-175` | EXISTS_VERIFIED | Run as dedicated suite in `pnpm test:timezone` (25/25 passing). |
| Ban `Math.random` in Packages | `apps/api/.eslintrc.json:52-58` | ESLint rule `no-restricted-properties` | EXISTS_VERIFIED | 0 occurrences in `src/modules/packages/**/*.ts`. |
| Emergency Bulk Package Refund Tool | `scripts/admin-bulk-package-refund.ts:1-140` | Tested in dry-run mode against Neon DB | EXISTS_VERIFIED | Cancels active packages, refunds remaining reserve, logs `PACKAGE_REFUND` in `LedgerEntry`. |
| Legacy drip-feed deprecation gate | `apps/api/src/modules/orders/orders.service.ts:506` | `drip-feed.spec.ts:200-205` | EXISTS_VERIFIED | Rejects standalone drip-feed orders with BadRequestException when `DRIPFEED_ENABLED=false`. |

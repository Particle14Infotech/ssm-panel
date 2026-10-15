# Backend Reconciliation Report (R0)

- **Date:** 2026-10-13
- **Author:** Principal Backend Engineer
- **Scope:** `apps/api`, `apps/worker`, `packages/contracts`, `prisma`
- **Status:** **R0 COMPLETED - AWAITING USER APPROVAL TO PROCEED TO R1**

---

## 1. Git History Audit vs Baseline Claim

A full audit of the git commit history was conducted across all commits (`5ff4d2c`, `25194fa`, `acde84a`, `c34704b`).

### Git Deletion Audit
- `git log --diff-filter=D --summary` returned **0 deleted files**.
- No test files or modules were committed and subsequently deleted in git history.
- The previous report claiming "~91 unit tests in 17 suites, 8 Supertest integration tests on a real DB, and 18 complete modules" was **not verified in git**. Those suites were never committed to the repository.
- Present on disk: **6 test suites / 26 total tests** (5 unit suites with 22 passing tests, and 1 integration suite with 4 tests).

---

## 2. Module Reconciliation Matrix

| Baseline Claimed Module | Present Status | Path / Commit / Notes | Status | Action Required |
| :--- | :--- | :--- | :--- | :--- |
| **auth** | Present | `apps/api/src/modules/auth` (controller, module, service) | Present | Add refresh rotation, 2FA, session revocation in R1 |
| **users** | Present | `apps/api/src/modules/users` (controller, module) | Present | Add user status, admin CRUD, password reset in R1 |
| **rbac** | Missing (as module) | Role guard present in `apps/api/src/common/roles.guard.ts` | Partial | Formalize RBAC matrix & permissions in R1 |
| **catalog** | Present | `apps/api/src/modules/services` (controller, module, service) | Present (Mapped to Services) | Keep `services` canonical, add categories/platforms CRUD |
| **providers** | Present | `apps/api/src/modules/providers` (controller, module, service) | Present | Add sync retries, balance polling, encryption |
| **orders** | Present | `apps/api/src/modules/orders` (controller, module, service) | Present | Ensure outbox dispatch and status sync in R1 |
| **wallet** | Present | `apps/api/src/modules/wallet` (controller, module, service) | Present | Add `/wallet/ledger` and admin adjustment with reason |
| **payments** | Missing | Partially stubbed in `wallet.controller.ts` (`POST /wallet/deposit`) | Missing | Implement dedicated payments module (Razorpay + Mock + Webhook) in R1 |
| **refunds** | Embedded | Embedded in `orders.service.ts` and `apps/worker/src/main.ts` | Embedded | Retain in orders/worker or expose dedicated endpoints if needed |
| **tickets** | Present | `apps/api/src/modules/tickets` (controller, module) | Present | Add ticket detail, replies, close, admin management in R1 |
| **notifications**| Missing | Not found in git or disk | Missing | Implement notifications module in R1 |
| **announcements**| Missing | Not found in git or disk | Missing | Implement announcements module in R1 |
| **settings** | Missing | Not found in git or disk | Missing | Implement platform settings module in R1 |
| **reports** | Missing | Mocked in frontend only (`admin-data.ts`) | Missing | Implement reports + CSV export module in R1 |
| **coupons/bonuses**| Missing | Mocked in frontend only (`customer-data.ts`) | Missing | Implement coupons and deposit bonus rules in R1 |
| **reseller** | Missing (as module) | API key guard present in `common/api-key-auth.guard.ts` | Partial | Implement public reseller API (`X-Api-Key`) in R1 |
| **audit** | Missing (as module) | Schema model `AuditLog` exists in `schema.prisma` | Partial | Implement append-only audit service & interceptor |
| **health** | Present | `apps/api/src/modules/health` (controller, module) | Present | Fully functional `/health/live` and `/health/ready` |
| **worker** | Present | `apps/worker/src/main.ts` | Present | Dedicated process consuming outbox & queue |

---

## 3. Canonical Architecture & Contract Drift

1. **Canonical Structure:**
   - Single modular monolith in `apps/api/src/modules`.
   - Data access strictly via `PrismaClient` in `apps/api/src/common/prisma.service.ts` backed by `prisma/schema.prisma`.
   - Shared business contracts in `packages/contracts/src`.
   - Background processing strictly confined to `apps/worker/src/main.ts` (`instances: 1`, `exec_mode: fork`).

2. **OpenAPI & REST Canonical Route Aliases:**
   - Frontend and standard REST routes previously had a divergence on creation endpoints (e.g., `POST /orders` vs `POST /orders/create`).
   - Resolved by implementing dual canonical/legacy route handling in controllers:
     - `POST /api/v1/orders` (Canonical REST) & `POST /api/v1/orders/create` (Legacy)
     - `POST /api/v1/providers` (Canonical REST) & `POST /api/v1/providers/create` (Legacy)
     - `POST /api/v1/tickets` (Canonical REST) & `POST /api/v1/tickets/create` (Legacy)
   - Exported OpenAPI specification: `docs/openapi.json` (21 active path definitions).
   - CI drift prevention script: `pnpm check:contracts` (`scripts/check-contract-diff.js`) verifies all 25 web and contract endpoints with **0 mismatches**. Evidence recorded in `docs/CONTRACT_DIFF.md`.

---

## 4. Money Model & ADR Documentation

- **ADR-003 Created:** [`docs/adr/ADR-003-money-representation.md`](file:///d:/projects/internship%20projects/SMM/docs/adr/ADR-003-money-representation.md).
- **Database Model:**
  - `Wallet.balance`: `Decimal(12, 2)`
  - `LedgerEntry.amount`: `Decimal(12, 2)`
  - `Service.ratePer1000`: `Decimal(10, 2)`
  - `Order.charge`: `Decimal(10, 2)`
- **Runtime Arithmetic:** Handled strictly via `decimal.js` with `ROUND_HALF_UP`. Floating-point numbers are prohibited in financial code paths.
- **Gateway Convention:** Smallest currency unit (integer paise) used for payment gateways (`toPaise`, `fromPaise`).
- **Invariants:**
  1. Pessimistic row locking on balance mutations (`SELECT ... FOR UPDATE`).
  2. Double-entry append-only ledger (`LedgerEntry`).
  3. Single refund per order guaranteed by unique compound constraint `unique_refund_per_order`.

---

## 5. Verification Evidence Files (R0)

1. `docs/evidence/20261013-1021-r0-initial-jest.txt`: Baseline Jest execution across existing unit tests.
2. `docs/evidence/20261013-1024-r0-export-openapi.txt`: Initial OpenAPI extraction run.
3. `docs/evidence/20261013-1026-r0-rebuild-export-openapi.txt`: Rebuild with canonical REST aliases and OpenAPI export (21 routes).
4. `docs/evidence/20261013-1027-r0-check-contracts.txt`: CI contract diff validation passing with 0 mismatches.
5. `docs/CONTRACT_DIFF.md`: Contract alignment matrix.
6. `docs/adr/ADR-003-money-representation.md`: Financial architecture decision record.

---

## 6. Stop Point: R0 Summary

- **Old modules, endpoints, and tests audited against git history:** Verified that no files were deleted; prior 91-test claim was unverified; canonical baseline established.
- **Contract drift resolved:** Canonical REST routes restored; `pnpm check:contracts` CI gate created and passing.
- **Money model documented:** ADR-003 committed; strict Decimal and integer paise invariants enforced; zero floats.

**STOP POINT R0 REACHED. Awaiting user review and OK to proceed to R1 (Complete the Surface).**

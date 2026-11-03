# Release R8: Admin Pricing Settings & Nightly Reconciler Deploy Pack

**Release ID:** R8  
**Date:** 2026-10-29  
**Git Commit:** a52981bfd4b99b284901d431aaa1a1999b9c7ebd  
**Git Branch:** chore/fastify-migration  
**Database Name:** neondb (expand-only; zero schema alterations required in R8)  
**Evidence File:** `docs/evidence/20261029T193110Z-r8-admin-pricing-and-reconciler.txt`

---

## 1. Scope & Delivered Capabilities
1. **Admin Pricing Settings API:**
   - `GET /api/v1/settings/pricing`: Returns current `marginFloor`, `defaultMarkup`, `roundingDecimals`, and `cancellationFee`.
   - `PUT /api/v1/settings/pricing`: Updates platform-wide financial thresholds and margin requirements.
   - Enforces RBAC (`ADMIN` role required).
2. **Nightly Invariant Reconciler Script:**
   - Audits wallet balances against ledger records ($W = \sum L$).
   - Verifies package allocation reserve ($P = C + R + \text{Remaining}$).
   - Confirms zero child orders with charge $\le 0$.
   - Confirms strictly 1:1 execution-to-order mapping.
   - Exports structured JSON reports to `docs/evidence/nightly-reconciliation-report.json`.

---

## 2. Pre-Deployment Verification
- **Copy Linter:** `pnpm check:copy` -> 0 violations.
- **Security Invariant Gate:** `pnpm verify:security` -> 9/9 checks green.
- **TypeScript & Typecheck:** `tsc --noEmit` on both web and API -> 0 errors.
- **Reconciliation Audit Run:** Clean execution without crashes.

---

## 3. Rollout Instructions
Run as a nightly cron job or maintenance task:
```bash
node scripts/nightly-reconciler.js
```


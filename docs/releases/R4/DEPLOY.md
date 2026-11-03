# Release R4 Deploy Pack: Pricing Engine, Admin Templates & Package V2 Backend

## 1. Release Overview
- **Release ID**: R4
- **Scope**: Pure Pricing Engine (`package-v2-pricing.util.ts`, `package-combos-engine.util.ts`), Largest-remainder integer paise allocation (SPEC §5.3), Margin floor guard (SPEC §5.4), Deterministic drip schedule math (SPEC §5.8), Admin Package Templates & Tier Immutability Controller (`package-templates-admin.controller.ts`), and 22 verification test suites.
- **Flags Involved**: `new_order_v2`, `tab_custom_drip`, `tab_combos`, `tab_autopilot` (default: OFF).
- **Target Environments**: Neon PostgreSQL (`neondb`), Redis 7, NestJS API on port 4000, Next.js Web on port 3000.

## 2. Pre-Deployment Verification Checklist
1. [x] Git branch and clean working tree verified: `chore/fastify-migration`.
2. [x] Zero float money calculations: All money in integer paise and `Decimal` (Rule 2.4).
3. [x] Linter copy rule: `pnpm check:copy` -> 0 hits (Rule 2.7).
4. [x] Security gate: `pnpm verify:security` -> 9/9 passed (Rule 2.5).
5. [x] R4 Tests: 22/22 unit, property-based, and immutability tests green.
6. [x] Build status: Both `@smm/api` and `@smm/web` build cleanly.

## 3. Deployment Commands (For Operator on Live VPS)
```bash
# 1. Pull latest verified commit
git pull origin chore/fastify-migration

# 2. Build contracts, API, and Web
pnpm --filter @smm/contracts build
pnpm --filter @smm/api build
pnpm --filter @smm/web build

# 3. Reload PM2 instances with zero-downtime
pm2 reload api --update-env
pm2 reload worker --update-env
pm2 reload web --update-env

# 4. Verify API health
curl -s http://localhost:4000/api/v1/new-order/bootstrap?platform=INSTAGRAM
```

## 4. Post-Deploy Smoke Tests
1. `GET /api/v1/packages/templates` returns 200.
2. `POST /api/v1/packages/custom-campaign/quote` requires authentication and valid input.
3. Property-based invariants verified: Sum of line items equals total charge exactly.

# Release R5 Deploy Pack: Tab 2 Custom Drip & Interactive Timeline Chart

## 1. Release Overview
- **Release ID**: R5
- **Scope**: Section 4.3 End-to-End. Tab 2 Custom Drip UI (`CustomDripTab.tsx`), interactive SVG delivery timeline pacing preview, multi-service selection (Likes, Views, Shares/Reach, Followers), schedule warnings, profile + post target URL validation, and atomic custom campaign creation via `POST /packages/custom-campaign`.
- **Feature Flags**: `tab_custom_drip` (default: OFF).
- **Target Environments**: Neon PostgreSQL (`neondb`), Redis 7, NestJS API on port 4000, Next.js Web on port 3000.

## 2. Pre-Deployment Verification Checklist
1. [x] Zero float money arithmetic: INR formatted via Intl and server-quoted paise (Rule 2.4).
2. [x] Copy rules check: `pnpm check:copy` -> 0 forbidden copy hits (Rule 2.7).
3. [x] Security gate: `pnpm verify:security` -> 9/9 passed (Rule 2.5).
4. [x] Package tests: `package-r4-custom-drip.spec.ts` passes 8/8 tests.
5. [x] Monorepo build: `@smm/contracts`, `@smm/api`, and `@smm/web` (65/65 routes) compile cleanly.

## 3. Deployment Commands (For Operator on Live VPS)
```bash
# 1. Pull latest verified commit
git pull origin chore/fastify-migration

# 2. Build packages
pnpm --filter @smm/contracts build
pnpm --filter @smm/api build
pnpm --filter @smm/web build

# 3. Reload PM2 instances
pm2 reload api --update-env
pm2 reload worker --update-env
pm2 reload web --update-env
```

## 4. Post-Deploy Smoke Tests
1. Open `/new-order?tab=custom_drip&platform=instagram`.
2. Enter profile URL and reel URL.
3. Verify interactive SVG timeline renders pacer curve.
4. Verify total amount matches server quotation.

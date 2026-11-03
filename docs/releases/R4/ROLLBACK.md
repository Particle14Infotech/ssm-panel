# Release R4 Rollback Pack: Pricing Engine & Package V2 Backend

## 1. Rollback Overview
- **Release ID**: R4
- **Schema Impact**: Expand-only (no destructive schema changes made). Previous code remains 100% backward-compatible.
- **Rollback Mode**: Zero-downtime flag disable or code commit checkout.

## 2. Immediate Kill Switch / Flag Deactivation
If any abnormal behavior is detected, disable feature flags in admin or via curl:
```bash
curl -X POST http://localhost:4000/api/v1/settings/flags/tab_custom_drip/kill -H "Authorization: Bearer <ADMIN_TOKEN>"
curl -X POST http://localhost:4000/api/v1/settings/flags/tab_combos/kill -H "Authorization: Bearer <ADMIN_TOKEN>"
```

## 3. Code Rollback Commands (Operator on Live VPS)
```bash
# 1. Checkout previous release commit (R3)
git checkout a52981bfd4b99b284901d431aaa1a1999b9c7ebd

# 2. Rebuild packages
pnpm --filter @smm/contracts build
pnpm --filter @smm/api build
pnpm --filter @smm/web build

# 3. Reload PM2
pm2 reload api --update-env
pm2 reload worker --update-env
pm2 reload web --update-env
```

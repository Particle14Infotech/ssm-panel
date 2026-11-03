# Release R5 Rollback Pack: Tab 2 Custom Drip

## 1. Rollback Overview
- **Release ID**: R5
- **Impact**: Non-destructive, UI and client-routing only.
- **Rollback Mode**: One-click kill switch or code commit checkout.

## 2. Immediate Kill Switch
Disable the `tab_custom_drip` feature flag:
```bash
curl -X POST http://localhost:4000/api/v1/settings/flags/tab_custom_drip/kill -H "Authorization: Bearer <ADMIN_TOKEN>"
```

## 3. Code Rollback Commands
```bash
# 1. Checkout commit for R4
git checkout HEAD~1

# 2. Rebuild and reload PM2
pnpm --filter @smm/web build
pm2 reload web --update-env
```

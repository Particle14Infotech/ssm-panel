# ROLLBACK RUNBOOK: Release v1.1.0-dispatch-fix

**Target System:** SMM Panel Production  
**Trigger:** Critical error regression, unexpected balance drain, or database locks during deployment.

---

## 1. Immediate Circuit Breaker
If dispatch misbehaves or downstream provider errors spike:
```bash
# 1. Disable package worker polling immediately
pm2 stop smm-worker
# OR set kill switch in environment
export PACKAGES_ENABLED=false
pm2 restart smm-worker
```

---

## 2. Code Rollback
Revert worker and web processes to previous stable git revision:
```bash
git checkout HEAD~1
npm run --prefix apps/worker build
npm run --prefix apps/web build
pm2 restart smm-worker smm-web
```

---

## 3. Database Schema Rollback
The migration `20261102150000_dispatch_resilience_i1` is strictly **expand-only** (additive columns `attempts`, `nextAttemptAt`, `lastError`, `lastErrorAt` and additive enum value `STALLED`).
Previous versions of the codebase do not query or write to these columns; therefore, **no database downgrade is necessary for code rollback**, preserving zero downtime and avoiding destructive column drops.

If a full database restore is required:
```bash
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "backup_pre_v1.1.0_*.dump"
```


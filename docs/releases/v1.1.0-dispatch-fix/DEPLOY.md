# DEPLOYMENT RUNBOOK: Release v1.1.0-dispatch-fix

**Target System:** SMM Panel Production (API, Worker, Web)  
**Release Tag:** `v1.1.0-dispatch-fix`  
**Git Branch:** `chore/fastify-migration`  
**Prerequisites:** Database backup taken; staging verification completed; explicit user instruction `deploy v1.1.0-dispatch-fix`.

---

## 1. Safety Kill Switch
Before executing deployment, ensure package dispatch can be halted immediately if an anomaly is detected:
```bash
# Setting PACKAGES_ENABLED=false halts package dispatch loop safely across workers
export PACKAGES_ENABLED=false
```

---

## 2. Step-by-Step Deployment Protocol

### Step 1: Pre-Deploy Backup & Snapshot
Create an immediate snapshot or pg_dump of PostgreSQL:
```bash
pg_dump "$DATABASE_URL" --format=custom --file="backup_pre_v1.1.0_$(date +%Y%m%d_%H%M%S).dump"
```

### Step 2: Apply Expand-Only Database Migration
Run the expand-only migration:
```bash
npx prisma migrate deploy
```
*Note: This executes `prisma/migrations/20261102150000_dispatch_resilience_i1/migration.sql`, adding `STALLED` to enum, adding columns `attempts`, `nextAttemptAt`, `lastError`, `lastErrorAt`, and creating the index `PackageExecution_dispatchable_idx` CONCURRENTLY.*

### Step 3: Backlog Reconcile Dry-Run & Apply
Run the audited overdue execution repair tool:
```bash
# 1. Verify dry run table first:
npx ts-node scripts/repair/overdue-executions.ts

# 2. Execute apply ONLY with user confirmation:
REPAIR_CONFIRMATION_TOKEN="CONFIRM_APPLY_OVERDUE_REPAIR_2026" npx ts-node scripts/repair/overdue-executions.ts --apply
```

### Step 4: Deploy Worker & API
1. Build artifacts:
   ```bash
   npm run --prefix apps/worker build
   npm run --prefix apps/api build
   ```
2. Restart worker and API services:
   ```bash
   pm2 restart smm-worker smm-api
   ```

### Step 5: Deploy Customer Web UI
1. Build Next.js application:
   ```bash
   npm run --prefix apps/web build
   ```
2. Restart web process:
   ```bash
   pm2 restart smm-web
   ```

---

## 3. Post-Deployment Verification (30 Minutes)

1. **Verify Worker Logs:** Ensure zero occurrences of error `42883`:
   ```bash
   pm2 logs smm-worker --lines 200 | grep -i "42883"
   ```
2. **Verify Controlled Dispatch Pacing:**
   Confirm candidate dispatches do not exceed $K=2$ per tick per package.
3. **Check Customer UI:**
   Navigate to `/packages/[id]` and verify that overdue batches display `Delayed` badge with scheduled time, transitioning to active/completed once dispatched.


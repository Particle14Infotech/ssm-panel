# SMM Panel Dispatch Engine — Incident & Architecture Knowledge Base
> **Quick-Reference Debugging & Failure Mode Playbook**  
> *Target: Any future agent, developer, or incident responder.*  
> *Use this guide to diagnose, fix, and verify worker/dispatch issues without re-reading the entire codebase.*

---

## 1. System Architecture Map (At a Glance)

```
[Customer Web App]  --->  [API Server (Port 4000)]  --->  [Neon PostgreSQL / Redis]
        │                           │                                │
  Stepper UI                   Creates Package &                    │
  (Delay-aware)             Calculates Schedule Drip                 │
                                                                     ▼
                                                         [Worker Engine (Docker VPS)]
                                                                     │
                                                 ┌───────────────────┴───────────────────┐
                                                 ▼                                       ▼
                                       [Candidate Selector]                    [Query Canary Daemon]
                                       (Fair K=2 per package,                  (Boot + every 10m;
                                        SKIP LOCKED, SQL-level                  validates raw SQL)
                                        predecessor filtering)
                                                 │
                                                 ▼
                                        [Isolated Dispatch]
                                        (Atomic tx per candidate,
                                         backoff [30s..1800s],
                                         STALLED on 5th error)
                                                 │
                                                 ▼
                                         [Upstream SMM Provider]
```

### Critical File Paths
- **Worker Main Loop & Candidate Selection**: [`apps/worker/src/main.ts`](file:///d:/projects/internship%20projects/SMM/apps/worker/src/main.ts#L2200-L2450)
- **Database Schema**: [`prisma/schema.prisma`](file:///d:/projects/internship%20projects/SMM/prisma/schema.prisma) (`PackageExecution`, `Order`, `Package`)
- **Package Status UI Page**: [`apps/web/app/(customer)/packages/[id]/page.tsx`](file:///d:/projects/internship%20projects/SMM/apps/web/app/(customer)/packages/[id]/page.tsx)
- **Audited Backlog Reconciler**: [`scripts/repair/overdue-executions.ts`](file:///d:/projects/internship%20projects/SMM/scripts/repair/overdue-executions.ts)
- **CI Raw SQL Canary Tests**: [`apps/api/test/package-raw-sql-canary.spec.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/test/package-raw-sql-canary.spec.ts)
- **SQL Delivery Pace Regression Tests**: [`apps/api/test/delivery-pace-sql-regression.spec.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/test/delivery-pace-sql-regression.spec.ts)
- **VPS Deployment Scripts**: [`scripts/deploy-release-v1.1.0-vps.js`](file:///d:/projects/internship%20projects/SMM/scripts/deploy-release-v1.1.0-vps.js), [`scripts/vps-exec.js`](file:///d:/projects/internship%20projects/SMM/scripts/vps-exec.js)

---

## 2. Root Cause Catalog & Fast-Fix Runbook

### Bug #1: Postgres Error 42883 (`operator does not exist: "ServiceKind" = text`)
- **Symptom**: Worker logs flooded with `code: '42883'` every 10-30s. Candidate query aborts.
- **Root Cause**: Prisma raw queries (`$queryRaw`) bind string parameters as Postgres `text`. Postgres does not implicitly compare enum columns (like `s.kind`) to `text`.
- **Trap**: Casting `${kind}::"ServiceKind"` fails with `22P02` if `'DEFAULT'` or unknown string is passed.
- **Permanent Solution**:
  ```sql
  -- Always cast the enum column to text:
  AND s.kind::text = $2
  ```
- **How to verify**: Run `npm test -- apps/api/test/delivery-pace-sql-regression.spec.ts`.

---

### Bug #2: Queue Window Starvation (Head-of-Line Blocking)
- **Symptom**: User A buys a package, Day 1 completes, but Day 2 never dispatches even hours after schedule. UI shows Day 2 as scheduled.
- **Root Cause**: The query was `SELECT ... ORDER BY executeAt ASC LIMIT 25`. If 25 older test/stuck executions existed with earlier timestamps, they occupied all 25 slots of the window forever. Execution #26 was starved.
- **Permanent Solution**: Candidate selection MUST happen in SQL with:
  1. **Predecessor check in SQL**: Exclude rows whose predecessor is not terminal (`COMPLETED`, `PARTIAL`, `FAILED`, `CANCELLED`, `SKIPPED`, `STALLED`).
  2. **Fair Partitioning**: `ROW_NUMBER() OVER (PARTITION BY e."packageId" ORDER BY e."executeAt" ASC) <= K` (e.g. $K=2$).
  3. **Concurrency Locking**: `FOR UPDATE OF e SKIP LOCKED`.

---

### Bug #3: Poison-Pill Candidate Crashing the Loop
- **Symptom**: One corrupted execution crashes worker tick, preventing all other packages from dispatching.
- **Root Cause**: Processing candidates in a single loop without individual error handling or retry backoffs.
- **Permanent Solution**:
  - Process each candidate in an isolated `try/catch` and individual `tx`.
  - On failure, increment `attempts` and set `nextAttemptAt` using exponential backoff:
    `const BACKOFF_SECONDS = [30, 60, 120, 300, 600, 1800]`.
  - After 5 attempts, auto-transition to `STALLED` with `lastError` logged.
  - Candidate query filters: `AND (e."nextAttemptAt" IS NULL OR e."nextAttemptAt" <= NOW())`.

---

### Bug #4: Unique Constraint Failed on `packageExecutionId` (`Invalid prisma.order.create()`)
- **Symptom**: Worker logs `Unique constraint failed on the fields: (packageExecutionId)`.
- **Root Cause**: `Order.packageExecutionId` is unique in Postgres. If an execution was previously linked to an order that was cancelled, and `packageExecution.orderId` was cleared/null, attempting to create a second order for the same execution fails.
- **Permanent Solution**:
  - In candidate query:
    ```sql
    AND e."orderId" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "Order" o WHERE o."packageExecutionId" = e.id)
    ```
  - In backlog reconciler: If `exec.order?.status === 'CANCELLED'`, mark execution `CANCELLED` and refund canonically; do NOT reschedule it.

---

### Bug #5: Backlog Burst Flush Danger
- **Symptom**: After fixing a stalled worker, 40+ overdue executions blast out simultaneously in a single tick.
- **Risk**: Provider rate limit, account balance drained, upstream IP ban.
- **Permanent Solution**:
  - Run `scripts/repair/overdue-executions.ts` with `--dry-run` first.
  - Overdue runs (>6h) are rescheduled forward with deterministic spacing (`now() + 30m * seq`).
  - Worker rate limit enforced: Max $K=2$ per package per tick, max 25 total per tick.

---

### Bug #6: Deceptive UI Stepper ("Active" vs "Delayed")
- **Symptom**: User sees "Day 2: Active (At 7:51 PM)" when dispatch is actually broken.
- **Root Cause**: UI stepper checked `status === 'SCHEDULED' && executeAt <= now()` and rendered "Active".
- **Permanent Solution**:
  - Added delay-awareness in [`apps/web/app/(customer)/packages/[id]/page.tsx`](file:///d:/projects/internship%20projects/SMM/apps/web/app/(customer)/packages/[id]/page.tsx):
  - If `isOverdue` (> 15 minutes past scheduled time without dispatch), badge renders `Delayed (<time>)` with alert warning colors (`amber/orange/red`).

---

### Bug #7: VPS Deployment Docker Build Disk Exhaustion
- **Symptom**: `docker compose build` fails with `no space left on device` or `ENOSPC`.
- **Root Cause**: Docker build cache and stale container layers accumulated on VPS root disk (`/dev/root`).
- **Rapid Resolution**:
  ```bash
  node scripts/vps-exec.js "docker image prune -f && docker builder prune -f"
  ```
  This immediately recovers 8GB–10GB of disk space.

---

## 3. Rapid Diagnostic Cheat Sheet (30-Second Health Check)

Run these commands to instantly know the state of production without reading code:

### 1. Check Worker Live Status & Errors
```powershell
node scripts/vps-exec.js "docker logs smm_worker --tail 40"
```
*Look for*:
- `[Query Canary] All critical raw queries passed canary health check.` (Green)
- `Dispatched X of Y due execution(s)` (Healthy dispatch)
- Any `level: 50` or `err:` strings.

### 2. Verify Zero Enum Cast Errors
```powershell
node scripts/vps-exec.js "docker logs smm_worker 2>&1 | grep '42883'"
```
*Expected*: Exit code 1 (no output = 0 occurrences).

### 3. Check Overdue Backlog (Read-Only)
```powershell
node scripts/repair/overdue-executions.ts --dry-run
```
*Expected*: Shows list of scheduled executions, age, owner, and planned action.

### 4. Check Specific Customer Package (e.g. Bholu)
```powershell
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.package.findUnique({
  where: { id: 'pkg_1793542883478_2a21679b' },
  include: { executions: { include: { order: true } } }
}).then(pkg => {
  console.log('Package:', pkg.id, 'Status:', pkg.status);
  pkg.executions.forEach(e => console.log(' Day', e.seq, e.status, 'Order:', e.order?.status || 'NONE', 'ExecAt:', e.executeAt));
}).finally(() => p.\$disconnect());
"
```

---

## 4. Deploy & Rollback Protocol
- **Deploy**: Follow [`docs/releases/v1.1.0-dispatch-fix/DEPLOY.md`](file:///d:/projects/internship%20projects/SMM/docs/releases/v1.1.0-dispatch-fix/DEPLOY.md). Run `node scripts/deploy-release-v1.1.0-vps.js`.
- **Rollback**: Follow [`docs/releases/v1.1.0-dispatch-fix/ROLLBACK.md`](file:///d:/projects/internship%20projects/SMM/docs/releases/v1.1.0-dispatch-fix/ROLLBACK.md). Re-tag previous image `infra-worker:rollback` and restart.
- **Evidence Rule**: Every deployment, test, or repair action MUST write to `docs/evidence/<timestamp>-<name>.txt` via `Tee-Object`.


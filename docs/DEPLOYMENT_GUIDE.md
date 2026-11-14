# Universal SMM Panel Deployment & Operations Guide

## 1. Architectural Principles (Zero-Build on VPS)

Our production deployment strictly adheres to the **Universal Deployment Agent Rules**:
1. **NEVER build on the VPS.** All Next.js and API builds happen locally on the developer machine or in CI. The VPS only receives and runs pre-built production artifacts.
2. **NEVER `git pull` on the VPS.** Push artifacts directly via SFTP/SCP.
3. **NEVER upload `node_modules/`, `target/`, `.venv/`, `.git/`** — only final compressed standalone build outputs (`web_dist.tar.gz`, `api_dist.tar.gz`).
4. **ONLY deploy what changed.** Detect diff before rebuilding and pushing.
5. **ALWAYS back up the current artifact** on the VPS before replacing it (enabling instant zero-downtime rollback).
6. **ALWAYS verify health checks after restart.** If health check fails within 25 attempts, automatically roll back.
7. **Fast turnaround**: Total deployment target is under 60–90 seconds.

---

## 2. Production VPS Architecture

- **Host IP**: `103.216.168.152`
- **Frontend Container**: `smm_web` (Port `3000` -> Host `3000`)
- **Backend Container**: `smm_api` (Port `4000` -> Host `4000`)
- **Database**: PostgreSQL (`smm_postgres` or external managed DB)
- **Cache & Queue**: Redis (`smm_redis`, BullMQ)
- **App Directory on VPS**: `/var/www/smm`
  - `/var/www/smm/apps/web/dist`: Web standalone distribution
  - `/var/www/smm/apps/api/dist`: API compiled JavaScript
  - `/var/www/smm/backups`: Timestamped rollback snapshots

---

## 3. Deployment Workflow

### Step 1: Type Checking & Local Production Build
```bash
# 1. Type check
pnpm --filter @smm/web exec tsc --noEmit
pnpm --filter @smm/api exec tsc --noEmit

# 2. Build Web and API locally
pnpm --filter @smm/web build
pnpm --filter @smm/api build
```

### Step 2: Packaging Standalone Artifacts
Next.js `output: 'standalone'` requires static files and routes manifests to be synchronized into the standalone directory. Run our packaging script:
```bash
node scripts/pack-standalone.js
```
This automatically:
- Copies `apps/web/.next/static` to `apps/web/.next/standalone/apps/web/.next/static`
- Copies `apps/web/public` to `apps/web/.next/standalone/apps/web/public`
- Syncs `routes-manifest.json`
- Generates `web_dist.tar.gz` (~22 MB)

### Step 3: 1-Click Fast VPS Deployment
Run the automated deployment script:
```bash
node scripts/deploy-artifacts-vps.js
```
This script executes:
1. Connects to VPS via SSH (`ssh2`).
2. Uploads `web_dist.tar.gz` and `api_dist.tar.gz` via SFTP.
3. Creates a safety rollback snapshot in `/var/www/smm/backups/`.
4. Extracts artifacts into container volume mounts.
5. Restarts `smm_api` and `smm_web` containers.
6. Polls health endpoints (`http://103.216.168.152:3000/api/health` and `http://103.216.168.152:4000/api/v1/health`) until HTTP 200 is confirmed.
7. Performs automated JWT login verification.
8. Cleans up temporary upload archives on the host.

---

## 4. Rollback Procedure

If an issue occurs on production, instant rollback is available:
```bash
# Automated rollback to previous snapshot on VPS:
ssh root@103.216.168.152 "
  LATEST_BACKUP=\$(ls -td /var/www/smm/backups/web_backup_* | head -1)
  if [ -d \"\$LATEST_BACKUP\" ]; then
    rm -rf /var/www/smm/apps/web/dist/*
    cp -r \$LATEST_BACKUP/* /var/www/smm/apps/web/dist/
    docker restart smm_web
    echo 'Rollback complete'
  fi
"
```

---

## 5. Live Verification with Playwright

Run end-to-end verification against the live VPS:
```bash
node scripts/verify-v8-compact-dashboard.js
```
Screenshots are automatically saved to `screenshots/` to confirm live visual rendering across desktop dark, desktop light, and mobile viewports.

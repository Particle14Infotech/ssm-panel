# Production Backend 5-Minute Rollback Runbook

This runbook outlines the exact, battle-tested procedure to rollback the backend from Fastify (`@smm/server`) to the legacy NestJS server (`@smm/api`) in under 5 minutes.

---

## Architecture Overview & Safety Invariants

1. **Zero Database Schema Drift**: The database schema and models are identical between `@smm/server` and `@smm/api`. No `prisma migrate` or database alterations are required during rollback.
2. **Pre-compiled Rollback Artifacts**: Both `@smm/server` and `@smm/api` are compiled during the build phase (`scripts/build-service.js`). Rollback does not require re-compiling from source.
3. **Identical Contract Surface**: All endpoints, status codes, JWT token formats, Argon2id hashes, and Redis keys are 100% compatible.

---

## Rollback Method 1: Railway (Estimated Time: ~90 seconds)

### Via Railway Web Dashboard:
1. Navigate to the **Railway Project Dashboard** -> **smm-api** service.
2. Go to **Variables**.
3. Add or update the variable:
   ```env
   USE_LEGACY_NESTJS=true
   ```
4. Click **Deploy** (or let Railway trigger automatic redeploy with the new variable).
5. The startup runner (`scripts/start-service.js`) will log:
   `[start-service] Rollback flag detected (USE_LEGACY_NESTJS=true). Starting legacy NestJS @smm/api...`

### Via Railway CLI:
```bash
railway variables --set USE_LEGACY_NESTJS=true --service smm-api
railway up --service smm-api
```

---

## Rollback Method 2: Render (Estimated Time: ~2 minutes)

### Via Render Web Dashboard:
1. Open **Render Dashboard** -> Select the backend web service (`smm-api`).
2. Go to **Environment**.
3. Locate `USE_LEGACY_NESTJS` and change its value from `false` to `true`.
4. Click **Save Changes**. Render will automatically restart the service using the pre-compiled NestJS binary.

---

## Rollback Method 3: Docker / VPS / PM2 (Estimated Time: ~30 seconds)

### Docker Compose:
```bash
# In the project root or /opt/smm on the VPS:
export USE_LEGACY_NESTJS=true
docker compose -f infra/docker-compose.prod.yml up -d --no-deps api
```

### PM2 / Systemd:
```bash
# Set environment flag and restart PM2 process
USE_LEGACY_NESTJS=true pm2 restart smm-api --update-env
```

---

## Rollback Method 4: Frontend Web Rewrites (Next.js)

If `INTERNAL_FASTIFY_URL` or `FASTIFY_ROUTE_PREFIXES` was customized on `smm-web`:
1. In the `smm-web` environment variables:
   ```env
   FASTIFY_ROUTE_PREFIXES=
   ```
   (Empty string defaults all routes to NestJS at `cleanBackend`).
2. Restart `smm-web`.

---

## Post-Rollback Health & Sanity Verification

Run the following checks to confirm NestJS is operational:

1. **Liveness Check**:
   ```bash
   curl -i https://<your-api-domain>/api/v1/health/live
   # Expected: HTTP 200 {"status":"ok", ...}
   ```
2. **Readiness Check**:
   ```bash
   curl -i https://<your-api-domain>/api/v1/health/ready
   # Expected: HTTP 200 {"status":"ready", "services":{"database":"connected", ...}}
   ```
3. **Auth Check**:
   Test a login request with an existing user:
   ```bash
   curl -X POST https://<your-api-domain>/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@smmpanel.internal","password":"<your-password>"}'
   # Expected: HTTP 200/201 with JWT access token
   ```

---

## Re-enabling Fastify (`@smm/server`)

To return to Fastify after resolving any upstream issues:
1. Set `USE_LEGACY_NESTJS=false` (or remove the variable).
2. Redeploy or restart the backend service.

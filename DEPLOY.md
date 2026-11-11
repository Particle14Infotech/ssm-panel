# Deployment Runbook: Zero-Friction Autopilot

**Document:** `DEPLOY.md`  
**Target Release:** `v-youpi-pilot-i1`  
**Deploy Guard:** Deploy ONLY when explicit operator command `deploy <release id>` is received.  
**Default Posture:** Dark Launch / Master Feature Flags Strictly **OFF**.

---

## 1. Safety Principles & Invariants
1. **Never Deploy While Flags Are Active:** Feature flags must default to `false` in production.
2. **Never Run `prisma db push` in Production:** Use `prisma migrate deploy` (or `prisma migrate resolve` if baselining existing database).
3. **Simulation Guard:** Production will refuse to boot if `SIMULATE_UPSTREAM_ORDERS=true`. Ensure this is `false` on VPS.
4. **Phased Rollout:**
   - Step 1: Admin allowlist only (internal team accounts).
   - Step 2: YouTube & Telegram only (official APIs).
   - Step 3: Instagram / TikTok stay on paste-link fallback until approved graph credentials exist.

---

## 2. Pre-Flight Verification Checklist
Run these commands on the target environment prior to cutover:

```bash
# 1. Verify Node environment and production flags
node -e 'if (process.env.NODE_ENV !== "production") console.error("NODE_ENV is not production");'
node -e 'if (process.env.SIMULATE_UPSTREAM_ORDERS === "true") throw new Error("SIMULATION MUST BE FALSE IN PROD");'

# 2. Check Database Connectivity and Migration Baseline
npx prisma migrate status

# 3. Check Secrets Validation (no dummy secrets, length >= 32)
npm --prefix apps/api run test -- test/package-secrets-hardening-s4.spec.ts
```

---

## 3. Production Deployment Procedure

### Step 1: Baseline Existing Database Migrations (If Needed)
If `neondb` was historically provisioned via `prisma db push`, baseline the 19 migration files:
```bash
# Mark all prior migrations as applied without re-running DDL
npx prisma migrate resolve --applied 20261015000000_baseline
npx prisma migrate resolve --applied 20261104113000_youpi_pilot_schema
# Verify status is clean
npx prisma migrate status
```

### Step 2: Build & Deploy Binaries
```bash
git fetch origin
git checkout <RELEASE_TAG_OR_COMMIT>
pnpm install --frozen-lockfile
pnpm build
```

### Step 3: Restart Services
```bash
pm2 restart smm-api
pm2 restart smm-worker
pm2 restart smm-web
```

### Step 4: Verify Boot Logs
Check stdout for the security boot line:
```
[BOOT] UPSTREAM_DISPATCH_MODE: LIVE_DISPATCH (Real Provider API Orders Active)
```
Ensure NO secrets are printed in logs.

---

## 4. Phased Feature Flag Activation

### Phase A: Internal Admin Allowlist
Enable Autopilot strictly for admin UUIDs:
```sql
UPDATE "SystemSetting" 
SET value = '{"enabled": false, "admin_allowlist": ["usr_admin_1", "usr_admin_2"], "platforms": {"youtube": true, "telegram": true, "instagram": false}}'
WHERE key = 'feature_flags_autopilot';
```

### Phase B: General Availability (Official Platforms Only)
```sql
UPDATE "SystemSetting" 
SET value = '{"enabled": true, "platforms": {"youtube": true, "telegram": true, "instagram": false}}'
WHERE key = 'feature_flags_autopilot';
```
*(Instagram remains on paste-link fallback for organic user experience without scraping).*


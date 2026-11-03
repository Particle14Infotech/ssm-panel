# Deploy Pack: Release R2 (Expand Schema, Flags, Bootstrap)

**Release:** R2  
**Target:** Live Production VPS (`103.216.168.152`)  
**Operator:** Human System Administrator (Agent has NO direct production access)  
**Safety Classification:** Expand-Only, Zero-Downtime, Backward-Compatible  

---

## 1. Pre-Deployment Backup (Rule L4)
Before executing any migration on production, take a full database snapshot:
```bash
# 1. SSH into VPS
ssh root@103.216.168.152

# 2. Execute pg_dump inside smm_postgres container
docker exec smm_postgres pg_dump -U smm_user -d smm_db -F c -b -v -f /var/lib/postgresql/data/backup_pre_r2_$(date +%Y%m%d_%H%M%S).dump

# 3. Verify backup file exists and has non-zero bytes
docker exec smm_postgres ls -lh /var/lib/postgresql/data/backup_pre_r2_*.dump
```

---

## 2. Migration Execution (Expand-Only)
The migration contains strict timeouts (`SET lock_timeout = '2s'; SET statement_timeout = '10s';`) to ensure live web and worker operations are never blocked.
```bash
cd /root/ssm-panel

# Run migration through Prisma Migrate Deploy
docker exec smm_api pnpm prisma migrate deploy
```

---

## 3. Container Rebuild & Rolling Restart
```bash
cd /root/ssm-panel/infra
docker compose -f docker-compose.prod.yml build api web
docker compose -f docker-compose.prod.yml up -d api
sleep 5
docker compose -f docker-compose.prod.yml up -d web
```

---

## 4. Post-Deployment Smoke Tests
1. **Health Check:**
   ```bash
   curl -sS -I http://localhost:4000/api/v1/health
   curl -sS -I http://localhost:3000/login
   ```
2. **Bootstrap API Verification:**
   ```bash
   curl -sS http://localhost:4000/api/v1/new-order/bootstrap?platform=INSTAGRAM | jq .platform
   # Output must be: "INSTAGRAM"
   ```
3. **Verify Feature Flags Default OFF:**
   ```bash
   curl -sS http://localhost:4000/api/v1/new-order/bootstrap?platform=INSTAGRAM | jq .flags
   # Output must show: "new_order_v2": false, "tab_custom_drip": false, "tab_combos": false, "tab_autopilot": false
   ```

---

## 5. One-Click Kill Switch (Rule L3)
If any anomaly is observed:
```bash
# Disable all R2-R6 flags instantly via Redis flush / flag update
docker exec smm_redis redis-cli del "system:feature_flags"
```
Users without the flag continue seeing the existing unchanged UI.


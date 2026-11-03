# Deploy Pack: Release R3 (Shell & Tab 1 Single Order V2)

**Release:** R3  
**Target:** Live Production VPS (`103.216.168.152`)  
**Operator:** Human System Administrator (Agent has NO direct production access)  
**Safety Classification:** Flag-Guarded (`new_order_v2`), Admin-Only Rollout First  

---

## 1. Pre-Deployment Verification
Verify R2 schema expansion has been applied on production:
```bash
ssh root@103.216.168.152
curl -sS http://localhost:4000/api/v1/new-order/bootstrap?platform=INSTAGRAM | jq .platform
# Output must be: "INSTAGRAM"
```

---

## 2. Code Deployment & Web Container Rebuild
Sync updated frontend code to the VPS and rebuild `smm_web`:
```bash
cd /root/ssm-panel/infra
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d web
sleep 3
docker ps | grep smm_web
```

---

## 3. Flag Activation (Admins Only First - Rule L3)
Activate `new_order_v2` for administrators and test users by adding their UUIDs to the allowlist:
```bash
# Set flag for Admin allowlist via PostgreSQL
docker exec smm_postgres psql -U smm_user -d smm_db -c "
UPDATE \"SystemSetting\" 
SET value = jsonb_set(
  value, 
  '{new_order_v2}', 
  '{\"enabled\": true, \"allowlist\": [\"admin@smmpanel.internal\"], \"percentage\": 0}'
) 
WHERE key = 'feature_flags';
"

# Invalidate cache so new flags take effect immediately
docker exec smm_redis redis-cli del "system:feature_flags"
docker exec smm_redis redis-cli keys "new_order:bootstrap:*" | xargs -r docker exec smm_redis redis-cli del
```

---

## 4. Production Smoke Tests (Test Account Only)
1. **Visit New Order with Flag/Query:**
   Open `https://103.216.168.152/new-order?tab=single&platform=instagram`
2. **Verify 4 Tabs Present:**
   `[⚡ Single Order] [Custom Drip (7-10 Days)] [Combo Packages] [Auto-Pilot]`
3. **Verify Platform Switcher:**
   Click YouTube / TikTok — observe category and service dropdown updates without page reload.
4. **Link Validation Check:**
   Enter `http://` or invalid URL — verify inline validation error: "Only secure https:// URLs are allowed."
5. **Real-Time Quote Check:**
   Enter quantity `1000` — verify sticky summary calculates total due and balance comparison.

---

## 5. Instant Kill Switch
If any issue is detected, flip the flag back to OFF:
```bash
docker exec smm_postgres psql -U smm_user -d smm_db -c "
UPDATE \"SystemSetting\" 
SET value = jsonb_set(value, '{new_order_v2,enabled}', 'false') 
WHERE key = 'feature_flags';
"
docker exec smm_redis redis-cli del "system:feature_flags"
```
All users immediately revert to the legacy single order view without any container restart.


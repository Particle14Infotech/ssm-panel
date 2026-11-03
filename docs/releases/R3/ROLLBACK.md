# Rollback Pack: Release R3

**Release:** R3  
**Target:** Live Production VPS (`103.216.168.152`)  
**Operator:** Human System Administrator  

---

## 1. Zero-Downtime Rollback (Immediate Flag Deactivation)
Because R3 lives strictly behind `new_order_v2`, deactivating the flag instantly returns 100% of traffic to the pre-existing interface:
```bash
# Deactivate new_order_v2 flag
docker exec smm_postgres psql -U smm_user -d smm_db -c "
UPDATE \"SystemSetting\" 
SET value = jsonb_set(
  value, 
  '{new_order_v2}', 
  '{\"enabled\": false, \"allowlist\": [], \"percentage\": 0}'
) 
WHERE key = 'feature_flags';
"

# Flush cache
docker exec smm_redis redis-cli del "system:feature_flags"
docker exec smm_redis redis-cli keys "new_order:bootstrap:*" | xargs -r docker exec smm_redis redis-cli del
```

---

## 2. Web Container Rollback
If a code rollback is preferred:
```bash
cd /root/ssm-panel
git checkout a52981b apps/web/app/\(customer\)/new-order/page.tsx
cd infra
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d web
```
No database rollback is needed because R3 introduces no new database columns.


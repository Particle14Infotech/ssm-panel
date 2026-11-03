# Rollback Pack: Release R2

**Release:** R2  
**Target:** Live Production VPS (`103.216.168.152`)  
**Operator:** Human System Administrator  

---

## 1. Instant Software Rollback (Via Flags - Zero Downtime)
Because all R2 changes are backward-compatible and behind feature flags (default OFF), no database restore is required for rollback:
```bash
# 1. Turn off new_order_v2 flag
docker exec smm_postgres psql -U smm_user -d smm_db -c "
UPDATE \"SystemSetting\" 
SET value = '{\"new_order_v2\":{\"enabled\":false,\"allowlist\":[],\"percentage\":0},\"tab_custom_drip\":{\"enabled\":false,\"allowlist\":[],\"percentage\":0},\"tab_combos\":{\"enabled\":false,\"allowlist\":[],\"percentage\":0},\"tab_autopilot\":{\"enabled\":false,\"allowlist\":[],\"percentage\":0},\"theme_light\":{\"enabled\":false,\"allowlist\":[],\"percentage\":0},\"dashboard_v2\":{\"enabled\":false,\"allowlist\":[],\"percentage\":0},\"auto_detect\":{\"enabled\":false,\"allowlist\":[],\"percentage\":0}}'::jsonb 
WHERE key = 'feature_flags';
"

# 2. Invalidate Redis cache
docker exec smm_redis redis-cli del "system:feature_flags"
docker exec smm_redis redis-cli keys "new_order:bootstrap:*" | xargs -r docker exec smm_redis redis-cli del
```

---

## 2. Code Revert (Previous Version against New Schema)
Rule L6 guarantees that previous code runs without error against the expanded schema because all additions are nullable or have default values:
```bash
cd /root/ssm-panel
git checkout a52981b
cd infra
docker compose -f docker-compose.prod.yml build api web
docker compose -f docker-compose.prod.yml up -d api web
```

---

## 3. Disaster Recovery (Restore from Pre-Migration Backup)
Only in the catastrophic event of database corruption:
```bash
# Terminate active backend connections
docker exec smm_postgres psql -U smm_user -d smm_db -c "
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'smm_db' AND pid <> pg_backend_pid();
"

# Restore database from backup taken in Step 1 of DEPLOY.md
docker exec smm_postgres pg_restore -U smm_user -d smm_db --clean --if-exists -v /var/lib/postgresql/data/<backup_filename>.dump
```


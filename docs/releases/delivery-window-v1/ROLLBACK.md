# ROLLBACK PROCEDURE: Delivery Window Scheduling & Pure Engine

**Release ID**: `delivery-window-v1`

---

## Fast Rollback (Feature Flag Kill Switch - Immediate, 0 Downtime)
If unexpected behavior occurs in production, perform an instantaneous rollback using the feature flag kill switch:

```bash
# In API console or via Admin UI
POST /api/v1/admin/settings/flags/delivery_window/kill-switch
```
Or via database update:
```sql
UPDATE "SystemSetting"
SET value = jsonb_set(value, '{delivery_window}', '{"enabled": false, "allowlist": [], "percentage": 0}')
WHERE key = 'feature_flags';
```
*Result*: All quote and purchase requests revert to standard unconstrained scheduling without interrupting running campaigns.

---

## Full Application Rollback
If application code must be reverted to previous commit:

1. Re-deploy previous commit artifact / git checkout previous SHA:
   ```bash
   git checkout <PREVIOUS_STABLE_COMMIT>
   pnpm build
   pm2 restart smm-api smm-worker smm-web
   ```
2. Database Schema:
   - **DO NOT** drop columns or tables immediately. The database changes are strictly expand-only and fully backward compatible with older application code (older code simply ignores `deliveryWindow`, `plannedAt`, `dispatchedAt`, and `PackageEvent`).
   - If database cleanup is desired after decommission:
     ```sql
     -- Optional cleanup (run only after full code deprecation)
     DROP TABLE IF EXISTS "PackageEvent";
     ALTER TABLE "PackageExecution" DROP COLUMN IF EXISTS "plannedAt";
     ALTER TABLE "PackageExecution" DROP COLUMN IF EXISTS "dispatchedAt";
     ALTER TABLE "PackageRule" DROP COLUMN IF EXISTS "deliveryWindow";
     ALTER TABLE "Package" DROP COLUMN IF EXISTS "rescheduleCount";
     ```


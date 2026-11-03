# Release R6: Tab 3 Combo Packages & Theme Rollback Pack

**Release ID:** R6  
**Target:** Safe immediate deactivation without database mutation or downtime.

---

## 1. Instant Kill Switch (One-Click / REST)
To instantly revert all users to legacy packages without redeploying:
```bash
curl -X POST https://api.smm-panel.example.com/api/v1/settings/flags/tab_combos/kill \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
Or via database setting directly:
```sql
UPDATE "SystemSetting" 
SET value = jsonb_set(value::jsonb, '{enabled}', 'false')
WHERE key = 'flags:tab_combos';
```

## 2. Code Revert Steps (If Necessary)
1. Since schema additions from R2 were expand-only, previous code versions run with zero schema conflicts.
2. Checkout previous commit:
   ```bash
   git checkout a52981bfd4b99b284901d431aaa1a1999b9c7ebd~1
   pnpm install
   pnpm build
   ```
3. Restart frontend processes.

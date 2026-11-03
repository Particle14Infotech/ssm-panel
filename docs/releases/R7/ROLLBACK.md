# Release R7: Tab 4 Auto-Pilot & Package Controls Rollback Pack

**Release ID:** R7  
**Target:** Safe immediate deactivation without database mutation or downtime.

---

## 1. Instant Kill Switches (One-Click / REST)
To instantly disable Tab 4, package controls, and dashboard v2:
```bash
curl -X POST https://api.smm-panel.example.com/api/v1/settings/flags/tab_autopilot/kill \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl -X POST https://api.smm-panel.example.com/api/v1/settings/flags/pkg_controls/kill \
  -H "Authorization: Bearer $ADMIN_TOKEN"

curl -X POST https://api.smm-panel.example.com/api/v1/settings/flags/dashboard_v2/kill \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

## 2. Code Revert Steps (If Necessary)
1. Since schema additions are expand-only, previous code versions run with zero schema conflicts.
2. Checkout previous commit:
   ```bash
   git checkout a52981bfd4b99b284901d431aaa1a1999b9c7ebd~1
   pnpm install
   pnpm build
   ```
3. Restart frontend and backend processes.


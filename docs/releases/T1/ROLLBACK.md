# Rollback Procedure: Release T1

**Release ID:** T1  
**Target:** Immediate restoration to pre-T1 state if any visual or operational regression occurs.

---

## 1. Fast Kill Switch (< 30 seconds, zero deployment)

If any visual anomaly, contrast issue, or toggle malfunction occurs in production, immediately kill the feature flags:

```bash
# 1. Kill theme_light toggle (hides toggle from all users)
curl -X POST https://api.smm-panel.example.com/api/v1/settings/flags/theme_light/kill \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 2. Kill theme_v2
curl -X POST https://api.smm-panel.example.com/api/v1/settings/flags/theme_v2/kill \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Once killed, the client UI instantly reverts to the default legacy dark mode behavior.

---

## 2. Full Code Rollback

If a hard rollback of the release commit is required:
1. Revert commit to previous SHA:
   ```bash
   git revert a52981bfd4b99b284901d431aaa1a1999b9c7ebd -m 1
   git push origin main
   ```
2. Database: Note that the schema migration for `themePreference` is **expand-only** (`nullable String?`), so no database downgrade or downtime is required.


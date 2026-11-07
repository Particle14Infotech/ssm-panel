# Link Preview Rollback Guide (v-link-preview)

## 1. Fast Kill Switch (Zero Downtime)
If any upstream degradation, latency spike, or unexpected edge case occurs, the feature can be killed immediately without deploying code or restarting services.

### Rapid Flag Disable (Redis / Admin Dashboard)
In the Redis CLI or Admin Feature Flags manager, set:
```bash
# Emergency Kill Switch: Disables all link preview requests globally
SET feature_flag:link_preview 0
```
Or via API:
```bash
curl -X PATCH "https://api.smm.internal/api/v1/settings/flags/link_preview" \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### Result of Kill Switch
1. `/api/v1/link-preview` immediately returns HTTP 404 (`Link preview feature is not enabled`).
2. Client-side `LinkPreviewCard` gracefully transitions to the local recognition card (`Link recognised`).
3. Users continue to paste links and submit orders with zero interruption.
4. Ordering is NEVER blocked.

---

## 2. Per-Platform Kill Switch
If an issue is isolated to a single platform (e.g. YouTube oEmbed starts rate-limiting with 429):
```bash
# Disable YouTube only
SET feature_flag:link_preview_youtube 0

# Disable TikTok only
SET feature_flag:link_preview_tiktok 0
```
Other platforms remain active, while the disabled platform falls back to local card recognition.

---

## 3. Code Rollback Procedure
If a full git rollback is required:
```bash
# 1. Revert to previous release tag or commit
git revert --no-edit <commit-hash>

# 2. Rebuild contracts, API, and web
pnpm --filter @smm/contracts build
pnpm --filter @smm/api build
pnpm --filter @smm/web build

# 3. Reload PM2 processes
pm2 reload smm-api
pm2 reload smm-web

# 4. Invalidate link preview Redis keys
redis-cli KEYS "link_preview:*" | xargs redis-cli DEL
```

---

## 4. Verification After Rollback
1. Verify that `GET /api/v1/link-preview` returns 404.
2. Verify that `/new-order` loads normally and the link input accepts URLs with local validation.
3. Verify that orders can be successfully placed and paid for.


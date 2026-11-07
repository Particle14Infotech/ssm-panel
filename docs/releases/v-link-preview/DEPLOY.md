# Link Preview Deployment & Rollout Guide (v-link-preview)

## 1. Overview
The Link Preview subsystem provides rich media hints under every post, reel, and video link input across the SMM panel (New Order tabs, package slot Start delivery, favorites, and order detail).

### Invariants & Non-Negotiables
- **Zero Scraping & SSRF Protection**: The server NEVER fetches user-supplied URLs. Upstream requests are constructed strictly using fixed host templates and validated linear IDs.
- **Copy Standard**: Marketing buzzwords promising total certainty, instantaneous delivery, or absolute guarantees are strictly forbidden across UI, API, and documentation. Previews are hints, never gates for ordering.
- **Local Fallback**: Any upstream outage, rate limit (429), or unknown status falls back to local card recognition (`Link recognised`), ensuring zero blocked orders.
- **Instagram Decision Gate**: As established in LP0, tokenless Instagram Graph API does not return thumbnail or author information. Instagram links remain entirely on high-performance local cards with zero external dependencies.

---

## 2. Pre-Deployment Verification Checklist
- [x] LP1 Contract Unit & Property Fuzz Tests: 20/20 PASS (10,000 hostile strings).
- [x] LP2 Backend Security Gates: 19/19 PASS (SSRF, XSS escaping, 64KB body limit, 2s timeout, single-flight coalescing, negative cache, circuit breakers, 30/min user throttle).
- [x] LP3 Frontend Integration: `LinkPreviewCard` integrated into `SingleOrderTab`, `CustomDripTab`, package slot Start (`packages/[id]/page.tsx`), favorites, and order details.
- [x] LP4 Playwright Quality Gate: 12/12 PASS (Axe WCAG 2.1 AA compliant across all five changed pages, 0 critical/serious violations, CLS = 0.005).
- [x] LP4 Mutation Test Gate: 7/7 mutations detected and killed (7/7 Protection Assured).
- [x] Forbidden Words Gate: 0 occurrences of forbidden marketing buzzwords.

---

## 3. Deployment Steps

### Step 1: Database Migration
No new tables or schema migrations are required for link preview. Feature flags use existing Redis & Neon database flag settings.

### Step 2: Build & Deploy Contracts, API, and Web
```bash
# 1. Build contracts
pnpm --filter @smm/contracts build

# 2. Build API
pnpm --filter @smm/api build

# 3. Build Web
pnpm --filter @smm/web build

# 4. Restart services
pm2 reload smm-api
pm2 reload smm-web
```

---

## 4. Feature Flag Rollout Order
All flags default to **OFF** (`false`). Enable strictly in the following phased order:

### Phase 1: Internal Staff & Admins (Day 1)
- Master Flag: `link_preview = ALLOWLIST (admin user IDs only)`
- Platform Flags:
  - `link_preview_youtube = true` (Admin only)
  - `link_preview_tiktok = true` (Admin only)
  - `link_preview_instagram = false` (Remains on local recognition card)
- **Watch**: Verify that non-admin requests receive clean local cards or 404 from backend without errors.

### Phase 2: Beta Allowlist (Day 2 - Day 3)
- Enable for 5% of active customers via the allowlist mechanism in `FeatureFlagsService`.
- **Metrics to monitor**:
  - Redis cache hit rate (target > 85%)
  - Upstream latency p95 (< 600ms)
  - Upstream 429 count (< 0.1%)
  - Circuit breaker trips (0 trips expected)

### Phase 3: General Availability (Day 4+)
- Master Flag: `link_preview = ON`
- Platform Flags:
  - `link_preview_youtube = ON`
  - `link_preview_tiktok = OFF` (Strict rule: TikTok oEmbed is not checked from production egress IP; remains OFF until checked by operator)
  - `link_preview_instagram = OFF` (Strict rule: Keep OFF until tokenized Meta Graph API permissions are granted and approved)

---

## 5. Telemetry & Alerts to Monitor
1. **Cache Hit Rate**: Key `link_preview:*` should trend toward >85% after first 24 hours.
2. **Upstream Latency p95**: Must remain under 800ms. Timeout trips at 2.0s.
3. **HTTP 429 Count**: Monitored via `metrics.status429s`. If 429s exceed 10/min, upstream rate budget is being saturated.
4. **Circuit Breaker State**: Trips if 5 consecutive failures occur within 30 seconds. Cooldown is 60 seconds before half-open probe.
5. **Customer Support Tickets**: Monitor support tickets for reports of incorrect thumbnail associations or link confusion.


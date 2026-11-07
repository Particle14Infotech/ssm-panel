# Link Preview Architecture & LP0 Study Document

- **Commit**: `48266b94b93afee04691e1266ce155a9b08bd78e`
- **Branch**: `chore/fastify-migration`
- **Database**: `neondb`
- **Date**: 2026-11-06

---

## 1. Study of Existing Link Validation & Inputs

### 1.1 Existing Validators in Codebase
- **`packages/contracts/src/link-validation.ts` (`validateServiceLink`)**:
  - Handles `INSTAGRAM`, `YOUTUBE`, `TIKTOK`, `X_TWITTER`, `TELEGRAM`.
  - Distinguishes between `PROFILE` (or `CHANNEL`) vs `POST_OR_REEL`.
  - Returns `{ isValid: boolean, error?: string, detectedType?: "PROFILE" | "POST_OR_REEL" | "CHANNEL" | "OTHER" }`.
- **`apps/api/src/modules/platforms/platform-rules.util.ts` (`validatePlatformLink`)**:
  - Validates handle regexes, allowlisted hosts, and link patterns against database `PlatformRules`.

### 1.2 Every Place Where a Link is Entered
1. **New Order Screen (`apps/web/app/(customer)/new-order/page.tsx`)**:
   - Single Order tab (`state.targetUrl` input).
   - Drip-Feed tab (`state.targetUrl` input).
   - Package / Combo / Autopilot builders (`PackageOrderBuilder.tsx`, `CustomPackageBuilder.tsx` `targetUrl` inputs).
2. **Package Slot Delivery / Start Screen (`apps/web/app/(customer)/packages/[id]/page.tsx`)**:
   - "Start Delivery for New Post" card (`postLink` input used for post trigger and schedule start).
3. **Favorites Management (`apps/web/app/(customer)/favorites/page.tsx`)**:
   - Favorite target URL cards and "Use / Reorder" prefill button.
4. **Order Detail View (`apps/web/app/(customer)/orders/[id]/page.tsx`)**:
   - Target URL preview in the order overview summary card.

---

## 2. LP0 Live Staging Calls Study (Empirical Evidence)

All calls were executed in read-only staging and recorded with nanosecond-resolution latency and full response header capture. Evidence file: `docs/evidence/2026-11-06-lp0-oembed-study.txt` & `.json`.

| Category | Upstream URL Tested | HTTP Status | Latency | Title Present | Author Present | Thumbnail URL Present | Thumbnail Dimensions | Thumbnail Host | HTML Present |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **YouTube Public Video** | `https://www.youtube.com/watch?v=dQw4w9WgXcQ` | `200 OK` | 284.1 ms | `Yes` ("Rick Astley...") | `Yes` ("Rick Astley") | `Yes` | 480 × 360 | `i.ytimg.com` | `Yes` (iframe) |
| **YouTube Public Short** | `https://www.youtube.com/shorts/kJQP7kiw5Fk` | `200 OK` | 103.0 ms | `Yes` ("Luis Fonsi...") | `Yes` ("LuisFonsiVEVO") | `Yes` | 480 × 360 | `i.ytimg.com` | `Yes` (iframe) |
| **YouTube Unavailable Video** | `https://www.youtube.com/watch?v=00000000000` | `404 Not Found` | 122.7 ms | `No` | `No` | `No` | — | — | `No` |
| **TikTok Public Video** | `https://www.tiktok.com/@tiktok/video/7106594312292453678` | `302 Found` (redirect to `/in/about`) | 711.3 ms | `No` | `No` | `No` | — | — | `No` |
| **TikTok Removed / Private** | `https://www.tiktok.com/@tiktok/video/0000000000000000000` | `302 Found` (redirect to `/in/about`) | 307.3 ms | `No` | `No` | `No` | — | — | `No` |
| **Instagram Tokenless Reel** | `https://graph.facebook.com/v21.0/instagram_oembed?url=...` | `200 OK` | 299.1 ms | `No` | `No` | `No` | — | — | `Yes` (blockquote) |
| **Instagram Tokenless Post** | `https://graph.facebook.com/v21.0/instagram_oembed?url=...` | `400 Bad Request` (`OAuthException` #24) | 269.7 ms | `No` | `No` | `No` | — | — | `No` |
| **Instagram Legacy API** | `https://api.instagram.com/oembed?url=...` | `301 Moved Permanently` | 409.5 ms | `No` | `No` | `No` | — | — | `No` |

---

## 3. The Instagram Decision Gate

### Decision Rule
> *"Enable only if tokenless access works AND thumbnail_url and author_name are returned AND the rate limit fits our expected volume; otherwise keep local card only."*

### Empirical Finding:
1. **Tokenless Post**: Returns HTTP 400 (`OAuthException` code 24: *"The requested media could not be embedded either because it does not exist or you don't have permission to embed it."*).
2. **Tokenless Reel**: Returns HTTP 200, but only returns `['version', 'provider_name', 'provider_url', 'type', 'width', 'html']`.
   - `thumbnail_url` is **NOT returned**.
   - `author_name` is **NOT returned**.
   - `title` is **NOT returned**.
3. **Hard Constraint Check**: The prompt strictly specifies *"never render oEmbed html"* and *"no scraping, no OpenGraph parsing of platform pages"*.

### **Gate Verdict: FAILED -> LOCAL CARD ONLY**
Instagram links will **NOT** make upstream oEmbed requests. Instead, they will be handled by the **Local Link Recognizer Card**:
- Identifies Instagram Reel vs Post vs Profile from URL syntax.
- Displays platform icon, media type badge (`REEL` or `POST`), media ID/handle.
- Friendly helper copy: *"Preview isn't available for this link. You can still place the order."*
- Zero network latency, zero token requirement, zero rate-limit risk.

---

## 4. Allowed Thumbnail Hosts & CSP Configuration

### Upstream Allowed Thumbnail Hosts (HTTPS only)
1. `i.ytimg.com` (YouTube main thumbnail CDN)
2. `img.youtube.com` (YouTube fallback thumbnail CDN)
3. `p16-sign-va.tiktokcdn.com`, `p16-sign.tiktokcdn-us.com`, `*.tiktokcdn.com` (TikTok CDN when TikTok preview enabled)

Any thumbnail URL pointing to a host not in this strict allowlist will be discarded (`thumbnailUrl = null`).

### Content Security Policy (`CSP`) Architecture
Note: Next.js `images.remotePatterns` only applies to Next.js `<Image />` optimizer requests and does NOT restrict native `<img>` tags in the DOM. Browser containment requires HTTP CSP `img-src`:
```http
Content-Security-Policy: img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com https://*.tiktokcdn.com https://images.unsplash.com https://lh3.googleusercontent.com;
```
See `docs/SECURITY_FINDINGS.md` for the full CSP audit and phased rollout plan.

---

## 5. Cache TTLs & Redis Storage Strategy

All preview results are cached in Redis keyed by `link_preview:{platform}:{mediaId}`:

1. **Success TTL (`status: OK`)**: **24 hours** (86,400 seconds). YouTube/TikTok video metadata is immutable for public videos.
2. **Negative TTL (`status: NOT_FOUND` or `UNAVAILABLE`)**: **10 minutes** (600 seconds). Prevents hammer attacks on deleted or non-existent URLs.
3. **Stale-While-Revalidate (`SWR`)**: **1 hour** (3,600 seconds). If a cached entry is older than 24h, serve cached response while refreshing asynchronously in the background.

---

## 6. Rate Budgets, Concurrency & Circuit Breakers

1. **Per-User Throttle**: 30 requests / minute (sliding window in Redis).
2. **Per-IP Throttle**: 60 requests / minute (for unauthenticated or shared networks).
3. **Upstream Token Bucket**:
   - YouTube oEmbed: Max 10 req/s, burst 20.
   - TikTok oEmbed: Max 5 req/s, burst 10.
4. **Single-Flight Request Coalescing**:
   - In-memory / Redis lock so that 50 parallel requests for the same URL execute exactly **one** upstream fetch.
5. **Circuit Breaker**:
   - Trips if 5 consecutive 5xx or timeouts occur within 30 seconds.
   - Enters `OPEN` state for 60 seconds (immediately returns `status: UNAVAILABLE` with local fallback without calling upstream).
   - Enters `HALF_OPEN` state, testing 1 request before fully resetting.

---

## 7. Data Transfer Object (DTO) Specifications

```typescript
export type LinkPreviewPlatform = "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "X_TWITTER" | "TELEGRAM" | "UNKNOWN";
export type LinkPreviewKind = "REEL" | "POST" | "VIDEO" | "SHORT" | "STATUS" | "PROFILE" | "UNKNOWN";
export type LinkPreviewStatus = "OK" | "NOT_FOUND" | "UNAVAILABLE";

export interface LinkPreviewDto {
  platform: LinkPreviewPlatform;
  kind: LinkPreviewKind;
  mediaId: string | null;
  canonicalUrl: string | null;
  title: string | null;
  authorName: string | null;
  thumbnailUrl: string | null;
  status: LinkPreviewStatus;
}
```

- `title` is sanitized (HTML stripped/escaped) and truncated to max 120 chars.
- `authorName` is sanitized and truncated to max 60 chars.
- `html` from oEmbed is **completely ignored and discarded** (never forwarded or rendered).

---

## 8. Open Questions for User Approval Before LP1/LP2

1. **Instagram Local Card**: The Instagram decision gate failed because tokenless oEmbed does not return `thumbnail_url` or `author_name`. We will keep Instagram on the local link card (instant, shows Reel/Post badge and link recognition without external calls). Please confirm you approve keeping Instagram local-only.
2. **TikTok Geoblocking Handling**: TikTok's official oEmbed returns `302 Found` with redirect to `https://www.tiktok.com/in/about` when accessed from Indian IP ranges. Under our strict no-redirect rule, should the backend treat this as `status: "UNAVAILABLE"` (rendering the clean local card) so users can still place orders without hindrance?
3. **Client-Side Instant Thumbnail for YouTube**: For YouTube links, the thumbnail URL is deterministically `https://i.ytimg.com/vi/${mediaId}/hqdefault.jpg`. Can the frontend render this image client-side immediately while the title/author loads from the API, eliminating any visual wait time for the user?


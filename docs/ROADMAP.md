# SMM Panel — Future Feature Roadmap & Product Backlog

> **Status**: Saved for future implementation. None of these features are currently active in `main` or `feature/package-engine`.
> Last updated: 2026-10-21

---

## 1. Core Drip-Feed & Anti-Ban Delivery Engine

### 1.1 Randomized Quantity & Interval Jitter
- Eliminate robotic delivery patterns by randomizing both batch quantities **and** time intervals per dispatch.
- **Example**: Dispatch 14 views after 42 minutes → 19 views after 67 minutes → 11 views after 53 minutes.
- Apply jitter to all metric types: views, followers, reach, subscribers, likes.
- Jitter band configurable per service tier (Standard: ±10%, Stealth: ±40%).

### 1.2 Circadian Rhythm / "Night-Mode" Throttling (Geo-Aware)
- When a user selects a specific country or state (e.g. Karnataka, India or California, USA), the drip engine must automatically suppress traffic during local sleep hours.
- **Night throttle rule**: Reduce delivery rate by **80%** between `01:00–06:00` local time in the target timezone.
- **Evening ramp-up**: Boost delivery rate by **1.5×** during `19:00–23:00` local peak hours.
- Implementation note: Store IANA timezone on order creation, resolve in scheduler before each batch dispatch.

### 1.3 Cross-Platform Compatibility
- Support slow-drip delivery across all major international social networks:
  - Instagram, YouTube, TikTok, X/Twitter, Facebook, LinkedIn, Telegram, Spotify
- Map service `targetType` to platform-specific constraints and URL rules.
- LinkedIn and Spotify require new `PlatformConfig` seeds.

### 1.4 Local Queue Holding & Micro-Batch API Dispatch

#### 1.4.1 Master Order Storage (Already Partially Implemented)
- Total order quantity and remaining pending balance stored locally in `PackageExecution` table.
- Next step: Add `pendingQty` field per execution row with reconciliation on partial fills.

#### 1.4.2 Sequential Lock-And-Verify Protocol
- Before dispatching the next micro-batch to an upstream provider, the middleware must:
  1. Call `action=status&id={prev_batch_id}` on the provider API.
  2. Verify `status == "completed"` before firing the next batch.
- Prevents `start_count` collisions and overlapping deliveries on the same link.
- Store `providerBatchId` and `lastStatusCheckAt` on `PackageExecution`.

#### 1.4.3 Multi-API Bundle Routing (Single Package → Multiple Providers)
- A single user-facing package (e.g. "Complete Viral Post Pack") should split payload across multiple upstream providers simultaneously:
  - Views → Provider A
  - Custom Comments → Provider B
  - Shares → Provider C
- Requires `PackageRule.preferredProviderId` override field and routing logic in the scheduler.

### 1.5 Service Failing / Auto-Failover

#### 1.5.1 Automated Failover
- If an upstream API service goes offline mid-campaign (consecutive failures ≥ N), the router automatically switches remaining pending batches to a backup provider.
- Add `backupProviderId` and `backupServiceId` fields to `Service` model.
- Trigger: 3 consecutive provider errors within a 15-minute window.

#### 1.5.2 User "Service Not Working" Action
- Dedicated one-click report/refill trigger inside order history.
- Allows users to:
  - Flag a stalled link.
  - Pause the active drip queue.
  - Trigger an automated API health check.
- Backend: `POST /orders/:id/report-stalled` → pauses execution batch, queues health check job.

---

## 2. Order Customization, Geo-Targeting & Package Tiers

### 2.1 Custom Slow-Drip Builder (Single Post / Profile URL)
- User manually selects:
  - Metrics: views, followers, likes, comments
  - Target Country / State
  - Total Completion Days (1–90 days)
- Generates a bespoke drip schedule using the jitter engine.

### 2.2 Preset Link Package (Specific Post / Video URL)
- One-click bundled engagement package for a single piece of content.
- Bundle contents: Likes + Shares + Reach + Impressions + Custom Comments.
- All metrics dripped organically over the configured window.

### 2.3 Monthly Profile Retainer (Whole Account / Channel)
- Automated monthly subscription for a profile.
- **Auto-detection**: Scraping or webhook detection triggers drip of views, likes, and reach on every new post published during the month.
- **Steady follower growth**: Background TIME_DRIP execution for follower service runs in parallel.
- Implementation: Requires a background monitoring job (polling public RSS/API or webhook) — no platform OAuth required.

### 2.4 Granular Geo-Targeting
- Filter delivery by Country and State/Region.
- Match local timezone activity waves and regional IP pools.
- Add `targetCountry` and `targetState` fields to `PackageRule` and `Order`.
- Scheduler reads timezone from country/state → applies Circadian throttle.

### 2.5 Custom Comment Engine
- Supports user-supplied comment lists, emoji-only filters, or niche-relevant comment presets.
- Comments scheduled **sequentially after views and likes begin registering** (e.g. delay comments by `+15 minutes` from first view batch).
- Scheduling guarantee: `commentExecuteAt = max(lastLikeBatch.executeAt + 15min, now)`.

---

## 3. Traffic Tiers & Delivery Sources

### 3.1 Standard Slow-Drip Services
- High-retention API services throttled via the platform's local queue scheduler.
- Already partially implemented via `PackageExecution` + scheduler tick.

### 3.2 Real Device / Phone Farm Network *(Premium Tier)*
- Utilizes physical device clusters and residential 4G/5G proxies.
- High-trust actions: saves, profile visits, watch-time retention.
- Requires dedicated provider integration with proxy pool API.
- **Not for current sprint** — external infrastructure dependency.

### 3.3 Verified Ad-Network Views *(Compliance Tier)*
- Direct integration with legitimate ad networks:
  - Google Discovery / In-Stream Ads
  - Meta Boost
- 100% compliant, monetizable views alongside standard SMM signals.
- Requires Google Ads API and Meta Marketing API credentials.
- **Not for current sprint** — requires compliance and billing integration.

---

## 4. Dynamic Duration-Based Pricing Engine

### 4.1 Time-Scaled Pricing Matrix
- Pricing dynamically scales based on selected campaign duration.
- Longer durations consume more cron cycles, API status polls, and proxy allocations.
- Apply a `durationMultiplier` to the base rate at quote time:

| Duration | Speed Tier | Multiplier |
| :--- | :--- | :--- |
| 1–3 days | Standard Drip | 1.00× |
| 4–14 days | Organic Slow Drip | 1.15× |
| 15–60 days | Ultra-Safe Stealth Drip | 1.30× |

### 4.2 Tiered Speed Selection
- Users toggle between:
  - **Standard Drip** (1–3 days): Fastest delivery, standard pricing.
  - **Organic Slow Drip** (4–14 days): Slight premium, randomized jitter.
  - **Ultra-Safe Stealth Drip** (15–60 days): Highest anti-ban protection, highest margin.
- Speed tier selection feeds into `PackageQuoteInput.speedTier`.

---

## 5. User Experience, Billing & Dashboard Features

### 5.1 Payment Gateway — YouPI-PG (Mista Hub)
> **Saved Reference**: [https://github.com/youpi-pg/YouPI-PG](https://github.com/youpi-pg/YouPI-PG)

- Seamless checkout via Mista Hub alongside standard regional/international payment rails.
- Features required:
  - Instant wallet top-up.
  - Automated webhook ledger reconciliation.
  - Multi-gateway fallback (YouPI-PG + Razorpay existing).
- Implementation: Add `YOUPI_PG_API_KEY`, `YOUPI_PG_WEBHOOK_SECRET` to env. Create `apps/api/src/modules/payments/youpi-pg.client.ts`.

### 5.2 My Favorites & Frequently Used
- Quick-access dashboard section pinning:
  - Most ordered services.
  - Saved custom drip templates.
  - Recurring client profiles for 2-click reordering.
- `Favorite` model already exists in schema. Next step: add `savedTemplates` JSON column for drip config presets.

### 5.3 Engagement Ratio Guardrail (Smart Ratio Lock)
- **Problem**: Users get shadowbanned ordering 50,000 likes on a video with only 2,000 views.
- **Solution**: Frontend warning + optional "Smart Ratio Lock" that auto-suggests or bundles proportional views/reach whenever a user orders likes, comments, or shares.
- **Rule examples**:
  - Likes ordered > 3× current view estimate → show warning + suggest view bundle.
  - Comments ordered > Likes ordered → suggest like bundle first.
- Implementation: Frontend ratio check in `new-order/page.tsx` before final checkout.

### 5.4 Drip-Feed Pause, Speed-Up, or Link Swap Mid-Campaign
- **Manage Active Drip button** inside Package detail page.
- Capabilities:
  - **Pause** the queue (marks `SCHEDULED` executions as `SKIPPED_PAUSED`).
  - **Resume** the queue.
  - **Link Swap**: If user deletes a post mid-campaign, redirect remaining `SCHEDULED` executions to a new post URL and mediaKey.
  - **Speed-Up**: Collapse remaining execution gaps (compress `executeAt` timestamps).
- Backend: `PATCH /packages/:id/executions/reschedule` with `{ newUrl, speedFactor }`.

### 5.5 AI Contextual Comment Generator
- User pastes their post caption or topic.
- Backend generates 50 natural, contextually relevant comments (English or regional languages).
- Supports slang, emoji, niche-relevant style.
- Implementation: `POST /ai/generate-comments` → calls Gemini API (`gemini-2.0-flash`) with structured output schema.
- Output feeds directly into `customComments[]` field of the order.
- **Copy rule**: Output must not contain `"verified"`, `"guaranteed"`, `"organic"`, `"natural"`.

### 5.6 Visual Drip Schedule Preview at Checkout
- Mini animated growth curve graph shown at checkout next to the price.
- Shows projected **daily growth curve** vs. an unsafe "instant spike" alternative.
- Highlights why longer campaigns cost more (anti-ban value proposition).
- Implementation: SVG or Canvas chart rendered client-side from `PackageQuoteResponse.timeline[]`.
- Data already available in `quote.timeline` from `PackageQuoteResponseSchema`.

### 5.7 Category Section in New Order Page
- **Issue Reported**: Category section is missing while placing an order.
- **Reference**: Check other SMM panels for how categories are displayed (grouped service list by category header).
- Implementation: Group `filteredServices` by `s.categoryName` in `new-order/page.tsx` and render category header labels above each group in the service selector panel.

---

## 6. Implementation Priority Suggested Order

```
P0 (Next Sprint):
  - Category section fix in new-order page (5.7)
  - Engagement Ratio Guardrail (5.3)
  - Visual Drip Schedule Preview (5.6) — data already available

P1 (Sprint +2):
  - Randomized Jitter (1.1) — extend drip-engine.util.ts
  - Drip Pause / Link Swap mid-campaign (5.4)
  - Sequential Lock-And-Verify Protocol (1.4.2)

P2 (Sprint +3):
  - Circadian Night-Mode Throttling (1.2) — requires geo/timezone field on order
  - Time-Scaled Pricing Matrix (4.1)
  - Custom Comment Engine sequencing (2.5)
  - AI Comment Generator (5.5)

P3 (Future):
  - YouPI-PG payment integration (5.1)
  - Auto-Failover (1.5.1)
  - Multi-API Bundle Routing (1.4.3)
  - Geo-Targeting (2.4)
  - Monthly Profile Retainer (2.3)
  - Real Device / Phone Farm tier (3.2)
  - Ad-Network views tier (3.3)
```

---

## 7. External Dependencies & References

| Item | Reference | Notes |
| :--- | :--- | :--- |
| YouPI-PG Payment Gateway | [github.com/youpi-pg/YouPI-PG](https://github.com/youpi-pg/YouPI-PG) | Mista Hub integration, future implementation |
| Gemini API (AI Comments) | Already integrated via `@google/genai` | Use `gemini-2.0-flash` with structured output |
| IANA Timezone Database | [`Intl.DateTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat) | Use for Circadian throttle scheduling |
| Residential Proxy API | TBD | Required for Phone Farm tier |
| Google Ads API | TBD | Required for Ad-Network views tier |
| Meta Marketing API | TBD | Required for Meta Boost tier |

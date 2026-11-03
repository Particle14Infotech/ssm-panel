=====================================================================
MASTER PROMPT: NEW ORDER v2 (4 TABS) FOR THE LIVE SMM PANEL
=====================================================================

0. ROLE AND CONTEXT
You are a principal full-stack engineer working on a LIVE SMM Panel (real users, real wallets, running on a VPS). Monorepo: apps/web (Next.js), apps/api (NestJS, Prisma, PostgreSQL, Redis, BullMQ, outbox), apps/worker, packages/contracts. Docker is not used.
Goal: rebuild the New Order section as four tabs (Single Order, Custom Drip, Combo Packages, Auto-Pilot), plus the package page, dashboard widgets and Light/Dark theme, matching the client mockups in design-reference/new-order/ for LOOK and STRUCTURE, and this prompt for BEHAVIOUR.
Current state as last seen (VERIFY in R0, do not trust): /new-order has two tabs (Single Order, Package Drip-feed); the package tab uses an Instagram "Connect Account" step and a "Package Engine Quote" card; the sidebar has Packages and Favorites; a package engine exists (packages, executions, scheduler tick, prepaid child orders, escrow-style reserve, settlement) with unresolved security findings (see R1).

1. SOURCES OF TRUTH (priority order)
(1) SRS (behaviour and exclusions, especially section 50). (2) This prompt. (3) Mockups in design-reference/new-order/ (8 images: custom drip desktop; combo + live stream desktop; combo mobile 3 screens; combo desktop with dollar prices; custom drip mobile 3 screens; combo desktop with rupee prices (Starter 399, Growth 999, Viral 2499, Elite 4999); dashboard desktop; dashboard mobile with theme switcher). Map each image to a tab by looking at it; if an image is missing STOP and ask.
The mockups are AI-generated: their text is garbled and their numbers are wrong (totals do not add up, duplicate chips, typos, mixed currencies, "Growfollows" and "SMM Panel" brands). Take layout, glass cards, lime glow, summary column, mobile 3-step wizard, bottom nav and Light/Dark from them. NEVER copy their text or numbers. Reuse the existing design tokens and components; do not invent a new design system.

2. NON-NEGOTIABLE RULES
2.1 Evidence: every claim needs a saved evidence file (command 2>&1 | Tee-Object docs/evidence/<ts>-<name>.txt) beginning with git commit hash, branch and the database NAME in use (name only). Numbers in reports come from tool output, never typed by hand. Forbidden words without evidence: working, fixed, verified, complete, safe, secure, production-ready, 100%.
2.2 Attempts: max 3 fix attempts per failing check, then STOP and report: step, command, error, what you tried, hypothesis. Never loop. Never skip a check silently.
2.3 Tests: never delete or weaken tests; no mocking the system under test in integration or e2e (no page.route, no mocked Prisma); every regression test must be shown FAILING against unfixed or deliberately broken code first, then passing.
2.4 Money: integer paise or Decimal only; never Number or parseFloat on money; no float arithmetic.
2.5 Security: never print secrets (URLs with credentials, tokens, keys); no hardcoded secret fallbacks; no in-memory fallback when the DB is down (return 503); no env toggle that disables a security check.
2.6 Scope: no features beyond this prompt; no destructive git or DB actions without my OK; no force push.
2.7 COPY RULES (UI strings, API messages, seeds, docs; add a grep gate that fails the build): never write "organic", "natural", "stealth", "anti-ban", "undetectable", "instant", "guaranteed", "verified", "randomized", "wave", "sync", "Country IP", "State IP", "Safety Score", "Peak Activity". Currency is rupees via Intl, brand comes from the BRAND config, labels are spelled correctly (Add Funds, API & Profile, Reseller). Payment is wallet only (no crypto, no direct card).
2.8 DO NOT BUILD (excluded by SRS section 50 or not possible safely): randomized quantities or intervals; human-like activity curves; night or sleep-hour throttling; IP, proxy or device targeting; scraping; Instagram OAuth or any automatic post detection (only a disabled "Coming soon" toggle with no code behind it); invented statistics; showing other users' orders; a "safety score"; crypto payments; monthly auto-renewal (open client decision).
2.9 REPLACEMENTS for mockup elements:
- "Randomized drip-feed wave", "Natural drip-feed", "Next random batch", "Delivery Rhythm Wave", "Peak Activity +x%" -> a deterministic Delivery timeline from the quote (which date, how much), and after purchase planned vs delivered from real executions.
- "Anti-Ban Safety Score" -> real Success rate = completed / finished orders.
- "Instant Delivery" -> "Starts within about X minutes".
- "Country IP / State IP" -> "Audience country / region", shown only for services that have a geo variant from the provider.
- "Auto-Pilot Sync / Radar" -> "Auto-Pilot": paste each new post link and press Start; "Auto-detect new posts" is a disabled "Coming soon" toggle.
- "$79/mo" -> one-time prepaid package price in rupees.
- "24/7 Priority Support", "Schedule Tool" -> remove unless the client confirms a real process.
- "Pay with crypto / card" -> wallet balance with Add Funds.
- "Live Order Stream" -> the user's OWN 5 most recent orders only.
- Totals that do not add up -> total is always the server quote: the sum of the lines.

3. LIVE SYSTEM RULES
L1 You have NO access to production. Never ask for or use SSH keys, prod credentials or prod URLs. You produce code, migrations, scripts and runbooks; I run deployments. Every release ends with a deploy pack docs/releases/<id>/DEPLOY.md (exact commands, backup step, migration list with measured timing, smoke tests, flag order) and ROLLBACK.md.
L2 Schema changes are EXPAND-ONLY: new tables, nullable or defaulted columns, indexes (CREATE INDEX CONCURRENTLY). No drops, renames, type changes or NOT NULL without default. Migrations set lock_timeout and statement_timeout. Cleanup of legacy code and tables is a separate later release after my OK.
L3 Every new behaviour is behind flags stored in settings, default OFF: new_order_v2, tab_custom_drip, tab_combos, tab_autopilot, pkg_controls (pause, swap, report), dashboard_v2, theme_light; auto_detect stays permanently off. Flags support a user-id allowlist, percentage rollout and a one-click kill switch in Admin. Users without a flag see today's behaviour unchanged; old routes keep working until I approve cutover.
L4 Tests, drills and e2e run ONLY on the test DB and on an ANONYMISED staging copy of production (no real emails, phones, tokens, keys). Before each production migration: pg_dump backup, restore test into a temporary DB, migration timing measured on the staging copy.
L5 Live data is read-only input: existing packages, Instagram-connect packages and their reserved money, wallets, ledgers, orders, favorites. Legacy packages keep working and settle normally. Nothing is deleted or destructively migrated.
L6 Every release must be rollback-safe: the PREVIOUS code version must run correctly against the NEW schema (run the previous release's test suite against it). Document flag-off and rollback steps.
L7 No major-version upgrade of Node, pnpm, Prisma or Next in this work.
L8 Open client decisions use these defaults, stored in settings and listed in docs/DECISIONS.md (do not block on them): unused slot value is refunded to the wallet at the allocated share; cancellationFeePct = 0; trial limit = 1 purchase per user per combo tier priced under a configurable threshold; prices are tax-inclusive with no invoice change; reseller price lists deferred; no auto-renewal.

4. PRODUCT SPEC

4.1 SHELL (all tabs)
- Header: search, wallet balance with Add Funds, notifications bell, theme toggle (when theme_light), profile menu.
- Four tabs: Single Order | Custom Drip | Combo Packages | Auto-Pilot. URL state: /new-order?tab=&platform=. Tabs can be hidden by flags.
- Platform picker (tiles): only platforms enabled in PlatformConfig that have eligible services; labels per platform (Followers, Subscribers, Members); no duplicate or unknown icons.
- Layout: left = configuration, right = sticky summary (line items, total, "Starts about", "Finishes about", delivery timeline, discount code field, wallet balance, Submit). On mobile the summary is a bottom sheet and the tabs become a horizontal tab bar plus a 3-step wizard (targets, services, schedule and submit).
- Quick link bar (dashboard): paste a link, detect the platform from the host (allowlist), open New Order with the link prefilled.
- Prices always come from the server quote; the UI never does money math. Pay is disabled while the quote is stale or loading.
- Drafts: each tab keeps its own draft (sessionStorage, config only, never prices). Changing platform asks for confirmation and resets incompatible fields.
- Errors: human wording, requestId and Retry; never a raw "Internal server error". Insufficient balance (402): friendly message plus Add Funds link, draft kept.
- Compliance notice (admin-editable) and a consent checkbox before paying: "I understand delivery is made through providers and that platform rules and risks apply." Also show "We do not verify account ownership."
- Skeletons, empty states, error boundaries, toasts.

4.2 TAB 1: SINGLE ORDER
- Category, then Service (searchable; uncategorised services under "Other"; empty or disabled categories hidden). Service details panel: rate per 1,000, min, max, step, average time, refill, cancel, description.
- Link (validated per platform), quantity (min, max, step with clear messages), audience country/region only if the service has a geo variant.
- Optional drip: duration chips from settings (default 1, 5, 7, 10, 14, 20, 25, 30 days, no duplicates) plus an extra-hours control; drip OFF = one normal order; drip ON = a one-item package through the package engine (time-interval drip, same progress and refund logic).
- Favorites strip (prefill only; never auto-orders; re-prices from the server) and the user's own recent orders (5).

4.3 TAB 2: CUSTOM DRIP
- Targets: Profile URL (needed only if a followers or subscribers item is checked) and Post/Reel URL (needed only if likes, views, reach or shares is checked). Each URL must belong to the selected platform; short links are rejected; the server never fetches user URLs.
- Item cards with checkbox: Likes/Reactions, Video/Reel Views, Reach/Shares, Followers/Subscribers time-interval drip. Each card: service dropdown (only services whose kind matches the card; enforced by the API), quantity stepper with min/max/step, rate per 1,000 and "= Rs x". Followers card: total quantity and drip interval (from settings).
- Audience country/region (only when supported). "Finish within": duration chips plus extra hours.
- If a quantity cannot be split into runs within provider min/max, show a warning with the fastest possible schedule; never silently create one big order.
- Summary: line items, total (sum of server-quoted lines), "Starts about", "Finishes about", Delivery timeline chart (SVG, deterministic, real dates and quantities).
- Submit = purchase and first start in ONE transaction (POST /packages mode CUSTOM with initialSlot {url}).

4.4 TAB 3: COMBO PACKAGES
- Targets: Profile URL and Post link (a combo may include followers and per-post items).
- Listing: search, filter chips (Popular, Growth, Video, ...), sort by price. Card: name, badge (Popular, Best value), three plain lines, tier chips with prices (for example Rs 399 | 999 | 2,499 | 4,999 are EXAMPLES only; real tiers come from admin), Select, Compare (2 or 3 tiers side by side), Details sheet ("what you get", days, how delivery works, timeline).
- Customize drawer: only items the admin marked customizable, within bounds. Customizing switches the price from FIXED to COMPUTED from catalog rates and shows "Custom price Rs x (bundle Rs y)". A compare-at price is shown only when the real a-la-carte catalog total is greater than the price.
- Review: discount code (existing coupons), wallet balance, consent, Pay.
- Success screen: Order confirmed, delivery status %, planned vs delivered chart, transaction summary (amount, transaction id, payment method: Wallet), estimated completion, Return to Dashboard, Support.
- Comments inside a combo: provider default comments or the user's own list (moderation: no links, no phone numbers, length limits, duplicates, count equals quantity, escaped output).

4.5 TAB 4: AUTO-PILOT
- Recipe: what runs on each new post (likes, views, reach, shares, comments) with quantity per post.
- Plan: number of posts (slots), duration, optional followers drip.
- After purchase the package page lists slots: "Slot n: [paste post link] [Preview] [Start]". A slot is used once. Start chooses quantities up to the purchased amount.
- Quota "N of M posts used" appears on the dashboard. Disabled "Auto-detect new posts, coming soon" toggle.

4.6 AFTER PURCHASE
- Package page: progress bar, per-item delivered/ordered, slots, timeline (planned vs delivered), next delivery from the real schedule, Pause and Resume (posts during pause are skipped; endAt extends up to a maximum), Swap Link (same platform, max 2 swaps, new unique mediaKey, SCHEDULED executions only, audit log), Cancel (unused allocated share refunded once), Report a problem (one open report per order, rate limited, creates a ticket, pauses the queue, queues a provider health check).
- Dashboard (dashboard_v2): KPIs (Total Orders, In Progress, Completed, Success rate), Active Link Processes cards, hourly planned vs delivered chart, wallet card, posts quota, quick link bar.
- Notifications: purchase, slot started, completed, failed, refund, expiry reminder 3 days before the end.

4.7 THEME AND MOBILE
Dark (#000000) and Light (#F5F5F8) via CSS variables and existing tokens, saved per user, default follows the system, contrast AA in both. Mobile: bottom nav (Home, Campaigns, Wallet, Settings), quick launchers, 3-step wizard, bottom-sheet summary, nothing overflows at 390 px.

4.8 ADMIN
Combo templates and tiers editor (name, tagline, badge, tags, scope, tiers with price, days, slots, per-user limit, daily cap, availability dates; items with service picker showing provider cost and live margin, quantities, bounds, step, window, minGap, startOffset, sequence afterItem, customizable flag); publish validator; clone; archive; version history and diff; health dashboard (NEEDS_REVIEW with reasons); Service.kind and region mapping (bulk friendly); PlatformConfig (labels, drip intervals, duration chips, max extra hours, link rules, enabled tabs); pricing settings; flags page (allowlist, percentage, kill switch); reports (combo sales, margin, popularity); all admin actions require RBAC, reason where money is involved, rate limit, idempotency and an append-only audit log.

5. PRICING AND MONEY RULES (all integer paise)
5.1 Rate and line price: line = ceil(sellingRate_per_1000 x qty / 1000), ceil once per line; total = sum of lines; optional coupon next; optional duration multiplier from settings (default 1.00, names Fast, Standard, Extended; the tier table must cover the whole allowed duration range with no gaps) applied in Decimal with one final ceil.
5.2 Pricing modes: FIXED (admin sets the tier price, for example 99, 299, 399 rupees) and COMPUTED (custom builder and customized combos). Customizing a FIXED tier always switches to COMPUTED so nobody can drop items and keep a cheap fixed price.
5.3 Allocation of a FIXED price P over items by their catalog values v_i (V = sum v_i): allocated_i = floor(P x v_i / V); distribute the leftover paise by largest fractional remainder, ties by item id ascending; then split each item over slots and runs the same way. Sums must equal P exactly at every level. Worked example: P = 29,900 paise, v(views) = 15,000, v(likes) = 25,000, V = 40,000. views = 11,212.5, likes = 18,687.5; floors 11,212 + 18,687 = 29,899; the leftover 1 paise goes to views (equal remainders, lower item id first): 11,213 + 18,687 = 29,900. Refunds always use the allocated share, never the a-la-carte value.
5.4 Margin guard: margin = (P - sum providerCost) / P. Checked at publish and at EVERY purchase against current provider cost; below the floor -> 409 TEMPLATE_UNAVAILABLE and the template becomes NEEDS_REVIEW.
5.5 Snapshots and versions: a tier is immutable once soldCount > 0 (edits create a new version); each package stores priceBreakdown and contentsSnapshot (rates, provider costs, allocation); later catalog or template changes never alter a purchased package.
5.6 Quote and hash: POST /packages/quote requires auth, Redis throttle (per user and per IP) and input caps (max runs 365, max items, max string lengths) validated before any computation. quoteHash = HMAC-SHA256 over canonical JSON (stable key order) of userId, mode, platform, template, tier version, items, targets, duration, drip parameters, coupon, rate version, total, expiresAt (10 minutes), with a key id, compared with timingSafeEqual. Purchase ALWAYS recomputes the price on the server; mismatch or expiry -> 409 QUOTE_CHANGED with a fresh quote. Purchase requires an Idempotency-Key.
5.7 Purchase (ONE transaction): wallet row FOR UPDATE, balance check (402 if insufficient), template and tier version check, margin check, atomic daily cap (TemplateDailySales), per-user and per-handle limits, PACKAGE_PURCHASE ledger entry for the full price, Package plus PackageRule rows with allocation snapshot, PackageSlot rows, precomputed TIME_DRIP executions, outbox events. Double click = one package, one charge.
5.8 Time-interval drip (deterministic; no jitter):
- Profile-level (followers): runs = min(floor(Q / serviceMin), floor(days / interval)); spacing = days / runs; quantity per run = floor(Q / runs) with the remainder spread over the first runs; every run within provider min/max (split into sub-orders when above max). Example: Q = 600, 30 days, interval 1 day, min 50 -> 12 runs of 50 every 2.5 days. If Q is below the minimum for one run, return a quote warning, never one silent big order.
- Per-post: runs = clamp(min(floor(q / min), maxRunsPerPost, floor(window / minGap)), 1); gap = window / runs; same remainder rule. Example: q = 600, window 6 h, min 50, minGap 10 min -> 12 runs of 50 every 30 min.
- allocatedCharge per run sums EXACTLY to the item's allocated charge (last run takes the remainder).
5.9 Slots: Start uses a compare-and-set UPDATE slot SET status = 'ACTIVE' WHERE status = 'AVAILABLE' RETURNING; chosen quantity <= purchased; unique(packageId, mediaKey); commentExecuteAt = max(lastLikeBatch.executeAt + offset, now) with a fixed fallback if likes fail; Start does not change the price; the unchosen part stays in "remaining".
5.10 Dispatch: the worker scheduler tick (single owner, FOR UPDATE SKIP LOCKED) creates a prepaid child order (prepaid = true, the REAL allocatedCharge, never 0) and an outbox event in one transaction, then the existing queue, provider, status-sync pipeline. Before the next sub-order of the same link, poll the previous batch status; terminal states (completed, partial, cancelled) proceed; timeout T sets STALLED, pauses the package and alerts admin.
5.11 Refunds: ONE canonical function refundExecution(tx, executionId, actor, reason, idempotencyKey) for worker, admin, cancel and settlement; locks execution, child order, package and wallet; refundable = round half up of allocatedCharge x remains / quantity (remains confirmed by the provider) minus refunds already issued; never above the package's remaining reserve; for UNKNOWN or DISPATCHED states cross-verify the provider status first (unreachable -> refuse). One REFUND per order (DB constraint). Failover (later) only after a confirmed failure, never on a timeout of the add-order call.
5.12 Settlement at endAt and on cancel: unused slots and undelivered runs return their allocated share once (PACKAGE_REFUND, unique per package and reason); optional cancellationFeePct (default 0).
5.13 Invariant, always, per package and per rule: purchased = consumed + refunded + remaining. Also: wallet balance equals the sum of ledger entries; no child order with charge 0; one order per execution.
5.14 State machines. Package: ACTIVE, PAUSED, COMPLETED, EXPIRED, CANCELLED. Slot: AVAILABLE, ACTIVE, COMPLETED, EXPIRED, REFUNDED. Execution: SCHEDULED, DISPATCHED, COMPLETED, PARTIAL, FAILED, CANCELLED, UNKNOWN, STALLED, SKIPPED_PAUSED, SKIPPED_QUOTA, SKIPPED_LIMIT. Illegal transitions are rejected and tested.

6. DATA MODEL (expand-only)
Service(+kind [LIKES, VIEWS, FOLLOWERS, SUBSCRIBERS, COMMENTS, REACH, IMPRESSIONS, SHARES, SAVES, OTHER] default OTHER, geoCountry?, geoRegion?, packageEligible)
PlatformConfig(+labels, dripIntervals[], durationChips[], maxExtraHours, enabledTabs[], eligibleKinds[])
Settings flags with allowlist and percent
PackageTemplate(id, platform, slug, name, tagline, description, badge, tags[], sortOrder, scope [PROFILE|SINGLE_POST|MULTI_POST|MIXED], status [DRAFT|ACTIVE|PAUSED|NEEDS_REVIEW|ARCHIVED], visibleFrom, visibleUntil)
PackageTemplateTier(id, templateId, version, label, pricingMode, pricePaise, durationDays, linkSlots, maxPurchasesPerUser, dailyCap, publishedAt, soldCount, status) unique(templateId, label, version)
PackageTemplateItem(id, tierId, serviceId, kind, role [PER_SLOT|PROFILE_DRIP], quantity, windowMin, minGapMin, startOffsetMin, afterItemId?, optional, defaultIncluded, customizable, minQty, maxQty, stepQty, sortOrder)
PricingSettings(markupPct, bundleDiscountPct, customDiscountPct, marginFloorPct, durationTiers JSON, rounding, cancellationFeePct)
Package(+ templateId?, tierId?, tierVersion?, mode [TEMPLATE|CUSTOMIZED|CUSTOM], pricePaise, priceBreakdown JSON, contentsSnapshot JSON, linkSlotsTotal, pausedDays, swapCount)
PackageRule(+ serviceId, role, quantity, allocatedTotal, rateSnapshot, providerCostSnapshot, targetCountry?, targetRegion?)
PackageSlot(id, packageId, seq, status, triggerId?, mediaKey?, startedAt) unique(packageId, seq), unique(packageId, mediaKey)
PackageExecution(+ slotId?, allocatedCharge, providerBatchId, lastStatusCheckAt, outcome KNOWN|UNKNOWN), orderId unique, prepaid on Order
PackageDraft(userId, config JSON, expiresAt) config only
TemplateDailySales(templateId, date, count)
StalledReport(orderId unique while open, userId, status)
PackageEvent(packageId, type, actorId, before, after, at) append-only
Favorite(kind ORDER|PACKAGE_CONFIG, config JSON, unique(userId, configHash))
Constraints: CHECK price > 0; CHECK minQty <= quantity <= maxQty; CHECK usedCount <= maxPosts; CHECK linkSlotsUsed <= linkSlotsTotal; one order per execution; one REFUND per order; unique(packageId, reason) for settlement; tier immutability guard (service-level and trigger) when soldCount > 0.

7. APIS (OpenAPI generated; contract diff in CI)
User: GET /new-order/bootstrap?platform= (cached 60 s, invalidated on admin changes); GET /platforms; POST /orders/quote; POST /orders; GET /orders?limit=; GET /package-templates?platform=; GET /package-templates/:id; POST /packages/quote; POST /packages (Idempotency-Key + quoteHash; optional initialSlot); GET /packages; GET /packages/:id; POST /packages/:id/slots/:slotId/preview; POST /packages/:id/slots/:slotId/start; POST /packages/:id/pause; /resume; /cancel; POST /packages/:id/swap-link; POST /orders/:id/report-problem; PUT and GET /package-drafts; GET and POST /favorites; GET /dashboard/summary (KPIs, active processes, hourly planned vs delivered, quota).
Admin: CRUD /admin/package-templates, /tiers, /items; POST /admin/package-templates/:id/validate, /publish, /clone, /archive; GET .../margin-preview and .../health; GET /admin/package-reports; PUT /admin/pricing-settings; services kind and region mapping (single and bulk); PlatformConfig CRUD; flags CRUD with kill switch.
All endpoints: auth, ownership checks, throttle tiers, validation with whitelist and size limits, consistent error envelope {code, message, details, requestId}.

8. PHASES (each ends with its exit checks; STOP where marked)
R0 PRODUCTION AUDIT, READ-ONLY (STOP). docs/LIVE_FACTS.md (how production is deployed: PM2, Nginx, build and release process, env handling, backups, monitoring, API instances, worker count, DB and Redis hosting; anything unknown becomes a numbered question for me, no assumptions); docs/NEW_ORDER_AS_BUILT.md (current /new-order, package feature, Instagram connect code, routes, tables, flags, tests, and a done/differs/missing diff against section 4); docs/NEW_ORDER_GAP.md traceability (requirement | endpoint | table | component | flag | test id | release | evidence; an empty cell means not done); docs/releases/PLAN.md with live-data risks.
R1 PREREQUISITE GATE. Confirm the package security fixes are merged and green (pnpm verify:security): mandatory bound quoteHash; authenticated, throttled, capped quote; one canonical refund function; no secret fallbacks; no in-memory fallback; admin refunds cross-check the provider. If not, STOP: tabs 2-4 and every new money path must not ship. The shell and Tab 1 may proceed.
R2 EXPAND SCHEMA, FLAGS, BOOTSTRAP (STOP). Migrations per section 6 and L2; flags page with allowlist, percentage and kill switch; Service.kind and region mapping in admin; GET /new-order/bootstrap with API-enforced kind filtering. Tests: migration on the staging copy (timing printed), previous code passes against the new schema, flags default off, kill switch works, bootstrap lists only active services, a FOLLOWERS slot can never list MENTIONS or PROFILE_VISITS services. Deploy pack R2.
R3 SHELL AND TAB 1 (flag new_order_v2). Section 4.1 and 4.2. Deploy pack R3, flag on for admins only.
R4 PRICING ENGINE AND PACKAGE V2 BACKEND (STOP). Pure-function pricing module (quote for TEMPLATE, CUSTOMIZED, CUSTOM; allocation; margin; duration tiers; schedule math) with property-based tests; templates and tiers admin API and publish validator (services active and eligible, quantities inside provider min/max, feasible schedule, margin floor, copy linter, versioning); purchase, slots, dispatch, settlement, cancel, pause per section 5; health job; invariant checks. No UI yet.
R5 TAB 2 CUSTOM DRIP (flag tab_custom_drip). Section 4.3 end to end, including the timeline chart and initialSlot purchase.
R6 TAB 3 COMBOS (flag tab_combos) (STOP). Section 4.4 and admin templates UI. Seeds marked EXAMPLE with no invented rates; I supply real combos.
R7 TAB 4, PACKAGE CONTROLS, DASHBOARD, THEME (flags tab_autopilot, pkg_controls, dashboard_v2, theme_light). Sections 4.5 to 4.7. Race tests between pause, swap, cancel, Start and the worker tick.
R8 ADMIN SETTINGS, REPORTS, RECONCILER (STOP). Pricing settings, reports, nightly reconciler (ledger vs wallet; purchased = consumed + refunded + remaining; allocation sums; executions vs provider status; payments vs gateway fetch API) with an admin-visible report and alerts.
R9 STAGING SOAK AND ROLLOUT. Full gate on the staging copy; docs/releases/ROLLOUT.md: flag order (admins, small allowlist, percentage steps), what to watch (error rate, p95 latency, queue depth, outbox lag, reconciler report, refunds issued, tickets), explicit rollback thresholds, kill switch usage, a production smoke test using ONLY a designated test account (balance added by an audited admin adjustment with a reason, tiny order, check, refund; no real payments by test accounts). Legacy cleanup is listed as a LATER release and NOT done now.

9. TESTS (test DB or staging copy; no mocking of the system under test)
9.1 Property-based (fast-check): allocation sums equal the price at item, slot and run level; quote equals purchase price; total equals the sum of lines; schedules deterministic; no run outside provider min/max; spacing >= minGap; rounding stable.
9.2 Integration: margin block at purchase; tier immutability after a sale; 50 parallel purchases vs the daily cap; 20 parallel identical purchases = one package, one charge; 50 parallel Starts on one slot = one execution set; cancel vs Start vs worker tick race (nothing dispatches after cancel, refund exactly once); settlement refunds once; partial refund of a prepaid child never 0 and equals the formula; customer B cannot read or act on customer A's packages, orders, drafts, favorites; no path credits a wallet except verified payment, refund, bonus or admin adjustment with a reason; kind filter enforced in the API; quote endpoint caps, auth and throttle (including across two API instances); quoteHash cases (missing, tampered, other user's, expired, stale rate version); contract diff; forbidden-words grep gate.
9.3 E2E (Playwright, real API + web + worker, 1440 px plus a 390 px pass): Tab 1 order (balance falls by EXACTLY the charge read from the order row, status reaches COMPLETED within 60 s); Custom Drip purchase (total equals the sum of lines AND the charged amount; executions appear; chart matches the DB schedule; followers item blocked without a profile URL; likes blocked without a post URL; wrong-platform link rejected; platform change resets incompatible fields; double submit creates one purchase; insufficient balance keeps the draft); combo buy and customize-and-buy; Auto-Pilot purchase and Start of one slot; pause, swap and cancel with exact refund amounts; flags off shows the old behaviour unchanged; Light and Dark screenshots.
9.4 Mutation patches (security/mutations/*.patch, applied only in a temporary git worktree): remove the allocation remainder step, the margin check, the slot CAS, the kind filter, the quoteHash check, the refund uniqueness; each must make its matching test FAIL; never leave a patch applied.
9.5 Visual: screenshots of each tab and the package page at 1440 and 390 px next to the matching mockup; list layout differences (text differences are expected). Accessibility: axe zero serious or critical on new screens; keyboard navigation; labels; focus order.
9.6 Load: k6 on bootstrap, quote and purchase (p95 targets: bootstrap < 200 ms, quote < 300 ms, purchase < 500 ms, errors < 1% at 50 virtual users), followed by the invariant SQL.

10. CROSS-VERIFICATION
(a) Traceability table kept current (NEW_ORDER_GAP.md): an empty cell means "not done". (b) Independent verifier: after each release a separate session that did not write the code reads only the repo and docs, re-runs the gate and tries to break the release; differences from the builder's claims are reported. (c) Nightly reconciler in production (section R8). (d) Contract diff between OpenAPI and web calls, plus the forbidden-words grep gate, in CI.

11. FINAL GATE PER RELEASE (raw output saved; table check | result | evidence file taken from tool output)
lint (per package), typecheck, unit tests with coverage (real numbers for packages, wallet, orders, payments), API e2e on the test DB, package e2e, contract diff, forbidden-words gate, security gate (pnpm verify:security), build, Playwright, backward-compatibility run (previous release tests against the new schema), invariant SQL. Anything unfinished is "not done" with the reason. Release report: what changed (git diff --stat), what was verified (evidence files), what could not be verified, flags and their state, deploy and rollback steps.

12. DEFINITION OF DONE
Each flag can be enabled for admins, then allowlisted users, then a percentage; every tab works end to end with exact balances; with all flags off the system behaves as before; the invariant holds after every scenario; no forbidden words or invented numbers in the UI; every item in NEW_ORDER_GAP.md has evidence or is explicitly "not done".
=====================================================================


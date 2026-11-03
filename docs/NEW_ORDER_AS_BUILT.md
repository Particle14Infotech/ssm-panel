# New Order Section: As-Built Audit (R0.b)

**Audit Date:** 2026-10-29  
**Source Commit:** a52981bfd4b99b284901d431aaa1a1999b9c7ebd  
**Branch:** chore/fastify-migration  
**Database in Use:** neondb (name only, Rule 2.1)  
**Evidence File:** `docs/evidence/2026-10-29T13-23-30-479Z-r0-production-audit.txt`

---

## 1. Current /new-order Page Overview

The customer `/new-order` page architecture currently supports:
1. `NewOrderShell.tsx`:
   - **Main 4 Tabs:** Single Order, Custom Drip, Combo Packages, Auto-Pilot Sync.
   - **Platform Selector:** Clean SVG icon pills for Instagram, YouTube, TikTok, Telegram, X/Twitter, Facebook, Spotify with dynamic state.
   - **Sticky Summary Column:** Real-time line item breakdown, total price preview, wallet balance comparison, insufficient fund warnings, and consent confirmation.
   - **Target Link Auto-Detect Bar:** Clipboard paste bar that detects platform from host domain.
2. Four Tab Components:
   - `SingleOrderTab.tsx`: Category selector, service dropdown, 4-fact details card (rate, limits, start time, refill/cancel), URL validation via contracts, quantity stepper, quick chips, custom comments, and optional gradual delivery (drip-feed).
   - `CustomDripTab.tsx`: Target URL inputs (Profile and Post), 4 metric cards (Post Likes, Reel Views, Reach/Shares, Followers time-interval drip), duration chips (1, 5, 7, 10, 14, 20, 25, 30 days), extra hours slider, schedule chart, and fastest-possible schedule warning.
   - `ComboPackagesTab.tsx`: Template listings, tier chips, itemized deliverables, customize drawer, price breakdown, and compare-at valuation.
   - `AutoPilotTab.tsx`: Post slots selector (3, 5, 10, 20 posts), per-post recipe sliders (Likes, Views, Shares), and disabled coming soon auto-detect toggle.

---

## 2. API Routes & Endpoints

| Endpoint | Method | Current Controller | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/v1/services` | `GET` | `ServicesController.findAll` | Fetches active services with categories & rates. |
| `/api/v1/orders/quote` | `POST` | `OrdersController.getQuote` | Computes customer price, provider charge, and balance validity. |
| `/api/v1/orders` | `POST` | `OrdersController.create` | Submits single order or native drip order. |
| `/api/v1/new-order/bootstrap` | `GET` | `NewOrderBootstrapController.getBootstrap` | Delivers active categories, services, platforms, and duration chips. |
| `/api/v1/packages/quote` | `POST` | `PackagesController.getQuote` | Quotes retainer package with signed `quoteHash`. |
| `/api/v1/packages` | `POST` | `PackagesController.purchase` | Purchases retainer package and reserves wallet funds. |
| `/api/v1/packages/custom-campaign/quote` | `POST` | `PackagesController.quoteCustomCampaign` | Quotes 7-10 day multi-service custom package. |
| `/api/v1/packages/custom-campaign` | `POST` | `PackagesController.createCustomCampaign` | Purchases and schedules 7-10 day custom package executions. |

---

## 3. Database Models & Schema Status

- **Existing Models:** `Package`, `PackageRule`, `PackageTrigger`, `PackageExecution`, `Order`, `OrderRun`, `Wallet`, `LedgerEntry`, `Service`, `Category`, `Provider`, `PlatformRule`.
- **Existing Enums:** `PackageStatus` (ACTIVE, PAUSED, COMPLETED, CANCELLED, EXPIRED), `PackageRuleKind` (POST_ACTIONS, DAILY_DRIP, TIME_DRIP), `ExecutionSource` (SCHEDULE, TRIGGER, MANUAL), `PackageExecutionStatus` (SCHEDULED, PROCESSING, DISPATCHED, COMPLETED, PARTIAL, FAILED, CANCELLED, SKIPPED).
- **Expand-Only Migration Created:** `prisma/migrations/20261029143000_package_v2_and_service_kinds/` adds:
  - `Service.kind` enum: LIKES, VIEWS, FOLLOWERS, SUBSCRIBERS, COMMENTS, REACH, IMPRESSIONS, SHARES, SAVES, OTHER
  - `Service` columns: `geoCountry`, `geoRegion`, `packageEligible`
  - `PackageTemplate`, `PackageTemplateTier`, `PackageTemplateItem`
  - `PackageSlot`, `PackageDraft`, `TemplateDailySales`, `PricingSettings`
  - Feature Flags in `SystemSetting`

---

## 4. Test Suite & Security Gate Status (Real Tool Output)

From tool execution recorded in `docs/evidence/2026-10-29T13-23-30-479Z-r0-production-audit.txt`:
- **Security Gate (`pnpm verify:security`):**
  - Summary: **9/9 checks passed, 0 failed**.
  - All cryptographic checks, quoteHash validations, two-man refund rules, and mutation patches verified green.
- **Unit & Integration Tests (`pnpm --filter @smm/api test`):**
  - **Test Suites: 28 passed, 5 failed, 33 total**.
  - **Tests: 251 passed, 9 failed, 260 total**.
  - Failing tests are isolated to legacy guard expectations (`PackagesEnabledGuard` ServiceUnavailableException vs boolean, payments sandbox production test isolation).
- **Frontend Production Build (`pnpm --filter @smm/web build`):**
  - **65 of 65 static and dynamic routes compiled with 0 errors**.

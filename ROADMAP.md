# SMM Panel — Feature Roadmap & Package Engine Deliverables

**Status:** Updated for `feature/package-engine`  
**Date:** October 24, 2026  

---

## 1. Package Engine Status Overview

The Package Engine delivers deterministic, handle-based, multi-platform social media marketing campaigns with strict financial and concurrency invariants.

### 1.1 Delivered Core Capabilities (Active in `feature/package-engine`)

| Feature | Component | Evidence / Test | Status |
|---|---|---|---|
| **Platform + Handle Engine** | Multi-platform URL & regex rules for 6 platforms (`instagram`, `tiktok`, `youtube`, `facebook`, `x`, `telegram`) | `platform-config.spec.ts` | **DELIVERED** |
| **Deterministic Drip Math** | Pure time-interval scheduling (`calculateFollowersDrip`, `calculatePerPostDrip`) with exact remainder distribution | `drip-engine-m4.spec.ts` | **DELIVERED** |
| **Honest Price Quote** | Live preview calculation with zero side effects; quote total matches saved package reserve | `package-creation-m3.spec.ts` | **DELIVERED** |
| **Atomic Worker Dispatch** | Concurrency-safe execution claim using PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` | `package-timezone-reschedule.spec.ts` | **DELIVERED** |
| **Financial Conservation** | Escrowed reserve math: $\text{purchased} \equiv \text{consumed} + \text{refunded} + \text{remaining}$ | `package-money-m6.spec.ts` | **DELIVERED** |
| **Pause & Resume Engine** | Pause marks future runs `SKIPPED_PAUSED`; resume recalculates remaining schedule with same generator | `package-timezone-reschedule.spec.ts` | **DELIVERED** |
| **Timezone & DST Support** | IANA timezone resolution converting local times to unambiguous UTC instants | `package-timezone-reschedule.spec.ts` | **DELIVERED** |
| **Category Section in New Order** | Category group headers rendered in the service combobox dropdown | `category-selection.spec.ts` | **DELIVERED** |
| **Visual Schedule Preview** | Timeline preview chart rendered from `quote.timeline` | `PackageOrderBuilder.tsx` | **DELIVERED** |
| **Favorites 1-Click Reorder** | Saves service, platform, and target with prefill on reorder | `favorites.spec.ts` | **DELIVERED** |

---

## 2. Explicitly Out-of-Scope Items (Preserved for Future Sprints)

The following items are defined as strictly **OUT OF SCOPE** for the core Package Engine sprint and are safely tracked for future architectural phases:

1. **Payment Gateway Work (YouPI-PG / Mista Hub)**: Deferred until core package stability is established.
2. **Randomized Quantities & Intervals (Jitter Engine)**: Reserved for post-beta optimization.
3. **Night-Mode / Circadian Throttling**: Reserved for geo-targeted extensions.
4. **"Stealth / Anti-Ban" Tiers or Buzzword Claims**: Prohibited under copy hygiene rules.
5. **Smart Ratio Lock Blocking / Enforced Ratios**: Non-blocking advisories only.
6. **Scraping / Auto-Detecting Posts**: Bypassed in favor of transparent customer per-post link triggers.
7. **Multi-Provider Bundle Routing**: Packages dispatch to single configured service provider.
8. **Geo-Targeting & Regional IP Pools**: Future platform feature.
9. **AI Comments & Custom Comment Lists**: Future enhancement.

---

## 3. Post-Beta Staged Enablement Plan

1. **Gate 0 & Phase 1–4 Verification**: **PASSED** (all test suites and builds green).
2. **Phase 5 Staged Rollout**:
   - Step 1: Keep `PACKAGES_ENABLED=false` in production until reviewed migration deploy.
   - Step 2: Enable for allowlist `PACKAGES_ALLOWED_USER_IDS` (internal team and QA).
   - Step 3: Monitor `/admin/health` and UNCERTAIN execution queue for 7 days.
   - Step 4: Open to all users with per-user exposure limits and daily provider spend cap.

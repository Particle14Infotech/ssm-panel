# Release R7: Tab 4 Auto-Pilot, Package Controls & Dashboard V2 Deploy Pack

**Release ID:** R7  
**Date:** 2026-10-29  
**Git Commit:** a52981bfd4b99b284901d431aaa1a1999b9c7ebd  
**Git Branch:** chore/fastify-migration  
**Database Name:** neondb (expand-only; zero schema alterations required in R7)  
**Evidence File:** `docs/evidence/20261029T192709Z-r7-autopilot-and-controls.txt`

---

## 1. Scope & Delivered Capabilities
1. **Tab 4 Auto-Pilot (Slots):**
   - Recipe builder (Likes, Views, Shares per post).
   - Post slots count selector (3, 5, 10, 20 posts) and duration options.
   - Optional profile followers drip integration.
   - Disabled "Auto-detect posts: Coming Soon" toggle (strictly compliant with Rule 2.8).
   - Pre-purchase wallet check, quote integrity verification, and atomic purchase dispatch.
2. **Package Lifecycle & Post-Purchase Controls:**
   - **Pause & Resume**: Pauses undispatched executions, tracks `pausedDays`, and enforces the 14-day maximum pause limit.
   - **Swap Link**: Validates platform target URL and enforces strict maximum 2 link swaps per package.
   - **Cancel Package**: Computes auditable package accounting, cancels undispatched executions, and refunds unused allocated reserve back to the customer's wallet exactly once (`PACKAGE_REFUND` ledger entry).
   - **Report a Problem**: Submits priority ticket and alerts operators without crashing execution queues.
3. **Dashboard V2 Widgets:**
   - Header bar with welcome greeting, avatar, wallet pill, and top-left/header mode toggles.
   - 4-Card KPI grid (Total Orders, In Progress, Completed, Delivery Health).
   - Active Link Processes cards with real/mockup telemetry.
   - 24h delivery rhythm wave chart.
   - Real-time collapsible execution ledger drawer.

---

## 2. Pre-Deployment Verification
- **Copy Linter:** `pnpm check:copy` -> 0 violations.
- **Security Invariant Gate:** `pnpm verify:security` -> 9/9 checks green.
- **AutoPilot & Controls Test Suite:** `pnpm --filter @smm/api exec jest --rootDir=. test/package-r7-autopilot.spec.ts` -> 7/7 tests passed green.
- **TypeScript & Web Build:** `tsc --noEmit` on both web and API -> 0 errors.

---

## 3. Flag Activation Steps
1. Deploy code artifact to staging / test environment.
2. Enable feature flags in admin settings:
   - `tab_autopilot`: Enables Tab 4 on `/new-order`.
   - `pkg_controls`: Enables Pause/Resume/Cancel/Swap actions on package details.
   - `dashboard_v2`: Activates enhanced KPIs and process cards on `/dashboard`.
   ```bash
   curl -X PUT https://api.smm-panel.example.com/api/v1/settings/flags/tab_autopilot \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"enabled": true, "rolloutPct": 100}'
   ```


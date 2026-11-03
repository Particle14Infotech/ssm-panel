# Release R6: Tab 3 Combo Packages & Theme Contrast Engine Deploy Pack

**Release ID:** R6  
**Date:** 2026-10-29  
**Git Commit:** a52981bfd4b99b284901d431aaa1a1999b9c7ebd  
**Git Branch:** chore/fastify-migration  
**Database Name:** neondb (expand-only; zero schema alterations required in R6)  
**Evidence File:** `docs/evidence/20261029T191813Z-r6-combo-packages-and-theme.txt`

---

## 1. Scope & Delivered Capabilities
1. **Tab 3 Combo Packages UI & Flow:**
   - Destination target link input with URL scheme verification.
   - 4-Tier Selection grid (`Starter ₹399`, `Growth ₹999`, `Viral ₹2,499`, `Elite ₹4,999`).
   - Plain line-item decomposition: Service kind badges, volume breakdown, and allocation shares.
   - Largest-Remainder Hamilton allocation (zero remainder penny loss).
   - Margin floor validation guard ($M \ge 15\%$).
   - Wallet balance pre-validation, server quote signing, and atomic purchase dispatch.
2. **Website-Wide Dark & Light Mode DOM Conflict Elimination:**
   - Removed obsolete appearance card component (`AppearanceSwitcher.tsx`).
   - Kept primary toggle accessible at top-left (sidebar brand header) and header.
   - Refactored glass tokens (`.glass-card-hover`, `.glass-squircle`, `.liquid-glass`, `.liquid-glass-pill`) in `globals.css` with dual-mode CSS tokens.
   - Updated scrollbar tracks from static `#131313` to `#f1f5f9` (light) and `#131313` (dark).
   - Sanitized all 17 customer-facing pages:
     - Replaced pitch-black backgrounds (`bg-[#1c1b1b]`, `bg-[#191919]`, `bg-[#171717]`, `bg-black/40`) with `bg-white dark:bg-[#...]`.
     - Fixed dark-background `<option>` tags in `<select>` menus to prevent unreadable dark-on-dark text.
     - Upgraded low-contrast `text-slate-300` text nodes to `text-slate-700 dark:text-slate-300`.
     - Normalized over 300 white borders (`border-white/10`) to `border-slate-200/80 dark:border-white/10`.

---

## 2. Pre-Deployment Verification
- **Copy Linter:** `pnpm check:copy` -> 0 violations.
- **Security Invariant Gate:** `pnpm verify:security` -> 9/9 checks green.
- **Combo Test Suite:** `pnpm --filter @smm/api test test/package-r5-combos.spec.ts` -> 34 test suites, 265 tests passed (100% green).
- **TypeScript & Web Build:** `pnpm --filter @smm/web exec tsc --noEmit` -> 0 errors.

---

## 3. Flag Activation Steps
1. Deploy code artifact to staging / test environment.
2. Verify visual appearance on `/dashboard`, `/new-order?tab=combos`, `/wallet`, `/orders`, `/packages`.
3. Enable flag `tab_combos` for user allowlist or 100% rollout:
   ```bash
   curl -X PUT https://api.smm-panel.example.com/api/v1/settings/flags/tab_combos \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"enabled": true, "rolloutPct": 100}'
   ```

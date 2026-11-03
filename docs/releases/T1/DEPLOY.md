# Release T1: Token System, Theme Engine & CI Gates Deploy Pack

**Release ID:** T1  
**Date:** 2026-10-30  
**Git Commit:** a52981bfd4b99b284901d431aaa1a1999b9c7ebd  
**Git Branch:** chore/fastify-migration  
**Database Name:** neondb (expand-only: nullable column `themePreference` on `User`)  
**Evidence Files:**
- Contrast Gate: `docs/evidence/2026-10-30-t1-contrast-check.txt`
- Theme Lint Gate: `docs/evidence/2026-10-30-t1-theme-lint-gate.txt`
- T0 Theme Audit: `docs/evidence/2026-10-29T20-48-33-024Z-t0-theme-audit.txt`

---

## 1. Scope & Delivered Capabilities

1. **Token Package (`@smm/ui` / `packages/ui/tokens.js`):**
   - Single source of truth for semantic tokens across Dark and Light modes.
   - Fully typed definitions (`tokens.d.ts`).
   - Mapped directly into `packages/config/tailwind-preset.js` (`bg-bg`, `bg-surface`, `bg-surface-glass`, `text-fg`, `text-fg-2`, `text-fg-muted`, `border-border`, `border-control`, `text-accent-text`, `bg-accent`, `text-on-accent`, `success`, `warning`, `danger`, `info`, `focus`, `glow`).
   - CSS variables exposed in `apps/web/styles/globals.css` with accessibility media query overrides (`prefers-contrast: more`, `prefers-reduced-transparency: reduce`).

2. **Automated CI Gates:**
   - `scripts/check-theme-contrast.mjs`: mathematically verifies all 34 foreground/background pairs against WCAG AA standards (>= 4.5:1 text, >= 3:1 controls/focus). 34/34 pass green.
   - `scripts/theme-lint.mjs`: verifies zero raw hex, rgb, unmapped tailwind palette, or unsanctioned `dark:` pairs. Verified with a failing fixture (`--test-fixture`) catching 6/6 deliberate violations.

3. **Theme Engine & Zero-Flash Delivery:**
   - Synchronous blocking inline `<script>` before first paint in `apps/web/app/layout.tsx`.
   - SSR cookie reading via `cookies()` in Next.js Server Component ensures first HTML byte matches client theme.
   - Three modes: `"dark" | "light" | "system"`.
   - LocalStorage and `smm_theme` cookie fallback for guest visitors.
   - User database preference sync via expand-only column `themePreference` in `User` table.
   - Accessibility overrides for high contrast and reduced transparency.

4. **ThemeToggle Component (`apps/web/components/shared/ThemeToggle.tsx`):**
   - Three-way segmented radio group (Sun, Moon, System) with full ARIA semantics (`role="radiogroup"`, `role="radio"`, `aria-checked`, keyboard focus).
   - Gated behind feature flag `theme_light` (default OFF in production; safe for live site).

---

## 2. Pre-Deployment Verification

- **Contrast Gate:** `pnpm check:theme-contrast` -> 34/34 PASS.
- **Theme Lint Gate:** `node scripts/theme-lint.mjs --test-fixture` -> PASS (fixture verified).
- **Copy Linter:** `pnpm check:copy` -> 0 violations.
- **Security Invariant Gate:** `pnpm verify:security` -> 9/9 checks green.

---

## 3. Flag Activation Steps

1. In production, flags `theme_v2` and `theme_light` default to `false` (today's look unchanged).
2. To enable canary/internal testing:
   ```bash
   curl -X PUT https://api.smm-panel.example.com/api/v1/settings/flags/theme_v2 \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"enabled": true, "percentage": 0, "allowlist": ["$INTERNAL_USER_ID"]}'
   ```
3. To enable the Light mode toggle:
   ```bash
   curl -X PUT https://api.smm-panel.example.com/api/v1/settings/flags/theme_light \
     -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"enabled": true, "percentage": 0, "allowlist": ["$INTERNAL_USER_ID"]}'
   ```


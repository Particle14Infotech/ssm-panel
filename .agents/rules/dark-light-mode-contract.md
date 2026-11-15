# Zero-Conflict Dark & Light Mode Contract

## Why UI Theme Conflicts Occur (The Mechanics)
In CSS and Tailwind CSS:
- Utility classes `bg-gradient-to-*`, `from-*`, `via-*`, and `to-*` set the CSS property:
  `background-image: linear-gradient(...)`
- Utility classes `bg-white`, `bg-slate-*`, `dark:bg-surface`, and `dark:bg-surface-raised` set the CSS property:
  `background-color: ...`
- **W3C CSS Specification Law**: `background-image` is always drawn **on top of** `background-color`.
- If an element is defined as:
  `className="bg-gradient-to-b from-white to-slate-50 dark:bg-surface"`
  In Dark Mode: `dark:bg-surface` updates the `background-color`, but the white `background-image` stays active and covers it completely, resulting in a stark blinding white card in dark mode.
- Any child text using `dark:text-fg` (white or light green text) becomes invisible or creates inverted contrast on top of the white background.

---

## Strict Rules for Antigravity & All Developers

### Rule 1: Always Neutralize Gradients in Dark Mode
Whenever a light gradient is used on a surface or card, you MUST neutralize the gradient stops in dark mode:
```html
<!-- CORRECT -->
<div className="bg-gradient-to-b from-white to-slate-50/80 dark:from-transparent dark:to-transparent dark:bg-surface border border-slate-200/90 dark:border-border">

<!-- OR USING PAIRED SOLID SURFACES -->
<div className="bg-white dark:bg-surface border border-slate-200/90 dark:border-border">

<!-- NEVER DO THIS (BUG) -->
<div className="bg-gradient-to-b from-white to-slate-50/80 dark:bg-surface">
```

### Rule 2: Explicit Three-Stop Neutralization
If `via-*` is used in light mode, neutralize `via` as well:
```html
className="bg-gradient-to-r from-lime-50/90 via-emerald-50/60 to-white dark:from-accent/10 dark:via-transparent dark:to-transparent dark:bg-surface-raised"
```

### Rule 3: Text Contrast Guarantee
- Always pair `text-slate-900` with `dark:text-fg` or `dark:text-white`.
- Always pair `text-slate-600` / `text-slate-500` with `dark:text-fg-muted` or `dark:text-slate-400`.
- Always pair `bg-slate-100` / `bg-slate-200` inner badges with `dark:bg-surface-raised` or `dark:bg-white/10`.

### Rule 4: Automated Verification Script
Before committing and deploying any UI changes, execute:
```bash
pnpm test:theme
# or
node scripts/check-theme-conflicts.js
```
This script scans all customer and admin components and fails if any un-neutralized gradient overlay is detected.

### Rule 5: Visual Verification
Verify the UI visually in BOTH Light and Dark mode using browser automation or manual inspection before reporting complete.

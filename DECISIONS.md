# Design System & Technical Decision Log (DECISIONS.md)

This log documents all design and technical conflicts between legacy documentation (such as early Stitch exports or historical PRDs) and the verified production requirements, detailing the explicit overriding decisions.

---

### 1. Brand Identity
- **Legacy Docs:** References to `Aether`, `Ather`, `Ethar`, `Vireo`, or `Futuristic SMM`.
- **Overriding Decision:** Canonical brand name is **"SMM Panel"** everywhere (UI titles, navbar, footer, invoices, metadata, emails, OpenAPI specs, documentation).
- **Rationale:** Established in Phase 3 rebrand with single-source constant `BRAND_NAME = "SMM Panel"`.

---

### 2. Color Palette & Visual Theme
- **CRITICAL UPDATE:** Blue palette rule revoked. The original lime/green dark theme is the source of truth.
- **Original Canonical Palette:**
  - Base Background: `#131313` (deep near-black with subtle warm olive undertone)
  - Surface Scale:
    - `surface-container-lowest`: `#0e0e0e`
    - `surface-container-low`: `#1c1b1b`
    - `surface-container`: `#201f1f`
    - `surface-container-high`: `#2a2a2a`
    - `surface-container-highest`: `#353534`
  - Primary Accent (Lime): `#d8ec8d` / `#dbef90`, Dim: `#bccf74`
  - Text On Primary (for lime buttons/badges): `#171e00` / `#2a3400` (high-contrast dark olive)
  - Secondary Accent (Crown Halo & Gradient Ring): `#bd0183`
  - Text Hierarchy: `#FFFFFF` / `#e5e2e1` (primary text), `#c7c8b6` (muted/secondary text), `#909281` (subtle labels/borders)
  - Card & Glass Styling: Frosted glass blur 16-24px, 1px hairline border at `rgba(255, 255, 255, 0.10)`, subtle top edge highlight `rgba(255, 255, 255, 0.25)`, soft lime core refraction `rgba(219, 239, 144, 0.04)`.
  - Buttons:
    - Primary CTA: `bg-gradient-to-r from-[#d8ec8d] via-[#bccf74] to-[#d8ec8d] text-[#171e00] font-bold` with `hover:shadow-[0_0_24px_rgba(216,236,141,0.4)]`
    - Secondary: `bg-white/[0.06] text-white hover:bg-white/[0.12] border border-white/[0.10]`
  - Zero Blue Elements: All blue hex codes (`#2563EB`, `#3B82F6`, `#60A5FA`, `#1D4ED8`) and `blue-*` utility classes are removed and prohibited across components. Brand logos (Instagram, YouTube, etc.) retain their official colors.
- **Rationale:** Restores the intended brand aesthetic, visual cohesion between desktop and mobile, and eliminates the stark desktop/mobile theme divergence.

---

### 3. Typography & Numerical Grouping
- **Legacy Docs:** Unspecified font fallbacks causing system serif / Times New Roman rendering.
- **Overriding Decision:**
  - Font Family: **Poppins** (`subsets: ["latin"], weights: 300..700`) via `next/font/google`, with system-ui sans-serif fallbacks.
  - Numbers & Currency: Always `tabular-nums`, formatted in Indian grouping (`en-IN`), prefixed with integer paise calculations represented with standard `₹` symbol (e.g., `₹1,100.00`).
  - Font Mono: Reserved strictly for cryptographic hashes, API keys, and order UUIDs. Never used on KPI values or section titles.
- **Rationale:** Consistent, high-precision typography avoiding awkward serif fallbacks.

---

### 4. Heading Glow & AI-Template Artifacts
- **Legacy Docs:** Decorative light beams, multi-layer text-shadows, and neon text gradients.
- **Overriding Decision:** Headings are rendered in solid, crisp `#FFFFFF`. Accent words are solid `#3B82F6` without text-shadow glow or animated gradient backgrounds. At most one ambient radial blue background bloom behind the primary visual.
- **Rationale:** Removes generic "AI-generated template" aesthetic and ensures professional readability.

---

### 5. 3D Elements & Mascot Handling
- **Legacy Docs:** Immediate synchronous Canvas initialization with Three.js.
- **Overriding Decision:** Existing 3D Crown stage and objects are retained, but **lazy-loaded** via Next.js dynamic imports (`next/dynamic` with `ssr: false`). When loading, on viewports `< 768px`, or when `prefers-reduced-motion: reduce` is active, a high-performance static poster WebP image is served.
- **Rationale:** Guarantees mobile performance, low CLS, and sub-second First Contentful Paint.

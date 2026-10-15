# Design System & Technical Decision Log (DECISIONS.md)

This log documents all design and technical conflicts between legacy documentation (such as early Stitch exports or historical PRDs) and the verified production requirements, detailing the explicit overriding decisions.

---

### 1. Brand Identity
- **Legacy Docs:** References to `Aether`, `Ather`, `Ethar`, `Vireo`, or `Futuristic SMM`.
- **Overriding Decision:** Canonical brand name is **"SMM Panel"** everywhere (UI titles, navbar, footer, invoices, metadata, emails, OpenAPI specs, documentation).
- **Rationale:** Established in Phase 3 rebrand with single-source constant `BRAND_NAME = "SMM Panel"`.

---

### 2. Color Palette & Visual Theme
- **Legacy Stitch Export (`design-reference/futuristic_smm_architecture/DESIGN.md`):** Used `#131313` base surface, `#d8ec8d` (lime yellow-green) primary container, and `#ffafd5` (pink) secondary accent.
- **Overriding Decision:** The color palette is strictly **Dark + Blue only**:
  - Page Background: `#02040A`
  - Alternate / Card Surface: `#070B16`
  - Glass Layer: `rgba(255, 255, 255, 0.04)` with `rgba(255, 255, 255, 0.08)` border and `rgba(255, 255, 255, 0.06)` inset top highlight.
  - Primary Blue: `#2563EB`
  - Bright Blue Accent: `#3B82F6`
  - Subtle Hover Glow: `#60A5FA`
  - Text Hierarchy: `#FFFFFF` (primary), `#94A3B8` (secondary/muted), `#64748B` (subtle labels).
  - Status Semantics only: Red/Emerald/Amber strictly for status badges (Failed, Completed, Pending).
  - Absolutely **NO** purple, pink, rainbow, or lime accents.
- **Rationale:** Strict Phase 6 visual identity guidelines and clean, premium enterprise appearance.

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

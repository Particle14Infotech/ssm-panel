# SMM Panel Canonical Design System Specification (DESIGN_SYSTEM.md)

This document is the **single source of truth** for all user interface, layout, typography, token, and component development across the SMM Panel web application.

---

## 1. Visual Theme & Color Palette (Dark + Blue Only)

| Token Name | Hex / CSS Value | Role & Usage |
|:---|:---|:---|
| **Page Background** | `#02040A` | Global application root background (`bg-background`). |
| **Alternate Surface** | `#070B16` | Sidebar, top header, modal backdrop base (`bg-surface`). |
| **Glass Panel Base** | `rgba(255, 255, 255, 0.04)` | Stat cards, table containers, content panels. |
| **Glass Border** | `1px solid rgba(255, 255, 255, 0.08)` | Outer 1px perimeter border on all glass cards. |
| **Glass Top Highlight** | `inset 0 1px 0 0 rgba(255, 255, 255, 0.06)` | Subtle light-bounce specular highlight on upper edge. |
| **Glass Shadow** | `0 8px 32px rgba(0, 0, 0, 0.4)` | Deep, soft ambient elevation shadow. |
| **Primary Blue** | `#2563EB` (Tailwind blue-600) | Primary CTA buttons, active sidebar indicators, checked states. |
| **Bright Blue** | `#3B82F6` (Tailwind blue-500) | Focus rings, text accent highlights, active pill tabs. |
| **Subtle Glow** | `#60A5FA` (Tailwind blue-400) | Micro-indicator dots, focused card border hover accents. |
| **Primary Gradient** | `#1D4ED8` -> `#3B82F6` | **Restricted strictly** to primary CTA buttons, active navigation, and key KPI highlights. |
| **Primary Text** | `#FFFFFF` | Headings, card titles, monetary numbers, active labels. |
| **Secondary Text** | `#94A3B8` (Tailwind slate-400) | Subtitles, helper text, table column headers. |
| **Muted Text** | `#64748B` (Tailwind slate-500) | Placeholders, inactive timestamps, footer notes. |

> **Strict Color Invariant:** Absolutely NO purple, violet, pink, magenta, or lime green elements. Semantic indicators (Emerald for Completed/Success, Amber for Pending, Rose for Failed/Cancelled) are reserved strictly for StatusBadges.

---

## 2. Typography Rules

- **Primary Font Family:** **Poppins**, with modern fallback stack: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- **Numbers, Currency & KPI Metrics:** Always use `font-sans tabular-nums tracking-tight font-semibold`.
  - Format: Indian grouping (`en-IN`), prefixed with `₹` (e.g., `₹1,100.00`, `₹525.00`).
- **Headings (`h1`, `h2`, `h3`):** Clean solid `#FFFFFF`, letter spacing `-0.02em`.
  - No text-shadow glow, no glow beams, no rainbow gradient text.
  - Accent words, if present, use solid `#3B82F6`.
- **Monospace Font (`font-mono`):** Reserved exclusively for transaction IDs (`order_XXXXXXXX`, `pay_XXXXXXXX`), API tokens, cURL code blocks, and system event hashes.

---

## 3. Spacing & Radius Scale

- **Grid System:** Strict 8px dimensional grid (`8px`, `16px`, `24px`, `32px`, `40px`, `48px`).
- **Border Radius:**
  - Standard Cards & Modals: `20px` to `24px` (`rounded-2xl` / `rounded-[20px]`).
  - Small Controls & Form Inputs: `12px` (`rounded-xl`).
  - Status Badges & Buttons: `8px` (`rounded-lg`) or full pills (`rounded-full`).

---

## 4. Reusable Shared Component Inventory

Every page must assemble its interface exclusively using these centralized components:

1. **`GlassCard`** (`components/shared/GlassCard.tsx`): 16px blur container with 1px border and inset highlight.
2. **`StatCard`** (`components/shared/StatCard.tsx`): Equal-height KPI card featuring title, Lucide icon, large sans tabular-nums value, and trend indicator.
3. **`DataTable`** (`components/shared/DataTable.tsx`): Sticky header, row hover highlight, horizontal scroll container for responsive mobile layouts.
4. **`StatusBadge`** (`components/shared/StatusBadge.tsx`): Tinted glass pills with semantic color mapping.
5. **`EmptyState`** (`components/shared/EmptyState.tsx`): Icon + one explanatory line + single action button.
6. **`FormField`** (`components/shared/FormField.tsx`): Accessible input with label, helper text, validation error, and blue focus-visible ring.
7. **`PlatformIcon`** (`components/shared/PlatformIcon.tsx`): Optimized local SVG platform logo.
8. **`PaymentIcon`** (`components/shared/PaymentIcon.tsx`): Verified local SVG payment method logo.
9. **`Skeleton`** (`components/shared/Skeleton.tsx`): Shimmer pulse for data-fetching states.

---

## 5. Site Map & Navigation Architecture

### Public / Marketing Pages:
- `/`: Landing page (Hero with 3D crown lazy-load, 4-step workflow, supported platforms, live pricing matrix, FAQ, CTA).
- `/services`: Searchable platform service catalog with real rates.
- `/pricing`: Transparent pricing and category breakdowns.
- `/how-it-works`: Step-by-step dispatch workflow and live simulation.
- `/faq`: Common questions regarding delivery, refill policies, API access.
- `/contact`: Official support desk and ticketing portal.
- `/about`: Infrastructure architecture, reliability standards, security guarantees.
- `/legal/terms`, `/legal/privacy`, `/legal/refund`: Compliance and legal disclosures.

### Authentication & Account:
- `/login`: Secure session authentication.
- `/register`: User onboarding with zero initial state.
- `/forgot-password`: Verified password reset request.

### Authenticated Customer Dashboard:
- `/dashboard`: High-level operational overview, balance telemetry, 7d/30d activity velocity chart, recent orders stream.
- `/new-order`: Multi-step dispatch console (Platform -> Category -> Service -> Target Link -> Quantity -> Live Rate Calculation).
- `/orders`: Paginated order stream, status filters, search, and lifecycle timeline drawer.
- `/services-catalog`: Full searchable matrix with live provider rates.
- `/wallet`: Liquidity overview, deposit presets (₹100, ₹500, ₹1000, ₹5000), simulated Razorpay-style checkout modal.
- `/transactions`: Double-entry ledger history with downloadable branded PDF/printable receipts.
- `/support`: Customer support desk with ticket creation and conversation thread.
- `/profile`: Account settings, password change, and API key generation/revocation.
- `/app/api`: Reseller API integration documentation and cURL code snippets.

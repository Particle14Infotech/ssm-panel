# SMM Panel Canonical Design System Specification (DESIGN_SYSTEM.md)

This document is the **single source of truth** for all user interface, layout, typography, token, and component development across the SMM Panel web application.

---

## 1. Visual Theme & Color Palette (Original Lime/Green on Dark)

The visual design is grounded in an ultra-premium, dark glassmorphism aesthetic with electric lime accents, warm olive undertones, and subtle magenta halo highlights for 3D elements.

| Token Name | Hex / CSS Value | Role & Usage |
|:---|:---|:---|
| **Page Background** | `#131313` | Global application root background (`bg-background`). |
| **Surface Containers** | `#0e0e0e` (lowest), `#1c1b1b` (low), `#201f1f` (default), `#2a2a2a` (high), `#353534` (highest) | Layered elevation scale for sidebar, panels, cards, inputs. |
| **Primary Accent (Lime)** | `#d8ec8d` / `#dbef90` (HSL `73 53% 74%`) | Headline accent words, active tabs, status pulse dots, primary borders. |
| **Primary Dim (Olive-Lime)** | `#bccf74` | Gradient transition stop, subtle badges. |
| **On-Primary (Dark Contrast Text)** | `#171e00` / `#2a3400` | High-contrast dark typography on lime CTA buttons and badges. |
| **Secondary Accent (Halo)** | `#bd0183` / `#ffafd5` | Crown ambient aura, brand zap logo gradient (`from-[#bd0183] to-[#d8ec8d]`). |
| **Primary Text** | `#FFFFFF` / `#e5e2e1` | Main headings, body text, table cells, metric values. |
| **Secondary Text** | `#c7c8b6` | Subtitles, helper text, form labels, secondary descriptions. |
| **Muted Text / Outline** | `#909281` / `#46483a` | Inactive controls, placeholder text, hairline borders. |
| **Primary CTA Button** | `linear-gradient(to right, #d8ec8d, #bccf74, #d8ec8d)` | Primary interactive buttons with `text-[#171e00] font-bold` and lime shadow. |
| **Secondary Button** | `rgba(255, 255, 255, 0.06)` | Border `rgba(255, 255, 255, 0.12)`, text white. |

> **Strict Color Rule:** Absolutely NO blue buttons, blue badges, or blue heading accents. Blue hex codes (`#2563EB`, `#3B82F6`, `#60A5FA`, `#1D4ED8`) and `blue-*` classes are prohibited in UI components. Real platform and payment logos keep their authentic brand colors.

---

## 2. Typography Rules

- **Primary Font Family:** **Poppins** (with modern fallback stack: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`).
- **Numbers, Currency & KPI Metrics:** Always use `tabular-nums tracking-tight font-semibold`.
  - Format: Indian grouping (`en-IN`), prefixed with `₹` (e.g., `₹1,100.00`, `₹525.00`).
- **Headings (`h1`, `h2`, `h3`):** Clean solid `#FFFFFF`, letter spacing `-0.02em`.
  - Accent words use solid `#d8ec8d` (lime).
- **Monospace Font (`font-mono`):** Reserved for telemetry tags, order IDs (`order_XXXXXXXX`), API keys, and system logs.

---

## 3. Glassmorphism & Elevation System

- **Glass Panels (`.glass-panel`):** `rgba(18, 18, 18, 0.72)` background, `backdrop-filter: blur(20px)`, 1px border `rgba(255, 255, 255, 0.12)`, radius `1.5rem`.
- **Glass Cards (`.glass-card`):** Linear gradient `rgba(255, 255, 255, 0.06)` to `rgba(255, 255, 255, 0.01)` over dark surface with subtle lime refraction `rgba(219, 239, 144, 0.04)`.
- **Liquid Glass Accents (`.liquid-glass` / `.liquid-glass-pill`):** Reserved for hero callouts, floating badges, and status pills, with 1px top highlight and light sweep effect on hover.

---

## 4. Spacing & Radius Scale

- **Grid System:** Strict 8px dimensional grid (`8px`, `16px`, `24px`, `32px`, `40px`, `48px`).
- **Border Radius:**
  - Standard Cards & Modals: `20px` to `24px` (`rounded-2xl` / `rounded-3xl`).
  - Small Controls & Form Inputs: `12px` to `16px` (`rounded-xl`).
  - Status Badges & Buttons: Full pills (`rounded-full`).

---

## 5. Mobile Hero Readability Invariant

- The 3D crown emblem / mascot visual must **never obscure** headline text on mobile viewports (< 768px).
- On mobile viewports, the crown sits beside or below the text block or renders with lowered opacity (`opacity-25`) behind the text to guarantee WCAG 2.1 AA text contrast.

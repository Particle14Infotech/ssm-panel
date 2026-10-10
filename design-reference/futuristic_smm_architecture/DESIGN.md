---
name: Futuristic SMM Architecture
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c7c8b6'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#909281'
  outline-variant: '#46483a'
  surface-tint: '#bccf74'
  primary: '#ffffff'
  on-primary: '#2a3400'
  primary-container: '#d8ec8d'
  on-primary-container: '#5b6b1b'
  inverse-primary: '#556515'
  secondary: '#ffafd5'
  on-secondary: '#620042'
  secondary-container: '#bd0183'
  on-secondary-container: '#ffd5e6'
  tertiary: '#ffffff'
  on-tertiary: '#283044'
  tertiary-container: '#dae2fc'
  on-tertiary-container: '#5c647a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8ec8d'
  primary-fixed-dim: '#bccf74'
  on-primary-fixed: '#171e00'
  on-primary-fixed-variant: '#3e4c00'
  secondary-fixed: '#ffd8e8'
  secondary-fixed-dim: '#ffafd5'
  on-secondary-fixed: '#3d0027'
  on-secondary-fixed-variant: '#8a005e'
  tertiary-fixed: '#dae2fc'
  tertiary-fixed-dim: '#bec6df'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3e475b'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-xl:
    fontFamily: Urbanist
    fontSize: 46px
    fontWeight: '300'
    lineHeight: 56px
    letterSpacing: 0.04em
  headline-xl-mobile:
    fontFamily: Urbanist
    fontSize: 32px
    fontWeight: '300'
    lineHeight: 40px
    letterSpacing: 0.03em
  headline-lg:
    fontFamily: Urbanist
    fontSize: 22px
    fontWeight: '400'
    lineHeight: 30px
    letterSpacing: 0.03em
  stat-display:
    fontFamily: Urbanist
    fontSize: 42px
    fontWeight: '200'
    lineHeight: 48px
    letterSpacing: 0.05em
  body-lg:
    fontFamily: Urbanist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.02em
  body-md:
    fontFamily: Urbanist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Urbanist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.06em
  label-xs:
    fontFamily: Urbanist
    fontSize: 10px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0.08em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2.5rem
  margin-mobile: 1.25rem
  space-xs: 0.375rem
  space-sm: 0.75rem
  space-md: 1.25rem
  space-lg: 2rem
  space-xl: 3rem
---

## Brand & Style

This design system delivers a high-precision, luxury command center for next-generation social growth and algorithmic marketing. Moving far beyond utilitarian SMM dashboards, the aesthetic balances dark glassmorphic surfaces with luminous biological gradients, evoking high-frequency trading terminals merged with cinematic computing.

The style unifies deep space black foundations, hairline-frosted borders, ambient multi-point mesh gradients, and light-split high-contrast surfaces. The atmosphere is ethereal, quiet, and hyper-premium—tailored for growth operators, agencies, and high-volume media buyers who demand visual clarity, low latency, and sophisticated data visualization.

## Colors

The core system is rooted in high-contrast optical depth:
- **Foundations**: Canvas background is purest `#000000`. Primary dark glass surfaces use `#0D0D0D` tinted with fine transparency.
- **Light Split Accents**: Secondary inverted split-views and invoice modules utilize `#F5F5F8` backgrounds with elevated pure white `#FFFFFF` cards.
- **Primary Gradient (Synthetic Energy)**: Blends from `#243100` (deep shadow olive) to `#DBEF90` (soft ambient lime). Used for critical actions, key performance thresholds, active states, and ambient radial glow backlights.
- **Secondary Accent (Hyper-Promo & Campaigns)**: Soft pink-to-magenta blurred mesh gradient spanning `#FF80BF` down into `#FF1A8C` with diffused edges, reserved for boosted services, promotional banners, and high-tier tiers.
- **Text & Foreground**: Pure `#FFFFFF` for primary headings on dark surfaces, scaled to `rgba(255, 255, 255, 0.60)` for secondary metrics, breadcrumbs, and helper copy. Pure `#000000` text governs light split surfaces.
- **Hairlines**: All dark surface boundaries are governed by 1px borders colored `rgba(255, 255, 255, 0.12)`.

## Typography

Typography relies entirely on **Urbanist**, calibrated exclusively across its thin, light (`300`), and regular (`400`) weight spectrum. Generous letter-spacing across all sizes maintains a clean architectural tone. Large numerical stats are intentionally rendered in weight `200` to `300` to evoke high-precision laboratory readouts rather than dense tabular blocks. Small labels always employ uppercase or tracked styling (`0.06em` to `0.08em`) with muted opacity (`60%`).

## Layout & Spacing

The canvas employs a fluid 12-column grid system with generous 24px (`1.5rem`) gutters and minimum 40px (`2.5rem`) outer canvas margins on desktop, scaling to 4 columns with 16px gutters and 20px margins on mobile viewport widths below 768px.

Data structures, analytical widgets, and order pipelines sit within spacious containers utilizing `space-lg` inner padding. Structural alignment honors breathing room, allowing ambient mesh glows and subtle background dot matrices (spaced at 24px pitch with 8% white opacity) to show between elevated glass modules.

## Elevation & Depth

Visual hierarchy does not rely on opaque cast shadows; instead, it uses luminous depth, glass stratification, and refractive frosted planes:

1. **Backdrop & Spatial Canvas**: Deep base `#000000` overlaid with localized radial spotlights (`rgba(219, 239, 144, 0.08)` to `transparent`, 400px radius) behind active analytical cards.
2. **Glass Surface Tier 1**: Background `rgba(13, 13, 13, 0.75)` with `backdrop-filter: blur(20px)`, framed by a crisp `1px` border of `rgba(255, 255, 255, 0.12)`.
3. **Glass Surface Tier 2 (Floating Modals / Popovers)**: Background `rgba(22, 22, 22, 0.85)` with `backdrop-filter: blur(32px)`, bordered by `1px solid rgba(255, 255, 255, 0.18)` and an ambient diffuse perimeter shadow of `0 24px 48px -12px rgba(0, 0, 0, 0.7)`.
4. **Light Inversion Tier**: Crisp `#FFFFFF` card elevated over `#F5F5F8` split panels using subtle shadow `0 10px 30px rgba(0, 0, 0, 0.04)` and `1px solid rgba(0, 0, 0, 0.06)`.

## Shapes

The geometric architecture pairs generous structural card silhouettes with continuous pill geometry for interactive controls:
- **Panels & Metric Cards**: Outer corner radiuses are locked between 24px and 32px to create an organic, modern frame.
- **Interactive Units**: Buttons, category filter chips, search fields, segment controllers, and status badges are rendered as full continuous pills (`border-radius: 9999px`).
- **Hairline Precision**: Card perimeters and dividers are strictly 1px wide frosted seams.

## Components

### Buttons & Interactive Controls
- **Primary Pill**: Filled with the signature gradient (`linear-gradient(135deg, #243100 0%, #DBEF90 100%)`). Label text set in `#000000`, 14px Regular, tracked. Hover state intensifies lime brightness with an outer glow (`box-shadow: 0 0 20px rgba(219, 239, 144, 0.35)`).
- **Secondary Glass Pill**: Background `rgba(255, 255, 255, 0.05)`, border `1px solid rgba(255, 255, 255, 0.15)`, text `#FFFFFF`. Hover elevates surface to `rgba(255, 255, 255, 0.10)`.
- **Promo Pill**: Background `linear-gradient(135deg, #FF80BF 0%, #FF1A8C 100%)`, text `#FFFFFF`, accompanied by an ambient magenta backlight.

### Inputs & Select Fields
- **Search & Order Inputs**: Pill-shaped or 24px rounded rectangles. Dark glass fill (`rgba(13, 13, 13, 0.6)`), 1px border `rgba(255, 255, 255, 0.12)`. Placeholder text in `rgba(255, 255, 255, 0.40)`. Focus transition shifts border to `#DBEF90` with a subtle 2px soft lime halo.

### Cards & Service Containers
- **Glass Service Tile**: 28px corner radius. Glass backdrop blur (20px), 1px border `rgba(255, 255, 255, 0.10)`. Contains top metadata badges, live deliverability metrics, and thin 1.5px icons.
- **Inverted Light Split Tile**: Background `#FFFFFF` on `#F5F5F8` background with dark `#000000` typography and minimal monochrome borders.

### Micro-Visualizations & Analytical Indicators
- **Waveform Activity Bars**: Segmented thin vertical bars (2px width, 2px gap) demonstrating real-time order processing; active heights illuminated in `#DBEF90`, inactive in `rgba(255, 255, 255, 0.10)`.
- **Dot-Matrix Progress**: Rows of 3px circular dots visualizing fulfillment stages (e.g., Pending, In Progress, Dispatched, Completed).
- **Semi-Circle Needles & Gauges**: 1.5px stroke arc measuring service speed/drop-rate with a central numerical stat in 42px light weight.
- **Circular Progress Rings**: Radial SVG circles with thin 1.5px tracks, lime active progress sweeps, and a pulsing 4px center indicator dot.

### Iconography & Badges
- **Strokes**: Strictly 1.5px hairline stroke weight, geometric and minimal.
- **System Accents**: A four-point sparkle star (`✦`) identifies AI-optimized delivery and smart routing; the soft lime asterisk (`*`) serves as a dynamic accent point for new services and balance indicators.
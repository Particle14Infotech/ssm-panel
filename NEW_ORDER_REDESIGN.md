# NEW ORDER PAGE REDESIGN & OPTIMIZATION SPECIFICATION

## Executive Overview
The customer dashboard "New Order" page (`/app/new-order` and `/new-order`) has been completely overhauled for maximum clarity, speed, conversion, and accessibility. Legacy marketing jargon, artificial claims, and decorative chrome clutter have been replaced with a high-performance, two-column responsive interface with real-time vector platform logos, searchable category-grouped combobox, inline regex format validation, dynamic input modes (Default & Custom Comments), and provider-native drip-feed delivery.

---

## 1. Page Structure & Responsive Architecture

- **Desktop Layout ($\ge 1100\text{px}$):**
  - **Left Column (max $760\text{px}$):** Sequential numbered form steps:
    1. Platform Selector
    2. Service Combobox & 4-Fact Detail Card
    3. Details (Dynamic Link & Quantity Stepper / Presets / Custom Comments)
    4. Delivery Options (Provider-Native Drip-Feed)
  - **Right Column ($360\text{px}$ Sticky Sidebar):** Persistent order summary displaying selected service, truncated target link, quantity calculation, unit rate, real-time animated price tween, live balance calculation, compact validation checklist, and immediate place-order button.
- **Mobile Layout ($< 1100\text{px}$):**
  - Single streamlined vertical column with horizontal scrolling platform chips featuring edge fades.
  - Sticky bottom action bar displaying total price, insufficient balance shortcuts, and "Place order" trigger.

---

## 2. Plain Language & Copy Changes

| Legacy Marketing / Jargon | Cleaned Plain Language | Rationale |
| :--- | :--- | :--- |
| `Target Vector URL or Username` | **`Link`** (dynamic: `Profile link`, `Post or reel link`, `Channel link`) | Clear intent based on service type |
| `Quantity Allocation` | **`Quantity`** (or `Quantity per run` when drip-feed active) | Standard user terminology |
| `Live Calculation` pill | *Removed* | Clutter elimination |
| `High-speed algorithmic fulfillment with auto-dispatch` | *Removed* | Eliminate unverified marketing hype |
| `Instant transaction locking with refund guarantee` | **`If an order is cancelled or only partly delivered, the unused amount returns to your wallet.`** | Truthful, verifiable policy |
| `Immediate automated dispatch to provider queue` | **`Your order is sent for delivery right after you confirm.`** | Plain operational statement |
| `Drip-feed delivery (provider native)... upstream networks` | **`Deliver gradually: split your order into runs spaced over time.`** | Comprehensible to all customers |
| Header subtitle: `Configure target links and volume for high-velocity...` | **`Choose a service, add your link and quantity.`** | Actionable instruction |
| Header balance chips | *Removed duplicate* | Balance is displayed once in top navigation and once in sticky summary |

---

## 3. Platform & Service Combobox Component Architecture

- **Platform Selector:**
  - Real vector SVG logos for `Instagram`, `YouTube`, `TikTok`, `Telegram`, `X` (named correctly as "X", not "x (Twitter)"), `Spotify`, `Facebook`, and `More` (replacing truncated "Other Servi...").
  - Dynamically displays platforms with active services along with active service count badges.
  - Keyboard accessible with full focus rings, meeting WCAG AA contrast standards.
- **Searchable Combobox & Detail Card:**
  - Fast client-side debounced search filtering by name, category, and keyword.
  - Options grouped by category showing cleaned display name, price per 1,000 in ₹, min-max limits, small metadata tags (`Refill`, `Cancel`, `Drip-feed`), and average start time.
  - **4-Fact Detail Card:**
    1. *Price per 1,000:* e.g. ₹150.00
    2. *Min - Max:* formatted with Indian number grouping (e.g. `10 - 1,00,000`)
    3. *Start / Avg Time:* e.g. `Instant`
    4. *Refill & Cancel:* Provider capabilities explicitly stated (`Refill: Yes · Cancel: No`)
    5. Clean provider/admin description (if present; otherwise omitted).

---

## 4. Dynamic Details & Input Modes

- **Link Field:**
  - Dynamic label and placeholder based on platform and link type (`PROFILE`, `CHANNEL`, `POST_OR_REEL`).
  - Native clipboard "Paste" button.
  - Inline format diagnosis via `validateServiceLink`:
    - Submitting an Instagram post link for a followers service returns: *"This service needs a profile link, not a post link."*
    - Submitting an Instagram profile link for a likes service returns: *"This service needs a post or reel link, not a profile link."*
    - Submitting a YouTube video link for a channel subscribers service returns: *"This service needs a channel link, not a video link."*
  - Persistent note: *"The account must be public."*
- **Quantity & Preset Chips:**
  - Numeric stepper input with Indian number grouping (`1,000`, `10,000`, `1,00,000`).
  - Quick preset chips (`100`, `500`, `1,000`, `5,000`, `10,000`) that set the value directly, with presets automatically hidden if outside the service min-max bounds.
- **Custom Comments Mode:**
  - Enabled when `serviceType === "CUSTOM_COMMENTS"`.
  - Multi-line textarea where each line represents one comment.
  - Quantity automatically bound to the number of comment lines.
  - Live line counter and duplicate comment detection warnings.
  - Drip-feed disabled with explanatory tooltip.

---

## 5. Inline Drip-Feed Experience

- Single inline toggle row: *"Deliver gradually (drip-feed)"*.
- If service does not support drip-feed: Muted indicator stating *"Not available for this service"* with zero empty card clutter.
- If enabled:
  - Numeric runs stepper ($2 - 100$).
  - Preset interval chips: `30 min`, `1 h`, `2 h`, `6 h`, `12 h`, `24 h` + custom minute input ($5 - 1440\text{ min}$).
  - Quantity label seamlessly switches to *"Quantity per run"*.
  - Live Schedule Preview: *"Run 1 starts after the usual start time, then every 1 hour, for 5 runs (100 x 5 runs = 500 total). Est. span: 4h"*.

---

## 6. Checkout, Confirmation & Recovery

- **Insufficient Balance State:**
  - Exact shortfall displayed (e.g., *"Short by ₹45.50"*).
  - One-click *"Add ₹45.50"* button deep-linking to `/wallet?amount=45.50`.
  - Form state preserved in `sessionStorage` and automatically restored upon return.
- **Order Confirmation Modal:**
  - Displays service, target link, run plan, customer charge, and balance after order.
  - Client-side idempotency key generated per order attempt to guarantee double-clicks cannot duplicate charges.
- **Success State:**
  - Displays Order ID badge, PENDING status badge, "View order" link, and "Place another order" (retains platform and service selection while clearing target link).

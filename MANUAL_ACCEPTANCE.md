# MANUAL ACCEPTANCE TESTING RUNBOOK

## PART 1: User Dashboard "New Order" Experience

### Step 1: Open New Order Page (Phone & Laptop)
- **Action:** Open `/app/new-order` on desktop ($\ge 1100\text{px}$) and mobile viewport ($390\text{px}$).
- **Expected Result:**
  - On desktop: Two columns — Form on left (max 760px), sticky summary card on right (360px).
  - On mobile: Single column + sticky bottom action bar.
  - Page header displays: `"New order"` with plain subtitle: `"Choose a service, add your link and quantity."`
  - Balance is shown in the top bar and summary; no duplicate balance chips in the header.
  - Platform chips show official vector SVG logos (Instagram, YouTube, TikTok, Telegram, X, Spotify, Facebook, More); platform name is `"X"` (not "x (Twitter)").
  - No decorative emojis, glow effects, or jargon anywhere in the UI.

### Step 2: Search and Select a Service
- **Action:** Click the service selector combobox and type a query (e.g. "Followers" or "Views").
- **Expected Result:**
  - Services are displayed grouped by category.
  - Options display cleaned `displayName` (emojis and decorative bracket spam stripped, meaningful tags like `[30 days refill]` preserved).
  - Price per 1,000 in ₹, min-max limits, small tags (`Refill`, `Cancel`, `Drip-feed`), and average time.
  - Selected Service Detail Card shows 4 key facts: Price per 1,000, Min-Max (with Indian grouping, e.g. `10 - 1,00,000`), Start/Average time, and Refill/Cancel (`Yes` / `No`).
  - No generic fake description; shows real provider description or nothing.

### Step 3: Link Field Validation & Type Mismatch Diagnosis
- **Action:** Select a post-link service (e.g. Instagram Likes or Views). Enter an Instagram profile link: `https://instagram.com/therock`.
- **Expected Result:**
  - Instant inline validation displays clear diagnostic error:
    `"This service needs a post or reel link, not a profile link."`
  - Submit button remains disabled with checklist reminder: `"Enter a valid post or reel link"`.
- **Action:** Paste a valid post link (e.g. `https://instagram.com/reel/C0xyz123/`).
- **Expected Result:**
  - Error clears immediately.

### Step 4: Drip-Feed Configuration & Schedule Preview
- **Action:** Select a service that supports drip-feed. Switch on `"Deliver gradually (drip-feed)"`.
- **Expected Result:**
  - Quantity label switches to `"Quantity per run"`.
  - Input reveals: Runs stepper (min 2, max 100) and Interval preset chips (`30 min`, `1 h`, `2 h`, `6 h`, `12 h`, `24 h`) + custom input.
  - Set quantity to `100`, runs to `3`, and interval to `30 min`.
  - Live schedule preview displays:
    `"Run 1 starts after the usual start time, then every 30 min, for 3 runs (100 x 3 runs = 300 total). Est. span: 1h"`
  - Summary total price updates to $\lceil \frac{300 \times \text{rate}}{1000} \rceil$ with smooth animated number tween.

### Step 5: Insufficient Balance Handling
- **Action:** Configure an order whose total exceeds your current wallet balance.
- **Expected Result:**
  - Summary displays a neutral shortfall warning: `"Short by ₹X.XX"`.
  - An `"Add ₹X.XX"` button appears, deep-linking to `/wallet?amount=X.XX`.
  - Clicking Add Funds stores form state in `sessionStorage`; returning restores all inputs intact.

### Step 6: Confirmation Modal & Order Placement
- **Action:** Ensure wallet has sufficient balance and click `"Place order - ₹X.XX"`.
- **Expected Result:**
  - Confirmation sheet modal opens displaying: Service name, target link, run plan, total charge, and balance after order.
  - Clicking `"Confirm order"` uses an idempotency key to prevent double submits.
  - Success state displays Order ID badge, PENDING status badge, `"View order"` button, and `"Place another order"` button.

---

## PART 2: Admin Pricing & Profit Engine

### Step 1: Services Pricing Table
- **Action:** Navigate to `/admin/services` or `/admin/pricing`.
- **Expected Result:**
  - Every active service displays: Provider Cost (in INR + original USD), Selling Rate, Margin %, and Profit per 1,000.
  - No active service has a selling rate below provider cost.

### Step 2: What-If Simulator
- **Action:** Open `/admin/pricing` and select the `"What-If Simulator"` tab.
- **Action:** Enter Cost: `60` INR, Quantity: `1000`.
- **Expected Result:**
  - Selling price is computed using tiered margin (Cost < 100 $\implies +80\%$, rate = ₹108.00 rounded UP to nearest 0.50).
  - Displays customer charge: ₹108.00, provider cost: ₹60.00, payment fee (2.36%): ₹2.55, and net profit: ₹45.45 (Net margin: 42.1%).

### Step 3: Bulk Repricing with Diff Preview
- **Action:** In `/admin/pricing`, open the `"Bulk Repricing Tool"` tab.
- **Action:** Select platform `INSTAGRAM`, enter margin `60%`, and click `"Preview Diff"`.
- **Expected Result:**
  - A preview diff table lists each affected service showing old sell rate vs new proposed sell rate.
  - Changes are applied only after clicking `"Confirm & Apply"`.

### Step 4: Profit Telemetry & Drip-Feed Split
- **Action:** Open `/admin/reports/profit`.
- **Expected Result:**
  - KPI cards display Delivered Revenue, Provider Cost, Gateway Fees, Refunds, and Net Realized Profit.
  - Toggle `"Drip-feed only"` filter to see metrics exclusively for drip-feed orders.
  - Split section shows Standard vs Drip-feed profit breakdown.
  - Cash Runway card displays daily burn and estimated days of upstream runway.
  - Export CSV downloads accurate spreadsheet with matching database numbers.

### Step 5: Zero Profit Leakage to Customers
- **Action:** Open browser dev tools on `/app/new-order`, `/app/orders`, or `/services`.
- **Expected Result:**
  - Inspect network response payloads for `/api/v1/orders` and `/api/v1/services`.
  - Zero presence of `costRatePer1k`, `estimatedProviderCost`, `estimatedGrossProfit`, `actualProviderCost`, `providerCostPer1k`, or `costINR`.

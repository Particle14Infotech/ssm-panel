# Manual Acceptance Test Plan: Drip-Feed Orders

Follow these 6 test procedures to verify the provider-native drip-feed workflow end-to-end.

---

### Step 1: Open New Order with a Non-Drip Service
1. Navigate to `/new-order` (or `/app/new-order`) as a logged-in customer.
2. In the service dropdown, select any service where `dripFeedSupported` is **false** (e.g. standard Instagram Likes or Views).
3. **Expected Result**:
   - The Drip-feed toggle switch is either completely hidden or disabled with the hint:
     `"This service does not support drip-feed delivery from the provider."`
   - The user cannot enter runs or interval fields.

---

### Step 2: Open a Drip-Feed Capable Service & Verify Live Calculations
1. Select a service configured with `dripFeedSupported = true` (or toggle it ON in Admin > Services).
2. **Expected Result**:
   - The **"Enable Drip-Feed Delivery"** toggle switch becomes active.
3. Click to enable the toggle:
   - Two input fields appear: **Runs** (default: `5`) and **Interval** (minutes, default: `60`).
   - Helper text appears beneath each input displaying service/global limits:
     `Min: 2 runs | Max: 100 runs` and `Min: 5 min | Max: 1440 min`.
4. Enter test values:
   - Quantity: `100`
   - Runs: `3`
   - Interval: `30`
5. **Expected Result in Live Summary Box**:
   - Total Units: `100 per run x 3 runs = 300 total units`
   - Schedule Breakdown: `Delivery every 30 min`
   - Estimated Duration: `~60 min total` ($(\text{runs} - 1) \times \text{interval} = 2 \times 30 = 60\text{ min}$)
   - Price calculation in INR displays exact ceiling-rounded charge:
     $$\text{Charge} = \left\lceil \frac{300 \times \text{Rate}}{1000} \right\rceil_{2}$$
   - Wallet balance indicator confirms sufficient balance or shows the "Add funds" link.

---

### Step 3: Place Order & Confirm in Customer & Admin Panels
1. Enter a valid target link and click **"Submit Order"**.
2. Navigate to **Customer Orders** (`/orders` or `/app/orders`):
   - Order displays with a lime-tinted **"Drip-Feed"** badge.
   - Quantity column reflects: `300 total (3x 100 every 30m)`.
   - Click the order row to open Details Modal: confirms Runs: `3`, Interval: `30 min`, Per-Run: `100`, Total Units: `300`.
3. Open a separate browser tab or window and navigate to **Admin Orders** (`/admin/orders`):
   - Locate the newly placed order.
   - Filter by **"Drip-feed only"**: order remains visible.
   - Click **"Trace"** button:
     - The modal shows the `OrderProviderEvent` JSON.
     - Verify `runs: 3` and `interval: 30` were dispatched to the upstream provider.
     - Verify API keys are replaced with `[REDACTED]`.
     - Verify upstream returned a valid single `providerOrderId`.

---

### Step 4: Confirm Order in Upstream Provider Panel
1. Log into the upstream provider dashboard (e.g. cheapestsmmpanels.com).
2. Go to the provider's **Orders History / Drip-feed Orders** tab.
3. Locate the order using the `providerOrderId` from Step 3.
4. **Expected Result**:
   - The provider lists the order with runs `3`, interval `30`, and quantity per run `100`.
   - The provider manages the individual execution intervals natively.

---

### Step 5: Check Wallet & Double-Entry Ledger Match Exact Charge
1. Navigate to **Admin > Wallets** (`/admin/wallets`) or check PostgreSQL `Transaction` ledger table:
   ```sql
   SELECT id, amount, type, description, "createdAt" 
   FROM "Transaction" 
   WHERE "orderId" = '<ORDER_ID>';
   ```
2. **Expected Result**:
   - Exactly **ONE** `DEBIT` transaction exists for the order.
   - The debit amount matches the total charge calculated in Step 2 down to 2 decimal places.
   - The user's wallet liquid balance was decreased by exactly this amount.
   - Sum of ledger entries equals user wallet balance.

---

### Step 6: Verify Validation Rejections on Invalid Inputs
Test malicious or malformed inputs to confirm server-side enforcement:
1. **Runs < Minimum**:
   - Set Runs to `1`.
   - **Expected Result**: Inline validation blocks submission: `"Runs must be at least 2"`.
2. **Interval < Minimum**:
   - Set Interval to `2` minutes (below minimum 5).
   - **Expected Result**: Inline validation blocks submission: `"Interval must be at least 5 minutes"`.
3. **Quantity below Service Minimum**:
   - Set Quantity to `5` on a service with minimum `50`.
   - **Expected Result**: Validation blocks submission: `"Quantity must be between 50 and 10000 per run"`.
4. **API Tampering Test**:
   - Attempt to POST directly to `/api/v1/orders` with `isDripFeed: false` while passing `runs: 5`:
   - **Expected Result**: API rejects with HTTP 400:
     `{"message": "runs cannot be supplied when isDripFeed is false"}`.

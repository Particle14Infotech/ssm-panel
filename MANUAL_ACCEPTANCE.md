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

---

# Section B: Transactional Email Manual Acceptance Checklist

Follow these 6 steps to verify the Resend HTTPS transactional email integration on the deployed stack.

---

### Step 1: Environment Variables on Railway
1. Open your **Railway Dashboard** -> Services -> `api` and `worker`.
2. Ensure the following environment variables are set:
   - `RESEND_API_KEY`: `re_...` (valid Resend API key)
   - `EMAIL_FROM`: `SMM Panel <no-reply@mail.yourdomain.com>`
   - `EMAIL_REPLY_TO`: `support@yourdomain.com`
   - `SUPPORT_EMAIL`: `support@yourdomain.com`
   - `RESEND_WEBHOOK_SECRET`: `whsec_...` (Svix webhook secret)
   - `FRONTEND_URL`: `https://smm-production-bca7.up.railway.app`
3. Restart both services. Check deployment logs:
   - Worker log must show: `[Worker Email] Provider initialized: Resend HTTPS API`
   - API log must show: `[Email] Provider initialized: Resend HTTPS API`

---

### Step 2: Register a New User & Verify Real Inbox Delivery
1. Navigate to the registration page: `/register`.
2. Fill in account details using your **real inbox email address** (e.g. Gmail/Outlook).
3. Click **Create Account**.
4. **Expected Result**:
   - Registration completes and displays: `"Verification email sent. Please check your inbox."`
   - Within 5 seconds, an email arrives in your inbox from `SMM Panel <no-reply@mail.yourdomain.com>`.
   - **Visual Check**:
     - Subject: `Verify your email - SMM Panel`
     - Brand styling: Dark background `#131313`, lime button `#D8EC8D`, crisp white typography.
     - Content: Zero emojis, professional phrasing, expiration note (24 hours).
   - In PostgreSQL, query:
     ```sql
     SELECT id, "to", type, status, "providerMessageId", error, "createdAt" 
     FROM "EmailLog" 
     ORDER BY "createdAt" DESC LIMIT 1;
     ```
     Status must be `SENT`, and `providerMessageId` must contain the Resend message ID.

---

### Step 3: Click Verification Link & Confirm Welcome Email
1. In your inbox, click the **Verify Email** button.
2. The browser opens `/verify?token=...`.
3. **Expected Result**:
   - Page displays: `"Email verified successfully. Welcome to SMM Panel!"`
   - Database record for user shows `emailVerified: true` and `emailVerificationTokenHash: null`.
   - A second email immediately arrives in your inbox: **Welcome to SMM Panel** with link to dashboard.
4. **Single-Use Check**:
   - Refresh the verification link in the browser.
   - **Expected Result**: Page rejects with: `"Verification link has expired or has already been used."`

---

### Step 4: Password Reset Flow
1. Navigate to `/forgot-password`.
2. Enter your registered email and click **Send Reset Link**.
3. **Expected Result**:
   - Page displays uniform anti-enumeration message: `"If an account exists with that email, reset instructions have been sent."`
   - Reset email arrives in your inbox with subject: `Password reset instructions - SMM Panel`.
   - Message explicitly states: `"This link will expire in 30 minutes."`
4. Click the reset link -> Enter a new password.
5. Log in with your new password to verify success.
6. Try opening the reset link a second time:
   - **Expected Result**: System rejects the token as already used.

---

### Step 5: Wallet Credit Receipt (Payment Confirmation)
1. In the admin dashboard (`/admin/wallets`), credit ₹100.00 to the user's wallet (or complete a deposit in `/wallet`).
2. **Expected Result**:
   - A payment receipt email arrives with subject: `Payment receipt: ₹100.00 credited to your wallet`.
   - Email table displays:
     - Amount Credited: `₹100.00`
     - Reference ID: Transaction UUID
     - Updated Balance: Exact current balance
     - Button: **View Wallet Ledger**

---

### Step 6: Admin Health Supervisor Inspection
1. Navigate to `/admin/health` as an Administrator.
2. Inspect the **Transactional Email** supervisor cards:
   - Provider: `Resend HTTPS API`
   - Daily Quota: Displays current count (e.g. `3 / 100 limit`) with green progress bar.
   - Queue: `0 pend`
   - Failures Today: `0`
   - Suppression List: Total count of bounced/complained addresses.
   - Last Email Dispatched: Shows the latest recipient, type, status (`SENT`), and Resend message ID.

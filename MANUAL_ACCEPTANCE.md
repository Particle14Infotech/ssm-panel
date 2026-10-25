# MANUAL_ACCEPTANCE.md: Verification Runbook for User Acceptance Testing

**Target Site:** SMM Panel Live Platform  
**Audience:** User / Product Owner  
**Date:** October 24, 2026  
**Status:** READY FOR VERIFICATION  

---

## Acceptance Test 1: Production Wallet Security Guard (No Free Credits)

### Goal
Prove that a normal user account cannot credit its own wallet balance without an authentic, verified payment gateway transaction.

### Step-by-Step Instructions
1. Open the browser or terminal and authenticate as a normal customer account (non-admin).
2. Attempt a direct wallet deposit by issuing a POST request to the API:
   ```bash
   curl -i -X POST "https://smm-production-bca7.up.railway.app/api/v1/wallet/deposit" \
     -H "Authorization: Bearer <CUSTOMER_JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"amount": 1000}'
   ```
3. Attempt to trigger the development sandbox completion endpoint:
   ```bash
   curl -i -X POST "https://smm-production-bca7.up.railway.app/api/v1/payments/sandbox-complete" \
     -H "Authorization: Bearer <CUSTOMER_JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"paymentId": "sim_test_123"}'
   ```

### Expected Result
- `POST /api/v1/wallet/deposit` returns **`HTTP/1.1 404 Not Found`**.
- `POST /api/v1/payments/sandbox-complete` returns **`HTTP/1.1 404 Not Found`**.
- The user's wallet balance is unchanged.
- No ledger row is inserted into the database.

---

## Acceptance Test 2: Build a 30-Day POST Package & Verify Quote Timeline Match

### Goal
Confirm that the live quote preview timeline precisely matches the saved execution schedule after purchase, and the wallet is debited by the exact quote amount.

### Step-by-Step Instructions
1. Navigate to `/new-order` and select the **"Package (Drip-feed)"** tab.
2. Select **Instagram** as the platform.
3. Enter your handle (e.g. `creator_travels`).
4. Select the **30-day** duration chip.
5. In the Component rules:
   - Check **Likes per Post**: Set 500 units per post, 10 max posts.
   - Check **Views per Post**: Set 1,000 units per post, 10 max posts.
6. Observe the **Live Quote Preview** card on the right:
   - Note down the `Total Amount` (e.g. ₹350.00).
   - Inspect the **Schedule Timeline Preview** chart showing the scheduled run intervals.
7. Check the consent box: *"I understand and agree to the delivery rules"*.
8. Click **"Confirm & Create Package"**.
9. Once created, navigate to the Package Detail view (`/packages/:id`).

### Expected Result
- The customer's wallet balance is reduced by **exactly** the quoted amount (e.g. ₹350.00).
- The transaction history records a single `PACKAGE_PURCHASE` ledger debit.
- The **Run List / Timeline** on `/packages/:id` displays exact runs matching the quote preview chart.

---

## Acceptance Test 3: Pause & Resume Schedule Conservation

### Goal
Prove that pausing a package suppresses dispatches, and resuming it extends the completion deadline while preserving the invariant $\text{delivered} + \text{remaining} \equiv \text{total}$.

### Step-by-Step Instructions
1. Open an active package on `/packages/:id`.
2. Record the current state:
   - Delivered units: $D$
   - Remaining scheduled units: $R$
   - Total units: $T = D + R$
   - Scheduled expiration date: `End Date`
3. Click the **"Pause Package"** button. Confirm the dialog.
4. Verify the package status changes to **`PAUSED`**.
5. Wait 1–2 minutes, then click **"Resume Package"**.
6. Refresh the page and inspect the updated timeline and metrics.

### Expected Result
- Package status returns to **`ACTIVE`**.
- The `End Date` is shifted forward by the pause duration.
- Future executions are rescheduled sequentially.
- **Invariant holds:** Delivered units + Remaining scheduled units equals the initial total $T$.

---

## Acceptance Test 4: Customer Problem Report & Admin Queue Flag

### Goal
Verify that reporting a stalled or problematic run flags the package and generates a priority item in the Admin Queue.

### Step-by-Step Instructions
1. Navigate to `/packages/:id`.
2. Locate an active execution or click **"Report a Problem"** in the top action bar.
3. Select the issue type (e.g. *"Delivery delayed or stalled"*) and provide a brief description.
4. Submit the report.
5. Log into the Admin Portal (`/admin/dashboard` or `/admin/orders`).
6. Inspect the **Reconciliation & Problem Queue**.

### Expected Result
- A support ticket is created and linked to the package.
- The package displays a visible **"Review Underway"** indicator.
- The run appears in the Admin Problem Queue for operator review.

---

## Acceptance Test 5: Save Favorite from Orders & Prefill Reorder

### Goal
Confirm that marking an order as a favorite enables 1-click reorder with pre-validated configuration.

### Step-by-Step Instructions
1. Navigate to `/orders`.
2. Click the star/heart icon on any existing order to mark it as a **Favorite**.
3. Go to the **Favorites** bar or `/favorites` view.
4. Click **"Reorder"** on the saved item.

### Expected Result
- The user is redirected to `/new-order`.
- The form is automatically prefilled with the favorite's platform, service, target URL, and quantity.
- Service availability, pricing rate, and user balance are re-checked in real time.

---

## Acceptance Test 6: Admin Health Telemetry (Zero Stalled / Uncertain Runs)

### Goal
Verify that the system health monitoring dashboard confirms zero lingering, uncertain, or stalled executions.

### Step-by-Step Instructions
1. Log into the Admin Dashboard as an administrator.
2. Navigate to `/admin/health` or `/admin/reports/profit`.
3. Check the **Package Engine Health** telemetry cards:
   - `Uncertain Dispatches`
   - `Stalled Runs (> 24h)`
   - `Consecutive Provider Errors`

### Expected Result
- `Uncertain Dispatches`: **0**
- `Stalled Runs`: **0**
- Provider health indicators show all active providers in **HEALTHY** status.

---

# SECTION 2: SECURITY BREAK-IT ACCEPTANCE CHECKS (STAGING ONLY)

## Security Check 1: Feature-Flag & Allowlist Lockdown (`PACKAGES_ALLOWED_USER_IDS`)

### Goal
Prove that when the package engine is in controlled rollout (`PACKAGES_ALLOWED_USER_IDS="usr_admin,usr_qa"`), any non-allowlisted customer is blocked from creating, quoting, or modifying packages with HTTP 403.

### Step-by-Step Instructions
1. Obtain a valid JWT token for a non-allowlisted customer account (`<NON_ALLOWLISTED_JWT>`).
2. Send a POST request to calculate a package quote:
   ```bash
   curl -i -X POST "https://staging.smm-domain.local/api/v1/packages/quote" \
     -H "Authorization: Bearer <NON_ALLOWLISTED_JWT>" \
     -H "Content-Type: application/json" \
     -d '{
       "platform": "instagram",
       "handle": "test_creator",
       "followersDrip": { "serviceId": "svc_1", "quantity": 1000, "days": 30 }
     }'
   ```
### Expected Result
- Server responds with **`HTTP/1.1 403 Forbidden`**.
- Response body contains: `"Access to packages is restricted to allowlisted beta users during this rollout phase."`

---

## Security Check 2: Cross-Tenant Package IDOR Protection (User B vs User A)

### Goal
Prove that customer User B cannot view, pause, resume, cancel, or tamper with customer User A's package, receiving HTTP 404 Not Found (zero side effects and zero metadata leakage).

### Step-by-Step Instructions
1. As User A, create or note an existing package ID (e.g. `pkg_user_a_123`).
2. Authenticate as User B (`<USER_B_JWT>`).
3. Attempt to fetch User A's package details:
   ```bash
   curl -i -X GET "https://staging.smm-domain.local/api/v1/packages/pkg_user_a_123" \
     -H "Authorization: Bearer <USER_B_JWT>"
   ```
4. Attempt to cancel User A's package:
   ```bash
   curl -i -X POST "https://staging.smm-domain.local/api/v1/packages/pkg_user_a_123/cancel" \
     -H "Authorization: Bearer <USER_B_JWT>"
   ```
### Expected Result
- Both requests return **`HTTP/1.1 404 Not Found`**.
- The package status remains unchanged.
- User B receives no refund and zero details about User A's account or handle.

---

## Security Check 3: Role Matrix & Unauthenticated Admin Mutation Rejection

### Goal
Confirm that all mutation routes on platform infrastructure controllers (`/services`, `/providers`, `/settings`, `/reports`) strictly reject unauthenticated callers and non-admin customer roles with HTTP 401 or HTTP 403.

### Step-by-Step Instructions
1. As an unauthenticated caller (no token), attempt to create a service:
   ```bash
   curl -i -X POST "https://staging.smm-domain.local/api/v1/services" \
     -H "Content-Type: application/json" \
     -d '{"name": "Hacked Service", "ratePer1000": 10}'
   ```
2. As a regular customer (`<CUSTOMER_JWT>`), attempt to list provider API keys:
   ```bash
   curl -i -X GET "https://staging.smm-domain.local/api/v1/providers" \
     -H "Authorization: Bearer <CUSTOMER_JWT>"
   ```
### Expected Result
- Unauthenticated request returns **`HTTP/1.1 401 Unauthorized`**.
- Customer request returns **`HTTP/1.1 403 Forbidden`**.
- Zero catalog mutations or credential leaks occur.

---

## Security Check 4: Mass Assignment Defense on Profile Update (`PUT /users/me`)

### Goal
Verify that a customer cannot self-elevate their pricing discount tier to `ENTERPRISE` or `PRO_SCALE` via mass assignment on their profile update endpoint.

### Step-by-Step Instructions
1. Authenticate as a normal customer (`<CUSTOMER_JWT>`) with current tier `FREE`.
2. Issue a profile update containing the forbidden `tier` field:
   ```bash
   curl -i -X PUT "https://staging.smm-domain.local/api/v1/users/me" \
     -H "Authorization: Bearer <CUSTOMER_JWT>" \
     -H "Content-Type: application/json" \
     -d '{"name": "Attacker", "tier": "ENTERPRISE"}'
   ```
3. Fetch the updated profile:
   ```bash
   curl -i -X GET "https://staging.smm-domain.local/api/v1/users/me" \
     -H "Authorization: Bearer <CUSTOMER_JWT>"
   ```
### Expected Result
- The `name` is updated to `"Attacker"`.
- The `tier` remains **`FREE`** (the client-sent `tier` was stripped/ignored).

---

## Security Check 5: Hostile Parameter Tampering & Injection on Package Quote

### Goal
Prove that the package calculation engine strictly rejects negative quantities, non-integer values, duration 0, and HTML injection payloads at server-side validation.

### Step-by-Step Instructions
1. Authenticate as a customer and submit a quote request with `days: 0` and negative quantity:
   ```bash
   curl -i -X POST "https://staging.smm-domain.local/api/v1/packages/quote" \
     -H "Authorization: Bearer <CUSTOMER_JWT>" \
     -H "Content-Type: application/json" \
     -d '{
       "platform": "instagram",
       "handle": "<script>alert(1)</script>",
       "followersDrip": { "serviceId": "svc_1", "quantity": -500, "days": 0 }
     }'
   ```
### Expected Result
- Server responds with **`HTTP/1.1 400 Bad Request`**.
- Response states: `"Schedule duration must be a positive integer."` or `"Quantity must be a positive integer."`
- No exception traces or internal paths are leaked.


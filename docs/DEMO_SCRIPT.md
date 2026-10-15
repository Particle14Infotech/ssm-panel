# 🎬 AETHER SMM Platform: 8–10 Minute Evaluator Demo Script

> **Objective:** Walk through the complete customer journey, administrative controls, financial invariants, and failure recovery mechanisms step-by-step.  
> **Target Environment:** Localhost (Web: `http://localhost:3000`, API: `http://localhost:4000`/`4001`)  
> **Demo Flow:** 5 Distinct Acts (Normal Order, Insufficient Funds Guard, Idempotency Protection, Admin Management & Refund, Audit Log Verification)

---

## ⏱️ Demo Timeline Overview

| Minute | Stage | Action / Flow | Expected Observable Outcome |
| :--- | :--- | :--- | :--- |
| **0:00 - 1:30** | **Act 1: Login & Telemetry** | Log in with demo customer, inspect wallet liquidity | Current balance is displayed (e.g. ₹2,450.00 INR) |
| **1:30 - 3:30** | **Act 2: Add Funds via Gateway** | Deposit ₹1,000 via simulated Razorpay gateway | Balance rises by exactly ₹1,100 (+10% tier bonus) |
| **3:30 - 5:00** | **Act 3: New Order Dispatch** | Configure 1,000 unit Instagram order, submit | Balance falls by exactly ₹180; status transitions to COMPLETED |
| **5:00 - 6:30** | **Act 4: Negative Financial Guards** | Test 9,999,999 units (Insufficient Funds) & double click | Alert blocks dispatch; double-click creates only 1 order |
| **6:30 - 8:30** | **Act 5: Admin Operations** | Log in as admin, adjust balance with mandatory reason | Audit log records reason; customer balance updates |
| **8:30 - 10:00** | **Act 6: Q&A & Invariant Proof** | Run `pnpm smoke` or review `docs/evidence/` | Complete ledger sum matches wallet balance |

---

## 📋 Step-by-Step Walkthrough

### Act 1: Initial Login & Wallet Inspection (0:00 - 1:30)
1. **Open Browser:** Navigate to `http://localhost:3000/login`.
2. **Enter Demo Customer Credentials:**
   - **Email:** `customer@smm.dev`
   - **Password:** `Password123!`
3. **Click:** `Sign In` / `Enter Terminal`.
4. **Navigate:** Click **Wallet** in the navigation sidebar (`http://localhost:3000/app/wallet`).
5. **Observe:**
   - The **Available Spending Liquidity** displays `₹2,450.00 INR`.
   - The **Recent Transactions** ledger lists past completed transactions.

---

### Act 2: Add Funds via Sandbox Gateway (+Bonus Tier) (1:30 - 3:30)
1. **On Wallet Page:** Locate the **Add Funds to Liquidity Pool** panel.
2. **Select Gateway:** Click **UPI** or **Credit / Debit Card**.
3. **Select Amount:** Click the **₹1,000** preset button.
4. **Observe Bonus Preview:**
   - The dynamic bonus banner updates: *"10% Tier Bonus Applied! You receive ₹1,100.00 in total spendable credit."*
5. **Click CTA:** Click `Deposit ₹1,000.00 & Claim +₹100.00 Bonus`.
6. **Observe Result:**
   - Confirmation banner appears: *"Deposit Credited Successfully! ₹1,100.00 has been credited instantly to your wallet."*
   - Current balance increases by **EXACTLY ₹1,100.00** from `₹2,450.00` to `₹3,550.00 INR`.

---

### Act 3: Normal Order Dispatch & Status Progression (3:30 - 5:00)
1. **Navigate:** Click **New Order** in navigation (`http://localhost:3000/app/new-order`).
2. **Select Service:** Ensure `Instagram High-Retention Followers` (ID `1042`, Rate: ₹180.00 / 1k) is active.
3. **Enter Target URL:**
   - Target: `https://instagram.com/p/live_evaluator_demo`
4. **Set Quantity:** Enter `1000`.
5. **Observe Dynamic Quote:**
   - Real-time quote indicates: `Total Investment Required: ₹180.00 INR NET`.
   - Projected balance indicates: `₹3,370.00 INR`.
6. **Click Dispatch:** Click `Execute Instant Dispatch (Confirm)`.
7. **Observe Confirmation:**
   - Banner confirms: *"Dispatched Successfully!"* with generated Order ID (e.g. `ORD-83412`).
8. **Navigate to Orders:** Click **Orders** (`http://localhost:3000/app/orders`).
9. **Observe Progression:**
   - Order appears in table and progresses from `PENDING` -> `PROCESSING` -> `IN_PROGRESS` -> `COMPLETED`.
10. **Re-check Wallet:** Return to `/app/wallet`; verify balance is **EXACTLY ₹3,370.00 INR** (`₹3,550.00 - ₹180.00`).

---

### Act 4: Negative Financial Guards (5:00 - 6:30)
1. **Navigate:** Return to `http://localhost:3000/app/new-order`.
2. **Test 4.1: Insufficient Balance Guard (Block Without Debit)**
   - Enter an extreme quantity exceeding wallet balance: `999999`.
   - **Observe:**
     - The dispatch CTA is immediately disabled and replaced with:
       *"Insufficient balance. Top up to continue."*
     - An **Add Funds to Wallet** shortcut button appears.
     - No database debit or ledger charge is created.
3. **Test 4.2: Double-Click Idempotency Protection**
   - Reset quantity to `1000`.
   - Enter target: `https://instagram.com/p/idempotency_check`.
   - Perform a rapid double-click on `Execute Instant Dispatch (Confirm)`.
   - **Observe:**
     - The button immediately enters a disabled spinning state (`Dispatching to Cluster...`).
     - Only **ONE** order row and **ONE** ledger charge of ₹180.00 is generated.

---

### Act 5: Admin Operations & Balance Adjustment with Reason (6:30 - 8:30)
1. **Log Out & Re-login as Admin:**
   - Navigate to `/login`.
   - **Email:** `admin@smm.dev`
   - **Password:** `AdminSecretPass123!`
2. **Inspect Admin Orders:**
   - Navigate to `http://localhost:3000/admin/orders`.
   - Observe the full supervisor orders ledger, with filters for status, user ID, and target vectors.
3. **Navigate to User Directory:**
   - Click **Users** (`http://localhost:3000/admin/users`).
4. **Trigger Balance Adjustment:**
   - Locate customer `Alex Vance` / `usr_001`.
   - Click `Adjust Balance`.
5. **Fill Adjustment Modal:**
   - Select: `+ Add Credit`.
   - Amount: `500`.
   - **Mandatory Reason:** `Evaluator demo VIP onboarding credit`.
   - Click `Confirm Adjustment`.
6. **Observe Result:**
   - Modal closes cleanly.
   - User table updates immediately to reflect the new adjusted balance (+₹500.00).

---

### Act 6: Invariant Proof & Conclusion (8:30 - 10:00)
1. **CLI Invariant & Smoke Verification:**
   - Open a terminal and run the authoritative smoke command:
     ```bash
     pnpm smoke
     ```
   - Point out to the evaluator the real-time execution trace:
     - Health probes response: 200 OK.
     - User registration & JWT generation.
     - Gateway deposit with bonus calculation.
     - Order charge deduction.
     - Final financial invariant check: **Ledger Net Sum matches Liquid Wallet Balance**.
2. **Review Evidence Pack:**
   - Direct evaluator to `docs/evidence/` for immutable raw logs from this session:
     - Full 15-Stage Gate: [`docs/evidence/20261015-1933-verify-backend-gate.txt`](file:///d:/projects/internship%20projects/SMM/docs/evidence/20261015-1933-verify-backend-gate.txt)
     - Playwright Desktop 1440: [`docs/evidence/20261015-1959-playwright-p3-proof.txt`](file:///d:/projects/internship%20projects/SMM/docs/evidence/20261015-1959-playwright-p3-proof.txt)
     - Smoke Run: [`docs/evidence/20261015-1950-smoke-test.txt`](file:///d:/projects/internship%20projects/SMM/docs/evidence/20261015-1950-smoke-test.txt)

---

## 🎯 Evaluator Talking Points Summary

During the presentation, state the following honestly and clearly:

1. **"Our financial core is governed by double-entry ledger invariants."**  
   Every balance debit or credit corresponds to an immutable ledger row. Negative balances and double-refunds are prevented by pessimistic database row locks and database-level unique constraints.

2. **"Docker is not used in this evaluation."**  
   All tests, gates, and services execute natively on the Windows host using Node.js, `pg-mem`, and in-memory mock adapters.

3. **"External providers are sandboxed for honest evaluation."**  
   Razorpay operates through a sandbox simulation endpoint; SMM orders route through `MockProvider`; emails print to console. Live modes require only substituting real API credentials in `.env`.

4. **"Deferred features are flagged off cleanly."**  
   Reseller portal, 2FA TOTP, SMS gateways, and cold storage archival are safely deferred behind feature flags and documented in `docs/KNOWN_LIMITATIONS.md`.

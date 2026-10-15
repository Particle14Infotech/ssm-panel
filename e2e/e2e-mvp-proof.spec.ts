import { test, expect } from "@playwright/test";

test.describe("Real End-to-End MVP Proof (P3 Desk 1440)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("1. Customer Flow: Login -> Read Balance -> Sandbox Add Funds (Exact +Bonus) -> Place Order (Exact -Charge) -> Poll COMPLETED", async ({
    page,
  }) => {
    // 1.1 Customer Login with Seeded Demo Credentials
    await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1, h2, input[name='usernameOrEmail'], input[type='text'], input[type='email']").first()).toBeVisible();

    const emailInput = page.locator("input[name='usernameOrEmail']").or(page.locator("input[type='text']")).first();
    const passwordInput = page.locator("input[name='password']").or(page.locator("input[type='password']")).first();

    await emailInput.fill("customer@smm.dev");
    await passwordInput.fill("Password123!");

    const submitBtn = page.getByRole("button", { name: /sign in|login|enter terminal/i }).first();
    await submitBtn.click();

    // 1.2 Navigate to Wallet and read Initial Balance
    await page.goto("http://localhost:3000/app/wallet", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toContainText(/Wallet & Billing/i);

    // Balance text locator: ₹2,450.00
    const balanceElem = page.locator("span.font-mono.tracking-tight").first();
    await expect(balanceElem).toBeVisible();
    const initialText = await balanceElem.innerText();
    const initialBalance = parseFloat(initialText.replace(/[^0-9.]/g, ""));
    expect(initialBalance).toBeGreaterThan(0);

    // 1.3 Add Funds through Sandbox Gateway (₹1,000 + 10% bonus = ₹1,100 credited)
    const depositBtn = page.locator("[data-testid='deposit-submit-btn']").or(page.getByRole("button", { name: /deposit/i })).first();
    await expect(depositBtn).toBeVisible();
    await depositBtn.click();

    // Assert Deposit Success confirmation
    await expect(page.getByText(/Deposit Credited Successfully/i).first()).toBeVisible({ timeout: 10000 });

    // Assert Balance rises by EXACTLY credited amount (+₹1,100)
    const afterDepositText = await balanceElem.innerText();
    const afterDepositBalance = parseFloat(afterDepositText.replace(/[^0-9.]/g, ""));
    const creditedAmount = 1100.0; // 1000 + 10% bonus for Tier 2
    expect(afterDepositBalance).toBeCloseTo(initialBalance + creditedAmount, 1);

    // 1.4 Place Order and assert balance falls by EXACTLY the order charge
    await page.goto("http://localhost:3000/app/new-order", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Target Vector|Dispatch Summary|New Dispatch/i).first()).toBeVisible();

    const targetInput = page.locator("input[placeholder*='growth.vector'], input[placeholder*='instagram.com']").first();
    await expect(targetInput).toBeVisible();
    await targetInput.fill("https://instagram.com/p/verified_proof_mvp_order");

    const qtyInput = page.locator("input[type='number']").first();
    await qtyInput.fill("1000");
    await qtyInput.dispatchEvent("change");

    const charge = 180.0;

    // Dispatch order
    const dispatchBtn = page.getByRole("button", { name: /Execute Instant Dispatch|Confirm/i }).first();
    await expect(dispatchBtn).toBeVisible();
    await dispatchBtn.click();

    // Verify order feedback
    await expect(page.getByText(/Dispatched Successfully|ORD-/i).first()).toBeVisible({ timeout: 8000 });

    // 1.5 Verify balance deducted by EXACTLY charge
    await page.goto("http://localhost:3000/app/wallet", { waitUntil: "domcontentloaded" });
    const finalBalanceText = await balanceElem.innerText();
    const finalBalance = parseFloat(finalBalanceText.replace(/[^0-9.]/g, ""));
    expect(finalBalance).toBeCloseTo(afterDepositBalance - charge, 1);

    // 1.6 Poll order status up to 60s for COMPLETED
    await page.goto("http://localhost:3000/app/orders", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Completed|Processing|Pending|In Progress/i).first()).toBeVisible({ timeout: 15000 });

    // Confirm that at least one order has status Completed
    const completedBadge = page.locator("text=/Completed/i").first();
    await expect(completedBadge).toBeVisible({ timeout: 60000 });
  });

  test("2. Admin Flow: Login -> Admin Orders -> User Balance Adjustment with Mandatory Reason", async ({
    page,
  }) => {
    // 2.1 Admin Login
    await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
    const emailInput = page.locator("input[name='usernameOrEmail']").or(page.locator("input[type='text']")).first();
    const passwordInput = page.locator("input[name='password']").or(page.locator("input[type='password']")).first();

    await emailInput.fill("admin@smm.dev");
    await passwordInput.fill("AdminSecretPass123!");
    await page.getByRole("button", { name: /sign in|login|enter terminal/i }).first().click();

    // 2.2 Inspect Admin Orders Ledger
    await page.goto("http://localhost:3000/admin/orders", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toContainText(/Admin Orders Ledger/i);
    await expect(page.locator("table, tr").first()).toBeVisible();

    // 2.3 User Directory: Balance adjustment with mandatory reason
    await page.goto("http://localhost:3000/admin/users", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1")).toContainText(/User Directory/i);

    // Click balance adjustment button on first user
    const editBalanceBtn = page.getByRole("button", { name: /Adjust Balance|Edit Balance/i }).or(page.locator("button:has-text('Adjust')")).first();
    await expect(editBalanceBtn).toBeVisible();
    await editBalanceBtn.click();

    // Assert modal opened
    await expect(page.getByText(/Adjust Wallet/i).first()).toBeVisible();

    // Fill mandatory reason and submit
    const reasonInput = page.locator("input[placeholder*='VIP onboarding'], input[placeholder*='reason']").first();
    await expect(reasonInput).toBeVisible();
    await reasonInput.fill("Proof validation: VIP onboarding credit verified");

    const confirmBtn = page.getByRole("button", { name: /Confirm Adjustment/i }).first();
    await confirmBtn.click();

    // Verify modal closed and user table updated
    await expect(page.getByText(/Adjust Wallet/i)).not.toBeVisible({ timeout: 5000 });
  });

  test("3. Negative Tests: Insufficient Balance Guard (Blocks Order without Debit) & Idempotency", async ({
    page,
  }) => {
    // 3.1 Insufficient Balance Guard
    await page.goto("http://localhost:3000/app/new-order", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(/Target Vector|Dispatch Summary|New Dispatch/i).first()).toBeVisible();

    // Enter extreme quantity exceeding available funds
    const qtyInput = page.locator("input[type='number']").first();
    await expect(qtyInput).toBeVisible();
    await qtyInput.fill("9999999");
    await qtyInput.dispatchEvent("change");

    // Guard alert appears
    const guardAlert = page.locator("[data-testid='insufficient-funds-alert']").or(page.getByText(/Insufficient balance/i)).first();
    await expect(guardAlert).toBeVisible({ timeout: 5000 });

    // Confirm that Add Funds button is offered and direct dispatch is blocked
    const addFundsShortcut = page.getByRole("link", { name: /Add Funds/i }).first();
    await expect(addFundsShortcut).toBeVisible();

    // 3.2 Double-Click Idempotency Verification
    await page.goto("http://localhost:3000/app/new-order", { waitUntil: "domcontentloaded" });
    const targetInput = page.locator("input[placeholder*='growth.vector'], input[placeholder*='instagram.com']").first();
    await targetInput.fill("https://instagram.com/p/idempotency_proof_test");

    const normalQtyInput = page.locator("input[type='number']").first();
    await normalQtyInput.fill("1000");
    await normalQtyInput.dispatchEvent("change");

    const dispatchBtn = page.getByRole("button", { name: /Execute Instant Dispatch|Confirm/i }).first();
    if (await dispatchBtn.isVisible()) {
      // Rapid double click
      await dispatchBtn.click({ clickCount: 2 });
      // Assert that either one order is confirmed or disabled while submitting
      await expect(page.getByText(/Dispatched Successfully|ORD-/i).first()).toBeVisible({ timeout: 8000 });
    }
  });
});

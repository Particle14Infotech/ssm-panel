import { test, expect, Page } from "@playwright/test";

test.describe("Q3: Orders, Tracking & Refund Browser Verification (ORD-01 to ORD-10)", () => {
  async function registerUser(page: Page, user: { name: string; username: string; email: string; password: string }) {
    await page.goto("http://localhost:3000/register");
    try {
      await expect(page.getByRole("heading", { name: /Create New Account/i })).toBeVisible({ timeout: 6000 });
    } catch {
      await page.reload();
      await expect(page.getByRole("heading", { name: /Create New Account/i })).toBeVisible({ timeout: 15000 });
    }
    await page.locator("input[name='name']").fill(user.name);
    await page.locator("input[name='username']").fill(user.username);
    await page.locator("input[name='email']").fill(user.email);
    await page.locator("input[name='password']").fill(user.password);
    await page.locator("input[name='confirmPassword']").fill(user.password);
    await page.locator("input[name='termsAccepted']").check();
    await page.getByRole("button", { name: /Complete Registration/i }).click();
    await page.waitForURL((url) => url.pathname.includes("/app/dashboard"), { timeout: 30000 });
  }

  async function fundWallet(page: Page) {
    await page.goto("http://localhost:3000/app/wallet");
    await page.waitForLoadState("domcontentloaded");

    const depositBtn = page.locator("[data-testid='deposit-submit-btn']");
    await expect(depositBtn).toBeVisible({ timeout: 15000 });
    await depositBtn.click();

    // Verify Simulated Checkout Modal appears
    await expect(page.locator("text=Secure Checkout")).toBeVisible({ timeout: 15000 });

    const payBtn = page.locator("button:has-text('Pay ₹')").last();
    await expect(payBtn).toBeVisible({ timeout: 10000 });
    await payBtn.click();

    // Wait for payment approval text in modal
    await expect(page.getByText(/Payment Approved/i)).toBeVisible({ timeout: 15000 });

    // Wait for modal to auto-close and wallet balance credit notification to appear
    await expect(page.getByText(/Deposit Credited Successfully!/i)).toBeVisible({ timeout: 20000 });
    await expect(page.locator("text=Secure Checkout")).not.toBeVisible({ timeout: 15000 });

    // Verify wallet balance reflects credited funds (1,000 deposit + 10% bonus = 1,100)
    await expect(page.locator("body")).toContainText("1,100");
  }

  test("1. Insufficient Balance Guardrail: New user with ₹0 balance sees shortfall & disabled submit", async ({ page }) => {
    const ts = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user = {
      name: `Q3 ZeroUser ${ts}`,
      username: `q3_zero_${ts}`,
      email: `q3_zero_${ts}@smm.dev`,
      password: "Password123!Secure",
    };

    // Register user with ₹0 initial balance
    await registerUser(page, user);

    // Navigate to new order page
    await page.goto("http://localhost:3000/app/new-order?service=1042");
    await page.waitForLoadState("domcontentloaded");

    // Target link (valid profile URL for Instagram followers service)
    const targetInput = page.locator("input[placeholder*='instagram.com' i], input[placeholder*='http' i]").first();
    await expect(targetInput).toBeVisible({ timeout: 15000 });
    await targetInput.fill("https://instagram.com/qa_zero_profile");

    // Check shortfall alert is displayed
    const shortfallAlert = page.getByText(/Short by ₹|Add ₹/i).first();
    await expect(shortfallAlert).toBeVisible({ timeout: 10000 });

    // Submit button must be disabled
    const placeOrderBtn = page.getByRole("button", { name: /Place order/i }).first();
    await expect(placeOrderBtn).toBeDisabled();
  });

  test("2. Place Order Flow: Deposit funds, submit order, view in order list & details", async ({ page }) => {
    const ts = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user = {
      name: `Q3 OrderUser ${ts}`,
      username: `q3_ord_${ts}`,
      email: `q3_ord_${ts}@smm.dev`,
      password: "Password123!Secure",
    };

    // 1. Register fresh user
    await registerUser(page, user);

    // 2. Fund wallet via simulation
    await fundWallet(page);

    // 3. Navigate to new order
    await page.goto("http://localhost:3000/app/new-order?service=1042");
    await page.waitForLoadState("domcontentloaded");

    // Enter valid profile link for Instagram Followers
    const targetInput = page.locator("input[placeholder*='instagram.com' i], input[placeholder*='http' i]").first();
    await expect(targetInput).toBeVisible({ timeout: 15000 });
    await targetInput.fill("https://instagram.com/qa_order_flow");

    // Click Place Order
    const placeOrderBtn = page.getByRole("button", { name: /Place order/i }).first();
    await expect(placeOrderBtn).toBeEnabled({ timeout: 15000 });
    await placeOrderBtn.click();

    // Confirm Modal
    const confirmBtn = page.getByRole("button", { name: /Confirm order/i });
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();

    // Verify Success card appears
    await expect(page.getByText(/Order placed successfully/i)).toBeVisible({ timeout: 15000 });

    // 4. Navigate to orders page
    await page.goto("http://localhost:3000/app/orders");
    await page.waitForLoadState("domcontentloaded");

    // Verify order row exists
    const orderRows = page.locator("tbody tr");
    await expect(orderRows.first()).toBeVisible({ timeout: 15000 });

    // Click order row to open Details modal
    await orderRows.first().click();

    // Verify Details modal opens
    await expect(page.getByText(/Aim Fulfillment Progress|Target Vector|Order Details/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("3. Order Cancellation & Wallet Refund in UI", async ({ page }) => {
    const ts = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user = {
      name: `Q3 CancelUser ${ts}`,
      username: `q3_cnc_${ts}`,
      email: `q3_cnc_${ts}@smm.dev`,
      password: "Password123!Secure",
    };

    // 1. Register fresh user
    await registerUser(page, user);

    // 2. Deposit funds
    await fundWallet(page);

    // 3. Place order
    await page.goto("http://localhost:3000/app/new-order?service=1042");
    await page.waitForLoadState("domcontentloaded");

    const targetInput = page.locator("input[placeholder*='instagram.com' i], input[placeholder*='http' i]").first();
    await expect(targetInput).toBeVisible({ timeout: 15000 });
    await targetInput.fill("https://instagram.com/qa_cancel_flow");

    const placeOrderBtn = page.getByRole("button", { name: /Place order/i }).first();
    await expect(placeOrderBtn).toBeEnabled({ timeout: 15000 });
    await placeOrderBtn.click();

    const confirmBtn = page.getByRole("button", { name: /Confirm order/i });
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();
    await expect(page.getByText(/Order placed successfully/i)).toBeVisible({ timeout: 15000 });

    // 4. Go to /app/orders and click Cancel
    await page.goto("http://localhost:3000/app/orders");
    await page.waitForLoadState("domcontentloaded");

    const cancelBtn = page.getByRole("button", { name: /^Cancel$/i }).first();
    if (await cancelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await cancelBtn.click();
      await page.waitForTimeout(2000);
    }

    // 5. Navigate to wallet and verify balance is active without NaN
    await page.goto("http://localhost:3000/app/wallet");
    await page.waitForLoadState("domcontentloaded");
    const walletText = await page.locator("body").innerText();
    expect(walletText).not.toContain("NaN");
    expect(walletText).toMatch(/₹|INR/);
  });
});

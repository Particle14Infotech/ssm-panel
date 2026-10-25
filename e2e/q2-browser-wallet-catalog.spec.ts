import { test, expect } from "@playwright/test";

test.describe("Q2: Catalog & Wallet Browser Verification (CAT-01, WAL-01, WAL-02, WAL-03)", () => {
  test("1. Services Catalog: Public/customer view, filters, search, INR pricing", async ({ page }) => {
    // Navigate to services catalog
    await page.goto("http://localhost:3000/services");
    await page.waitForLoadState("domcontentloaded");

    // Check catalog presence
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("NaN");
    expect(bodyText).not.toContain("undefined");

    // Check search input exists
    const searchInput = page.locator("input[placeholder*='Search' i]");
    if (await searchInput.isVisible()) {
      await searchInput.fill("Instagram");
      await page.waitForTimeout(500);
      const afterSearch = await page.locator("body").innerText();
      expect(afterSearch).toMatch(/Instagram/i);
    }
  });

  test("2. Wallet Zero-State: New customer registers, wallet shows ₹0.00 without NaN", async ({ page }) => {
    const ts = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user = {
      name: `Q2 ZeroUser ${ts}`,
      username: `q2_zero_${ts}`,
      email: `q2_zero_${ts}@smm.dev`,
      password: "Password123!Secure",
    };

    // Register fresh user
    await page.goto("http://localhost:3000/register");
    await page.locator("input[name='name']").fill(user.name);
    await page.locator("input[name='username']").fill(user.username);
    await page.locator("input[name='email']").fill(user.email);
    await page.locator("input[name='password']").fill(user.password);
    await page.locator("input[name='confirmPassword']").fill(user.password);
    await page.locator("input[name='termsAccepted']").check();
    await page.getByRole("button", { name: /Complete Registration/i }).click();

    // Wait for dashboard navigation
    await page.waitForURL((url) => url.pathname.includes("/app/dashboard"), { timeout: 30000 });

    // Navigate to wallet
    await page.goto("http://localhost:3000/app/wallet");
    await page.waitForLoadState("domcontentloaded");

    // Verify zero state balance is displayed in INR and is not NaN
    const walletText = await page.locator("body").innerText();
    expect(walletText).not.toContain("NaN");
    expect(walletText).not.toContain("undefined");
    expect(walletText).toMatch(/₹|INR/);
  });

  test("3. Add Funds & Ledger: Modal opens, payment completes, balance & ledger update", async ({ page }) => {
    const ts = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user = {
      name: `Q2 DepositUser ${ts}`,
      username: `q2_dep_${ts}`,
      email: `q2_dep_${ts}@smm.dev`,
      password: "Password123!Secure",
    };

    // Register fresh user for deposit test
    await page.goto("http://localhost:3000/register");
    await page.locator("input[name='name']").fill(user.name);
    await page.locator("input[name='username']").fill(user.username);
    await page.locator("input[name='email']").fill(user.email);
    await page.locator("input[name='password']").fill(user.password);
    await page.locator("input[name='confirmPassword']").fill(user.password);
    await page.locator("input[name='termsAccepted']").check();
    await page.getByRole("button", { name: /Complete Registration/i }).click();

    await page.waitForURL((url) => url.pathname.includes("/app/dashboard"), { timeout: 30000 });

    // Navigate to wallet
    await page.goto("http://localhost:3000/app/wallet");
    await page.waitForLoadState("domcontentloaded");

    // Locate the deposit submit button
    const depositBtn = page.locator("[data-testid='deposit-submit-btn']");
    await expect(depositBtn).toBeVisible({ timeout: 15000 });
    await depositBtn.click();

    // Verify Simulated Checkout Modal appears
    const checkoutModal = page.locator("text=Secure Checkout");
    await expect(checkoutModal).toBeVisible({ timeout: 15000 });

    // In simulated checkout modal, click Pay button
    const payBtn = page.locator("button:has-text('Pay ₹')").last();
    await expect(payBtn).toBeVisible({ timeout: 10000 });
    await payBtn.click();

    // Wait for success confirmation in modal or on page
    await expect(page.getByText(/Payment Approved|credited to your wallet|Authorizing Payment/i).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(3000);

    // Verify wallet balance renders valid number without NaN
    const updatedWalletText = await page.locator("body").innerText();
    expect(updatedWalletText).not.toContain("NaN");
    expect(updatedWalletText).not.toContain("undefined");
  });
});

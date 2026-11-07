import { test, expect } from "@playwright/test";

test.describe("Client Requirements Overhaul Verification", () => {
  test.beforeEach(async ({ context, page }) => {
    // Inject cookies for Next.js middleware authentication
    await context.addCookies([
      {
        name: "authToken",
        value: "jwt_bholu_test_token_12345",
        domain: "localhost",
        path: "/",
      },
      {
        name: "token",
        value: "jwt_bholu_test_token_12345",
        domain: "localhost",
        path: "/",
      },
      {
        name: "userRole",
        value: "CUSTOMER",
        domain: "localhost",
        path: "/",
      },
    ]);

    // Inject demo auth session into localStorage
    await page.addInitScript(() => {
      localStorage.setItem("authToken", "jwt_bholu_test_token_12345");
      localStorage.setItem("token", "jwt_bholu_test_token_12345");
      localStorage.setItem(
        "authUser",
        JSON.stringify({
          id: "usr_test_demo",
          email: "bholu@gmail.com",
          name: "Bholu Customer",
          role: "CUSTOMER",
          tier: "GOLD",
          balance: 99570.76,
        })
      );
    });
  });

  test("1. Verify New Order Link Reset & Clear Form controls", async ({ page }) => {
    await page.goto("http://localhost:3000/new-order?tab=custom_drip");
    await page.waitForLoadState("networkidle");

    // Verify Quick Link Detection Bar has Reset Form button
    const resetFormBtn = page.locator("button:has-text('Reset Form')");
    await expect(resetFormBtn).toBeVisible({ timeout: 8000 });

    // Type a test link into the quick input
    const quickInput = page.locator("input[placeholder*='Paste profile or post link']");
    await quickInput.fill("https://instagram.com/reel/DfZF7ZShr8c");
    await expect(quickInput).toHaveValue("https://instagram.com/reel/DfZF7ZShr8c");

    // Click Reset Form
    await resetFormBtn.click();
    await expect(quickInput).toHaveValue("");

    // Verify Campaign Configuration has Reset Links button when link is entered
    const reelInput = page.locator("input[placeholder*='instagram.com/reel']");
    if (await reelInput.isVisible()) {
      await reelInput.fill("https://instagram.com/reel/TestLink123");
      const resetLinksBtn = page.locator("button:has-text('Reset Links')");
      await expect(resetLinksBtn).toBeVisible();
      await resetLinksBtn.click();
      await expect(reelInput).toHaveValue("");
    }
  });

  test("2. Verify Custom Package 3 Days chip, 60 Days duration, and Slider", async ({ page }) => {
    await page.goto("http://localhost:3000/new-order?tab=custom_drip");
    await page.waitForLoadState("networkidle");

    // Verify 3 Days chip is visible and clickable
    const threeDaysChip = page.locator("button:has-text('3d'), button:has-text('3 Days')").first();
    await expect(threeDaysChip).toBeVisible({ timeout: 8000 });
    await threeDaysChip.click();

    // Verify schedule badge reflects 3 Days
    const scheduleBadge = page.locator("text=3 Days Pacing");
    await expect(scheduleBadge).toBeVisible();

    // Verify 60 Days chip is visible and clickable
    const sixtyDaysChip = page.locator("button:has-text('60d'), button:has-text('60 Days')").first();
    await expect(sixtyDaysChip).toBeVisible();
    await sixtyDaysChip.click();

    // Verify schedule badge reflects 60 Days
    const sixtyBadge = page.locator("text=60 Days Pacing");
    await expect(sixtyBadge).toBeVisible();

    // Verify slider input has max 60
    const slider = page.locator("input[type='range'][max='60']");
    await expect(slider).toBeVisible();
    await expect(slider).toHaveAttribute("max", "60");
  });

  test("3. Verify All Platform Services Catalog and Smooth Intra-Day Triggers", async ({ page }) => {
    await page.goto("http://localhost:3000/new-order?tab=custom_drip");
    await page.waitForLoadState("networkidle");

    // Verify Smooth Intra-Day Drip & Random Safe Triggers section is present
    const dripHeader = page.locator("text=Smooth Intra-Day Drip & Random Safe Triggers");
    await expect(dripHeader).toBeVisible({ timeout: 8000 });

    // Verify Organic Random (Safe) and Uniform Paced buttons
    const organicBtn = page.locator("button:has-text('Organic Random')");
    const uniformBtn = page.locator("button:has-text('Uniform Paced')");
    await expect(organicBtn).toBeVisible();
    await expect(uniformBtn).toBeVisible();

    // Click uniform then back to organic
    await uniformBtn.click();
    await organicBtn.click();

    // Verify All Platform Services section is present
    const catalogHeader = page.locator("text=All Platform Services");
    await expect(catalogHeader).toBeVisible();

    // Verify "+ Add Other Service" button toggles catalog browser
    const addServiceBtn = page.locator("button:has-text('+ Add Other Service')");
    await expect(addServiceBtn).toBeVisible();
    await addServiceBtn.click();

    // Verify search input inside catalog
    const catalogSearchInput = page.locator("input[placeholder*='saves, reach']");
    await expect(catalogSearchInput).toBeVisible();
  });

  test("4. Verify Floating Liquid Glass Mobile Navigation & Wallet Balance", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://localhost:3000/dashboard");
    await page.waitForLoadState("networkidle");

    // Verify floating capsule navigation bar is present
    const navBar = page.locator("nav.rounded-full");
    await expect(navBar).toBeVisible({ timeout: 8000 });

    // Verify Wallet balance is displayed under the Wallet icon
    const walletBalanceText = page.locator("nav").locator("text=₹99,570");
    await expect(walletBalanceText).toBeVisible();

    // Verify active pill styling
    const activeItem = page.locator("nav a").first();
    await expect(activeItem).toBeVisible();
  });

  test("5. Verify Orders Section has Custom Orders tab and Actions", async ({ page }) => {
    await page.goto("http://localhost:3000/orders");
    await page.waitForLoadState("networkidle");

    // Verify Order Type Switcher tabs: All, Standard, Custom Orders
    const allTab = page.locator("button:has-text('All (')");
    const standardTab = page.locator("button:has-text('Standard (')");
    const customTab = page.locator("button:has-text('Custom Orders (')");

    await expect(allTab).toBeVisible({ timeout: 8000 });
    await expect(standardTab).toBeVisible();
    await expect(customTab).toBeVisible();
  });

  test("6. Verify Consolidated Wallet & Settings redirects and tabs", async ({ page }) => {
    // 6a. Wallet tabs
    await page.goto("http://localhost:3000/wallet");
    await page.waitForLoadState("networkidle");
    const addFundsTab = page.locator("button:has-text('Add Funds')");
    const transTab = page.locator("button:has-text('Transactions & Invoices')");
    await expect(addFundsTab).toBeVisible({ timeout: 8000 });
    await expect(transTab).toBeVisible();

    // 6b. /transactions redirects to /wallet?tab=transactions
    await page.goto("http://localhost:3000/transactions");
    await page.waitForURL("**/wallet?tab=transactions");
    expect(page.url()).toContain("/wallet?tab=transactions");

    // 6c. Settings tabs
    await page.goto("http://localhost:3000/settings");
    await page.waitForLoadState("networkidle");
    const profileTab = page.locator("button:has-text('Profile & Account')");
    const securityTab = page.locator("button:has-text('Security & Login')");
    const prefTab = page.locator("button:has-text('Preferences')");
    await expect(profileTab).toBeVisible({ timeout: 8000 });
    await expect(securityTab).toBeVisible();
    await expect(prefTab).toBeVisible();

    // 6d. /profile redirects to /settings
    await page.goto("http://localhost:3000/profile");
    await page.waitForURL("**/settings");
    expect(page.url()).toContain("/settings");

    // 6e. Verify Reseller API is NOT present anywhere in sidebar or nav
    const resellerApiLink = page.locator("a:has-text('Reseller API')");
    await expect(resellerApiLink).toHaveCount(0);
  });
});

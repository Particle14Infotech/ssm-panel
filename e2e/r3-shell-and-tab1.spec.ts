import { test, expect, Page } from "@playwright/test";

test.describe("Release R3: New Order Shell & Tab 1 Single Order V2", () => {
  async function loginOrRegister(page: Page) {
    const ts = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user = {
      name: `R3 Tester ${ts}`,
      username: `r3_user_${ts}`,
      email: `r3_${ts}@smm.test`,
      password: "Password123!Secure",
    };

    await page.goto("http://localhost:3000/register");
    await expect(page.getByRole("heading", { name: /Create New Account/i })).toBeVisible({ timeout: 15000 });

    await page.locator("input[name='name']").fill(user.name);
    await page.locator("input[name='username']").fill(user.username);
    await page.locator("input[name='email']").fill(user.email);
    await page.locator("input[name='password']").fill(user.password);
    await page.locator("input[name='confirmPassword']").fill(user.password);
    await page.locator("input[name='termsAccepted']").check();
    await page.getByRole("button", { name: /Complete Registration/i }).click();
    await page.waitForURL((url) => url.pathname.includes("/app/dashboard"), { timeout: 30000 });
  }

  test("1. Shell Navigation: 4 tabs switch cleanly and update URL parameters", async ({ page }) => {
    await loginOrRegister(page);

    await page.goto("http://localhost:3000/app/new-order?tab=single&platform=instagram");
    await page.waitForLoadState("domcontentloaded");

    // Verify all four tabs exist in navigation
    const singleTab = page.locator("button:has-text('Single Order')").first();
    const customDripTab = page.locator("button:has-text('Custom Drip')").first();
    const combosTab = page.locator("button:has-text('Combo Packages')").first();
    const autoPilotTab = page.locator("button:has-text('Auto-Pilot')").first();

    await expect(singleTab).toBeVisible();
    await expect(customDripTab).toBeVisible();
    await expect(combosTab).toBeVisible();
    await expect(autoPilotTab).toBeVisible();

    // Switch to Custom Drip and verify URL updates
    await customDripTab.click();
    await expect(page).toHaveURL(/tab=custom_drip/);

    // Switch to Combos and verify URL updates
    await combosTab.click();
    await expect(page).toHaveURL(/tab=combos/);

    // Switch back to Single Order
    await singleTab.click();
    await expect(page).toHaveURL(/tab=single/);
  });

  test("2. Tab 1 Form & Sticky Summary: Category, Service, Stepper, and Balance Calculation", async ({ page }) => {
    await loginOrRegister(page);

    await page.goto("http://localhost:3000/app/new-order?tab=single&platform=instagram");
    await page.waitForLoadState("domcontentloaded");

    // Verify 4-section layout
    await expect(page.locator("text=2. Category")).toBeVisible();
    await expect(page.locator("text=3. Service")).toBeVisible();
    await expect(page.locator("text=4. Details")).toBeVisible();

    // Verify Order Summary Sticky Card
    const summaryCard = page.locator("text=ORDER SUMMARY").first();
    await expect(summaryCard).toBeVisible();
    await expect(page.locator("text=Total charge")).toBeVisible();
    await expect(page.locator("text=Wallet balance")).toBeVisible();
    await expect(page.locator("text=Balance after order")).toBeVisible();

    // Verify Destination Link input has Paste button
    const pasteBtn = page.locator("button:has-text('Paste')");
    await expect(pasteBtn).toBeVisible();

    // Test Quick preset chips (e.g. 1,000, 5,000)
    const chip5k = page.locator("button:has-text('5,000')").first();
    if (await chip5k.isVisible()) {
      await chip5k.click();
      const qtyInput = page.locator("input[type='number']").first();
      await expect(qtyInput).toHaveValue("5000");
    }

    // Verify Consent Checkbox & Place Order button
    const consentBox = page.locator("input[type='checkbox']").first();
    await expect(consentBox).toBeVisible();
    const placeOrderBtn = page.locator("button:has-text('Place order')").first();
    await expect(placeOrderBtn).toBeVisible();
  });

  test("3. Copy Rules Gate: New Order page contains zero forbidden words", async ({ page }) => {
    await loginOrRegister(page);

    await page.goto("http://localhost:3000/app/new-order?tab=single&platform=instagram");
    await page.waitForLoadState("domcontentloaded");

    const pageContent = await page.locator("body").innerText();
    const lower = pageContent.toLowerCase();

    // Explicit Rule 2.7 forbidden words
    const forbidden = [
      "anti-ban",
      "stealth",
      "undetectable",
      "safety score",
      "peak activity",
      "auto-pilot sync",
    ];

    for (const term of forbidden) {
      expect(lower).not.toContain(term);
    }
  });

  test("4. Responsive Viewport Check: 390px Mobile Viewport has zero horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginOrRegister(page);

    await page.goto("http://localhost:3000/app/new-order?tab=single&platform=instagram");
    await page.waitForLoadState("domcontentloaded");

    // Check that document element width does not overflow 390px
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(395); // 390px + minor scrollbar tolerance
  });
});


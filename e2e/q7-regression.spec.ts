import { test, expect, Page } from "@playwright/test";

async function loginUser(page: Page, email = "bholu@gmail.com", pass = "password123") {
  await page.goto("http://localhost:3000/login");
  await page.waitForLoadState("domcontentloaded");

  const emailInput = page.locator("input[type='email'], input[name='usernameOrEmail'], input[name='email']").first();
  const passwordInput = page.locator("input[type='password']").first();

  await emailInput.fill(email);
  await passwordInput.fill(pass);

  const submitBtn = page.locator("button[type='submit']").first();
  await submitBtn.click();
  await page.waitForTimeout(1000);
}

test.describe("Q7: End-to-End Regression Matrix (REG-01)", () => {
  test.describe("Desktop Viewport (1440x900)", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("1. Desktop Landing, Catalog & Public Navigation", async ({ page }) => {
      await page.goto("http://localhost:3000/");
      await page.waitForLoadState("domcontentloaded");

      // Verify header branding and primary call-to-actions
      await expect(page.locator("body")).toBeVisible();
      const bodyText = await page.locator("body").innerText();
      expect(bodyText).toMatch(/SMM|Panel|Services|Growth|Vector/i);

      // Navigate to public services catalog
      await page.goto("http://localhost:3000/services");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15000 });

      // Verify category grouping or services rendered
      const catalogText = await page.locator("body").innerText();
      expect(catalogText).toMatch(/Instagram|YouTube|Twitter|Telegram|Followers|Likes|Views/i);
    });

    test("2. Desktop Customer Dashboard, Wallet & Balance", async ({ page }) => {
      await loginUser(page);

      await page.goto("http://localhost:3000/app/dashboard");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("body")).toBeVisible();

      // Check wallet balance route
      await page.goto("http://localhost:3000/app/wallet");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByText(/Wallet|Balance|Ledger|Deposit/i).first()).toBeVisible({ timeout: 15000 });
    });

    test("3. Desktop Packages Marketplace & Quote Interface", async ({ page }) => {
      await page.goto("http://localhost:3000/packages");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15000 });

      const packagesText = await page.locator("body").innerText();
      expect(packagesText).toMatch(/Instagram|TikTok|YouTube|Starter|Creator|Enterprise|Growth/i);
    });
  });

  test.describe("Mobile Viewport (390x844)", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("4. Mobile Navigation & Responsive Header", async ({ page }) => {
      await page.goto("http://localhost:3000/");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("body")).toBeVisible();

      // Ensure no horizontal scrollbar overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    });

    test("5. Mobile Catalog & Services Layout", async ({ page }) => {
      await page.goto("http://localhost:3000/services");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15000 });

      // Check responsive rendering on mobile
      const catalogText = await page.locator("body").innerText();
      expect(catalogText).toMatch(/Instagram|YouTube|Twitter|Telegram|Followers|Likes|Views/i);
    });

    test("6. Mobile Customer Wallet & Transactions", async ({ page }) => {
      await loginUser(page);

      await page.goto("http://localhost:3000/app/wallet");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.getByText(/Wallet|Balance|Ledger|Deposit/i).first()).toBeVisible({ timeout: 15000 });

      // Ensure no horizontal scrollbar on mobile wallet view
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
    });
  });
});

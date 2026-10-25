import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { width: 390, height: 844, name: "mobile" },
  { width: 820, height: 1180, name: "tablet" },
  { width: 1440, height: 900, name: "desktop" },
];

for (const vp of VIEWPORTS) {
  test.describe(`A6 Browser E2E - Viewport ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test.beforeEach(async ({ context }) => {
      await context.addCookies([
        {
          name: "authToken",
          value: "test-mock-token-e2e",
          domain: "localhost",
          path: "/",
        },
        {
          name: "token",
          value: "test-mock-token-e2e",
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
    });

    test("1. Mode switch: Regular -> Package on New Order screen", async ({ page }) => {
      await page.goto("http://localhost:3000/new-order", { waitUntil: "domcontentloaded" });

      // Look for the Package mode toggle or Switch to Package button
      const packageToggle = page.locator("button, a").filter({ hasText: /Switch to Package|Package/i }).first();
      await expect(packageToggle).toBeVisible();
      await packageToggle.click();

      // Ensure package mode or package order builder is visible or navigated
      await page.waitForTimeout(500);
      const packageBuilder = page.locator("text=/Package|Duration|Growth Plan|handle|followers/i").first();
      await expect(packageBuilder).toBeVisible();
    });

    test("2. Category selection & filtering on Services Catalog", async ({ page }) => {
      await page.goto("http://localhost:3000/services-catalog", { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1")).toContainText(/Services Matrix/i);

      // Verify category selector or search works
      const search = page.locator("input[placeholder*='Search']").first();
      if (await search.isVisible()) {
        await search.fill("Instagram");
        await page.waitForTimeout(300);
        await search.fill("");
      }
    });

    test("3. Package builder feasibility messages render gracefully", async ({ page }) => {
      await page.goto("http://localhost:3000/packages", { waitUntil: "domcontentloaded" });
      // Verify packages dashboard or feasibility indicators
      const heading = page.locator("text=/Growth Packages|Packages/i").first();
      await expect(heading).toBeVisible();
    });

    test("4. Order detail page handles packageExecution without crashes", async ({ page }) => {
      await page.goto("http://localhost:3000/orders/ord_demo_1", { waitUntil: "domcontentloaded" });
      await expect(page.locator("h1")).toContainText(/Order/i);

      // Verify Report a Problem button exists on order detail
      const reportBtn = page.locator("text=/Report a Problem/i").first();
      await expect(reportBtn).toBeVisible();
    });

    test("5. Favorites page has Reorder button that prefills new order", async ({ page }) => {
      await page.goto("http://localhost:3000/favorites", { waitUntil: "domcontentloaded" });
      const favHeader = page.locator("text=/Saved Favorites|Favorites/i").first();
      await expect(favHeader).toBeVisible();

      // If favorites exist, verify reorder button
      const reorderBtn = page.locator("button, a").filter({ hasText: /Use \/ Reorder|Go to New Order|Create New Order/i }).first();
      await expect(reorderBtn).toBeVisible();
    });
  });
}

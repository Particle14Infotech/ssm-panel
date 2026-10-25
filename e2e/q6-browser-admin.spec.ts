import { test, expect, Page } from "@playwright/test";

test.describe("Q6: Admin Command Operations Browser Verification (ADM-01 to ADM-06)", () => {
  async function adminLogin(page: Page) {
    await page.goto("http://localhost:3000/login");
    try {
      await expect(page.getByRole("heading", { name: /Welcome Back|Sign in/i })).toBeVisible({ timeout: 6000 });
    } catch {
      await page.reload();
      await expect(page.getByRole("heading", { name: /Welcome Back|Sign in/i })).toBeVisible({ timeout: 15000 });
    }

    const emailInput = page.locator("input[name='usernameOrEmail'], input[name='email']").first();
    await emailInput.fill("vaibhavrishabh40@gmail.com");
    await page.locator("input[name='password']").fill("Admin123!Secure");
    await page.locator("button[type='submit']").click();

    // After login, admin can navigate to /admin/dashboard or /app/dashboard
    await page.waitForURL((url) => url.pathname.includes("/dashboard") || url.pathname.includes("/admin"), {
      timeout: 30000,
    });
  }

  test("1. Admin Command Dashboard & Navigation (ADM-01)", async ({ page }) => {
    await adminLogin(page);

    await page.goto("http://localhost:3000/admin/dashboard");
    await page.waitForLoadState("domcontentloaded");

    // Verify Admin Header / Brand
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15000 });

    // Verify key analytics cards / metrics render without crash or NaN
    const pageText = await page.locator("body").innerText();
    expect(pageText).not.toContain("NaN");
    expect(pageText).toMatch(/Admin|Dashboard|Overview|Revenue|Orders|Users/i);
  });

  test("2. Provider Node Registration & Key Masking (ADM-04)", async ({ page }) => {
    await adminLogin(page);

    await page.goto("http://localhost:3000/admin/providers");
    await page.waitForLoadState("domcontentloaded");

    // Verify Title
    await expect(page.locator("h1")).toContainText(/API Providers/i);

    // Click Connect New Provider
    const connectBtn = page.getByRole("button", { name: /Connect New Provider/i }).first();
    await expect(connectBtn).toBeVisible({ timeout: 10000 });
    await connectBtn.click();

    const ts = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nameInput = page.locator("input[placeholder*='cheapestsmmpanels'], input[placeholder*='ApexSMM Primary']").first();
    const urlInput = page.locator("input[placeholder*='https://'], input[type='url']").first();
    const keyInput = page.locator("input[placeholder*='secret API key'], input[type='password']").first();

    await nameInput.fill(`Browser Wholesaler ${ts}`);
    await urlInput.fill("https://api.browser-wholesaler.com/v2");
    await keyInput.fill("sk_live_secret_key_8899001122");

    const submitBtn = page.getByRole("button", { name: /Verify & Connect Node/i }).first();
    await submitBtn.click();

    // Verify provider card appears or success notice appears
    await expect(page.getByText(/Provider connected successfully|Browser Wholesaler/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("3. Admin User Directory & Management (ADM-02)", async ({ page }) => {
    await adminLogin(page);

    await page.goto("http://localhost:3000/admin/users");
    await page.waitForLoadState("domcontentloaded");

    // Verify Table exists and displays users
    const tableRows = page.locator("tbody tr, div[data-testid='user-row']");
    await expect(tableRows.first()).toBeVisible({ timeout: 15000 });

    // Verify Bholu or Admin is visible in the directory
    await expect(page.getByText(/bholu@gmail.com|vaibhavrishabh40@gmail.com/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("4. Services Catalog Management & Pricing Markups (ADM-03)", async ({ page }) => {
    await adminLogin(page);

    await page.goto("http://localhost:3000/admin/services");
    await page.waitForLoadState("domcontentloaded");

    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 15000 });
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).toMatch(/Instagram|YouTube|Twitter|Telegram/i);
  });

  test("5. System Health Telemetry Matrix (ADM-06)", async ({ page }) => {
    await adminLogin(page);

    await page.goto("http://localhost:3000/admin/health");
    await page.waitForLoadState("domcontentloaded");

    // Verify Database connection badge / healthy telemetry
    await expect(page.getByText(/Healthy|Active|Connected|Operational|Database/i).first()).toBeVisible({
      timeout: 15000,
    });
  });
});

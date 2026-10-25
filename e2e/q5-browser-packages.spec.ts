import { test, expect, Page } from "@playwright/test";

test.describe("Q5: Packages Architecture & Execution (PKG-01)", () => {
  async function registerAndFundUser(page: Page, user: { name: string; username: string; email: string; password: string }) {
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
    const submitBtn = page.getByRole("button", { name: /Complete Registration/i });
    await submitBtn.click();

    try {
      await page.waitForURL((url) => url.pathname.includes("/app/dashboard"), { timeout: 8000 });
    } catch {
      if (await page.getByText(/Failed to fetch|could not be completed/i).isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.waitForTimeout(1000);
        await submitBtn.click();
      }
      await page.waitForURL((url) => url.pathname.includes("/app/dashboard"), { timeout: 25000 });
    }

    // Add funds via API for this user so they have liquidity for bundle purchase
    const token = await page.evaluate(() => localStorage.getItem("authToken"));
    if (token) {
      const orderRes = await page.request.post("http://localhost:4000/api/v1/payments/create-order", {
        headers: { Authorization: `Bearer ${token}` },
        data: { amount: 6000.0 },
      });
      const orderData = await orderRes.json();
      const gatewayOrderId = orderData.gatewayOrderId || orderData.id;
      if (gatewayOrderId) {
        await page.request.post("http://localhost:4000/api/v1/payments/sandbox-complete", {
          data: { gatewayOrderId },
        });
      }
    }
  }

  test("1. Featured Growth Bundles & 1-Click Purchase Flow (PKG-01)", async ({ page }) => {
    const ts = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user = {
      name: `Q5 BundleUser ${ts}`,
      username: `q5_bnd_${ts}`,
      email: `q5_bnd_${ts}@smm.dev`,
      password: "Password123!Secure",
    };

    // 1. Register & Fund
    await registerAndFundUser(page, user);

    // 2. Navigate to /packages
    await page.goto("http://localhost:3000/packages");
    await page.waitForLoadState("domcontentloaded");

    // Verify Page Header
    await expect(page.getByRole("heading", { name: /Growth Packages/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Featured Growth Bundles/i)).toBeVisible({ timeout: 10000 });

    // Verify Bundle Cards
    const bundleCard = page.locator("div").filter({ hasText: "Instagram Starter Bundle" }).last();
    await expect(bundleCard).toBeVisible({ timeout: 10000 });

    // Click "Choose & Activate Bundle"
    const activateBtn = page.getByRole("button", { name: /Choose & Activate Bundle/i }).first();
    await expect(activateBtn).toBeVisible({ timeout: 10000 });
    await activateBtn.click();

    // Verify Modal appears
    const modalHeading = page.getByRole("heading", { name: /Instagram Starter Bundle/i }).last();
    await expect(modalHeading).toBeVisible({ timeout: 10000 });

    // Enter Target Account Handle
    const handleInput = page.locator("input[placeholder='creator_handle']");
    await expect(handleInput).toBeVisible({ timeout: 10000 });
    await handleInput.fill(`creator_${ts}`);

    // Click "Activate Now" button inside modal
    const confirmBtn = page.getByRole("button", { name: /Activate Now/i });
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await confirmBtn.click();

    // Toast appears & redirects to /packages/[id]
    await page.waitForURL((url) => url.pathname.includes("/packages/"), { timeout: 20000 });
    expect(page.url()).toMatch(/\/packages\/[a-zA-Z0-9-]+/);

    // Verify Package Details on /packages/[id]
    await expect(page.getByText(new RegExp(`@creator_${ts}`, "i"))).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/ACTIVE/i).first()).toBeVisible({ timeout: 10000 });
  });

  test("2. Packages Listing & Schedule Detail Inspection (PKG-01)", async ({ page }) => {
    // Navigate to /packages
    await page.goto("http://localhost:3000/packages");
    await page.waitForLoadState("domcontentloaded");

    // Header visible
    await expect(page.getByRole("heading", { name: /Growth Packages/i })).toBeVisible({ timeout: 10000 });

    // Verify "Create Custom Package" action link
    const createBtn = page.getByRole("link", { name: /Create Custom Package/i });
    await expect(createBtn).toBeVisible({ timeout: 10000 });
    expect(await createBtn.getAttribute("href")).toContain("/new-order");
  });
});

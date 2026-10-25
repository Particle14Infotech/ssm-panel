import { test, expect, Page } from "@playwright/test";

test.describe("Q4: Support Tickets, Notifications & Dashboard (SUP-01, NOT-01, DSH-01)", () => {
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
    const submitBtn = page.getByRole("button", { name: /Complete Registration/i });
    await submitBtn.click();

    // If server error / failed to fetch appears, retry click once
    try {
      await page.waitForURL((url) => url.pathname.includes("/app/dashboard"), { timeout: 8000 });
    } catch {
      if (await page.getByText(/Failed to fetch|could not be completed/i).isVisible({ timeout: 1000 }).catch(() => false)) {
        await page.waitForTimeout(1000);
        await submitBtn.click();
      }
      await page.waitForURL((url) => url.pathname.includes("/app/dashboard"), { timeout: 25000 });
    }
  }

  test("1. Support Ticket Lifecycle: Create ticket, inspect thread, post reply (SUP-01)", async ({ page }) => {
    const ts = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user = {
      name: `Q4 TicketUser ${ts}`,
      username: `q4_tkt_${ts}`,
      email: `q4_tkt_${ts}@smm.dev`,
      password: "Password123!Secure",
    };

    // 1. Register fresh user
    await registerUser(page, user);

    // 2. Navigate to /app/support
    await page.goto("http://localhost:3000/app/support");
    await page.waitForLoadState("domcontentloaded");

    // Click Open New Ticket button
    const openBtn = page.getByRole("button", { name: /Open New Ticket|Open ticket/i }).first();
    await expect(openBtn).toBeVisible({ timeout: 10000 });
    await openBtn.click();

    // Fill new ticket form with precise inputs
    const subjectInput = page.locator("input[placeholder*='refill request' i]");
    await expect(subjectInput).toBeVisible({ timeout: 10000 });
    await subjectInput.fill(`Delivery Delay Investigation #${ts}`);

    const messageInput = page.locator("textarea[placeholder*='Describe your issue' i]");
    await expect(messageInput).toBeVisible({ timeout: 10000 });
    await messageInput.fill("Hello support, my recent dispatch has not reflected any updates for 2 hours. Please assist.");

    // Submit ticket
    const submitBtn = page.getByRole("button", { name: "Submit Ticket" });
    await expect(submitBtn).toBeVisible({ timeout: 10000 });
    await submitBtn.click();

    // Verify ticket appears in list or thread is opened
    await expect(page.getByText(`Delivery Delay Investigation #${ts}`).first()).toBeVisible({ timeout: 15000 });

    // Find reply box
    const replyBox = page.locator("textarea[placeholder*='reply' i], textarea[placeholder*='message' i]").last();
    if (await replyBox.isVisible({ timeout: 5000 }).catch(() => false)) {
      await replyBox.fill("Following up: verified my profile link is public and accessible.");
      const sendReplyBtn = page.getByRole("button", { name: /Send Reply|Reply/i }).first();
      await expect(sendReplyBtn).toBeVisible({ timeout: 5000 });
      await sendReplyBtn.click();

      // Verify reply appears in conversation
      await expect(page.getByText("Following up: verified my profile link is public and accessible.")).toBeVisible({ timeout: 15000 });
    }
  });

  test("2. Header Notifications Panel Interaction (NOT-01)", async ({ page }) => {
    const ts = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user = {
      name: `Q4 NotifUser ${ts}`,
      username: `q4_notif_${ts}`,
      email: `q4_notif_${ts}@smm.dev`,
      password: "Password123!Secure",
    };

    // 1. Register fresh user
    await registerUser(page, user);

    // 2. Locate Bell notification button in header
    const bellBtn = page.locator("button:has(svg.lucide-bell)").first();
    await expect(bellBtn).toBeVisible({ timeout: 15000 });
    await bellBtn.click();

    // Verify notifications dropdown renders
    await expect(page.getByText(/Notifications/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/All caught up|No new alerts/i).first()).toBeVisible({ timeout: 5000 });

    // Click again to close
    await bellBtn.click();
    await page.waitForTimeout(500);
  });

  test("3. Customer Dashboard KPI Metrics & Clean Zero State (DSH-01)", async ({ page }) => {
    const ts = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const user = {
      name: `Q4 DashUser ${ts}`,
      username: `q4_dsh_${ts}`,
      email: `q4_dsh_${ts}@smm.dev`,
      password: "Password123!Secure",
    };

    // 1. Register fresh user
    await registerUser(page, user);

    // 2. Verify dashboard KPI elements render without NaN or broken data
    await page.goto("http://localhost:3000/app/dashboard");
    await page.waitForLoadState("domcontentloaded");

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("NaN");
    expect(bodyText).toContain("₹0");

    // Verify platform announcements render gracefully
    const announcement = page.getByText(/Fast-Track UPI Gateways Active|YouTube/i).first();
    await expect(announcement).toBeVisible({ timeout: 10000 });
  });
});

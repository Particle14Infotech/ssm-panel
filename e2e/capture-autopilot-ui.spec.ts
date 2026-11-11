import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const SCREENSHOTS_DIR = path.join(
  "C:",
  "Users",
  "vaibh",
  ".gemini",
  "antigravity",
  "brain",
  "efaf2b74-da3f-467a-81bd-9c6a0e1bfb6d",
  "test-screenshots"
);

test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
});

test("Capture Autopilot UI - Real Screenshots", async ({ page, context }) => {
  // Add authentication cookies
  await context.addCookies([
    { name: "authToken", value: "jwt_bholu_test_token_12345", domain: "localhost", path: "/" },
    { name: "token", value: "jwt_bholu_test_token_12345", domain: "localhost", path: "/" },
    { name: "userRole", value: "CUSTOMER", domain: "localhost", path: "/" },
  ]);

  // Route mocking for preview API
  await page.route("**/packages/autopilot/preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          platform: "INSTAGRAM",
          handle: "areion._",
          displayName: "Areion Studio",
          avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300",
        },
        latestMedia: {
          platform: "INSTAGRAM",
          mediaKey: "reel_areion_live_8912",
          url: "https://instagram.com/reel/reel_areion_live_8912",
          title: "Cinematic Reel 04 - Visual Identity in Modern Aesthetics",
          author: "areion._",
          publishedAt: new Date().toISOString(),
          thumbnailUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400",
          mediaType: "REEL",
          isLiveDetected: true,
        },
      }),
    });
  });

  // Route mocking for list API
  await page.route("**/packages/autopilot/list", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "pkg_auto_live_44921",
          platform: "INSTAGRAM",
          handle: "areion._",
          status: "ACTIVE",
          reserveTotal: 1495,
          createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          allocationSnapshot: {
            preset: {
              id: "viral_push",
              name: "Viral Push",
              pricePerSlot: 299,
              metrics: { views: 10000, likes: 600, shares: 150, comments: 50 },
            },
          },
          slots: [
            {
              id: "slot_01",
              slotNumber: 1,
              status: "COMPLETED",
              mediaKey: "reel_areion_live_8912",
              targetUrl: "https://instagram.com/reel/reel_areion_live_8912",
              startedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
              completedAt: new Date(Date.now() - 3600000 * 1).toISOString(),
              executions: [
                { id: "ex1", seq: 1, quantity: 2500, executeAt: new Date(Date.now() - 3600000 * 4).toISOString(), status: "COMPLETED", rule: { service: { name: "Instagram High Retention Views" } } },
                { id: "ex2", seq: 2, quantity: 2500, executeAt: new Date(Date.now() - 3600000 * 3).toISOString(), status: "COMPLETED", rule: { service: { name: "Instagram Real Likes" } } },
                { id: "ex3", seq: 3, quantity: 2500, executeAt: new Date(Date.now() - 3600000 * 2).toISOString(), status: "COMPLETED", rule: { service: { name: "Instagram High Retention Views" } } },
                { id: "ex4", seq: 4, quantity: 2500, executeAt: new Date(Date.now() - 3600000 * 1).toISOString(), status: "COMPLETED", rule: { service: { name: "Instagram Shares & Saves" } } },
              ],
            },
            {
              id: "slot_02",
              slotNumber: 2,
              status: "ACTIVE",
              mediaKey: "reel_areion_viral_9031",
              targetUrl: "https://instagram.com/reel/reel_areion_viral_9031",
              startedAt: new Date(Date.now() - 1800000).toISOString(),
              executions: [
                { id: "ex5", seq: 1, quantity: 2500, executeAt: new Date(Date.now() - 1800000).toISOString(), status: "COMPLETED", rule: { service: { name: "Instagram High Retention Views" } } },
                { id: "ex6", seq: 2, quantity: 2500, executeAt: new Date(Date.now() + 3600000 * 2).toISOString(), status: "DISPATCHED", rule: { service: { name: "Instagram Real Likes" } } },
                { id: "ex7", seq: 3, quantity: 2500, executeAt: new Date(Date.now() + 3600000 * 5).toISOString(), status: "SCHEDULED", rule: { service: { name: "Instagram High Retention Views" } } },
                { id: "ex8", seq: 4, quantity: 2500, executeAt: new Date(Date.now() + 3600000 * 8).toISOString(), status: "SCHEDULED", rule: { service: { name: "Instagram Shares & Saves" } } },
              ],
            },
            {
              id: "slot_03",
              slotNumber: 3,
              status: "AVAILABLE",
              mediaKey: null,
              targetUrl: null,
            },
            {
              id: "slot_04",
              slotNumber: 4,
              status: "AVAILABLE",
              mediaKey: null,
              targetUrl: null,
            },
            {
              id: "slot_05",
              slotNumber: 5,
              status: "AVAILABLE",
              mediaKey: null,
              targetUrl: null,
            },
          ],
        },
      ]),
    });
  });

  // Navigate to Autopilot page
  await page.goto("http://localhost:3000/packages/autopilot", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // 1. Screenshot: Full Page Overview
  const fullPagePath = path.join(SCREENSHOTS_DIR, "autopilot_full_page_overview.png");
  await page.screenshot({ path: fullPagePath, fullPage: true });

  // 2. Screenshot: Top Hero Banner & Guided Wizard
  const heroPath = path.join(SCREENSHOTS_DIR, "autopilot_hero_and_wizard.png");
  await page.screenshot({ path: heroPath, clip: { x: 0, y: 0, width: 1440, height: 420 } });

  // 3. Screenshot: Configurator (Creator Profile, Seed Mode, Recipe Cards & Slots)
  const configPath = path.join(SCREENSHOTS_DIR, "autopilot_profile_and_recipes.png");
  await page.screenshot({ path: configPath, clip: { x: 0, y: 350, width: 1440, height: 780 } });

  // Expand the active slot's drip drawer to show suborders
  const drawerBtn = page.locator("button:has-text('Drip Sub-Orders')").first();
  if (await drawerBtn.isVisible()) {
    await drawerBtn.click();
    await page.waitForTimeout(600);
  }

  // 4. Screenshot: Active Deployments & Real-Time Slots
  const deploymentsSection = page.locator("text=Active Autopilot Subscriptions");
  if (await deploymentsSection.isVisible()) {
    const box = await deploymentsSection.evaluate((el) => {
      const rect = el.parentElement?.parentElement?.getBoundingClientRect();
      return rect ? { x: 0, y: rect.top + window.scrollY - 30, width: 1440, height: 650 } : null;
    });
    if (box) {
      const deploymentsPath = path.join(SCREENSHOTS_DIR, "autopilot_active_deployments_and_slots.png");
      await page.screenshot({ path: deploymentsPath, clip: box });
    }
  }

  // Click Cancel & Refund button to open confirmation modal
  const cancelBtn = page.locator("button:has-text('Cancel & Refund')").first();
  if (await cancelBtn.isVisible()) {
    await cancelBtn.click();
    await page.waitForTimeout(600);

    // 5. Screenshot: Cancel & Refund Modal
    const modalPath = path.join(SCREENSHOTS_DIR, "autopilot_cancel_refund_modal.png");
    await page.screenshot({ path: modalPath });
  }

  expect(fs.existsSync(fullPagePath)).toBe(true);
});


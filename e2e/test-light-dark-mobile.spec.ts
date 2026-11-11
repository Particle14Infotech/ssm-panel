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

const mockData = {
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
  packages: [
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
          ],
        },
        {
          id: "slot_03",
          slotNumber: 3,
          status: "AVAILABLE",
          mediaKey: null,
          targetUrl: null,
        },
      ],
    },
  ],
};

async function setupPage(page, context) {
  await context.addCookies([
    { name: "authToken", value: "jwt_bholu_test_token_12345", domain: "localhost", path: "/" },
    { name: "token", value: "jwt_bholu_test_token_12345", domain: "localhost", path: "/" },
    { name: "userRole", value: "CUSTOMER", domain: "localhost", path: "/" },
  ]);

  await page.route("**/packages/autopilot/preview", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: mockData.profile,
        latestMedia: mockData.latestMedia,
      }),
    });
  });

  await page.route("**/packages/autopilot/list", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(mockData.packages),
    });
  });
}

test("1. Capture Desktop - Light Mode", async ({ page, context }) => {
  await setupPage(page, context);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/packages/autopilot", { waitUntil: "networkidle" });

  // Apply Light Theme
  await page.evaluate(() => {
    localStorage.setItem("smm_theme", "light");
    const r = document.documentElement;
    r.setAttribute("data-theme", "light");
    r.classList.remove("dark");
    r.classList.add("light");
    r.style.colorScheme = "light";
  });
  await page.waitForTimeout(1000);

  // Expand a slot drawer
  const drawerBtn = page.locator("button:has-text('Drip Sub-Orders')").first();
  if (await drawerBtn.isVisible()) {
    await drawerBtn.click();
    await page.waitForTimeout(500);
  }

  const ssPath = path.join(SCREENSHOTS_DIR, "autopilot_desktop_light.png");
  await page.screenshot({ path: ssPath, fullPage: true });
  expect(fs.existsSync(ssPath)).toBe(true);
});

test("2. Capture Desktop - Dark Mode", async ({ page, context }) => {
  await setupPage(page, context);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://localhost:3000/packages/autopilot", { waitUntil: "networkidle" });

  // Apply Dark Theme
  await page.evaluate(() => {
    localStorage.setItem("smm_theme", "dark");
    const r = document.documentElement;
    r.setAttribute("data-theme", "dark");
    r.classList.add("dark");
    r.classList.remove("light");
    r.style.colorScheme = "dark";
  });
  await page.waitForTimeout(1000);

  const drawerBtn = page.locator("button:has-text('Drip Sub-Orders')").first();
  if (await drawerBtn.isVisible()) {
    await drawerBtn.click();
    await page.waitForTimeout(500);
  }

  const ssPath = path.join(SCREENSHOTS_DIR, "autopilot_desktop_dark.png");
  await page.screenshot({ path: ssPath, fullPage: true });
  expect(fs.existsSync(ssPath)).toBe(true);
});

test("3. Capture Mobile - Light Mode (iPhone 14)", async ({ page, context }) => {
  await setupPage(page, context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3000/packages/autopilot", { waitUntil: "networkidle" });

  await page.evaluate(() => {
    localStorage.setItem("smm_theme", "light");
    const r = document.documentElement;
    r.setAttribute("data-theme", "light");
    r.classList.remove("dark");
    r.classList.add("light");
    r.style.colorScheme = "light";
  });
  await page.waitForTimeout(1000);

  const ssPath = path.join(SCREENSHOTS_DIR, "autopilot_mobile_light.png");
  await page.screenshot({ path: ssPath, fullPage: true });
  expect(fs.existsSync(ssPath)).toBe(true);
});

test("4. Capture Mobile - Dark Mode (iPhone 14)", async ({ page, context }) => {
  await setupPage(page, context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3000/packages/autopilot", { waitUntil: "networkidle" });

  await page.evaluate(() => {
    localStorage.setItem("smm_theme", "dark");
    const r = document.documentElement;
    r.setAttribute("data-theme", "dark");
    r.classList.add("dark");
    r.classList.remove("light");
    r.style.colorScheme = "dark";
  });
  await page.waitForTimeout(1000);

  const ssPath = path.join(SCREENSHOTS_DIR, "autopilot_mobile_dark.png");
  await page.screenshot({ path: ssPath, fullPage: true });
  expect(fs.existsSync(ssPath)).toBe(true);
});

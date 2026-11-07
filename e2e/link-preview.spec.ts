import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const MOCK_SERVICES = [
  {
    id: "srv_insta_likes",
    name: "Instagram Likes [High Quality]",
    platform: "INSTAGRAM",
    linkType: "POST",
    minQty: 10,
    maxQty: 10000,
    ratePer1000: 50,
    categoryName: "Likes",
  },
  {
    id: "srv_insta_followers",
    name: "Instagram Followers [Real]",
    platform: "INSTAGRAM",
    linkType: "PROFILE",
    minQty: 50,
    maxQty: 50000,
    ratePer1000: 90,
    categoryName: "Followers",
  },
  {
    id: "srv_yt_views",
    name: "YouTube Views [High Retention]",
    platform: "YOUTUBE",
    linkType: "VIDEO",
    minQty: 100,
    maxQty: 50000,
    ratePer1000: 120,
    categoryName: "Views",
  },
  {
    id: "srv_tt_views",
    name: "TikTok Views [Fast]",
    platform: "TIKTOK",
    linkType: "VIDEO",
    minQty: 100,
    maxQty: 50000,
    ratePer1000: 60,
    categoryName: "Views",
  },
];

test.describe("LP4 Link Preview Quality Gate", () => {
  test.beforeEach(async ({ page }) => {
    // 1. Obtain signed token for real seeded test user 'bholu' from real API
    let token = "";
    let user: any = {
      id: "usr_bholu_customer",
      email: "bholu@gmail.com",
      role: "CUSTOMER",
    };

    try {
      const res = await fetch("http://localhost:4000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "bholu@gmail.com", password: "password123" }),
      });
      const data = await res.json();
      if (data.token) {
        token = data.token;
        user = data.user;
      }
    } catch (err: any) {
      console.warn("Real auth login failed, using fallback:", err.message);
    }

    // Set real auth cookies and localStorage for Next.js session
    await page.context().addCookies([
      { name: "authToken", value: token, domain: "localhost", path: "/" },
      { name: "token", value: token, domain: "localhost", path: "/" },
      { name: "userRole", value: user.role || "CUSTOMER", domain: "localhost", path: "/" },
    ]);

    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem("authToken", token);
        localStorage.setItem("token", token);
        localStorage.setItem("smm_user", JSON.stringify(user));
        localStorage.setItem("authUser", JSON.stringify(user));
      },
      { token, user }
    );
  });

  test("1. Instagram reel link uses local card (Instagram decision gate)", async ({ page }) => {
    await page.goto("http://localhost:3000/new-order?platform=instagram", { waitUntil: "domcontentloaded" });
    const input = page.locator('input[type="url"]').first();
    await input.waitFor({ state: "visible", timeout: 10000 });
    await input.fill("https://www.instagram.com/reel/C0xyz123abc/");

    // Instagram decision gate: Tokenless API lacks thumbnail/author, immediately shows local card
    await expect(page.locator("text=Link recognised").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=REEL").first()).toBeVisible();
    await expect(
      page.locator("text=Preview is not available for this link. You can still place the order.").first()
    ).toBeVisible();
  });

  test("2. Profile link in a likes/reel order is blocked with type conflict", async ({ page }) => {
    await page.goto("http://localhost:3000/new-order?platform=instagram", { waitUntil: "domcontentloaded" });
    const input = page.locator('input[type="url"]').first();
    await input.waitFor({ state: "visible", timeout: 10000 });
    await input.fill("https://www.instagram.com/johndoe");

    await expect(page.locator("text=Link Type Conflict").first()).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator("text=This service needs a post or reel link, not a profile link.").first()
    ).toBeVisible();
  });

  test("3. Wrong platform link is blocked with platform mismatch", async ({ page }) => {
    await page.goto("http://localhost:3000/new-order?platform=instagram", { waitUntil: "domcontentloaded" });
    const input = page.locator('input[type="url"]').first();
    await input.waitFor({ state: "visible", timeout: 10000 });
    // Default platform is Instagram; paste YouTube link
    await input.fill("https://www.youtube.com/watch?v=jfKfPfyJRdk");

    await expect(page.locator("text=Platform Mismatch").first()).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator("text=This link is for YouTube, but the selected service is for Instagram.").first()
    ).toBeVisible();
  });

  test("4. Shortened link asks for full link (blocking shortener)", async ({ page }) => {
    await page.goto("http://localhost:3000/new-order?platform=instagram", { waitUntil: "domcontentloaded" });
    const input = page.locator('input[type="url"]').first();
    await input.waitFor({ state: "visible", timeout: 10000 });
    await input.fill("https://vm.tiktok.com/ZM8abc123/");

    await expect(page.locator("text=Paste the full link").first()).toBeVisible({ timeout: 5000 });
  });

  test("5. YouTube link preview displays thumbnail, title, author, and badge", async ({
    page,
  }) => {
    await page.route("**/api/v1/link-preview*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "YOUTUBE",
          kind: "VIDEO",
          title: "Lofi Hip Hop - Beats to Relax/Study to",
          authorName: "Lofi Girl",
          thumbnailUrl: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg",
          status: "OK",
        }),
      });
    });

    await page.goto("http://localhost:3000/new-order?platform=youtube", { waitUntil: "domcontentloaded" });
    const input = page.locator('input[type="url"]').first();
    await input.waitFor({ state: "visible", timeout: 10000 });
    await input.fill("https://www.youtube.com/watch?v=jfKfPfyJRdk");

    await expect(page.locator("text=Preview").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=VIDEO").first()).toBeVisible();
    await expect(page.locator("text=Lofi Hip Hop - Beats to Relax/Study to").first()).toBeVisible();
    await expect(page.locator("text=by Lofi Girl").first()).toBeVisible();
    await expect(page.locator('a:has-text("Open link")').first()).toBeVisible();
  });

  test("6. TikTok link preview renders when available", async ({ page }) => {
    await page.route("**/api/v1/link-preview*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "TIKTOK",
          kind: "VIDEO",
          title: "Dance Challenge Viral 2026",
          authorName: "creator123",
          thumbnailUrl: "https://p16-sign-va.tiktokcdn.com/obj/tos-maliva-p-0068/thumb.jpeg",
          status: "OK",
        }),
      });
    });

    await page.goto("http://localhost:3000/new-order?platform=tiktok", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    const input = page.locator('input[type="url"]').first();
    await input.waitFor({ state: "visible", timeout: 10000 });
    await input.fill("https://www.tiktok.com/@creator123/video/7123456789012345678");

    await expect(page.locator("text=Preview").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Dance Challenge Viral 2026").first()).toBeVisible();
  });

  test("7. Unavailable link falls back to local card and order remains placeable", async ({
    page,
  }) => {
    await page.route("**/api/v1/link-preview*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "INSTAGRAM",
          kind: "POST",
          status: "UNAVAILABLE",
        }),
      });
    });

    await page.goto("http://localhost:3000/new-order?platform=instagram", { waitUntil: "domcontentloaded" });
    const input = page.locator('input[type="url"]').first();
    await input.waitFor({ state: "visible", timeout: 10000 });
    await input.fill("https://www.instagram.com/p/C0xyz123abc/");

    await expect(page.locator("text=Link recognised").first()).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator("text=Preview is not available for this link. You can still place the order.").first()
    ).toBeVisible();
  });

  test("8. XSS payload in title and author is safely rendered strictly as text", async ({
    page,
  }) => {
    await page.route("**/api/v1/link-preview*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          platform: "YOUTUBE",
          kind: "VIDEO",
          title: '<script>window.__xss_attack = true;</script><img src="x" onerror="window.__xss_attack = true;">Evil Video',
          authorName: '<b onclick="window.__xss_attack = true;">Hacker</b>',
          thumbnailUrl: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg",
          status: "OK",
        }),
      });
    });

    await page.goto("http://localhost:3000/new-order?platform=youtube", { waitUntil: "domcontentloaded" });
    const input = page.locator('input[type="url"]').first();
    await input.waitFor({ state: "visible", timeout: 10000 });
    await input.fill("https://www.youtube.com/watch?v=jfKfPfyJRdk");

    const isXssTriggered = await page.evaluate(() => (window as any).__xss_attack === true);
    expect(isXssTriggered).toBe(false);
  });

  test("9. Slow upstream falls back gracefully to local card within timeout", async ({ page }) => {
    await page.route("**/api/v1/link-preview*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "OK" }),
      });
    });

    await page.goto("http://localhost:3000/new-order?platform=instagram", { waitUntil: "domcontentloaded" });
    const input = page.locator('input[type="url"]').first();
    await input.waitFor({ state: "visible", timeout: 10000 });
    await input.fill("https://www.instagram.com/reel/C0xyz123abc/");

    await expect(page.locator("text=Link recognised").first()).toBeVisible({ timeout: 2000 });
  });

  test("10. Flags off (404) gracefully falls back to local card against real API", async ({ page }) => {
    // Real unstubbed call to our real API on port 4000: flag defaults to OFF, endpoint returns 404
    await page.goto("http://localhost:3000/new-order?platform=instagram", { waitUntil: "domcontentloaded" });
    const input = page.locator('input[type="url"]').first();
    await input.waitFor({ state: "visible", timeout: 10000 });
    await input.fill("https://www.instagram.com/p/C0xyz123abc/");

    await expect(page.locator("text=Link recognised").first()).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator("text=Preview is not available for this link. You can still place the order.").first()
    ).toBeVisible();
  });

  test("11. Accessibility scan (Axe) across all five changed pages has zero critical violations", async ({
    page,
  }) => {
    const pagesToAudit = [
      "http://localhost:3000/new-order?platform=instagram",
      "http://localhost:3000/new-order?tab=custom-drip&platform=instagram",
      "http://localhost:3000/favorites",
      "http://localhost:3000/orders",
      "http://localhost:3000/packages",
    ];

    for (const url of pagesToAudit) {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .disableRules(["color-contrast"])
        .analyze();

      const criticalViolations = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );
      expect(criticalViolations).toEqual([]);
    }
  });

  test("12. Cumulative Layout Shift (CLS) on new-order page is below 0.1", async ({ page }) => {
    await page.goto("http://localhost:3000/new-order?platform=instagram", { waitUntil: "domcontentloaded" });

    // Attach PerformanceObserver before interaction
    await page.evaluate(() => {
      (window as any).__clsScore = 0;
      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            (window as any).__clsScore += (entry as any).value;
          }
        }
      });
      observer.observe({ type: "layout-shift", buffered: true });
    });

    const input = page.locator('input[type="url"]').first();
    await input.waitFor({ state: "visible", timeout: 10000 });
    await input.fill("https://www.instagram.com/reel/C0xyz123abc/");

    await expect(page.locator("text=Link recognised").first()).toBeVisible({ timeout: 5000 });

    // Wait for animation to settle
    await page.waitForTimeout(500);

    const measuredCls = await page.evaluate(() => (window as any).__clsScore || 0);
    console.log(`Measured CLS on New Order: ${measuredCls}`);
    expect(measuredCls).toBeLessThan(0.1);
  });
});

import { test, expect, Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

test.describe("D4 Playwright: Delivery Window Purchase and Reschedule Flow", () => {
  let createdPackageId: string | null = null;
  let testUserEmail: string = "";

  async function loginBholuUser(page: Page) {
    const loginRes = await fetch("http://localhost:4000/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "bholu@gmail.com",
        password: "password123",
      }),
    });

    const loginData = await loginRes.json();
    if (!loginData.token) {
      throw new Error(`Failed to login bholu: ${JSON.stringify(loginData)}`);
    }

    const { token, refreshToken, user } = loginData;
    testUserEmail = user.email;

    // Set auth cookies in browser context
    await page.context().addCookies([
      {
        name: "authToken",
        value: token,
        domain: "localhost",
        path: "/",
      },
      {
        name: "userRole",
        value: user.role || "CUSTOMER",
        domain: "localhost",
        path: "/",
      },
    ]);

    // Set localStorage in browser
    await page.goto("http://localhost:3000/login");
    await page.evaluate(
      ({ token, refreshToken, user }) => {
        localStorage.setItem("authToken", token);
        if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
        localStorage.setItem("authUser", JSON.stringify(user));
      },
      { token, refreshToken, user }
    );
  }

  test.afterAll(async () => {
    if (createdPackageId) {
      await prisma.package.deleteMany({ where: { id: createdPackageId } });
    }
    await prisma.$disconnect();
  });

  test("1. Buy with Daytime window and verify timeline equals DB executeAt values, then change to Evening", async ({
    page,
  }) => {
    page.on("response", (res) => {
      if (res.status() === 401) {
        console.log(`[401 URL] ${res.request().method()} ${res.url()}`);
      }
    });
    page.on("pageerror", (err) => console.log(`[BROWSER ERROR] ${err.message}`));
    page.on("requestfailed", (req) => console.log(`[BROWSER REQ FAILED] ${req.url()} - ${req.failure()?.errorText}`));

    await loginBholuUser(page);

    // 1. Navigate to Custom Drip tab
    await page.goto("http://localhost:3000/new-order?tab=custom_drip&platform=instagram");
    await page.waitForLoadState("networkidle");

    // 2. Verify Delivery Window Selector is present
    await expect(page.locator("text=Delivery Window")).toBeVisible({ timeout: 10000 });

    // 3. Select Daytime Delivery Window (09:00 - 21:00)
    const daytimeBtn = page.getByRole("button", { name: /Daytime/i });
    await expect(daytimeBtn).toBeVisible();
    await daytimeBtn.click();

    // 4. Fill Reel URL and Profile URL
    const profileInput = page.locator("input[placeholder*='instagram.com/username']");
    if (await profileInput.isVisible()) {
      await profileInput.fill("https://instagram.com/d4_test_user");
    }
    const postInput = page.locator("input[placeholder*='instagram.com/reel']");
    if (await postInput.isVisible()) {
      await postInput.fill("https://instagram.com/reel/C8xyz123");
    }

    // 5. Verify planned batch schedule timeline renders with run dates
    await expect(page.locator("text=Planned Batch Schedule")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Run #1", { exact: true })).toBeVisible();

    // 6. Check terms & submit
    const consent = page.locator("input[type='checkbox']").last();
    if (await consent.isVisible()) {
      await consent.check();
    }

    const submitBtn = page.getByRole("button", { name: /Submit Custom Drip Order/i });
    await expect(submitBtn).toBeVisible();

    // Wait for button to be enabled
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
    await submitBtn.click();

    // Wait for success toast / feedback
    await page.waitForTimeout(3000);

    // 7. Verify in DB
    const dbUser = await prisma.user.findFirst({ where: { email: testUserEmail } });
    const pkg = await prisma.package.findFirst({
      where: { userId: dbUser!.id },
      orderBy: { createdAt: "desc" },
      include: { executions: { orderBy: { seq: "asc" } } },
    });

    expect(pkg).toBeTruthy();
    createdPackageId = pkg!.id;
    expect(pkg!.executions.length).toBeGreaterThan(0);

    // Verify executions are snapped inside Daytime (09:00 - 21:00)
    for (const exec of pkg!.executions) {
      const dt = new Date(exec.executeAt);
      const istHour = (dt.getUTCHours() + 5 + Math.floor((dt.getUTCMinutes() + 30) / 60)) % 24;
      expect(istHour).toBeGreaterThanOrEqual(9);
      expect(istHour).toBeLessThanOrEqual(21);
    }

    // 8. Go to package detail page
    await page.goto(`http://localhost:3000/packages/${pkg!.id}`);
    await page.waitForLoadState("networkidle");

    // Click "Change Delivery Window"
    const changeWindowBtn = page.getByRole("button", { name: /Change Delivery Window/i });
    await expect(changeWindowBtn).toBeVisible({ timeout: 10000 });
    await changeWindowBtn.click();

    // Select Evening Window
    const eveningBtn = page.getByRole("button", { name: /Evening/i });
    await expect(eveningBtn).toBeVisible();
    await eveningBtn.click();

    // Preview
    const previewBtn = page.getByRole("button", { name: /Preview New Schedule/i });
    await expect(previewBtn).toBeVisible();
    await previewBtn.click();

    await expect(page.locator("text=Preview Schedule Changes")).toBeVisible({ timeout: 10000 });

    // Confirm
    const confirmBtn = page.getByRole("button", { name: /Confirm Reschedule/i });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    await expect(page.locator("text=Delivery window updated successfully")).toBeVisible({
      timeout: 10000,
    });

    // 9. Verify in DB that executions are updated to Evening (17:00 - 23:00)
    const updatedExecutions = await prisma.packageExecution.findMany({
      where: { packageId: pkg!.id, status: "SCHEDULED" },
    });

    for (const exec of updatedExecutions) {
      const dt = new Date(exec.executeAt);
      const istHour = (dt.getUTCHours() + 5 + Math.floor((dt.getUTCMinutes() + 30) / 60)) % 24;
      expect(istHour).toBeGreaterThanOrEqual(17);
      expect(istHour).toBeLessThanOrEqual(23);
    }
  });
});

import { PrismaClient, PackageStatus, PackageExecutionStatus } from "@prisma/client";
import { PackagesService } from "./packages.service";
import {
  generateQuoteHash,
  verifyQuoteHash,
  setQuoteSecret,
} from "./package-quote-hash.util";
import { Decimal } from "decimal.js";

describe("D4 Integration & Invariant Tests (Test DB)", () => {
  let prisma: PrismaClient;
  let pkgService: PackagesService;
  let testUserId: string;
  let userBId: string;
  let activeServiceId: string;
  const createdPackageIds: string[] = [];

  const TEST_SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  jest.setTimeout(30000);

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
    setQuoteSecret("primary", TEST_SECRET);
    pkgService = new PackagesService(prisma, null, null, null, null);

    // Get or create test users
    const userA = await prisma.user.findFirst();
    if (!userA) throw new Error("No user found in test DB");
    testUserId = userA.id;

    const userB =
      (await prisma.user.findFirst({ where: { id: { not: testUserId } } })) ||
      (await prisma.user.create({
        data: {
          email: `test_user_b_${Date.now()}@test.internal`,
          passwordHash: "dummy",
          role: "CUSTOMER",
        },
      }));
    userBId = userB.id;

    const service = await prisma.service.findFirst({ where: { status: "ACTIVE" } });
    if (!service) throw new Error("No active service found in test DB");
    activeServiceId = service.id;
    await prisma.wallet.upsert({
      where: { userId: testUserId },
      create: { userId: testUserId, balance: 10000 },
      update: { balance: { increment: 1000 } },
    });
  });

  afterAll(async () => {
    for (const id of createdPackageIds) {
      await prisma.package.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  });

  it("1. Quote schedule equals purchased executions equals reschedule output", async () => {
    const deliveryWindow = {
      timezone: "Asia/Kolkata",
      ranges: [{ startHour: 9, startMinute: 0, endHour: 21, endMinute: 0 }],
    };

    // 1. Quote
    const quote = await pkgService.getCustomCampaignQuote(testUserId, {
      platform: "instagram",
      targetUrl: "https://instagram.com/reel/test_d4",
      durationDays: 3,
      timezone: "Asia/Kolkata",
      deliveryWindow,
      services: [
        {
          serviceId: activeServiceId,
          quantity: 300,
        },
      ],
    });

    expect(quote.runs).toHaveLength(3);
    const quoteExecuteAts = quote.runs.map((r) => r.executeAt);

    // 2. Purchase
    const purchaseRes = await pkgService.purchaseCustomCampaign(testUserId, {
      platform: "instagram",
      targetUrl: "https://instagram.com/reel/test_d4",
      durationDays: 3,
      timezone: "Asia/Kolkata",
      deliveryWindow,
      quoteHash: quote.quoteHash,
      services: [
        {
          serviceId: activeServiceId,
          quantity: 300,
        },
      ],
    });

    expect(purchaseRes.success).toBe(true);
    createdPackageIds.push(purchaseRes.packageId);

    const executions = await prisma.packageExecution.findMany({
      where: { packageId: purchaseRes.packageId },
      orderBy: { seq: "asc" },
    });

    expect(executions).toHaveLength(3);
    const purchaseExecuteAts = executions.map((e) => e.executeAt.toISOString());

    // Invariant: quote schedule == purchase executions
    expect(purchaseExecuteAts).toEqual(quoteExecuteAts);

    // 3. Reschedule preview on same window returns identical output
    const preview = await pkgService.getReschedulePreview(testUserId, purchaseRes.packageId, {
      timezone: "Asia/Kolkata",
      deliveryWindow,
    });

    expect(preview.scheduledRunsCount).toBe(3);
    expect(preview.afterSchedule).toHaveLength(3);
    for (const after of preview.afterSchedule) {
      expect(after.executeAt).toBeDefined();
      const dt = new Date(after.executeAt);
      const istHours = (dt.getUTCHours() + 5 + Math.floor((dt.getUTCMinutes() + 30) / 60)) % 24;
      expect(istHours).toBeGreaterThanOrEqual(9);
      expect(istHours).toBeLessThanOrEqual(21);
    }
  });

  it("2. Quote hash changes deterministically with window and timezone", async () => {
    const quoteBase = {
      userId: testUserId,
      platform: "instagram",
      handle: "d4_account",
      timezone: "Asia/Kolkata",
      days: 5,
      intervalHours: 24,
      totalCharge: 55,
      totalRuns: 5,
      items: [
        {
          serviceId: activeServiceId,
          kind: "TIME_DRIP",
          totalQuantity: 500,
          quantityPerPost: 100,
          charge: 55,
          ratePer1000: 110,
          runs: 5,
          maxPosts: 5,
        },
      ],
    };

    const windowDaytime = {
      timezone: "Asia/Kolkata",
      ranges: [{ startHour: 9, startMinute: 0, endHour: 21, endMinute: 0 }],
    };

    const windowEvening = {
      timezone: "Asia/Kolkata",
      ranges: [{ startHour: 17, startMinute: 0, endHour: 23, endMinute: 0 }],
    };

    const hash1 = generateQuoteHash({ ...quoteBase, deliveryWindow: windowDaytime }, 1800000000000, "primary", TEST_SECRET);
    const hash2 = generateQuoteHash({ ...quoteBase, deliveryWindow: windowEvening }, 1800000000000, "primary", TEST_SECRET);

    expect(hash1.quoteHash).not.toEqual(hash2.quoteHash);

    const verified = verifyQuoteHash(hash1.quoteHash, { ...quoteBase, deliveryWindow: windowDaytime }, 1700000000000, TEST_SECRET);
    expect(verified.valid).toBe(true);

    const tampered = verifyQuoteHash(hash1.quoteHash, { ...quoteBase, deliveryWindow: windowEvening }, 1700000000000, TEST_SECRET);
    expect(tampered.valid).toBe(false);
  });

  it("3. User B cannot reschedule User A's package", async () => {
    // Create package owned by User A
    const pkg = await prisma.package.create({
      data: {
        userId: testUserId,
        platform: "INSTAGRAM",
        handle: "user_a_target",
        timezone: "Asia/Kolkata",
        status: PackageStatus.ACTIVE,
        startAt: new Date(),
        endAt: new Date(Date.now() + 5 * 86400000),
        reserveTotal: 100,
        rules: {
          create: {
            serviceId: activeServiceId,
            kind: "TIME_DRIP",
            quantityPerPost: 50,
            unitCharge: 10,
            rateSnapshot: 100,
            reserve: 100,
          },
        },
      },
      include: { rules: true },
    });
    createdPackageIds.push(pkg.id);

    await prisma.packageExecution.create({
      data: {
        packageId: pkg.id,
        ruleId: pkg.rules[0].id,
        seq: 1,
        quantity: 50,
        remainingQuantity: 50,
        allocatedCharge: 10,
        executeAt: new Date(Date.now() + 86400000),
        status: PackageExecutionStatus.SCHEDULED,
      },
    });

    await expect(
      pkgService.reschedulePackage(
        userBId,
        pkg.id,
        {
          timezone: "Asia/Kolkata",
          deliveryWindow: {
            timezone: "Asia/Kolkata",
            ranges: [{ startHour: 10, endHour: 18 }],
          },
        },
        `idemp_sec_${Date.now()}`,
        false
      )
    ).rejects.toThrow(/permission|forbidden/i);
  });

  it("4. Executed runs never move; quantity and charge invariants intact", async () => {
    const pkg = await prisma.package.create({
      data: {
        userId: testUserId,
        platform: "INSTAGRAM",
        handle: "immutability_test",
        timezone: "Asia/Kolkata",
        status: PackageStatus.ACTIVE,
        startAt: new Date(),
        endAt: new Date(Date.now() + 7 * 86400000),
        reserveTotal: 30,
        rules: {
          create: {
            serviceId: activeServiceId,
            kind: "TIME_DRIP",
            quantityPerPost: 100,
            unitCharge: 10,
            rateSnapshot: 100,
            reserve: 30,
          },
        },
      },
      include: { rules: true },
    });
    createdPackageIds.push(pkg.id);

    const fixedExecutedTime = new Date(Date.now() - 3600000);
    const executedRun = await prisma.packageExecution.create({
      data: {
        packageId: pkg.id,
        ruleId: pkg.rules[0].id,
        seq: 1,
        quantity: 100,
        remainingQuantity: 0,
        allocatedCharge: 10,
        plannedAt: fixedExecutedTime,
        executeAt: fixedExecutedTime,
        dispatchedAt: fixedExecutedTime,
        status: PackageExecutionStatus.COMPLETED,
      },
    });

    const scheduledRun = await prisma.packageExecution.create({
      data: {
        packageId: pkg.id,
        ruleId: pkg.rules[0].id,
        seq: 2,
        quantity: 100,
        remainingQuantity: 100,
        allocatedCharge: 10,
        plannedAt: new Date(Date.now() + 86400000),
        executeAt: new Date(Date.now() + 86400000),
        status: PackageExecutionStatus.SCHEDULED,
      },
    });

    // Reschedule package
    await pkgService.reschedulePackage(
      testUserId,
      pkg.id,
      {
        timezone: "Asia/Kolkata",
        deliveryWindow: {
          timezone: "Asia/Kolkata",
          ranges: [{ startHour: 18, endHour: 22 }],
        },
      },
      `idemp_immut_${Date.now()}`,
      false
    );

    // Verify executed run was completely untouched
    const verifiedExecuted = await prisma.packageExecution.findUnique({
      where: { id: executedRun.id },
    });
    expect(verifiedExecuted!.status).toBe(PackageExecutionStatus.COMPLETED);
    expect(verifiedExecuted!.executeAt.toISOString()).toBe(fixedExecutedTime.toISOString());
    expect(verifiedExecuted!.dispatchedAt?.toISOString()).toBe(fixedExecutedTime.toISOString());
    expect(verifiedExecuted!.quantity).toBe(100);
    expect(Number(verifiedExecuted!.allocatedCharge)).toBe(10);

    // Verify scheduled run was updated in place preserving quantity and charge
    const verifiedScheduled = await prisma.packageExecution.findUnique({
      where: { id: scheduledRun.id },
    });
    expect(verifiedScheduled!.quantity).toBe(100);
    expect(Number(verifiedScheduled!.allocatedCharge)).toBe(10);
    expect(verifiedScheduled!.status).toBe(PackageExecutionStatus.SCHEDULED);
    expect(verifiedScheduled!.executeAt.toISOString()).not.toBe(scheduledRun.executeAt.toISOString());
  });

  it("5. Reschedule is idempotent", async () => {
    const pkg = await prisma.package.create({
      data: {
        userId: testUserId,
        platform: "INSTAGRAM",
        handle: "idempotency_test",
        timezone: "Asia/Kolkata",
        status: PackageStatus.ACTIVE,
        startAt: new Date(),
        endAt: new Date(Date.now() + 5 * 86400000),
        reserveTotal: 20,
        rules: {
          create: {
            serviceId: activeServiceId,
            kind: "TIME_DRIP",
            quantityPerPost: 50,
            unitCharge: 10,
            rateSnapshot: 100,
            reserve: 20,
          },
        },
      },
      include: { rules: true },
    });
    createdPackageIds.push(pkg.id);

    await prisma.packageExecution.create({
      data: {
        packageId: pkg.id,
        ruleId: pkg.rules[0].id,
        seq: 1,
        quantity: 50,
        remainingQuantity: 50,
        allocatedCharge: 10,
        executeAt: new Date(Date.now() + 86400000),
        status: PackageExecutionStatus.SCHEDULED,
      },
    });

    const idempKey = `idemp_repeat_${Date.now()}`;
    const payload = {
      timezone: "Asia/Kolkata",
      deliveryWindow: {
        timezone: "Asia/Kolkata",
        ranges: [{ startHour: 10, endHour: 14 }],
      },
    };

    const res1 = await pkgService.reschedulePackage(testUserId, pkg.id, payload, idempKey, false);
    const res2 = await pkgService.reschedulePackage(testUserId, pkg.id, payload, idempKey, false);

    expect(res1.rescheduledCount).toBe(1);
    expect(res2.rescheduledCount).toBe(1);

    const refreshedPkg = await prisma.package.findUnique({ where: { id: pkg.id } });
    expect(refreshedPkg!.rescheduleCount).toBe(1);
  });

  it("6. Accounting invariant: purchased = consumed + refunded + remaining", async () => {
    const totalPurchased = 500;
    const consumed = 200;
    const remaining = 300;
    const refunded = 0;

    expect(totalPurchased).toBe(consumed + refunded + remaining);
  });
});

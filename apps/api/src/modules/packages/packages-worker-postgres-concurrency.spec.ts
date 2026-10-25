import {
  PackageExecutionStatus,
  PackageRuleKind,
  PackageStatus,
  PrismaClient,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { SMMWorkerEngine } from "../../../../worker/src/main";

import { assertRealPostgresStartup } from "../../test-utils/pg-test-startup";

jest.setTimeout(60000);

describe("@pg Package worker PostgreSQL dispatch concurrency", () => {
  let prisma: PrismaClient;
  let testDatabaseUrl: string;
  let packageId: string | undefined;
  let serviceId: string | undefined;
  let categoryId: string | undefined;
  let userId: string | undefined;
  let executionId: string | undefined;
  const previousNodeEnv = process.env.NODE_ENV;
  const previousPackagesEnabled = process.env.PACKAGES_ENABLED;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.PACKAGES_ENABLED = "true";

    const startup = await assertRealPostgresStartup();
    testDatabaseUrl = startup.testDatabaseUrl;

    prisma = new PrismaClient({
      datasources: { db: { url: testDatabaseUrl } },
    });
    await prisma.$connect();

    const existingDueExecutions = await prisma.packageExecution.count({
      where: {
        status: PackageExecutionStatus.SCHEDULED,
        executeAt: { lte: new Date() },
      },
    });
    if (existingDueExecutions > 0) {
      throw new Error(
        "The isolated PostgreSQL test branch must not contain unrelated due package executions."
      );
    }

    const suffix = randomUUID();
    const category = await prisma.category.create({
      data: {
        name: `PostgreSQL concurrency ${suffix}`,
        slug: `pg-concurrency-${suffix}`,
      },
    });
    categoryId = category.id;

    const service = await prisma.service.create({
      data: {
        categoryId,
        name: `PostgreSQL concurrency service ${suffix}`,
        platform: "INSTAGRAM",
        ratePer1000: 100,
        minQty: 1,
        maxQty: 10000,
        packageEligible: true,
      },
    });
    serviceId = service.id;

    const user = await prisma.user.create({
      data: {
        email: `pg-concurrency-${suffix}@example.test`,
        name: "PostgreSQL concurrency test",
        passwordHash: "test-only",
      },
    });
    userId = user.id;

    const packageRecord = await prisma.package.create({
      data: {
        userId,
        platform: "INSTAGRAM",
        handle: `pg_concurrency_${suffix}`,
        endAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reserveTotal: 100,
      },
    });
    packageId = packageRecord.id;

    const rule = await prisma.packageRule.create({
      data: {
        packageId,
        kind: PackageRuleKind.TIME_DRIP,
        serviceId,
        unitCharge: 10,
        rateSnapshot: 100,
        reserve: 100,
      },
    });

    const execution = await prisma.packageExecution.create({
      data: {
        packageId,
        ruleId: rule.id,
        quantity: 100,
        allocatedCharge: 10,
        executeAt: new Date(Date.now() - 1000),
      },
    });
    executionId = execution.id;
  });

  afterAll(async () => {
    try {
      if (prisma) {
        await prisma.$transaction(async (tx) => {
          if (executionId) {
            const events = await tx.outboxEvent.findMany({
              where: { aggregate: "ORDER", eventType: "ORDER_CREATED" },
              select: { id: true, payload: true },
            });
            const relatedEventIds = events
              .filter(
                (event) =>
                  (event.payload as { packageExecutionId?: string })
                    .packageExecutionId === executionId
              )
              .map((event) => event.id);
            if (relatedEventIds.length > 0) {
              await tx.outboxEvent.deleteMany({
                where: { id: { in: relatedEventIds } },
              });
            }
            await tx.order.deleteMany({
              where: { packageExecutionId: executionId },
            });
          }
          if (packageId) {
            await tx.package.deleteMany({ where: { id: packageId } });
          }
          if (serviceId) {
            await tx.service.deleteMany({ where: { id: serviceId } });
          }
          if (categoryId) {
            await tx.category.deleteMany({ where: { id: categoryId } });
          }
          if (userId) {
            await tx.user.deleteMany({ where: { id: userId } });
          }
        });
      }
    } finally {
      await prisma?.$disconnect();
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
      if (previousPackagesEnabled === undefined) {
        delete process.env.PACKAGES_ENABLED;
      } else {
        process.env.PACKAGES_ENABLED = previousPackagesEnabled;
      }
    }
  });

  it("creates one child order and outbox event when two workers claim the same due run", async () => {
    if (!prisma || !executionId) {
      throw new Error("PostgreSQL test fixtures were not initialized.");
    }

    const worker = new SMMWorkerEngine();
    const results = await Promise.all([
      worker.pollAndDispatchPackageExecutions(prisma),
      worker.pollAndDispatchPackageExecutions(prisma),
    ]);

    expect(results.reduce((count, result) => count + result.dispatchedCount, 0)).toBe(1);
    expect(results.reduce((count, result) => count + result.errorsCount, 0)).toBe(0);

    const execution = await prisma.packageExecution.findUnique({
      where: { id: executionId },
    });
    expect(execution?.status).toBe(PackageExecutionStatus.DISPATCHED);
    expect(execution?.orderId).toBeTruthy();

    const childOrders = await prisma.order.findMany({
      where: { packageExecutionId: executionId },
    });
    expect(childOrders).toHaveLength(1);

    const orderCreatedEvents = await prisma.outboxEvent.findMany({
      where: { aggregate: "ORDER", eventType: "ORDER_CREATED" },
      select: { payload: true },
    });
    expect(
      orderCreatedEvents.filter(
        (event) =>
          (event.payload as { packageExecutionId?: string }).packageExecutionId ===
          executionId
      )
    ).toHaveLength(1);
  });

  afterAll(async () => {
    try {
      if (executionId) {
        await prisma.order.deleteMany({ where: { packageExecutionId: executionId } });
        await prisma.packageExecution.deleteMany({ where: { id: executionId } });
      }
      if (packageId) {
        await prisma.packageRule.deleteMany({ where: { packageId } });
        await prisma.package.deleteMany({ where: { id: packageId } });
      }
      if (serviceId) {
        await prisma.service.deleteMany({ where: { id: serviceId } });
      }
      if (categoryId) {
        await prisma.category.deleteMany({ where: { id: categoryId } });
      }
      if (userId) {
        await prisma.wallet.deleteMany({ where: { userId } });
        await prisma.user.deleteMany({ where: { id: userId } });
      }
    } catch (err) {
      console.warn("Cleanup warning:", err);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      process.env.PACKAGES_ENABLED = previousPackagesEnabled;
      if (prisma) {
        await prisma.$disconnect();
      }
    }
  }, 60000);
});

import { BadRequestException } from "@nestjs/common";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PackageExecutionStatus, PackageStatus } from "@prisma/client";
import { newDb } from "pg-mem";
import {
  PackageQuoteInputSchema,
  PackageQuoteResponseSchema,
  PackagePurchaseInputSchema,
  RescheduleExecutionInputSchema,
  formatInstantForDateTimeLocal,
  localDateTimeToInstant,
  PACKAGE_PROVIDER_STATUS_STALLED_REASON,
} from "@smm/contracts";
import { PackagesQuoteService } from "../src/modules/packages/packages-quote.service";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PackagesSchedulerService } from "../src/modules/packages/packages-scheduler.service";
import { PackagesController } from "../src/modules/packages/packages.controller";
import { SMMWorkerEngine } from "../../worker/src/main";
import { generateQuoteHash } from "../src/modules/packages/package-quote-hash.util";

jest.mock("../../worker/src/crypto.util", () => ({
  decryptProviderKey: jest.fn(() => "test-provider-key"),
}));

describe("package timezone and rescheduling", () => {
  const previousPackagesEnabled = process.env.PACKAGES_ENABLED;

  beforeAll(() => {
    process.env.PACKAGES_ENABLED = "true";
  });

  afterAll(() => {
    if (previousPackagesEnabled === undefined) {
      delete process.env.PACKAGES_ENABLED;
    } else {
      process.env.PACKAGES_ENABLED = previousPackagesEnabled;
    }
  });

  it("converts package-local schedule times to unambiguous absolute instants", () => {
    expect(localDateTimeToInstant("2026-02-01T12:00", "America/New_York")).toBe(
      "2026-02-01T17:00:00.000Z",
    );
    expect(localDateTimeToInstant("2026-02-01T12:00", "Asia/Kolkata")).toBe(
      "2026-02-01T06:30:00.000Z",
    );
    expect(
      formatInstantForDateTimeLocal(
        "2026-02-01T17:00:00.000Z",
        "America/New_York",
      ),
    ).toBe("2026-02-01T12:00");
    expect(() =>
      localDateTimeToInstant("2026-03-08T02:30", "America/New_York"),
    ).toThrow("does not exist");
    expect(() =>
      localDateTimeToInstant("2026-11-01T01:30", "America/New_York"),
    ).toThrow("occurs twice");
  });

  it("accepts IANA timezones, rejects invalid values, and returns the timezone in the quote", async () => {
    expect(
      PackageQuoteInputSchema.safeParse({
        platform: "instagram",
        handle: "travel_notes",
        timezone: "Asia/Kolkata",
        followersDrip: {
          serviceId: "svc_followers",
          quantity: 100,
          days: 2,
          intervalHours: 24,
        },
      }).success,
    ).toBe(true);
    expect(
      PackageQuoteInputSchema.safeParse({
        platform: "instagram",
        handle: "travel_notes",
        timezone: "Not/A_Timezone",
        followersDrip: {
          serviceId: "svc_followers",
          quantity: 100,
          days: 2,
          intervalHours: 24,
        },
      }).success,
    ).toBe(false);
    expect(
      PackageQuoteInputSchema.safeParse({
        platform: "instagram",
        handle: "travel_notes",
        timezone: "UTC",
        items: [
          {
            serviceId: "svc_followers",
            target: "https://instagram.com/travel_notes",
            quantity: 100,
            timezone: "Not/A_Timezone",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      PackagePurchaseInputSchema.safeParse({
        platform: "instagram",
        handle: "travel_notes",
        timezone: "Not/A_Timezone",
        consentRulesUnderstood: true,
        followersDrip: {
          serviceId: "svc_followers",
          quantity: 100,
          days: 2,
          intervalHours: 24,
        },
      }).success,
    ).toBe(false);
    expect(
      RescheduleExecutionInputSchema.safeParse({ executeAt: "not-a-date" })
        .success,
    ).toBe(false);
    expect(
      RescheduleExecutionInputSchema.safeParse({
        executeAt: "2026-10-23T15:00:00",
      }).success,
    ).toBe(false);
    expect(
      RescheduleExecutionInputSchema.safeParse({
        executeAt: "2026-10-23T15:00:00+05:30",
      }).success,
    ).toBe(true);

    const quoteService = new PackagesQuoteService({
      isConnected: false,
    } as any);
    const quote = await quoteService.calculateQuote({
      platform: "instagram",
      handle: "travel_notes",
      timezone: "Asia/Kolkata",
      followersDrip: {
        serviceId: "svc_followers",
        quantity: 100,
        days: 2,
        intervalHours: 24,
      },
    });

    expect(quote.timezone).toBe("Asia/Kolkata");
    expect(quote.timeline).toHaveLength(2);
    expect(PackageQuoteResponseSchema.safeParse(quote).success).toBe(true);
    expect(
      PackageQuoteResponseSchema.safeParse({
        ...quote,
        timeline: [{ ...quote.timeline[0], scheduledAt: "invalid-date" }],
      }).success,
    ).toBe(false);
  });

  it("reschedules only a future scheduled sandbox execution owned by the package user", async () => {
    const service = new PackagesService(
      { isConnected: false } as any,
      {} as any,
      {} as any,
    );
    const packages = (service as any).sandboxPackages as Map<string, any>;
    packages.set("pkg_1", {
      id: "pkg_1",
      userId: "user_1",
      status: PackageStatus.ACTIVE,
      startAt: new Date(Date.now() - 60_000).toISOString(),
      endAt: new Date(Date.now() + 60 * 60_000).toISOString(),
      timezone: "Asia/Kolkata",
      executions: [{ id: "exec_1", status: PackageExecutionStatus.SCHEDULED }],
    });

    const scheduledAt = new Date(Date.now() + 60_000).toISOString();
    await expect(
      service.rescheduleExecution("user_1", "pkg_1", "exec_1", {
        executeAt: scheduledAt,
      }),
    ).resolves.toMatchObject({
      success: true,
      executionId: "exec_1",
      timezone: "Asia/Kolkata",
    });
    expect(packages.get("pkg_1").executions[0].executeAt).toBe(scheduledAt);

    packages.get("pkg_1").executions[0].status =
      PackageExecutionStatus.DISPATCHED;
    await expect(
      service.rescheduleExecution("user_1", "pkg_1", "exec_1", {
        executeAt: scheduledAt,
      }),
    ).rejects.toThrow("Only scheduled executions can be rescheduled");
    await expect(
      service.rescheduleExecution("other_user", "pkg_1", "exec_1", {
        executeAt: scheduledAt,
      }),
    ).rejects.toThrow("Package not found");
    await expect(
      service.rescheduleExecution("user_1", "pkg_1", "exec_1", {
        executeAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).rejects.toThrow("future");

    packages.get("pkg_1").executions[0].status =
      PackageExecutionStatus.SCHEDULED;
    await expect(
      service.rescheduleExecution("user_1", "pkg_1", "exec_1", {
        executeAt: packages.get("pkg_1").endAt,
      }),
    ).rejects.toThrow("within the package duration");

    packages.get("pkg_1").status = PackageStatus.PAUSED;
    await expect(
      service.rescheduleExecution("user_1", "pkg_1", "exec_1", {
        executeAt: scheduledAt,
      }),
    ).rejects.toThrow("package in status");
  });

  it("persists the requested timezone when creating a package", async () => {
    const quote = {
      totalCharge: 1,
      days: 2,
      totalRuns: 2,
      items: [
        {
          serviceId: "svc_followers",
          serviceName: "Followers",
          kind: "TIME_DRIP",
          targetType: "PROFILE",
          totalQuantity: 100,
          quantityPerPost: 50,
          charge: 1,
          ratePer1000: 10,
          runs: 2,
          minQty: 1,
          maxQty: 1000,
        },
      ],
    };
    const testHash = generateQuoteHash({
      userId: "user_1",
      platform: "instagram",
      handle: "travel_notes",
      timezone: "Asia/Kolkata",
      days: 2,
      intervalHours: 24,
      totalCharge: 1,
      totalRuns: 2,
      items: quote.items,
    }).quoteHash;

    const calculateQuote = jest.fn(async (_input: any, scheduleStartAt: Date) => ({
      ...quote,
      quoteHash: testHash,
      timeline: [
        {
          serviceId: "svc_followers",
          scheduledAt: scheduleStartAt.toISOString(),
          quantity: 50,
          chargeShare: 0.5,
        },
        {
          serviceId: "svc_followers",
          scheduledAt: new Date(scheduleStartAt.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          quantity: 50,
          chargeShare: 0.5,
        },
      ],
    }));
    const packageCreate = jest.fn(async ({ data }: any) => ({
      id: "pkg_db_1",
      ...data,
    }));
    const executionCreate = jest
      .fn()
      .mockResolvedValue({ id: "execution_1" });
    const prisma: any = {
      isConnected: true,
      package: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: async (callback: (tx: any) => Promise<unknown>) =>
        callback({
          package: {
            findFirst: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            create: packageCreate,
          },
          $queryRawUnsafe: jest
            .fn()
            .mockResolvedValue([{ id: "wallet_1", balance: "100" }]),
          wallet: { update: jest.fn() },
          ledgerEntry: { create: jest.fn() },
          packageRule: {
            create: jest.fn().mockResolvedValue({ id: "rule_1" }),
          },
          packageExecution: { create: executionCreate },
        }),
    };
    const platformsService = {
      getPlatformConfig: async () => ({
        platform: "instagram",
        handleRegex: "^[A-Za-z0-9_.]+$",
        handleMaxLength: 30,
      }),
      isHandleBlocked: async () => false,
    };
    const service = new PackagesService(
      prisma,
      { calculateQuote } as any,
      platformsService as any,
    );

    await service.purchasePackage("user_1", {
      platform: "instagram",
      handle: "travel_notes",
      timezone: "Asia/Kolkata",
      idempotencyKey: "timezone-purchase-1",
      quoteHash: testHash,
      consentRulesUnderstood: true,
      followersDrip: {
        serviceId: "svc_followers",
        quantity: 100,
        days: 2,
        intervalHours: 24,
      },
    });

    expect(packageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ timezone: "Asia/Kolkata" }),
      }),
    );
    const purchaseStartAt = packageCreate.mock.calls[0][0].data.startAt;
    expect(calculateQuote.mock.calls[0][1]).toEqual(purchaseStartAt);
    const persistedRuns = executionCreate.mock.calls.map((call) => call[0].data);
    expect(persistedRuns).toHaveLength(2);
    expect(persistedRuns.map((run) => run.executeAt)).toEqual([
      purchaseStartAt,
      new Date(purchaseStartAt.getTime() + 24 * 60 * 60 * 1000),
    ]);
    expect(persistedRuns.map((run) => run.quantity)).toEqual([50, 50]);
    expect(
      persistedRuns.every(
        (run) =>
          run.packageId === "pkg_db_1" &&
          run.ruleId === "rule_1" &&
          run.source === "SCHEDULE" &&
          run.status === PackageExecutionStatus.SCHEDULED,
      ),
    ).toBe(true);
  });

  it("adds UTC defaults to historical package rows without changing their schedule instants", () => {
    const database = newDb();
    database.public.none(`
      CREATE TABLE "Package" (
        id TEXT PRIMARY KEY,
        "startAt" TIMESTAMP NOT NULL,
        "endAt" TIMESTAMP NOT NULL
      );
      INSERT INTO "Package" (id, "startAt", "endAt") VALUES
        ('historical_1', '2026-01-01 00:00:00', '2026-01-31 00:00:00'),
        ('historical_2', '2026-02-01 12:30:00', '2026-03-03 12:30:00');
    `);

    const migration = readFileSync(
      path.resolve(
        __dirname,
        "../../../prisma/migrations/20261022000000_package_timezone/migration.sql",
      ),
      "utf8",
    );
    database.public.none(migration);

    const records = database.public.many(
      `SELECT id, "startAt", "endAt", timezone FROM "Package" ORDER BY id`,
    );
    expect(records).toHaveLength(2);
    expect(records.map((record: any) => record.timezone)).toEqual([
      "UTC",
      "UTC",
    ]);
    expect(new Date(records[0].startAt).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(new Date(records[0].endAt).toISOString()).toBe(
      "2026-01-31T00:00:00.000Z",
    );
    expect(new Date(records[1].startAt).toISOString()).toBe(
      "2026-02-01T12:30:00.000Z",
    );
    expect(new Date(records[1].endAt).toISOString()).toBe(
      "2026-03-03T12:30:00.000Z",
    );
  });

  it("adds provider status health fields without changing provider activation", () => {
    const database = newDb();
    database.public.none(`
      CREATE TABLE "Provider" (
        id TEXT PRIMARY KEY,
        active BOOLEAN NOT NULL DEFAULT TRUE
      );
      INSERT INTO "Provider" (id, active) VALUES ('provider_existing', TRUE);
    `);

    const migration = readFileSync(
      path.resolve(
        __dirname,
        "../../../prisma/migrations/20261023000000_provider_status_health/migration.sql",
      ),
      "utf8",
    );
    expect(migration).toMatch(
      /"consecutiveStatusFailures" INTEGER NOT NULL DEFAULT 0/,
    );
    database.public.none(migration);

    expect(
      database.public.one(`
        SELECT active, "consecutiveStatusFailures", "lastStatusCheckAt", "lastStatusCheckError"
        FROM "Provider"
        WHERE id = 'provider_existing'
      `),
    ).toMatchObject({
      active: true,
    });
  });

  it("locks and audits a database-backed reschedule", async () => {
    const updated: any[] = [];
    const audits: any[] = [];
    const startAt = new Date(Date.now() - 60_000);
    const executeAt = new Date(Date.now() + 60_000);
    const prisma: any = {
      isConnected: true,
      $transaction: async (fn: any) =>
        fn({
          $queryRawUnsafe: async (query: string) =>
            query.includes('FROM "Package"')
              ? [
                  {
                    id: "pkg_2",
                    status: PackageStatus.ACTIVE,
                    startAt,
                    endAt: new Date(Date.now() + 120_000),
                    timezone: "UTC",
                  },
                ]
              : [
                  {
                    id: "exec_2",
                    status: PackageExecutionStatus.SCHEDULED,
                    executeAt: startAt,
                  },
                ],
          packageExecution: {
            update: async (input: any) => updated.push(input),
          },
          auditLog: { create: async (input: any) => audits.push(input) },
        }),
    };
    const service = new PackagesService(prisma, {} as any, {} as any);

    await expect(
      service.rescheduleExecution("user_2", "pkg_2", "exec_2", {
        executeAt: executeAt.toISOString(),
      }),
    ).resolves.toMatchObject({
      success: true,
      executeAt: executeAt.toISOString(),
      timezone: "UTC",
    });
    expect(updated).toHaveLength(1);
    expect(audits).toHaveLength(1);
    expect(audits[0].data.action).toBe("PACKAGE_EXECUTION_RESCHEDULED");
    expect(audits[0].data.payload.previousExecuteAt).toBe(
      startAt.toISOString(),
    );
  });

  it("does not update another user's package during a database-backed reschedule", async () => {
    const update = jest.fn();
    const audit = jest.fn();
    const prisma: any = {
      isConnected: true,
      $transaction: async (fn: any) =>
        fn({
          $queryRawUnsafe: async () => [],
          packageExecution: { update },
          auditLog: { create: audit },
        }),
    };
    const service = new PackagesService(prisma, {} as any, {} as any);

    await expect(
      service.rescheduleExecution("another_user", "private_package", "exec_1", {
        executeAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    ).rejects.toThrow("Package not found");
    expect(update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("validates reschedule requests at the API boundary", async () => {
    const rescheduleExecution = jest.fn().mockResolvedValue({ success: true });
    const controller = new PackagesController({ rescheduleExecution } as any);
    const user = { id: "user_3" } as any;
    const body = { executeAt: new Date(Date.now() + 60_000).toISOString() };

    await expect(
      controller.rescheduleExecution(user, "pkg_3", "exec_3", body),
    ).resolves.toEqual({ success: true });
    expect(rescheduleExecution).toHaveBeenCalledWith(
      "user_3",
      "pkg_3",
      "exec_3",
      body,
    );
    await expect(
      controller.rescheduleExecution(user, "pkg_3", "exec_3", {
        executeAt: "not-a-date",
      }),
    ).rejects.toThrow(BadRequestException);
    expect(rescheduleExecution).toHaveBeenCalledTimes(1);
  });

  it("keeps only expiry settlement on the API timer", async () => {
    const scheduler = new PackagesSchedulerService({
      isConnected: false,
    } as any);
    const settle = jest
      .spyOn(scheduler, "settleExpiredPackages")
      .mockResolvedValue({ settledCount: 0 });
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    jest.useFakeTimers();
    try {
      scheduler.onModuleInit();
      await jest.advanceTimersByTimeAsync(10_000);
      scheduler.onModuleDestroy();
    } finally {
      jest.useRealTimers();
      process.env.NODE_ENV = previousEnvironment;
    }

    expect(settle).toHaveBeenCalledTimes(1);
    expect(scheduler).not.toHaveProperty("processDueExecutions");
  });

  it("dispatches a due execution once under duplicate worker polls and atomically writes order and outbox", async () => {
    const fake = createPackageDispatchDatabase();
    const worker = new SMMWorkerEngine();

    const [first, second] = await Promise.all([
      worker.pollAndDispatchPackageExecutions(fake.database),
      worker.pollAndDispatchPackageExecutions(fake.database),
    ]);

    expect(first.dispatchedCount + second.dispatchedCount).toBe(1);
    expect(fake.state.orders).toHaveLength(1);
    expect(fake.state.executions[0]).toMatchObject({
      status: PackageExecutionStatus.DISPATCHED,
      orderId: "child_order_1",
      remainingQuantity: 250,
    });
    expect(fake.state.orders[0]).toMatchObject({
      isPrepaid: true,
      quantity: 250,
      remains: 250,
      packageExecutionId: "exec_dispatch_1",
    });
    expect(fake.state.orders[0].charge.toString()).toBe("7.5");
    expect(fake.state.outbox).toHaveLength(1);
    expect(fake.state.outbox[0].data.payload).toMatchObject({
      orderId: "child_order_1",
      packageExecutionId: "exec_dispatch_1",
      isPrepaid: true,
    });
  });

  it("rolls back a failed child-order transaction and retries the due execution on a later poll", async () => {
    const fake = createPackageDispatchDatabase({ failNextOrderCreate: true });
    const worker = new SMMWorkerEngine();

    const failed = await worker.pollAndDispatchPackageExecutions(fake.database);
    expect(failed).toMatchObject({ dispatchedCount: 0, errorsCount: 1 });
    expect(fake.state.executions[0].status).toBe(
      PackageExecutionStatus.SCHEDULED,
    );
    expect(fake.state.orders).toHaveLength(0);
    expect(fake.state.outbox).toHaveLength(0);

    const retried = await worker.pollAndDispatchPackageExecutions(
      fake.database,
    );
    expect(retried).toMatchObject({ dispatchedCount: 1, errorsCount: 0 });
    expect(fake.state.orders).toHaveLength(1);
    expect(fake.state.outbox).toHaveLength(1);
  });

  it("rolls back child order and execution state when outbox persistence fails", async () => {
    const fake = createPackageDispatchDatabase({ failNextOutboxCreate: true });
    const worker = new SMMWorkerEngine();

    const failed = await worker.pollAndDispatchPackageExecutions(fake.database);
    expect(failed).toMatchObject({ dispatchedCount: 0, errorsCount: 1 });
    expect(fake.state.executions[0].status).toBe(
      PackageExecutionStatus.SCHEDULED,
    );
    expect(fake.state.orders).toHaveLength(0);
    expect(fake.state.outbox).toHaveLength(0);

    const retried = await worker.pollAndDispatchPackageExecutions(
      fake.database,
    );
    expect(retried.dispatchedCount).toBe(1);
    expect(fake.state.orders).toHaveLength(1);
    expect(fake.state.outbox).toHaveLength(1);
  });

  it("does not create child orders or outbox events for paused packages", async () => {
    const fake = createPackageDispatchDatabase({
      packageStatus: PackageStatus.PAUSED,
    });
    const worker = new SMMWorkerEngine();

    const result = await worker.pollAndDispatchPackageExecutions(fake.database);

    expect(result.dispatchedCount).toBe(0);
    expect(fake.state.executions[0].status).toBe(
      PackageExecutionStatus.SKIPPED_PAUSED,
    );
    expect(fake.state.orders).toHaveLength(0);
    expect(fake.state.outbox).toHaveLength(0);
  });

  it("does not dispatch an execution after package cancellation wins the row-lock race", async () => {
    const fake = createPackageDispatchDatabase();
    const worker = new SMMWorkerEngine();
    let releaseCancellation: () => void = () => {};
    let signalCancellationStarted: () => void = () => {};
    const cancellationGate = new Promise<void>((resolve) => {
      releaseCancellation = resolve;
    });
    const cancellationStarted = new Promise<void>((resolve) => {
      signalCancellationStarted = resolve;
    });

    const cancellation = fake.database.$transaction(async (tx: any) => {
      await tx.package.update({ data: { status: PackageStatus.CANCELLED } });
      await tx.packageExecution.updateMany({
        where: { status: PackageExecutionStatus.SCHEDULED },
        data: { status: PackageExecutionStatus.CANCELLED },
      });
      signalCancellationStarted();
      await cancellationGate;
    });
    await cancellationStarted;

    const dispatching = worker.pollAndDispatchPackageExecutions(fake.database);
    releaseCancellation();
    await cancellation;
    const result = await dispatching;

    expect(result.dispatchedCount).toBe(0);
    expect(fake.state.executions[0].status).toBe(
      PackageExecutionStatus.CANCELLED,
    );
    expect(fake.state.orders).toHaveLength(0);
    expect(fake.state.outbox).toHaveLength(0);
  });

  it("does not retry an uncertain provider outcome for a package order on duplicate worker jobs", async () => {
    const fake = createPackageProviderDispatchDatabase();
    const worker = new SMMWorkerEngine();
    const providerCall = jest
      .spyOn(worker, "callUpstreamAddOrder")
      .mockRejectedValue(
        new Error("request timeout after provider accepted the request"),
      );

    const results = await Promise.allSettled([
      worker.dispatchOrderToProvider("child_order_uncertain", fake.database),
      worker.dispatchOrderToProvider("child_order_uncertain", fake.database),
    ]);

    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(0);
    expect(providerCall).toHaveBeenCalledTimes(1);
    expect(fake.state.order.status).toBe("PROCESSING");
    expect(
      fake.state.history.some(
        (entry: any) =>
          entry.data.notes.includes("outcome is uncertain") &&
          entry.data.notes.includes("automatic resubmission is blocked"),
      ),
    ).toBe(true);

    await worker.dispatchOrderToProvider(
      "child_order_uncertain",
      fake.database,
    );
    expect(providerCall).toHaveBeenCalledTimes(1);
  });

  it("does not simulate fulfillment for a package order with an uncertain provider reference", async () => {
    const worker = new SMMWorkerEngine();
    const simulateOrderProgression = jest
      .spyOn(worker, "simulateOrderProgression")
      .mockResolvedValue(undefined);
    const database: any = {
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "child_order_uncertain",
            status: "PROCESSING",
            packageExecutionId: "exec_uncertain_1",
            providerId: "provider_1",
            providerOrderId: null,
            provider: { active: true },
            createdAt: new Date(),
            isDripFeed: false,
          },
          {
            id: "child_order_provider_paused",
            status: "PROCESSING",
            packageExecutionId: "exec_uncertain_2",
            providerId: "provider_2",
            providerOrderId: "provider-ref-2",
            provider: { active: false },
            createdAt: new Date(),
            isDripFeed: false,
          },
        ]),
        findUnique: jest.fn(async ({ where }: any) => ({
          id: where.id,
          packageExecutionId: "exec_uncertain_1",
          status: "PROCESSING",
        })),
      },
      packageExecution: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      orderRun: { findMany: jest.fn().mockResolvedValue([]) },
    };

    await worker.syncNonFinalOrders(database);

    expect(simulateOrderProgression).not.toHaveBeenCalled();
    expect(database.orderRun.findMany).toHaveBeenCalledTimes(1);
  });

  it("pauses polling for a non-terminal package order after 24 hours", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const worker = new SMMWorkerEngine();
    const providerStatus = jest
      .spyOn(worker, "callUpstreamOrderStatus")
      .mockResolvedValue({ status: "Processing" });
    const order = {
      id: "child_order_stalled",
      status: "PROCESSING",
      packageExecutionId: "exec_stalled",
      providerId: "provider_1",
      providerOrderId: "provider-ref-1",
      provider: { active: true },
      packageExecution: {
        status: PackageExecutionStatus.DISPATCHED,
        skipReason: null as string | null,
      },
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000 - 1),
      isDripFeed: false,
    };
    const database: any = {
      order: {
        findMany: jest.fn().mockResolvedValue([order]),
        findUnique: jest.fn(),
      },
      packageExecution: { updateMany },
      orderRun: { findMany: jest.fn().mockResolvedValue([]) },
    };

    await worker.syncNonFinalOrders(database);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "exec_stalled",
        orderId: "child_order_stalled",
        status: PackageExecutionStatus.DISPATCHED,
      },
      data: { skipReason: PACKAGE_PROVIDER_STATUS_STALLED_REASON },
    });
    order.packageExecution.skipReason = PACKAGE_PROVIDER_STATUS_STALLED_REASON;
    await worker.syncNonFinalOrders(database);

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(providerStatus).not.toHaveBeenCalled();
    expect(database.orderRun.findMany).toHaveBeenCalledTimes(2);
  });

  it("rate-limits provider health telemetry and resets failures after a successful check", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-23T00:00:00.000Z"));
    try {
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const database: any = { provider: { updateMany } };
      const worker = new SMMWorkerEngine();

      await (worker as any).recordProviderStatusCheck(
        "provider_1",
        false,
        "HTTP 503",
        database,
      );
      await (worker as any).recordProviderStatusCheck(
        "provider_1",
        false,
        "HTTP 503",
        database,
      );
      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(updateMany.mock.calls[0][0].data).toMatchObject({
        consecutiveStatusFailures: { increment: 1 },
        lastStatusCheckError: "HTTP 503",
      });

      jest.advanceTimersByTime(60_000);
      await (worker as any).recordProviderStatusCheck(
        "provider_1",
        false,
        "HTTP 503",
        database,
      );
      expect(updateMany).toHaveBeenCalledTimes(2);

      await (worker as any).recordProviderStatusCheck(
        "provider_1",
        true,
        undefined,
        database,
      );
      expect(updateMany).toHaveBeenCalledTimes(3);
      expect(updateMany.mock.calls[2][0].data).toEqual({
        consecutiveStatusFailures: 0,
        lastStatusCheckAt: new Date("2026-10-23T00:01:00.000Z"),
        lastStatusCheckError: null,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it("updates package execution state from terminal child-order status", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const database: any = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: "child_order_1",
          packageExecutionId: "exec_1",
          status: "COMPLETED",
          remains: 0,
          providerOrderId: "provider-order-1",
        }),
      },
      packageExecution: { updateMany },
    };
    const worker = new SMMWorkerEngine();

    await worker.syncPackageExecutionStatus("child_order_1", database);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "exec_1",
        orderId: "child_order_1",
        status: PackageExecutionStatus.DISPATCHED,
      },
      data: {
        status: PackageExecutionStatus.COMPLETED,
        remainingQuantity: 0,
        skipReason: null,
      },
    });
  });

  it("atomically claims due managed runs and dispatches only the successful claimant", async () => {
    const fake = createManagedRunClaimDatabase();
    const worker = new SMMWorkerEngine();
    const dispatch = jest
      .spyOn(worker, "dispatchSingleRun")
      .mockResolvedValue(undefined);

    await Promise.all([
      worker.pollAndDispatchDueRuns(fake.database),
      worker.pollAndDispatchDueRuns(fake.database),
    ]);

    expect(fake.state.status).toBe("DISPATCHING");
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(fake.state.claimQueries).toHaveLength(2);
    expect(fake.state.claimQueries[0]).toContain("FOR UPDATE OF r SKIP LOCKED");
    expect(fake.state.claimQueries[0]).toContain("UPDATE \"OrderRun\"");
    expect(fake.state.claimQueries[0]).toContain("SET status = 'DISPATCHING'");
  });

  it("moves an abandoned managed-run claim to UNCERTAIN instead of redispatching it", async () => {
    const fake = createManagedRunClaimDatabase({
      status: "DISPATCHING",
      updatedAt: new Date(Date.now() - 3 * 60 * 1000),
    });
    const worker = new SMMWorkerEngine();
    const dispatch = jest
      .spyOn(worker, "dispatchSingleRun")
      .mockResolvedValue(undefined);

    await worker.pollAndDispatchDueRuns(fake.database);

    expect(fake.state.status).toBe("UNCERTAIN");
    expect(fake.state.lastError).toContain("requires reconciliation");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("holds a due package execution while its predecessor is still processing", async () => {
    const fake = createSequentialPackageDispatchDatabase(
      PackageExecutionStatus.DISPATCHED,
      "PROCESSING",
    );
    const worker = new SMMWorkerEngine();

    const result = await worker.pollAndDispatchPackageExecutions(fake.database);

    expect(result.dispatchedCount).toBe(0);
    expect(fake.state.current.status).toBe(PackageExecutionStatus.SCHEDULED);
    expect(fake.state.current.skipReason).toContain("Waiting for prior execution");
    expect(fake.state.orders).toHaveLength(0);
    expect(fake.state.outbox).toHaveLength(0);
  });

  it("releases a due package execution after its predecessor completes", async () => {
    const fake = createSequentialPackageDispatchDatabase(
      PackageExecutionStatus.DISPATCHED,
      "COMPLETED",
    );
    const worker = new SMMWorkerEngine();

    const result = await worker.pollAndDispatchPackageExecutions(fake.database);

    expect(result.dispatchedCount).toBe(1);
    expect(fake.state.predecessor.status).toBe(PackageExecutionStatus.COMPLETED);
    expect(fake.state.current.status).toBe(PackageExecutionStatus.DISPATCHED);
    expect(fake.state.current.skipReason).toBeNull();
    expect(fake.state.orders).toHaveLength(1);
    expect(fake.state.outbox).toHaveLength(1);
  });

  it("keeps later package executions held after a failed predecessor", async () => {
    const fake = createSequentialPackageDispatchDatabase(
      PackageExecutionStatus.FAILED,
      "FAILED",
    );
    const worker = new SMMWorkerEngine();

    const result = await worker.pollAndDispatchPackageExecutions(fake.database);

    expect(result.dispatchedCount).toBe(0);
    expect(fake.state.current.status).toBe(PackageExecutionStatus.SCHEDULED);
    expect(fake.state.current.skipReason).toContain("requires recovery");
    expect(fake.state.orders).toHaveLength(0);
  });
});

function createPackageDispatchDatabase(
  options: {
    failNextOrderCreate?: boolean;
    failNextOutboxCreate?: boolean;
    packageStatus?: PackageStatus;
  } = {},
) {
  const state: any = {
    package: {
      status: options.packageStatus || PackageStatus.ACTIVE,
      endAt: new Date(Date.now() + 60 * 60_000),
    },
    executions: [
      {
        id: "exec_dispatch_1",
        packageId: "pkg_dispatch_1",
        ruleId: "rule_dispatch_1",
        status: PackageExecutionStatus.SCHEDULED,
        executeAt: new Date(Date.now() - 1_000),
        targetUrl: "https://instagram.com/p/ABC123",
        quantity: 250,
        allocatedCharge: 7.5,
      },
    ],
    orders: [],
    outbox: [],
  };
  let transactionTail = Promise.resolve();
  let failNextOrderCreate = options.failNextOrderCreate || false;
  let failNextOutboxCreate = options.failNextOutboxCreate || false;

  const database: any = {
    packageExecution: {
      findMany: jest.fn(async () =>
        state.executions
          .filter(
            (execution: any) =>
              execution.status === PackageExecutionStatus.SCHEDULED &&
              execution.executeAt <= new Date(),
          )
          .map((execution: any) => ({
            id: execution.id,
            packageId: execution.packageId,
          })),
      ),
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => {
      let releaseTransaction: () => void = () => {};
      const previousTransaction = transactionTail;
      transactionTail = new Promise<void>((resolve) => {
        releaseTransaction = resolve;
      });
      await previousTransaction;

      const stagedExecution = { ...state.executions[0] };
      const stagedPackage = { ...state.package };
      const stagedOrders: any[] = [];
      const stagedOutbox: any[] = [];
      let nextOrderId = 1;
      const tx = {
        $queryRawUnsafe: async (query: string) =>
          query.includes('FROM "Package"')
            ? [stagedPackage]
            : stagedExecution.status === PackageExecutionStatus.SCHEDULED &&
                stagedExecution.executeAt <= new Date()
              ? [
                  {
                    ...stagedExecution,
                    userId: "user_dispatch_1",
                    handle: "travel_notes",
                    platform: "instagram",
                    serviceId: "service_dispatch_1",
                    providerId: null,
                  },
                ]
              : [],
        order: {
          create: async (input: any) => {
            if (failNextOrderCreate) {
              failNextOrderCreate = false;
              throw new Error("simulated order insert failure");
            }
            const order = { id: `child_order_${nextOrderId++}`, ...input.data };
            stagedOrders.push(order);
            return order;
          },
        },
        packageExecution: {
          updateMany: async (input: any) => {
            if (
              input.where.status &&
              stagedExecution.status !== input.where.status
            ) {
              return { count: 0 };
            }
            if (
              Object.prototype.hasOwnProperty.call(input.where, "orderId") &&
              (stagedExecution.orderId ?? null) !== input.where.orderId
            ) {
              return { count: 0 };
            }
            Object.assign(stagedExecution, input.data);
            return { count: 1 };
          },
        },
        package: {
          update: async (input: any) =>
            Object.assign(stagedPackage, input.data),
        },
        outboxEvent: {
          create: async (input: any) => {
            if (failNextOutboxCreate) {
              failNextOutboxCreate = false;
              throw new Error("simulated outbox insert failure");
            }
            stagedOutbox.push(input);
            return input;
          },
        },
      };

      try {
        const result = await callback(tx);
        Object.assign(state.package, stagedPackage);
        Object.assign(state.executions[0], stagedExecution);
        state.orders.push(...stagedOrders);
        state.outbox.push(...stagedOutbox);
        return result;
      } finally {
        releaseTransaction();
      }
    },
  };

  return { database, state };
}

function createPackageProviderDispatchDatabase() {
  const state: any = {
    order: {
      id: "child_order_uncertain",
      status: "PENDING",
      packageExecutionId: "exec_uncertain_1",
      providerId: "provider_1",
      provider: {
        id: "provider_1",
        active: true,
        apiUrl: "https://provider.invalid/api",
        apiKeyEncrypted: "test-key",
      },
      service: {
        id: "service_1",
        name: "Test service",
        providerServiceId: "service-provider-1",
      },
      target: "https://instagram.com/p/ABC123",
      quantity: 25,
      isDripFeed: false,
      isPrepaid: true,
    },
    history: [],
    execution: {
      id: "exec_uncertain_1",
      status: PackageExecutionStatus.DISPATCHED,
      orderId: "child_order_uncertain",
      skipReason: null,
    },
  };
  let transactionTail = Promise.resolve();
  const packageExecutionMock = {
    updateMany: jest.fn(async ({ where, data }: any) => {
      if (
        where.id !== state.execution.id ||
        where.orderId !== state.execution.orderId ||
        where.status !== state.execution.status
      ) {
        return { count: 0 };
      }
      Object.assign(state.execution, data);
      return { count: 1 };
    }),
  };

  const database: any = {
    order: {
      findUnique: jest.fn(async () => ({ ...state.order })),
      updateMany: jest.fn(async ({ where, data }: any) => {
        if (where.id !== state.order.id || where.status !== state.order.status)
          return { count: 0 };
        Object.assign(state.order, data);
        return { count: 1 };
      }),
    },
    orderStatusHistory: {
      create: jest.fn(async (input: any) => {
        state.history.push(input);
        return input;
      }),
    },
    packageExecution: packageExecutionMock,
    $transaction: async (callback: (tx: any) => Promise<unknown>) => {
      let releaseTransaction: () => void = () => {};
      const previousTransaction = transactionTail;
      transactionTail = new Promise<void>((resolve) => {
        releaseTransaction = resolve;
      });
      await previousTransaction;
      try {
        return await callback({
          order: {
            updateMany: async ({ where, data }: any) => {
              if (
                where.id !== state.order.id ||
                where.status !== state.order.status
              )
                return { count: 0 };
              Object.assign(state.order, data);
              return { count: 1 };
            },
          },
          orderStatusHistory: {
            create: async (input: any) => {
              state.history.push(input);
              return input;
            },
          },
          packageExecution: packageExecutionMock,
        });
      } finally {
        releaseTransaction();
      }
    },
  };

  return { database, state };
}

function createManagedRunClaimDatabase(
  initial: { status?: string; updatedAt?: Date } = {},
) {
  const state: any = {
    status: initial.status || "SCHEDULED",
    updatedAt: initial.updatedAt || new Date(Date.now() - 60_000),
    lastError: null,
    claimQueries: [] as string[],
  };
  let transactionTail = Promise.resolve();
  const database: any = {
    $transaction: async (callback: (tx: any) => Promise<unknown>) => {
      let releaseTransaction: () => void = () => {};
      const previousTransaction = transactionTail;
      transactionTail = new Promise<void>((resolve) => {
        releaseTransaction = resolve;
      });
      await previousTransaction;

      try {
        return await callback({
          orderRun: {
            updateMany: async ({ where, data }: any) => {
              if (
                state.status !== where.status ||
                state.updatedAt > where.updatedAt.lte
              ) {
                return { count: 0 };
              }
              Object.assign(state, data, { updatedAt: new Date() });
              return { count: 1 };
            },
          },
          $queryRawUnsafe: async (query: string) => {
            state.claimQueries.push(query);
            if (state.status !== "SCHEDULED") return [];
            state.status = "DISPATCHING";
            state.updatedAt = new Date();
            return [
              {
                id: "run_1",
                orderId: "order_1",
                runIndex: 1,
                quantity: 100,
                scheduledAt: new Date(Date.now() - 60_000),
                attempts: 0,
                chargeShare: 1,
                status: "DISPATCHING",
              },
            ];
          },
        });
      } finally {
        releaseTransaction();
      }
    },
  };
  return { database, state };
}

function createSequentialPackageDispatchDatabase(
  predecessorStatus: PackageExecutionStatus,
  predecessorOrderStatus: string,
) {
  const state: any = {
    package: {
      status: PackageStatus.ACTIVE,
      endAt: new Date(Date.now() + 60 * 60_000),
    },
    predecessor: {
      id: "exec_1",
      packageId: "pkg_1",
      ruleId: "rule_1",
      source: "SCHEDULE",
      seq: 1,
      status: predecessorStatus,
      order: { status: predecessorOrderStatus },
    },
    current: {
      id: "exec_2",
      packageId: "pkg_1",
      ruleId: "rule_1",
      source: "SCHEDULE",
      seq: 2,
      status: PackageExecutionStatus.SCHEDULED,
      executeAt: new Date(Date.now() - 1_000),
      skipReason: null,
      targetUrl: "https://instagram.com/p/SECOND",
      quantity: 250,
      allocatedCharge: 7.5,
    },
    orders: [] as any[],
    outbox: [] as any[],
  };
  const database: any = {
    packageExecution: {
      findMany: jest.fn(async () =>
        state.current.status === PackageExecutionStatus.SCHEDULED
          ? [{ id: state.current.id, packageId: state.current.packageId }]
          : [],
      ),
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => {
      const tx = {
        $queryRawUnsafe: async (query: string, executionId?: string) => {
          if (
            query.includes('FROM "PackageExecution" e') &&
            executionId === state.current.id &&
            state.current.status === PackageExecutionStatus.SCHEDULED
          ) {
            return [
              {
                ...state.current,
                userId: "user_1",
                handle: "sequence_test",
                platform: "instagram",
                serviceId: "service_1",
                providerId: null,
              },
            ];
          }
          if (query.includes('FROM "Package"')) return [state.package];
          return [];
        },
        packageExecution: {
          findFirst: jest.fn(async () => state.predecessor),
          updateMany: async ({ where, data }: any) => {
            const target =
              where.id === state.predecessor.id
                ? state.predecessor
                : where.id === state.current.id
                  ? state.current
                  : null;
            if (!target || target.status !== where.status) {
              return { count: 0 };
            }
            if (
              Object.prototype.hasOwnProperty.call(where, "orderId") &&
              (target.orderId ?? null) !== where.orderId
            ) {
              return { count: 0 };
            }
            Object.assign(target, data);
            return { count: 1 };
          },
        },
        order: {
          create: async ({ data }: any) => {
            const order = { id: "child_order_2", ...data };
            state.orders.push(order);
            return order;
          },
        },
        outboxEvent: {
          create: async ({ data }: any) => {
            state.outbox.push(data);
            return { id: "outbox_2", ...data };
          },
        },
      };
      return callback(tx);
    },
  };

  return { database, state };
}

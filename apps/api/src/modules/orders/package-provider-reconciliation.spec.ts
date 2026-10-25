import { ConflictException } from "@nestjs/common";
import { OrderStatus, PackageExecutionStatus } from "@prisma/client";
import { PACKAGE_PROVIDER_STATUS_STALLED_REASON } from "@smm/contracts";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

function createReconciliationFixture() {
  const order: any = {
    id: "package-order-1",
    status: OrderStatus.PROCESSING,
    packageExecutionId: "package-execution-1",
    providerId: "provider-original",
    providerOrderId: null,
  };
  const execution: any = {
    id: "package-execution-1",
    status: PackageExecutionStatus.DISPATCHED,
    skipReason: null,
  };
  const state = {
    auditLogs: [] as any[],
    history: [] as any[],
    outbox: [] as any[],
  };
  const provider = { active: true };
  const tx: any = {
    $queryRawUnsafe: jest.fn(async () => [order]),
    provider: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.id ? { id: where.id, active: provider.active } : null,
      ),
    },
    order: {
      update: jest.fn(async ({ data }: any) => Object.assign(order, data)),
    },
    orderStatusHistory: {
      create: jest.fn(async (input: any) => {
        state.history.push(input);
        return input;
      }),
    },
    outboxEvent: {
      create: jest.fn(async (input: any) => {
        state.outbox.push(input);
        return input;
      }),
    },
    auditLog: {
      create: jest.fn(async (input: any) => {
        state.auditLogs.push(input);
        return input;
      }),
    },
    packageExecution: {
      updateMany: jest.fn(async ({ data }: any) => {
        Object.assign(execution, data);
        return { count: 1 };
      }),
    },
  };
  let transactionTail = Promise.resolve();
  const prisma: any = {
    isConnected: true,
    order: {
      findUnique: jest.fn(async () => ({
        status: order.status,
        packageExecutionId: order.packageExecutionId,
        providerOrderId: order.providerOrderId,
        packageExecution: execution,
      })),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (transaction: any) => unknown) => {
      let release: () => void = () => {};
      const previous = transactionTail;
      transactionTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await callback(tx);
      } finally {
        release();
      }
    }),
  };
  return { order, execution, provider, state, tx, prisma };
}

describe("Admin package provider outcome reconciliation", () => {
  it("records unresolved review without retrying or changing the order", async () => {
    const fixture = createReconciliationFixture();
    const service = new OrdersService(fixture.prisma, {} as any);

    await expect(
      service.reconcilePackageProviderOutcome("package-order-1", "admin-1", {
        outcome: "UNRESOLVED",
        evidence: "Provider dashboard has no matching request yet.",
      }),
    ).resolves.toMatchObject({
      success: true,
      outcome: "UNRESOLVED",
      retryQueued: false,
    });

    expect(fixture.order.status).toBe(OrderStatus.PROCESSING);
    expect(fixture.order.providerOrderId).toBeNull();
    expect(fixture.tx.order.update).not.toHaveBeenCalled();
    expect(fixture.tx.outboxEvent.create).not.toHaveBeenCalled();
    expect(fixture.state.auditLogs[0].data).toMatchObject({
      userId: "admin-1",
      action: "PACKAGE_PROVIDER_OUTCOME_UNRESOLVED",
      resource: "package-order-1",
    });
  });

  it("attaches a verified accepted provider reference for normal status polling", async () => {
    const fixture = createReconciliationFixture();
    const service = new OrdersService(fixture.prisma, {} as any);

    await expect(
      service.reconcilePackageProviderOutcome("package-order-1", "admin-1", {
        outcome: "ACCEPTED",
        providerId: "provider-verified",
        providerOrderId: "external-123",
        evidence: "Matched provider order in the provider dashboard.",
      }),
    ).resolves.toMatchObject({
      success: true,
      outcome: "ACCEPTED",
      retryQueued: false,
    });

    expect(fixture.order).toMatchObject({
      status: OrderStatus.PROCESSING,
      providerId: "provider-verified",
      providerOrderId: "external-123",
    });
    expect(fixture.state.outbox).toHaveLength(0);
    expect(fixture.state.auditLogs[0].data.payload).toMatchObject({
      providerId: "provider-verified",
      providerOrderId: "external-123",
      retryQueued: false,
    });
  });

  it("permits one retry only after an operator confirms provider rejection", async () => {
    const fixture = createReconciliationFixture();
    const service = new OrdersService(fixture.prisma, {} as any);

    await expect(
      service.reconcilePackageProviderOutcome("package-order-1", "admin-1", {
        outcome: "REJECTED",
        providerId: "provider-verified",
        confirmedNoAcceptance: true,
        evidence: "Provider confirmed request rejection; ticket CASE-456.",
      }),
    ).resolves.toMatchObject({
      success: true,
      outcome: "REJECTED",
      retryQueued: true,
    });

    expect(fixture.order).toMatchObject({
      status: OrderStatus.PENDING,
      providerId: "provider-verified",
      providerOrderId: null,
    });
    expect(fixture.state.outbox).toHaveLength(1);
    expect(fixture.state.outbox[0].data.payload).toEqual({
      orderId: "package-order-1",
    });
    expect(fixture.state.auditLogs[0].data.payload).toMatchObject({
      retryQueued: true,
      evidence: "Provider confirmed request rejection; ticket CASE-456.",
    });
  });

  it("rejects duplicate reconciliation and blocks generic retry while outcome is uncertain", async () => {
    const fixture = createReconciliationFixture();
    const service = new OrdersService(fixture.prisma, {} as any);
    const accepted = {
      outcome: "ACCEPTED" as const,
      providerId: "provider-verified",
      providerOrderId: "external-123",
      evidence: "Provider dashboard match.",
    };

    const duplicateAttempts = await Promise.allSettled([
      service.reconcilePackageProviderOutcome(
        "package-order-1",
        "admin-1",
        accepted,
      ),
      service.reconcilePackageProviderOutcome(
        "package-order-1",
        "admin-1",
        accepted,
      ),
    ]);
    expect(
      duplicateAttempts.filter((attempt) => attempt.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      duplicateAttempts.filter((attempt) => attempt.status === "rejected"),
    ).toHaveLength(1);
    expect(fixture.state.auditLogs).toHaveLength(1);
    expect(fixture.tx.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("FOR UPDATE"),
      "package-order-1",
    );

    const unresolvedFixture = createReconciliationFixture();
    const unresolvedService = new OrdersService(
      unresolvedFixture.prisma,
      {} as any,
    );
    await expect(
      unresolvedService.retry("package-order-1", "admin-1"),
    ).rejects.toThrow(
      "Reconcile it with an administrator",
    );
  });

  it("resumes a stalled accepted package order without resubmitting it", async () => {
    const fixture = createReconciliationFixture();
    fixture.order.providerOrderId = "external-123";
    fixture.execution.skipReason = PACKAGE_PROVIDER_STATUS_STALLED_REASON;
    const service = new OrdersService(fixture.prisma, {} as any);

    await expect(
      service.retry("package-order-1", "admin-1"),
    ).resolves.toMatchObject({
      success: true,
      message: expect.stringContaining("will not be resubmitted"),
    });

    expect(fixture.execution.skipReason).toBeNull();
    expect(fixture.tx.outboxEvent.create).not.toHaveBeenCalled();
    expect(fixture.state.auditLogs[0].data).toMatchObject({
      userId: "admin-1",
      action: "PACKAGE_PROVIDER_STATUS_POLLING_RESUMED",
      resource: "package-order-1",
    });
  });

  it("does not redispatch a package order that already has a provider reference", async () => {
    const fixture = createReconciliationFixture();
    fixture.order.providerOrderId = "external-123";
    const service = new OrdersService(fixture.prisma, {} as any);

    await expect(
      service.retry("package-order-1", "admin-1"),
    ).rejects.toThrow("It cannot be resubmitted");

    expect(fixture.tx.outboxEvent.create).not.toHaveBeenCalled();
    expect(fixture.prisma.order.update).not.toHaveBeenCalled();
  });

  it("rejects a reconciliation for an order that is no longer uncertain", async () => {
    const fixture = createReconciliationFixture();
    fixture.order.status = OrderStatus.PENDING;
    const service = new OrdersService(fixture.prisma, {} as any);

    await expect(
      service.reconcilePackageProviderOutcome("package-order-1", "admin-1", {
        outcome: "REJECTED",
        providerId: "provider-verified",
        confirmedNoAcceptance: true,
        evidence: "Provider confirmed rejection.",
      }),
    ).rejects.toThrow(ConflictException);
    expect(fixture.tx.outboxEvent.create).not.toHaveBeenCalled();
    expect(fixture.state.auditLogs).toHaveLength(0);
  });

  it("does not allow manual completion of package orders outside provider polling", async () => {
    const fixture = createReconciliationFixture();
    const service = new OrdersService(fixture.prisma, {} as any);

    await expect(
      service.updateStatus("package-order-1", OrderStatus.COMPLETED),
    ).rejects.toThrow("provider status verification");
    expect(fixture.prisma.order.update).not.toHaveBeenCalled();
  });

  it("does not queue a confirmed rejection to an inactive provider", async () => {
    const fixture = createReconciliationFixture();
    fixture.provider.active = false;
    const service = new OrdersService(fixture.prisma, {} as any);

    await expect(
      service.reconcilePackageProviderOutcome("package-order-1", "admin-1", {
        outcome: "REJECTED",
        providerId: "provider-verified",
        confirmedNoAcceptance: true,
        evidence: "Provider confirmed request rejection.",
      }),
    ).rejects.toThrow("provider is inactive");
    expect(fixture.order.status).toBe(OrderStatus.PROCESSING);
    expect(fixture.state.outbox).toHaveLength(0);
    expect(fixture.state.auditLogs).toHaveLength(0);
  });

  it("validates the admin endpoint payload before invoking the service", async () => {
    const reconcile = jest.fn().mockResolvedValue({ success: true });
    const controller = new OrdersController({
      reconcilePackageProviderOutcome: reconcile,
    } as any);

    await expect(
      controller.reconcilePackageProviderOutcome(
        "package-order-1",
        { id: "admin-1" } as any,
        {
          outcome: "ACCEPTED",
          providerId: "provider-verified",
          providerOrderId: "external-123",
          evidence: "Provider dashboard match.",
        },
      ),
    ).resolves.toEqual({ success: true });
    await expect(async () =>
      controller.reconcilePackageProviderOutcome(
        "package-order-1",
        { id: "admin-1" } as any,
        { outcome: "REJECTED", providerId: "provider-verified" },
      ),
    ).rejects.toThrow();
    expect(reconcile).toHaveBeenCalledTimes(1);
  });
});

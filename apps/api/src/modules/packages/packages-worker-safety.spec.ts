import { OrderStatus, PackageExecutionStatus } from "@prisma/client";
import { SMMWorkerEngine } from "../../../../worker/src/main";

describe("Package worker safety boundaries", () => {
  const previousValue = process.env.PACKAGES_ENABLED;
  const worker = new SMMWorkerEngine();

  afterAll(() => {
    if (previousValue === undefined) {
      delete process.env.PACKAGES_ENABLED;
    } else {
      process.env.PACKAGES_ENABLED = previousValue;
    }
  });

  it("does not query due package runs when the feature flag is unset", async () => {
    delete process.env.PACKAGES_ENABLED;
    const findMany = jest.fn();

    await expect(
      worker.pollAndDispatchPackageExecutions({
        packageExecution: { findMany },
      } as any),
    ).resolves.toEqual({ dispatchedCount: 0, errorsCount: 0 });

    expect(findMany).not.toHaveBeenCalled();
  });

  it("allows the package dispatcher to run when explicitly enabled", async () => {
    process.env.NODE_ENV = "test";
    process.env.PACKAGES_ENABLED = "true";
    const findMany = jest.fn().mockResolvedValue([]);

    await expect(
      worker.pollAndDispatchPackageExecutions({
        packageExecution: { findMany },
      } as any),
    ).resolves.toEqual({ dispatchedCount: 0, errorsCount: 0 });

    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("keeps package dispatch disabled in production even if opted in", async () => {
    process.env.NODE_ENV = "production";
    process.env.PACKAGES_ENABLED = "true";
    const findMany = jest.fn();

    await expect(
      worker.pollAndDispatchPackageExecutions({
        packageExecution: { findMany },
      } as any),
    ).resolves.toEqual({ dispatchedCount: 0, errorsCount: 0 });

    expect(findMany).not.toHaveBeenCalled();
    process.env.NODE_ENV = "test";
  });

  it("blocks direct dispatch of a package child order while disabled", async () => {
    delete process.env.PACKAGES_ENABLED;
    const findUnique = jest.fn().mockResolvedValue({
      id: "package-child",
      packageExecutionId: "execution-1",
      status: OrderStatus.PENDING,
    });
    const transaction = jest.fn();

    await worker.dispatchOrderToProvider("package-child", {
      order: { findUnique },
      $transaction: transaction,
    } as any);

    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(transaction).not.toHaveBeenCalled();
  });

  it.each([
    [OrderStatus.COMPLETED, PackageExecutionStatus.COMPLETED, 0],
    [OrderStatus.PARTIAL, PackageExecutionStatus.PARTIAL, 23],
    [OrderStatus.FAILED, PackageExecutionStatus.FAILED, 25],
    [OrderStatus.CANCELLED, PackageExecutionStatus.CANCELLED, 25],
  ])(
    "syncs terminal child order status %s and remaining quantity",
    async (orderStatus, executionStatus, remains) => {
      process.env.PACKAGES_ENABLED = "true";
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const database = {
        order: {
          findUnique: jest.fn().mockResolvedValue({
            id: "package-child",
            packageExecutionId: "execution-1",
            status: orderStatus,
            remains,
            providerOrderId: "provider-order-1",
          }),
        },
        packageExecution: { updateMany },
      };

      await worker.syncPackageExecutionStatus("package-child", database as any);

      expect(updateMany).toHaveBeenCalledWith({
        where: {
          id: "execution-1",
          orderId: "package-child",
          status: PackageExecutionStatus.DISPATCHED,
        },
        data: {
          status: executionStatus,
          remainingQuantity: remains,
          skipReason: null,
        },
      });
    },
  );

  it("marks a provider response without a reference as uncertain without making the run retryable", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const database = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: "package-child",
          packageExecutionId: "execution-1",
          status: OrderStatus.PROCESSING,
          remains: 25,
          providerOrderId: null,
        }),
      },
      packageExecution: { updateMany },
    };

    await worker.syncPackageExecutionStatus("package-child", database as any);

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "execution-1",
        orderId: "package-child",
        status: PackageExecutionStatus.DISPATCHED,
      },
      data: {
        remainingQuantity: 25,
        skipReason:
          "Provider outcome is uncertain; automatic resubmission is blocked.",
      },
    });
  });
});

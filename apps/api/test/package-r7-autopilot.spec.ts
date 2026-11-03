import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PackagesService } from "../src/modules/packages/packages.service";
import { Decimal } from "decimal.js";
import { PackageStatus, PackageExecutionStatus } from "@prisma/client";

describe("Phase R7: Auto-Pilot, Package Controls & Slot Lifecycle", () => {
  let service: PackagesService;
  let mockPrisma: any;
  let mockFlags: any;
  let mockQuoteService: any;
  let mockPlatformsService: any;

  const userId = "user_r7_tester_88";
  const packageId = "pkg_r7_autopilot_1";

  beforeEach(() => {
    mockFlags = {
      isEnabled: jest.fn().mockResolvedValue(true),
    };
    mockQuoteService = { calculateQuote: jest.fn() };
    mockPlatformsService = { getConfig: jest.fn() };

    mockPrisma = {
      isConnected: true,
      $transaction: jest.fn().mockImplementation(async (callback: any) => callback(mockPrisma)),
      $queryRawUnsafe: jest.fn(),
      package: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      packageSlot: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      packageRule: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      packageExecution: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refund: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      ledgerEntry: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      systemSetting: {
        findUnique: jest.fn(),
      },
    };

    service = new PackagesService(
      mockPrisma,
      mockQuoteService,
      mockPlatformsService,
      mockFlags
    );
  });

  describe("1. Package Controls: Pause & Resume Lifecycle", () => {
    it("pauses an active package and increments pausedDays count", async () => {
      mockPrisma.package.findFirst.mockResolvedValue({
        id: packageId,
        userId,
        status: PackageStatus.ACTIVE,
        pausedDays: 2,
      });

      mockPrisma.package.update.mockResolvedValue({
        id: packageId,
        status: PackageStatus.PAUSED,
        pausedDays: 3,
      });

      const res = await service.pausePackage(userId, packageId);
      expect(res.success).toBe(true);
      expect(res.status).toBe(PackageStatus.PAUSED);
      expect(res.pausedDays).toBe(3);
    });

    it("rejects pause when package is already paused or completed", async () => {
      mockPrisma.package.findFirst.mockResolvedValue({
        id: packageId,
        userId,
        status: PackageStatus.PAUSED,
        pausedDays: 3,
      });

      await expect(service.pausePackage(userId, packageId)).rejects.toThrow(BadRequestException);
    });

    it("enforces maximum pause days limit (14 days default)", async () => {
      mockPrisma.package.findFirst.mockResolvedValue({
        id: packageId,
        userId,
        status: PackageStatus.ACTIVE,
        pausedDays: 14,
      });

      await expect(service.pausePackage(userId, packageId)).rejects.toThrow(
        "Maximum pause days limit reached for this package (14 days)."
      );
    });
  });

  describe("2. Package Controls: Swap Link Limit & Integrity", () => {
    it("allows up to 2 target link swaps on scheduled executions", async () => {
      mockPrisma.package.findFirst.mockResolvedValue({
        id: packageId,
        userId,
        platform: "instagram",
      });

      mockPrisma.packageRule.findFirst.mockResolvedValue({
        id: "rule_1",
        packageId,
        swapCount: 1, // first swap was already done
      });

      mockPrisma.packageExecution.findMany
        .mockResolvedValueOnce([]) // mediaKey check returns empty (unique)
        .mockResolvedValueOnce([
          { id: "exec_1", status: PackageExecutionStatus.SCHEDULED },
          { id: "exec_2", status: PackageExecutionStatus.SCHEDULED },
        ]);

      mockPrisma.packageExecution.update.mockResolvedValue({});
      mockPrisma.packageRule.update.mockResolvedValue({});

      const res = await service.swapTriggerLink(userId, packageId, "rule_1", {
        newTargetUrl: "https://www.instagram.com/p/DFGH_7890/",
      });

      expect(res.success).toBe(true);
      expect(res.swappedExecutionsCount).toBe(2);
    });

    it("rejects 3rd target link swap attempt (max 2 rule)", async () => {
      mockPrisma.package.findFirst.mockResolvedValue({
        id: packageId,
        userId,
        platform: "instagram",
      });

      mockPrisma.packageRule.findFirst.mockResolvedValue({
        id: "rule_1",
        packageId,
        swapCount: 2, // already at max 2
      });

      await expect(
        service.swapTriggerLink(userId, packageId, "rule_1", {
          newTargetUrl: "https://www.instagram.com/p/NEW_LINK_123/",
        })
      ).rejects.toThrow("Maximum 2 link swaps allowed per trigger.");
    });
  });

  describe("3. Package Controls: Cancellation & Money Invariants", () => {
    it("cancels package, marks scheduled runs cancelled, and refunds unused allocated share once", async () => {
      const packageRecord = {
        id: packageId,
        userId,
        status: PackageStatus.ACTIVE,
        reserveTotal: new Decimal("2000.00"), // 2000 INR
      };

      const walletRecord = {
        id: "wallet_user_88",
        userId,
        balance: new Decimal("500.00"),
      };

      // Mock $queryRawUnsafe FOR UPDATE locks
      mockPrisma.$queryRawUnsafe
        .mockResolvedValueOnce([packageRecord]) // lock package
        .mockResolvedValueOnce([walletRecord]); // lock wallet

      // Executions: 1 completed (500 INR), 2 scheduled (750 INR each = 1500 INR remaining)
      const executions = [
        {
          id: "exec_comp_1",
          status: PackageExecutionStatus.COMPLETED,
          allocatedCharge: new Decimal("500.00"),
          orderId: "ord_child_1",
        },
        {
          id: "exec_sched_1",
          status: PackageExecutionStatus.SCHEDULED,
          allocatedCharge: new Decimal("750.00"),
          orderId: null,
        },
        {
          id: "exec_sched_2",
          status: PackageExecutionStatus.SCHEDULED,
          allocatedCharge: new Decimal("750.00"),
          orderId: null,
        },
      ];

      mockPrisma.packageExecution.findMany.mockResolvedValue(executions);
      mockPrisma.refund.findMany.mockResolvedValue([]);
      mockPrisma.packageExecution.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.package.update.mockResolvedValue({ ...packageRecord, status: PackageStatus.CANCELLED });
      mockPrisma.wallet.findUnique.mockResolvedValue({ id: "wal_1", userId, balance: new Decimal("500.00") });
      mockPrisma.wallet.update.mockResolvedValue({});
      mockPrisma.refund.create.mockResolvedValue({ id: "ref_1" });
      mockPrisma.ledgerEntry.create.mockResolvedValue({ id: "led_1" });

      const res = await service.cancelPackage(userId, packageId);

      expect(res.success).toBe(true);
      expect(res.status).toBe(PackageStatus.CANCELLED);
      // Unused reserve was 2000 - 500 = 1500 INR
      expect(new Decimal(res.refundedAmount).toFixed(2)).toBe("1500.00");

      // Verify wallet credit matches unused reserve
      expect(mockPrisma.wallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { balance: new Decimal("2000.00") }, // 500 + 1500
        })
      );

      // Verify unique PACKAGE_REFUND ledger entry written
      expect(mockPrisma.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: new Decimal("1500.00"),
            type: "PACKAGE_REFUND",
          }),
        })
      );
    });

    it("does not allow cancellation of an already cancelled or completed package", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        { id: packageId, userId, status: PackageStatus.CANCELLED },
      ]);

      await expect(service.cancelPackage(userId, packageId)).rejects.toThrow(
        'Cannot cancel a package with status "CANCELLED".'
      );
    });
  });
});


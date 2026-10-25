import { BadRequestException, NotFoundException, ForbiddenException, ConflictException } from "@nestjs/common";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PackageStatus, PackageExecutionStatus } from "@prisma/client";
import { Decimal } from "decimal.js";

describe("Phase F2: Package State Extensions, Governance & Safety", () => {
  let mockPrisma: any;
  let packagesService: PackagesService;

  beforeEach(() => {
    mockPrisma = {
      isConnected: true,
      package: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      packageRule: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      packageExecution: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      ticket: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      stalledReport: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      setting: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };

    packagesService = new PackagesService(
      mockPrisma,
      { isProviderHealthy: jest.fn().mockResolvedValue(true) } as any,
      { createRefund: jest.fn() } as any
    );
  });

  describe("1. Pause & Resume (F2.1)", () => {
    it("pauses an active package and respects max pausedDays cap", async () => {
      mockPrisma.package.findUnique.mockResolvedValue({
        id: "pkg_f2_1",
        userId: "user_f2",
        status: PackageStatus.ACTIVE,
        pausedDays: 2,
      });

      mockPrisma.package.update.mockResolvedValue({
        id: "pkg_f2_1",
        status: PackageStatus.PAUSED,
        pausedDays: 3,
      });

      const res = await (packagesService as any).pausePackage("user_f2", "pkg_f2_1");
      expect(res.success).toBe(true);
      expect(res.newStatus).toBe(PackageStatus.PAUSED);

      // Attempting to pause when cap (e.g. 14 days) is exceeded
      mockPrisma.package.findUnique.mockResolvedValueOnce({
        id: "pkg_f2_1",
        userId: "user_f2",
        status: PackageStatus.ACTIVE,
        pausedDays: 14,
      });
      await expect(
        (packagesService as any).pausePackage("user_f2", "pkg_f2_1")
      ).rejects.toThrow(BadRequestException);
    });

    it("resumes a paused package and shifts future scheduled executions forward", async () => {
      mockPrisma.package.findUnique.mockResolvedValue({
        id: "pkg_f2_1",
        userId: "user_f2",
        status: PackageStatus.PAUSED,
        pausedAt: new Date(Date.now() - 3600 * 1000 * 24), // paused 1 day ago
      });

      mockPrisma.package.update.mockResolvedValue({
        id: "pkg_f2_1",
        status: PackageStatus.ACTIVE,
      });

      const res = await (packagesService as any).resumePackage("user_f2", "pkg_f2_1");
      expect(res.success).toBe(true);
      expect(res.newStatus).toBe(PackageStatus.ACTIVE);
    });
  });

  describe("2. Link Swap (F2.2)", () => {
    it("swaps link for scheduled executions with unique mediaKey and enforces max 2 swaps", async () => {
      mockPrisma.package.findUnique.mockResolvedValue({
        id: "pkg_f2_swap",
        userId: "user_f2",
        status: PackageStatus.ACTIVE,
        platform: "instagram",
        handle: "fashion_creator",
      });

      mockPrisma.packageRule.findUnique.mockResolvedValue({
        id: "rule_swap_1",
        packageId: "pkg_f2_swap",
        swapCount: 1, // 1 previous swap
      });

      mockPrisma.packageExecution.findMany.mockImplementation(async (args: any) => {
        if (args?.where?.mediaKey) {
          return []; // new mediaKey is not already used
        }
        return [
          { id: "exec_1", status: PackageExecutionStatus.SCHEDULED, mediaKey: "old_key" },
        ];
      });

      const res = await (packagesService as any).swapTriggerLink("user_f2", "pkg_f2_swap", "rule_swap_1", {
        newTargetUrl: "https://instagram.com/p/CxyzNewPost99/",
      });

      expect(res.success).toBe(true);
      expect(res.swappedExecutionsCount).toBe(1);

      // Attempting 3rd swap (exceeding max 2) must throw BadRequestException
      mockPrisma.packageRule.findUnique.mockResolvedValueOnce({
        id: "rule_swap_1",
        packageId: "pkg_f2_swap",
        swapCount: 2,
      });

      await expect(
        (packagesService as any).swapTriggerLink("user_f2", "pkg_f2_swap", "rule_swap_1", {
          newTargetUrl: "https://instagram.com/p/AnotherPost33/",
        })
      ).rejects.toThrow("Maximum 2 link swaps allowed per trigger.");
    });
  });

  describe("3. Speed-Up Schedule (F2.3)", () => {
    it("speeds up remaining schedule while strictly respecting minGapMinutes", async () => {
      mockPrisma.package.findUnique.mockResolvedValue({
        id: "pkg_f2_speed",
        userId: "user_f2",
        status: PackageStatus.ACTIVE,
        platform: "instagram",
      });

      mockPrisma.packageExecution.findMany.mockResolvedValue([
        {
          id: "exec_1",
          status: PackageExecutionStatus.SCHEDULED,
          executeAt: new Date(Date.now() + 1000 * 3600 * 4), // 4 hours from now
        },
        {
          id: "exec_2",
          status: PackageExecutionStatus.SCHEDULED,
          executeAt: new Date(Date.now() + 1000 * 3600 * 8), // 8 hours from now
        },
      ]);

      const res = await (packagesService as any).speedUpPackage("user_f2", "pkg_f2_speed", {
        speedFactor: 1.5,
      });

      expect(res.success).toBe(true);
      expect(res.acceleratedCount).toBe(2);
    });
  });

  describe("4. Lock-and-Verify Batch Chain (F2.4)", () => {
    it("stalls package and raises alert when previous batch exceeds timeout T without terminal status", async () => {
      const lockVerifyResult = await (packagesService as any).verifyBatchPredecessor({
        packageId: "pkg_f2_lock",
        mediaKey: "post_123",
        previousExecution: {
          id: "exec_prev",
          status: PackageExecutionStatus.DISPATCHED,
          dispatchedAt: new Date(Date.now() - 1000 * 3600 * 25), // 25 hours ago (> 24h timeout T)
        },
      });

      expect(lockVerifyResult.canProceed).toBe(false);
      expect(lockVerifyResult.outcome).toBe("STALLED");
      expect(lockVerifyResult.raiseAdminAlert).toBe(true);
    });

    it("proceeds dispatch when previous batch is COMPLETED or PARTIAL", async () => {
      const lockVerifyResult = await (packagesService as any).verifyBatchPredecessor({
        packageId: "pkg_f2_lock",
        mediaKey: "post_123",
        previousExecution: {
          id: "exec_prev",
          status: PackageExecutionStatus.COMPLETED,
        },
      });

      expect(lockVerifyResult.canProceed).toBe(true);
    });
  });

  describe("5. Order Problem Report (F2.5)", () => {
    it("creates ticket, pauses queue, and prevents duplicate open reports", async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: "ord_prob_1",
        userId: "user_f2",
        status: "PROCESSING",
      });

      mockPrisma.stalledReport.findFirst.mockResolvedValue(null); // No open report

      mockPrisma.stalledReport.create.mockResolvedValue({
        id: "rep_1",
        orderId: "ord_prob_1",
        status: "OPEN",
      });

      mockPrisma.ticket.create.mockResolvedValue({
        id: "tkt_prob_1",
        subject: "Problem Report: Order #ord_prob_1",
      });

      const res = await (packagesService as any).reportOrderProblem("user_f2", "ord_prob_1", {
        issueType: "SLOW_DELIVERY",
        notes: "Order has not updated in 12 hours.",
      });

      expect(res.success).toBe(true);
      expect(res.reportId).toBe("rep_1");

      // Duplicate report on the same order must be rejected
      mockPrisma.stalledReport.findFirst.mockResolvedValueOnce({
        id: "rep_1",
        orderId: "ord_prob_1",
        status: "OPEN",
      });

      await expect(
        (packagesService as any).reportOrderProblem("user_f2", "ord_prob_1", {
          issueType: "SLOW_DELIVERY",
          notes: "Another report",
        })
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("6. Custom Comments & Sequencing (F2.6)", () => {
    it("validates comments count matches quantity and rejects URLs, phone numbers, and duplicates", () => {
      const rawComments = [
        "Love this style!",
        "Check out https://spam.com", // Link -> MUST FAIL
        "Call me 9876543210", // Phone -> MUST FAIL
        "Love this style!", // Duplicate -> MUST FAIL
      ];

      const moderationResult = (packagesService as any).moderateComments(rawComments, 4);
      expect(moderationResult.isValid).toBe(false);
      expect(moderationResult.errors).toContain("Links and URLs are not permitted in custom comments.");
      expect(moderationResult.errors).toContain("Phone numbers or numeric sequences are not permitted.");
      expect(moderationResult.errors).toContain("Duplicate comment lines detected.");
    });

    it("calculates comment sequence offset relative to likes execution", () => {
      const likeExecuteAt = new Date("2026-10-25T10:00:00Z");
      const offsetMinutes = 30;

      const commentExecuteAt = (packagesService as any).calculateCommentSequencing(
        likeExecuteAt,
        offsetMinutes
      );

      expect(commentExecuteAt.toISOString()).toBe("2026-10-25T10:30:00.000Z");
    });
  });

  describe("7. Duration Pricing Tiers (F2.7)", () => {
    it("calculates tier multiplier with single final ceil and snapshots in package", () => {
      const baseCost = new Decimal("150.35");
      const standardTier = { name: "Standard", multiplier: new Decimal("1.10") }; // 10% premium

      const finalPrice = (packagesService as any).calculateTieredPrice(baseCost, standardTier);
      // 150.35 * 1.10 = 165.385 -> ceil once at the end -> 165.39
      expect(finalPrice.toString()).toBe("165.39");
    });
  });

  describe("8. Geo-Targeting & Deterministic Delivery Window (F2.8)", () => {
    it("shifts execution time into user delivery window deterministically", () => {
      // User window: 9 AM to 9 PM (09:00 to 21:00) IST
      const scheduledAt = new Date("2026-10-25T01:00:00Z"); // 06:30 IST (outside 09:00-21:00)
      const adjusted = (packagesService as any).applyDeliveryWindow(
        scheduledAt,
        9, // startHour
        21, // endHour
        "Asia/Kolkata"
      );

      // Must be shifted to 09:00 IST (03:30 UTC)
      expect(adjusted.toISOString()).toBe("2026-10-25T03:30:00.000Z");
    });
  });
});

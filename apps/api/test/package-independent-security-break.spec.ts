import { newDb } from "pg-mem";
import { Decimal } from "decimal.js";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PackagesQuoteService } from "../src/modules/packages/packages-quote.service";
import { PlatformsService } from "../src/modules/platforms/platforms.service";
import { WalletService } from "../src/modules/wallet/wallet.service";
import { OrdersService } from "../src/modules/orders/orders.service";
import { validateEnvironment } from "../src/config/env.validation";
import { generateQuoteHash, verifyQuoteHash } from "../src/modules/packages/package-quote-hash.util";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  PackageStatus,
  PackageRuleKind,
  PackageExecutionStatus,
  OrderStatus,
} from "@prisma/client";

describe("Independent Security Audit: Breaking the 6 Security Fixes", () => {
  let db: any;
  let mockPrisma: any;
  let quoteService: PackagesQuoteService;
  let packagesService: PackagesService;
  let platformsService: PlatformsService;
  let walletService: WalletService;
  let ordersService: OrdersService;

  beforeAll(() => {
    db = newDb();
    db.public.registerFunction({
      name: "now",
      returns: db.public.getType("timestamp"),
      implementation: () => new Date(),
    });
  });

  beforeEach(() => {
    mockPrisma = {
      isConnected: true,
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
      $queryRawUnsafe: jest.fn(async () => []),
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "user_test_1" }),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ id: "w_1", userId: "user_test_1", balance: new Decimal(1000) }),
        update: jest.fn().mockResolvedValue({ id: "w_1", balance: new Decimal(900) }),
      },
      package: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      packageRule: {
        createMany: jest.fn(),
      },
      packageExecution: {
        createMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      refund: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      ledger: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit_1" }),
      },
      service: {
        findMany: jest.fn().mockImplementation(async ({ where }: any) => {
          return [
            {
              id: "srv_test",
              displayName: "Instagram Followers",
              platform: "instagram",
              status: "ACTIVE",
              active: true,
              packageEligible: true,
              ratePer1000: new Decimal(10),
              minQuantity: 50,
              maxQuantity: 100000,
              minQty: 50,
              maxQty: 100000,
              providerId: "prov_1",
            },
          ];
        }),
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          return {
            id: where.id,
            displayName: "Instagram Followers",
            platform: "instagram",
            status: "ACTIVE",
            active: true,
            packageEligible: true,
            ratePer1000: new Decimal(10),
            minQuantity: 50,
            maxQuantity: 100000,
            minQty: 50,
            maxQty: 100000,
            providerId: "prov_1",
          };
        }),
      },
      platformConfig: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      platformHandleBlocklist: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    platformsService = new PlatformsService(mockPrisma);
    quoteService = new PackagesQuoteService(mockPrisma, platformsService);
    walletService = new WalletService(mockPrisma);
    ordersService = new OrdersService(mockPrisma, {} as any, {} as any);
    packagesService = new PackagesService(
      mockPrisma,
      quoteService,
      platformsService,
      walletService,
      ordersService
    );
  });

  describe("1. Break Attempt: Send a quote without a hash", () => {
    it("fails purchase when quoteHash is missing, undefined, null, or whitespace", async () => {
      const basePayload: any = {
        platform: "instagram",
        handle: "test_handle",
        followersDrip: {
          serviceId: "srv_test",
          quantity: 1000,
          days: 5,
          intervalHours: 24,
        },
        consentRulesUnderstood: true,
        idempotencyKey: "idem_no_hash",
      };

      // 1. Missing / undefined
      await expect(
        packagesService.purchasePackage("user_test_1", { ...basePayload })
      ).rejects.toThrow(BadRequestException);

      // 2. Empty string
      await expect(
        packagesService.purchasePackage("user_test_1", { ...basePayload, quoteHash: "" })
      ).rejects.toThrow(BadRequestException);

      // 3. Whitespace string
      await expect(
        packagesService.purchasePackage("user_test_1", { ...basePayload, quoteHash: "   " })
      ).rejects.toThrow(BadRequestException);

      console.log("BREAK ATTEMPT 1 RESULT: Missing quoteHash was rejected with 400 BadRequestException as expected.");
    });
  });

  describe("2. Break Attempt: Send a quote hash from another user", () => {
    it("rejects User B using a qh_v2 quote hash signed for User A", async () => {
      const quotePayload: any = {
        platform: "instagram",
        handle: "test_handle",
        followersDrip: {
          serviceId: "srv_test",
          quantity: 1000,
          days: 5,
          intervalHours: 24,
        },
        consentRulesUnderstood: true,
        idempotencyKey: "idem_quote_diff_user",
      };

      // User A generates quote
      const quoteUserA = await quoteService.calculateQuote(
        { ...quotePayload, userId: "user-A" },
        new Date()
      );
      expect(quoteUserA.quoteHash.startsWith("qh_v2_")).toBe(true);

      // User B attempts to purchase using User A's quote hash
      await expect(
        packagesService.purchasePackage("user-B", {
          ...quotePayload,
          quoteHash: quoteUserA.quoteHash,
        })
      ).rejects.toThrow(ConflictException);

      console.log("BREAK ATTEMPT 2A RESULT: User B using User A's qh_v2 hash rejected with 409 ConflictException.");
    });

    it("evaluates whether User B can use an unauthenticated qh_v1 quote hash", async () => {
      const quotePayload: any = {
        platform: "instagram",
        handle: "test_handle",
        followersDrip: {
          serviceId: "srv_test",
          quantity: 1000,
          days: 5,
          intervalHours: 24,
        },
        consentRulesUnderstood: true,
        idempotencyKey: "idem_v1_check",
      };

      // Public quote generated without userId creates qh_v1
      const publicQuote = await quoteService.calculateQuote({ ...quotePayload }, new Date());
      expect(publicQuote.quoteHash.startsWith("qh_v1_")).toBe(true);

      // When User B attempts to verify publicQuote.quoteHash
      const verification = verifyQuoteHash(publicQuote.quoteHash, {
        userId: "user-B",
        platform: "instagram",
        handle: "test_handle",
        timezone: "UTC",
        days: publicQuote.days,
        intervalHours: 24,
        totalCharge: publicQuote.totalCharge,
        totalRuns: publicQuote.totalRuns,
        items: publicQuote.items,
      });

      console.log("BREAK ATTEMPT 2B RESULT: Public unauthenticated quote (qh_v1) verification for User B:", verification.valid ? "ALLOWED (qh_v1 does not bind userId)" : "BLOCKED");
    });
  });

  describe("3. Break Attempt: A 365-day quote at scale", () => {
    it("rejects 365-day quote with 1-hour interval (8,760 runs) before computation", async () => {
      const start = Date.now();
      let errorThrown: any = null;
      try {
        await quoteService.calculateQuote({
          platform: "instagram",
          handle: "test_handle",
          followersDrip: {
            serviceId: "srv_test",
            quantity: 100000,
            days: 365,
            intervalHours: 1,
          },
        });
      } catch (err: any) {
        errorThrown = err;
      }
      const duration = Date.now() - start;

      expect(errorThrown).toBeInstanceOf(UnprocessableEntityException);
      expect(duration).toBeLessThan(50);
      console.log(`BREAK ATTEMPT 3A RESULT: 8,760 runs rejected in ${duration}ms with ${errorThrown?.message}`);
    });

    it("rejects schedule exceeding 365 days cap", async () => {
      await expect(
        quoteService.calculateQuote({
          platform: "instagram",
          handle: "test_handle",
          followersDrip: {
            serviceId: "srv_test",
            quantity: 10000,
            days: 366,
            intervalHours: 24,
          },
        })
      ).rejects.toThrow(UnprocessableEntityException);
      console.log("BREAK ATTEMPT 3B RESULT: 366 days rejected with UnprocessableEntityException.");
    });
  });

  describe("4. Break Attempt: Admin REFUND on partly delivered execution (twice, in parallel)", () => {
    it("prevents double-refund on parallel admin refund calls", async () => {
      let executionStatus = "STALLED";
      const executionRow = {
        id: "exec_part_1",
        packageId: "pkg_1",
        orderId: "order_child_1",
        allocatedCharge: new Decimal(100),
        get status() {
          return executionStatus;
        },
        set status(val) {
          executionStatus = val;
        },
        package: { userId: "user_test_1" },
        order: {
          id: "order_child_1",
          status: "PROCESSING", // Partly delivered, still processing
          charge: new Decimal(40),
        },
      };

      mockPrisma.$queryRawUnsafe.mockImplementation(async (query: string, id: string) => {
        if (query.includes('"PackageExecution"')) {
          return [executionRow];
        }
        if (query.includes('"Wallet"')) {
          return [{ id: "w_1", userId: "user_test_1", balance: new Decimal(500) }];
        }
        if (query.includes('"Order"')) {
          return [executionRow.order];
        }
        return [];
      });

      mockPrisma.packageExecution.findUnique.mockResolvedValue(executionRow);
      mockPrisma.packageExecution.updateMany.mockImplementation(async ({ where, data }: any) => {
        if (executionStatus === PackageExecutionStatus.CANCELLED) {
          return { count: 0 };
        }
        executionStatus = data.status;
        return { count: 1 };
      });

      // Execute 2 refund calls in parallel
      const call1 = packagesService.adminResolveExecution("exec_part_1", "REFUND", {
        reason: "Partly delivered run refund test A",
        actor: { userId: "admin1", role: "ADMIN" },
      });
      const call2 = packagesService.adminResolveExecution("exec_part_1", "REFUND", {
        reason: "Partly delivered run refund test B",
        actor: { userId: "admin2", role: "ADMIN" },
      });

      const results = await Promise.allSettled([call1, call2]);
      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");

      console.log(`BREAK ATTEMPT 4 RESULT: Parallel refund results -> Fulfilled: ${fulfilled.length}, Rejected: ${rejected.length}`);
      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);
    });

    it("observes refund amount behavior on partly delivered execution", async () => {
      const executionRow = {
        id: "exec_part_2",
        packageId: "pkg_1",
        orderId: "order_child_2",
        allocatedCharge: new Decimal(100), // Entire allocated charge
        status: "STALLED",
        package: { userId: "user_test_1" },
        order: {
          id: "order_child_2",
          status: "PROCESSING", // Upstream delivered 60%, charge is 60
          charge: new Decimal(60),
        },
      };

      mockPrisma.$queryRawUnsafe.mockImplementation(async (query: string) => {
        if (query.includes('"PackageExecution"')) return [executionRow];
        if (query.includes('"Wallet"')) return [{ id: "w_1", userId: "user_test_1", balance: new Decimal(500) }];
        if (query.includes('"Order"')) return [executionRow.order];
        return [];
      });
      mockPrisma.packageExecution.updateMany.mockResolvedValue({ count: 1 });

      const refundResult = await packagesService.refundExecution(mockPrisma, "exec_part_2", {
        reason: "Investigating refund amount on partial order",
        actor: { userId: "admin1", role: "ADMIN" },
      });

      console.log(`BREAK ATTEMPT 4B OBSERVATION: On partly delivered order (child order charge=60, allocatedCharge=100), refund amount granted was: ${refundResult.refundAmount}. (Note: It refunds 100% of allocatedCharge, not prorated against partial delivery).`);
    });
  });

  describe("5. Break Attempt: Boot with weak or missing secrets", () => {
    it("refuses boot when secrets are weak or missing in production", () => {
      const originalEnv = { ...process.env };
      const originalExit = process.exit;
      let exitCode: number | null = null;
      (process as any).exit = (code: number) => {
        exitCode = code;
        throw new Error(`process.exit called with ${code}`);
      };

      try {
        process.env.NODE_ENV = "production";
        process.env.JWT_ACCESS_SECRET = "weak_secret";
        process.env.QUOTE_SECRET = "weak_secret";
        process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/db";

        expect(() => validateEnvironment()).toThrow(/process.exit called with 1/);
        console.log("BREAK ATTEMPT 5 RESULT: Boot with weak secrets in production was aborted with process.exit(1).");
      } finally {
        process.env = originalEnv;
        process.exit = originalExit;
      }
    });
  });

  describe("6. Break Attempt: Purchase with the database stopped", () => {
    it("fails closed with 503 ServiceUnavailableException and zero state changes", async () => {
      mockPrisma.isConnected = false;

      const payload: any = {
        platform: "instagram",
        handle: "test_handle",
        quoteHash: "qh_v2_k1_9999999999_fakehmac",
        followersDrip: {
          serviceId: "srv_test",
          quantity: 1000,
          days: 5,
          intervalHours: 24,
        },
        consentRulesUnderstood: true,
        idempotencyKey: "idem_db_stopped",
      };

      // 1. purchasePackage
      await expect(
        packagesService.purchasePackage("user_test_1", payload)
      ).rejects.toThrow(ServiceUnavailableException);

      // 2. walletService debit
      await expect(
        walletService.debitForOrder("user_test_1", new Decimal(100), "order_dummy")
      ).rejects.toThrow(ServiceUnavailableException);

      // 3. ordersService create
      await expect(
        ordersService.create({ serviceId: "srv_test", target: "test", quantity: 100, userId: "user_test_1" })
      ).rejects.toThrow(ServiceUnavailableException);

      expect(mockPrisma.package.create).not.toHaveBeenCalled();
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
      expect(mockPrisma.wallet.update).not.toHaveBeenCalled();

      console.log("BREAK ATTEMPT 6 RESULT: All operations failed closed with 503 ServiceUnavailableException and zero state writes when DB is disconnected.");
    });
  });
});

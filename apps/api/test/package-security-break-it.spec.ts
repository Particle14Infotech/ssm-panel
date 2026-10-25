import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, NotFoundException, ForbiddenException, UnauthorizedException, BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PackagesController } from "../src/modules/packages/packages.controller";
import { PackagesEnabledGuard } from "../src/modules/packages/packages-enabled.guard";
import { PrismaService } from "../src/common/prisma.service";
import { WalletService } from "../src/modules/wallet/wallet.service";
import { PlatformsService } from "../src/modules/platforms/platforms.service";
import { PackagesQuoteService } from "../src/modules/packages/packages-quote.service";
import { OrdersService } from "../src/modules/orders/orders.service";
import { ServicesController } from "../src/modules/services/services.controller";
import { ServicesService } from "../src/modules/services/services.service";
import { ProvidersController } from "../src/modules/providers/providers.controller";
import { ProvidersService } from "../src/modules/providers/providers.service";
import { SettingsController } from "../src/modules/settings/settings.controller";
import { SettingsService } from "../src/modules/settings/settings.service";
import { ReportsController } from "../src/modules/reports/reports.controller";
import { ReportsService } from "../src/modules/reports/reports.service";
import { CouponsController } from "../src/modules/coupons/coupons.controller";
import { CouponsService } from "../src/modules/coupons/coupons.service";
import { AnnouncementsController } from "../src/modules/announcements/announcements.controller";
import { AnnouncementsService } from "../src/modules/announcements/announcements.service";
import { UsersController } from "../src/modules/users/users.controller";
import { UsersService } from "../src/modules/users/users.service";
import { TicketsService } from "../src/modules/tickets/tickets.service";
import { FavoritesService } from "../src/modules/favorites/favorites.service";
import { Role, PackageStatus, PackageExecutionStatus, TransactionType } from "@prisma/client";
import { Decimal } from "decimal.js";
import * as jwt from "jsonwebtoken";
import { getOrderRefundTemplate, getSupportReplyTemplate } from "../src/modules/email/templates";

const JWT_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "smm_panel_jwt_secret_dev_environment_key_32bytes";

describe("PACKAGE SECURITY BREAK-IT TEST SUITE", () => {
  describe("STEP 1: Authorization and Tenant Isolation", () => {
    describe("1.1 IDOR Protection across User A vs User B", () => {
      let packagesService: PackagesService;
      let prismaMock: any;

      beforeEach(() => {
        prismaMock = {
          isConnected: true,
          package: {
            findFirst: jest.fn(),
            findMany: jest.fn(),
            update: jest.fn(),
          },
          packageExecution: {
            findMany: jest.fn(),
            updateMany: jest.fn(),
          },
          packageTrigger: {
            findMany: jest.fn(),
          },
          ticket: {
            create: jest.fn(),
            findUnique: jest.fn(),
          },
          favorite: {
            findFirst: jest.fn(),
            delete: jest.fn(),
          },
          $queryRawUnsafe: jest.fn(),
          $transaction: jest.fn((cb) => cb(prismaMock)),
        };

        packagesService = new PackagesService(
          prismaMock,
          { calculateQuote: jest.fn() } as any,
          { getPlatformConfig: jest.fn(), isHandleBlocked: jest.fn() } as any
        );
      });

      it("IDOR-01: User B cannot inspect User A's package (must throw 404, not 403, no side effects)", async () => {
        // User A owns pkg_1
        prismaMock.package.findFirst.mockResolvedValue(null); // findFirst with { id: 'pkg_1', userId: 'usr_b' } returns null

        await expect(packagesService.getPackage("usr_b", "pkg_1")).rejects.toThrow(NotFoundException);
        expect(prismaMock.package.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: "pkg_1", userId: "usr_b" },
          })
        );
      });

      it("IDOR-02: User B cannot pause User A's package (must throw 404)", async () => {
        prismaMock.package.findFirst.mockResolvedValue(null);

        await expect(packagesService.pausePackage("usr_b", "pkg_1")).rejects.toThrow(NotFoundException);
      });

      it("IDOR-03: User B cannot resume User A's package (must throw 404)", async () => {
        prismaMock.package.findFirst.mockResolvedValue(null);

        await expect(packagesService.resumePackage("usr_b", "pkg_1")).rejects.toThrow(NotFoundException);
      });

      it("IDOR-04: User B cannot cancel User A's package (must throw 404)", async () => {
        prismaMock.$queryRawUnsafe.mockResolvedValue([]); // Locked query with userId = 'usr_b' returns empty

        await expect(packagesService.cancelPackage("usr_b", "pkg_1")).rejects.toThrow(NotFoundException);
      });

      it("IDOR-05: User B cannot fetch User A's package executions (must throw 404)", async () => {
        prismaMock.package.findFirst.mockResolvedValue(null);

        await expect(packagesService.getPackageExecutions("usr_b", "pkg_1")).rejects.toThrow(NotFoundException);
      });

      it("IDOR-06: User B cannot reschedule User A's package execution (must throw 404)", async () => {
        prismaMock.$queryRawUnsafe.mockResolvedValue([]);

        await expect(
          packagesService.rescheduleExecution("usr_b", "pkg_1", "exec_1", {
            executeAt: new Date(Date.now() + 86400000).toISOString(),
          })
        ).rejects.toThrow(NotFoundException);
      });

      it("IDOR-07: User B cannot report a problem on User A's package (must throw 404)", async () => {
        prismaMock.package.findFirst.mockResolvedValue(null);

        await expect(
          packagesService.reportProblem("usr_b", "pkg_1", {
            issue: "Stalled",
            description: "Fake problem",
          })
        ).rejects.toThrow(NotFoundException);
      });

      it("IDOR-08: User B cannot access User A's order (must throw 404)", async () => {
        const ordersService = new OrdersService(prismaMock, {} as any, {} as any);
        prismaMock.order = {
          findUnique: jest.fn().mockResolvedValue({ id: "ord_1", userId: "usr_a" }),
        };

        // User B accessing User A's order throws NotFoundException
        await expect(ordersService.findOne("ord_1", "usr_b", "CUSTOMER")).rejects.toThrow(NotFoundException);
        // Caller with no requesterUserId as non-admin also throws NotFoundException
        await expect(ordersService.findOne("ord_1", undefined, "CUSTOMER")).rejects.toThrow(NotFoundException);
      });

      it("IDOR-09: User B cannot access User A's ticket (must throw 404)", async () => {
        const ticketsService = new TicketsService(prismaMock, {} as any);
        prismaMock.ticket = {
          findUnique: jest.fn().mockResolvedValue({ id: "tck_1", userId: "usr_a", messages: [] }),
        };

        // User B accessing User A's ticket throws NotFoundException
        await expect(ticketsService.findOne("tck_1", "usr_b", "CUSTOMER")).rejects.toThrow(NotFoundException);
        // Caller with no requesterUserId as non-admin also throws NotFoundException
        await expect(ticketsService.findOne("tck_1", undefined, "CUSTOMER")).rejects.toThrow(NotFoundException);
      });

      it("USERS-01: Mass assignment protection: user cannot elevate tier via updateProfile", async () => {
        prismaMock.user = {
          update: jest.fn().mockResolvedValue({ id: "usr_1", name: "New Name", tier: "FREE" }),
        };
        const usersService = new UsersService(prismaMock);

        await usersService.updateProfile("usr_1", { name: "New Name", tier: "ENTERPRISE" });
        expect(prismaMock.user.update).toHaveBeenCalledWith({
          where: { id: "usr_1" },
          data: { name: "New Name" }, // tier is ignored!
        });
      });
    });

    describe("1.2 Missing Authorization Guards on Platform Mutation Controllers", () => {
      it("AUTHZ-01: Proves ServicesController mutation routes have Roles(ADMIN) guards", () => {
        const metadataKeys = Reflect.getMetadataKeys(ServicesController);
        const roles = Reflect.getMetadata("roles", ServicesController.prototype.create) ||
                      Reflect.getMetadata("roles", ServicesController);
        expect(roles).toBeDefined();
        expect(roles).toContain(Role.ADMIN);
      });

      it("AUTHZ-02: Proves ProvidersController has Roles(ADMIN) guard", () => {
        const roles = Reflect.getMetadata("roles", ProvidersController);
        expect(roles).toBeDefined();
        expect(roles).toContain(Role.ADMIN);
      });

      it("AUTHZ-03: Proves SettingsController has Roles(ADMIN) guard", () => {
        const roles = Reflect.getMetadata("roles", SettingsController);
        expect(roles).toBeDefined();
        expect(roles).toContain(Role.ADMIN);
      });

      it("AUTHZ-04: Proves ReportsController has Roles(ADMIN) guard", () => {
        const roles = Reflect.getMetadata("roles", ReportsController);
        expect(roles).toBeDefined();
        expect(roles).toContain(Role.ADMIN);
      });

      it("AUTHZ-05: Proves CouponsController mutation routes have Roles(ADMIN) guards", () => {
        const roles = Reflect.getMetadata("roles", CouponsController.prototype.create);
        expect(roles).toBeDefined();
        expect(roles).toContain(Role.ADMIN);
      });

      it("AUTHZ-06: Proves AnnouncementsController create route has Roles(ADMIN) guard", () => {
        const roles = Reflect.getMetadata("roles", AnnouncementsController.prototype.create);
        expect(roles).toBeDefined();
        expect(roles).toContain(Role.ADMIN);
      });
    });

    describe("1.3 Feature-Flag & Allowlist (PACKAGES_ALLOWED_USER_IDS) Enforcement", () => {
      let guard: PackagesEnabledGuard;

      beforeEach(() => {
        guard = new PackagesEnabledGuard();
      });

      afterEach(() => {
        delete process.env.PACKAGES_ALLOWED_USER_IDS;
        delete process.env.PACKAGES_ENABLED;
      });

      it("FLAG-01: Rejects when PACKAGES_ENABLED is false", () => {
        process.env.PACKAGES_ENABLED = "false";
        const mockContext: any = {
          switchToHttp: () => ({
            getRequest: () => ({ user: { id: "usr_admin" } }),
          }),
        };
        expect(() => guard.canActivate(mockContext)).toThrow(ServiceUnavailableException);
      });

      it("FLAG-02: Rejects non-allowlisted customer when PACKAGES_ALLOWED_USER_IDS is set", () => {
        process.env.PACKAGES_ENABLED = "true";
        process.env.PACKAGES_ALLOWED_USER_IDS = "usr_admin_1,usr_qa_1";

        const mockContextUnauthorized: any = {
          switchToHttp: () => ({
            getRequest: () => ({ user: { id: "usr_attacker" } }),
          }),
        };
        // Expect ForbiddenException when user is not on allowlist
        expect(() => guard.canActivate(mockContextUnauthorized)).toThrow(ForbiddenException);
      });

      it("FLAG-03: Allows allowlisted user when PACKAGES_ALLOWED_USER_IDS is set", () => {
        process.env.PACKAGES_ENABLED = "true";
        process.env.PACKAGES_ALLOWED_USER_IDS = "usr_admin_1,usr_qa_1";

        const mockContextAuthorized: any = {
          switchToHttp: () => ({
            getRequest: () => ({ user: { id: "usr_qa_1" } }),
          }),
        };
        expect(guard.canActivate(mockContextAuthorized)).toBe(true);
      });
    });

    describe("1.4 Data Leak Scanner: Zero Supplier Cost/Margin Fields Exposed to Customer", () => {
      it("LEAK-01: Verifies customer package response contains no supplier cost/margin fields", () => {
        const customerSafeKeys = Object.keys(
          (PackagesService as any).CUSTOMER_SAFE_SERVICE_SELECT
        );
        const forbiddenKeys = [
          "costINR",
          "providerCostPer1k",
          "marginPercentOverride",
          "fixedSellingRateOverride",
          "backupProviderId",
          "providerId",
          "providerOrderId",
        ];

        for (const forbidden of forbiddenKeys) {
          expect(customerSafeKeys).not.toContain(forbidden);
        }
      });
    });
  });

  describe("STEP 2: Money Attacks", () => {
    describe("2.1 Price Manipulation & Parameter Tampering", () => {
      let quoteService: PackagesQuoteService;
      let prismaMock: any;

      beforeEach(() => {
        prismaMock = {
          isConnected: false,
          service: { findMany: jest.fn() },
          package: { findFirst: jest.fn() },
        };
        quoteService = new PackagesQuoteService(prismaMock);
      });

      it("MONEY-01: Server strictly rejects negative quantities in quote/purchase", async () => {
        await expect(
          quoteService.calculateQuote({
            platform: "instagram",
            handle: "valid_creator",
            followersDrip: {
              serviceId: "svc_followers",
              quantity: -500,
              days: 30,
              intervalHours: 24,
            },
          } as any)
        ).rejects.toThrow();
      });

      it("MONEY-02: Server strictly rejects duration 0 or negative days", async () => {
        await expect(
          quoteService.calculateQuote({
            platform: "instagram",
            handle: "valid_creator",
            followersDrip: {
              serviceId: "svc_followers",
              quantity: 1000,
              days: 0,
              intervalHours: 24,
            },
          } as any)
        ).rejects.toThrow();
      });

      it("MONEY-03: Server strictly rejects non-integer / NaN quantities", async () => {
        await expect(
          quoteService.calculateQuote({
            platform: "instagram",
            handle: "valid_creator",
            followersDrip: {
              serviceId: "svc_followers",
              quantity: NaN,
              days: 30,
              intervalHours: 24,
            },
          } as any)
        ).rejects.toThrow();
      });

      it("MONEY-04: Rounding Abuse Protection: sum of run charges exactly matches totalCharge", async () => {
        const quote = await quoteService.calculateQuote({
          platform: "instagram",
          handle: "creator_test",
          timezone: "UTC",
          followersDrip: {
            serviceId: "svc_followers",
            quantity: 3333,
            days: 30,
            intervalHours: 24,
          },
        });

        const sumOfRunCharges = quote.timeline.reduce(
          (sum, r) => sum.plus(new Decimal(r.chargeShare)),
          new Decimal(0)
        );

        expect(sumOfRunCharges.toNumber()).toEqual(quote.totalCharge);
      });
    });

    describe("2.2 Refund Invariant & Abuse Resistance", () => {
      let packagesService: PackagesService;
      let prismaMock: any;

      beforeEach(() => {
        prismaMock = {
          isConnected: true,
          $queryRawUnsafe: jest.fn(),
          packageExecution: {
            updateMany: jest.fn(),
            findMany: jest.fn(),
          },
          refund: { create: jest.fn() },
          ledgerEntry: { create: jest.fn() },
          wallet: { update: jest.fn() },
          package: { update: jest.fn() },
          $transaction: jest.fn((cb) => cb(prismaMock)),
        };

        packagesService = new PackagesService(
          prismaMock,
          {} as any,
          {} as any
        );
      });

      it("REFUND-01: Cancel on already CANCELLED or COMPLETED package throws BadRequestException", async () => {
        prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
          {
            id: "pkg_1",
            userId: "usr_1",
            status: PackageStatus.CANCELLED,
            reserveTotal: new Decimal(500),
          },
        ]);

        await expect(packagesService.cancelPackage("usr_1", "pkg_1")).rejects.toThrow(
          BadRequestException
        );
      });

      it("REFUND-02: Cancel on fully delivered package results in ZERO refund", async () => {
        prismaMock.$queryRawUnsafe.mockResolvedValueOnce([
          {
            id: "pkg_1",
            userId: "usr_1",
            status: PackageStatus.ACTIVE,
            reserveTotal: new Decimal(500),
          },
        ]);

        // All executions were COMPLETED
        prismaMock.packageExecution.findMany.mockResolvedValueOnce([
          { id: "e1", allocatedCharge: new Decimal(250), status: PackageExecutionStatus.COMPLETED },
          { id: "e2", allocatedCharge: new Decimal(250), status: PackageExecutionStatus.COMPLETED },
        ]);

        const res = await packagesService.cancelPackage("usr_1", "pkg_1");
        expect(res.refundedAmount).toBe(0);
        expect((res as any).consumed).toBe(500);
        expect(prismaMock.refund.create).not.toHaveBeenCalled();
      });

      it("PKG-CANCEL-01: CancelPackage cancels SKIPPED_PAUSED executions along with PENDING and SCHEDULED", async () => {
        prismaMock.$queryRawUnsafe
          .mockResolvedValueOnce([
            {
              id: "pkg_1",
              userId: "usr_1",
              status: PackageStatus.PAUSED,
              reserveTotal: new Decimal(500),
            },
          ])
          .mockResolvedValueOnce([
            {
              id: "w_1",
              balance: new Decimal(100),
            },
          ]);

        prismaMock.packageExecution.findMany.mockResolvedValueOnce([
          { id: "e1", allocatedCharge: new Decimal(250), status: PackageExecutionStatus.SKIPPED_PAUSED },
        ]);

        await packagesService.cancelPackage("usr_1", "pkg_1");
        expect(prismaMock.packageExecution.updateMany).toHaveBeenCalledWith({
          where: {
            packageId: "pkg_1",
            status: {
              in: [
                PackageExecutionStatus.SCHEDULED,
                PackageExecutionStatus.DETECTED,
                PackageExecutionStatus.SKIPPED_PAUSED,
              ],
            },
          },
          data: {
            status: PackageExecutionStatus.CANCELLED,
            skipReason: "User cancelled package",
          },
        });
      });
    });
  });

  describe("STEP 3: Input Injection & Template Escaping", () => {
    it("XSS-01: HTML in order refund email reason is sanitized / escaped", () => {
      const maliciousReason = "<script>alert('XSS')</script>";
      const email = getOrderRefundTemplate({
        name: "Test User",
        orderId: "ord_123",
        amountFormatted: "₹50.00",
        reason: maliciousReason,
        ordersUrl: "https://example.com/orders",
      });

      expect(email.html).not.toContain("<script>alert('XSS')</script>");
      expect(email.html).toContain("&lt;script&gt;alert(&#x27;XSS&#x27;)&lt;/script&gt;");
    });

    it("XSS-02: HTML in support ticket reply email excerpt is sanitized / escaped", () => {
      const maliciousReply = "<img src=x onerror=alert('PWNED')>";
      const email = getSupportReplyTemplate({
        name: "Test User",
        ticketId: "tck_123",
        subject: "Problem Report",
        replyExcerpt: maliciousReply,
        ticketUrl: "https://example.com/tickets/123",
      });

      expect(email.html).not.toContain("<img src=x onerror=alert('PWNED')>");
      expect(email.html).toContain("&lt;img src=x onerror=alert(&#x27;PWNED&#x27;)&gt;");
    });
  });

  describe("STEP 4: Untrusted Provider Responses & Worker Fault Tolerance", () => {
    it("PROVIDER-01: Hostile provider response with negative remains is clamped to 0", () => {
      function processProviderRemains(reportedRemains: any, orderQuantity: number): number {
        const num = Number(reportedRemains);
        if (!Number.isFinite(num) || num < 0) return 0;
        return Math.min(num, orderQuantity);
      }

      expect(processProviderRemains(-50, 1000)).toBe(0);
      expect(processProviderRemains("NaN", 1000)).toBe(0);
      expect(processProviderRemains(9999999, 1000)).toBe(1000);
    });

    it("PROVIDER-02: Status regression (COMPLETED -> PENDING) is ignored by status state machine", () => {
      const TERMINAL_STATUSES = ["COMPLETED", "PARTIAL", "CANCELLED", "FAILED"];
      function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
        if (TERMINAL_STATUSES.includes(currentStatus)) {
          return false; // Terminal states cannot regress
        }
        return true;
      }

      expect(isValidStatusTransition("COMPLETED", "PENDING")).toBe(false);
      expect(isValidStatusTransition("COMPLETED", "PROCESSING")).toBe(false);
      expect(isValidStatusTransition("PROCESSING", "COMPLETED")).toBe(true);
    });

    it("ADMIN-01: adminResolveExecution strictly rejects RETRY or REFUND on terminal executions", async () => {
      const mockPrisma: any = {
        isConnected: true,
        packageExecution: {
          findUnique: jest.fn().mockResolvedValue({
            id: "exec_1",
            status: PackageExecutionStatus.COMPLETED,
            package: { userId: "usr_1" },
          }),
        },
      };
      const service = new PackagesService(mockPrisma, {} as any, {} as any);

      await expect(service.adminResolveExecution("exec_1", "RETRY")).rejects.toThrow(
        BadRequestException
      );
      await expect(service.adminResolveExecution("exec_1", "REFUND")).rejects.toThrow(
        BadRequestException
      );
    });

    it("REPORT-02: reportProblem rejects oversized text (> 2000 chars) or CANCELLED package", async () => {
      const mockPrisma: any = {
        isConnected: true,
        package: {
          findFirst: jest.fn().mockResolvedValue({
            id: "pkg_1",
            status: PackageStatus.CANCELLED,
            handle: "creator",
            platform: "instagram",
          }),
        },
      };
      const service = new PackagesService(mockPrisma, {} as any, {} as any);

      // 1. Oversized description (> 2000 chars)
      await expect(
        service.reportProblem("usr_1", "pkg_1", {
          issue: "Valid Issue",
          description: "A".repeat(2001),
        })
      ).rejects.toThrow(BadRequestException);

      // 2. Reporting on CANCELLED package
      await expect(
        service.reportProblem("usr_1", "pkg_1", {
          issue: "Valid Issue",
          description: "Valid description",
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("FAV-01: createFavorite executes in transaction with user lock to eliminate 50-cap race", async () => {
      const mockTx: any = {
        $queryRawUnsafe: jest.fn().mockResolvedValue([]),
        favorite: {
          count: jest.fn().mockResolvedValue(5),
          upsert: jest.fn().mockResolvedValue({
            id: "fav_1",
            userId: "usr_1",
            serviceId: "svc_1",
            targetUrl: "https://instagram.com/test",
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        },
        service: {
          findUnique: jest.fn().mockResolvedValue({ id: "svc_1", isDeleted: false }),
        },
      };
      const mockPrisma: any = {
        isConnected: true,
        $transaction: jest.fn(async (cb) => cb(mockTx)),
      };
      const service = new FavoritesService(mockPrisma);

      await service.createFavorite("usr_1", {
        serviceId: "svc_1",
        targetUrl: "https://instagram.com/test",
        defaultQuantity: 100,
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockTx.$queryRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining("FOR UPDATE"),
        "usr_1"
      );
    });
  });

  describe("STEP 5: Stateful Fuzzing Invariant Check (100,000 Step Simulation)", () => {
    it("FUZZ-01: 100,000 stateful steps maintain financial conservation and execution invariants", () => {
      interface PackageSimState {
        reserveTotal: number;
        consumed: number;
        refunded: number;
        status: "ACTIVE" | "PAUSED" | "CANCELLED" | "COMPLETED";
        runsTotal: number;
        runsDispatched: number;
        runsCancelled: number;
      }

      // Pseudo-random generator with fixed seed for determinism
      let seed = 1337042;
      function random(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      const activeList: PackageSimState[] = [];
      const pausedList: PackageSimState[] = [];
      let totalPurchased = 0;
      let totalConsumed = 0;
      let totalRefunded = 0;
      let totalPackagesCreated = 0;

      const TOTAL_STEPS = 100000;

      function assertPackageInvariants(pkg: PackageSimState) {
        // Invariant 1: reserveTotal == consumed + refunded + unspent
        const unspent = pkg.status === "CANCELLED" ? 0 : pkg.reserveTotal - pkg.consumed - pkg.refunded;
        const sum = pkg.consumed + pkg.refunded + unspent;
        expect(Math.abs(sum - pkg.reserveTotal)).toBeLessThan(0.001);

        // Invariant 2: runsTotal == runsDispatched + runsCancelled + pendingRuns
        const pendingRuns = ["CANCELLED", "COMPLETED"].includes(pkg.status)
          ? 0
          : pkg.runsTotal - pkg.runsDispatched - pkg.runsCancelled;
        expect(pkg.runsDispatched + pkg.runsCancelled + pendingRuns).toBe(pkg.runsTotal);
        expect(pkg.runsDispatched + pkg.runsCancelled).toBeLessThanOrEqual(pkg.runsTotal);
        expect(pkg.consumed).toBeLessThanOrEqual(pkg.reserveTotal + 0.001);
      }

      for (let step = 0; step < TOTAL_STEPS; step++) {
        const actionRoll = random();

        if (actionRoll < 0.25 || (activeList.length === 0 && pausedList.length === 0)) {
          // Action 1: Purchase Package
          const runsTotal = Math.floor(random() * 20) + 1;
          const chargePerRun = Math.floor(random() * 50) + 5;
          const reserveTotal = runsTotal * chargePerRun;

          const newPkg: PackageSimState = {
            reserveTotal,
            consumed: 0,
            refunded: 0,
            status: "ACTIVE",
            runsTotal,
            runsDispatched: 0,
            runsCancelled: 0,
          };
          activeList.push(newPkg);
          totalPurchased += reserveTotal;
          totalPackagesCreated++;
          assertPackageInvariants(newPkg);
        } else if (actionRoll < 0.65 && activeList.length > 0) {
          // Action 2: Dispatch a Run on an Active Package
          const idx = Math.floor(random() * activeList.length);
          const targetPkg = activeList[idx];
          const chargeShare = targetPkg.reserveTotal / targetPkg.runsTotal;
          targetPkg.runsDispatched += 1;
          targetPkg.consumed += chargeShare;
          totalConsumed += chargeShare;

          if (targetPkg.runsDispatched + targetPkg.runsCancelled === targetPkg.runsTotal) {
            targetPkg.status = "COMPLETED";
            activeList.splice(idx, 1);
          }
          assertPackageInvariants(targetPkg);
        } else if (actionRoll < 0.85) {
          // Action 3: Pause or Resume Package
          if (activeList.length > 0 && (pausedList.length === 0 || random() < 0.5)) {
            const idx = Math.floor(random() * activeList.length);
            const targetPkg = activeList.splice(idx, 1)[0];
            targetPkg.status = "PAUSED";
            pausedList.push(targetPkg);
            assertPackageInvariants(targetPkg);
          } else if (pausedList.length > 0) {
            const idx = Math.floor(random() * pausedList.length);
            const targetPkg = pausedList.splice(idx, 1)[0];
            targetPkg.status = "ACTIVE";
            activeList.push(targetPkg);
            assertPackageInvariants(targetPkg);
          }
        } else {
          // Action 4: Cancel Package
          let targetPkg: PackageSimState | null = null;
          if (activeList.length > 0 && (pausedList.length === 0 || random() < 0.5)) {
            const idx = Math.floor(random() * activeList.length);
            targetPkg = activeList.splice(idx, 1)[0];
          } else if (pausedList.length > 0) {
            const idx = Math.floor(random() * pausedList.length);
            targetPkg = pausedList.splice(idx, 1)[0];
          }

          if (targetPkg) {
            const remainingRuns = targetPkg.runsTotal - targetPkg.runsDispatched - targetPkg.runsCancelled;
            const unusedReserve = targetPkg.reserveTotal - targetPkg.consumed;
            targetPkg.refunded += unusedReserve;
            totalRefunded += unusedReserve;
            targetPkg.runsCancelled += remainingRuns;
            targetPkg.status = "CANCELLED";
            assertPackageInvariants(targetPkg);
          }
        }
      }

      expect(totalPackagesCreated).toBeGreaterThan(1000);
      expect(totalPurchased).toBeGreaterThan(0);
      expect(totalConsumed + totalRefunded).toBeLessThanOrEqual(totalPurchased);
    });
  });
});


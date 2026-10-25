import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { PackagesService } from "../src/modules/packages/packages.service";
import {
  DEFAULT_PLATFORM_CONFIGS,
  validatePlatformLink,
} from "../src/modules/platforms/platform-rules.util";
import Decimal from "decimal.js";

describe("Phase F3: Presets, Retainers, Failover & Extended Platforms", () => {
  let packagesService: PackagesService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      isConnected: true,
      $transaction: jest.fn(async (callback: any) => callback(mockPrisma)),
      package: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      packageRule: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      packageExecution: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      service: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      wallet: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      ledgerEntry: {
        create: jest.fn(),
      },
      ticket: {
        create: jest.fn(),
      },
      ticketMessage: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    packagesService = new PackagesService(mockPrisma as any, {} as any, {} as any);
  });

  describe("1. Preset Package Bundles (F3.1)", () => {
    it("returns active admin preset bundle templates with rules and duration", () => {
      const templates = packagesService.getBundleTemplates();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);

      const starter = templates.find((t) => t.id === "bundle_starter_ig");
      expect(starter).toBeDefined();
      expect(starter?.platform).toBe("instagram");
      expect(starter?.rules.length).toBeGreaterThan(0);
      expect(starter?.discountPercent).toBeGreaterThanOrEqual(0);
    });

    it("purchases a preset bundle template and creates package with bundle rules", async () => {
      mockPrisma.wallet.findUnique.mockResolvedValue({
        id: "wallet-1",
        userId: "user-1",
        balance: new Decimal(5000),
      });

      mockPrisma.package.create.mockResolvedValue({
        id: "pkg-bundle-1",
        userId: "user-1",
        platform: "instagram",
        handle: "creator_test",
        status: "ACTIVE",
        reserveTotal: new Decimal(2500),
      });

      mockPrisma.packageRule.create.mockResolvedValue({
        id: "rule-bundle-1",
        packageId: "pkg-bundle-1",
      });

      const res = await packagesService.purchaseBundle("user-1", {
        templateId: "bundle_starter_ig",
        handle: "creator_test",
        idempotencyKey: "idem_bundle_101",
      });

      expect(res.packageId).toBe("pkg-bundle-1");
      expect(mockPrisma.package.create).toHaveBeenCalled();
    });
  });

  describe("2. Monthly Retainer Auto-Renew (F3.2)", () => {
    it("refuses auto-renew when customer has not provided explicit consent", async () => {
      mockPrisma.package.findUnique.mockResolvedValue({
        id: "pkg-retainer-1",
        userId: "user-1",
        autoRenew: false,
        status: "ACTIVE",
        reserveTotal: new Decimal(1000),
      });

      await expect(
        packagesService.renewPackage("user-1", "pkg-retainer-1", { explicitConsent: false })
      ).rejects.toThrow(ForbiddenException);
    });

    it("aborts renewal and raises notice when wallet balance is insufficient", async () => {
      mockPrisma.package.findUnique.mockResolvedValue({
        id: "pkg-retainer-2",
        userId: "user-1",
        autoRenew: true,
        status: "ACTIVE",
        reserveTotal: new Decimal(2000),
      });

      mockPrisma.wallet.findUnique.mockResolvedValue({
        id: "wallet-1",
        userId: "user-1",
        balance: new Decimal(500), // Insufficient: 500 < 2000
      });

      const res = await packagesService.renewPackage("user-1", "pkg-retainer-2", {
        explicitConsent: true,
      });

      expect(res.success).toBe(false);
      expect(res.reason).toBe("INSUFFICIENT_BALANCE");
      // Must not deduct wallet
      expect(mockPrisma.wallet.update).not.toHaveBeenCalled();
    });

    it("successfully renews package when consent is explicit and balance is sufficient", async () => {
      mockPrisma.package.findUnique.mockResolvedValue({
        id: "pkg-retainer-3",
        userId: "user-1",
        platform: "instagram",
        handle: "brand_handle",
        autoRenew: true,
        status: "ACTIVE",
        reserveTotal: new Decimal(1500),
        rules: [],
      });

      mockPrisma.wallet.findUnique.mockResolvedValue({
        id: "wallet-1",
        userId: "user-1",
        balance: new Decimal(3000),
      });

      mockPrisma.package.create.mockResolvedValue({
        id: "pkg-renewed-1",
        userId: "user-1",
        renewalOfId: "pkg-retainer-3",
        status: "ACTIVE",
        reserveTotal: new Decimal(1500),
      });

      const res = await packagesService.renewPackage("user-1", "pkg-retainer-3", {
        explicitConsent: true,
      });

      expect(res.success).toBe(true);
      expect(res.newPackageId).toBe("pkg-renewed-1");
      expect(mockPrisma.wallet.update).toHaveBeenCalled();
    });

    it("allows customer to cancel auto-renew consent at any time", async () => {
      mockPrisma.package.findUnique.mockResolvedValue({
        id: "pkg-retainer-4",
        userId: "user-1",
        autoRenew: true,
      });

      mockPrisma.package.update.mockResolvedValue({
        id: "pkg-retainer-4",
        autoRenew: false,
      });

      const res = await packagesService.setAutoRenew("user-1", "pkg-retainer-4", false);
      expect(res.autoRenew).toBe(false);
    });
  });

  describe("3. Multi-Provider Failover & Routing (F3.3)", () => {
    it("sets execution outcome to UNKNOWN on add-order timeout and does not failover immediately", () => {
      const decision = packagesService.handleProviderDispatchTimeout({
        executionId: "exec-failover-1",
        primaryProviderId: "prov-1",
        providerOrderId: null,
      });

      expect(decision.outcome).toBe("UNKNOWN");
      expect(decision.canFailoverImmediately).toBe(false);
      expect(decision.nextAction).toBe("QUERY_PRIMARY_STATUS");
    });

    it("executes failover to backup provider only when primary confirms order failed or missing", async () => {
      const serviceConfig = {
        id: "srv-failover-1",
        backupProviderId: "prov-backup",
        backupProviderServiceId: "srv-backup-101",
        ratePer1000: new Decimal(100),
      };

      const backupService = {
        id: "srv-backup-101",
        minQty: 10,
        maxQty: 10000,
        ratePer1000: new Decimal(80),
        active: true,
      };

      const failoverResult = await packagesService.evaluateFailoverRouting({
        serviceConfig,
        backupService,
        primaryStatusConfirmation: "ORDER_NOT_FOUND",
        quantity: 500,
      });

      expect(failoverResult.approved).toBe(true);
      expect(failoverResult.targetProviderId).toBe("prov-backup");
      expect(failoverResult.targetServiceId).toBe("srv-backup-101");
    });

    it("rejects failover if primary provider status check confirms the order was already placed", async () => {
      const failoverResult = await packagesService.evaluateFailoverRouting({
        serviceConfig: { id: "srv-1", backupProviderId: "prov-backup" },
        backupService: { id: "srv-backup-101", minQty: 10, maxQty: 10000 },
        primaryStatusConfirmation: "CONFIRMED_PLACED",
        quantity: 500,
      });

      expect(failoverResult.approved).toBe(false);
      expect(failoverResult.reason).toBe("PRIMARY_ORDER_EXISTS");
    });
  });

  describe("4. Extended Platform Configs: LinkedIn & Spotify (F3.4)", () => {
    it("includes linkedin and spotify platform definitions in DEFAULT_PLATFORM_CONFIGS", () => {
      const linkedin = DEFAULT_PLATFORM_CONFIGS.find((p) => p.platform === "linkedin");
      const spotify = DEFAULT_PLATFORM_CONFIGS.find((p) => p.platform === "spotify");

      expect(linkedin).toBeDefined();
      expect(spotify).toBeDefined();
      expect(linkedin?.hostAllowlist).toContain("linkedin.com");
      expect(spotify?.hostAllowlist).toContain("open.spotify.com");
    });

    it("validates legitimate LinkedIn post URLs and extracts media key", () => {
      const linkedinConfig = DEFAULT_PLATFORM_CONFIGS.find((p) => p.platform === "linkedin")!;
      const validUrl = "https://www.linkedin.com/feed/update/urn:li:activity:7123456789012345678/";
      const result = validatePlatformLink(validUrl, linkedinConfig);
      expect(result.isValid).toBe(true);
      expect(result.mediaKey).toBe("7123456789012345678");
    });

    it("validates legitimate Spotify track URLs and extracts media key", () => {
      const spotifyConfig = DEFAULT_PLATFORM_CONFIGS.find((p) => p.platform === "spotify")!;
      const validUrl = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT";
      const result = validatePlatformLink(validUrl, spotifyConfig);
      expect(result.isValid).toBe(true);
      expect(result.mediaKey).toBe("4cOdK2wGLETKBW3PvgPWqT");
    });

    it("rejects invalid Spotify URLs pointing to unsupported paths", () => {
      const spotifyConfig = DEFAULT_PLATFORM_CONFIGS.find((p) => p.platform === "spotify")!;
      const invalidUrl = "https://open.spotify.com/unsupported/12345";
      expect(() => validatePlatformLink(invalidUrl, spotifyConfig)).toThrow(BadRequestException);
    });
  });
});

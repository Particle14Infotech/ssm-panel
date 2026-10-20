import { PackagesController } from "../src/modules/packages/packages.controller";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PackagesQuoteService } from "../src/modules/packages/packages-quote.service";
import { ConnectionsController } from "../src/modules/instagram/instagram.controller";
import { InstagramService } from "../src/modules/instagram/instagram.service";
import { SettingsController } from "../src/modules/settings/settings.controller";
import { SettingsService } from "../src/modules/settings/settings.service";
import { BadRequestException, NotFoundException, ForbiddenException } from "@nestjs/common";
import { mockInstagramServer } from "../src/modules/instagram/mock-instagram";

describe("PACKAGE ENGINE: Complete API Surface Verification", () => {
  let packagesController: PackagesController;
  let packagesService: PackagesService;
  let quoteService: PackagesQuoteService;
  let connectionsController: ConnectionsController;
  let instagramService: InstagramService;
  let settingsController: SettingsController;
  let settingsService: SettingsService;

  const mockPrisma = { isConnected: false } as any;

  const testUserA = { id: "user_api_alice", email: "alice@test.com", role: "CUSTOMER" };
  const testUserB = { id: "user_api_bob", email: "bob@test.com", role: "CUSTOMER" };

  beforeAll(() => {
    quoteService = new PackagesQuoteService(mockPrisma);
    instagramService = new InstagramService(mockPrisma);
    packagesService = new PackagesService(mockPrisma, quoteService, instagramService);
    packagesController = new PackagesController(packagesService);
    connectionsController = new ConnectionsController(instagramService);
    settingsService = new SettingsService();
    settingsController = new SettingsController(settingsService);
  });

  beforeEach(() => {
    mockInstagramServer.reset();
  });

  describe("1. POST /packages/quote", () => {
    it("returns pure calculated quote with timeline, items, and warnings", async () => {
      const quote = await packagesController.getQuote({
        durationDays: 14,
        rules: [
          {
            kind: "POST_TRIGGERED",
            serviceId: "srv-views",
            quantityPerPost: 500,
            maxPosts: 10,
            delayMinutes: 5,
          },
          {
            kind: "TIME_DRIP",
            serviceId: "srv-followers",
            totalQuantity: 1400,
          },
        ],
      });

      expect(quote.valid).toBe(true);
      expect(quote.totalCharge).toBeGreaterThan(0);
      expect(quote.items.length).toBe(2);
      expect(quote.timeline.length).toBeGreaterThanOrEqual(1);
    });

    it("rejects invalid quote payload (missing rules/items)", async () => {
      await expect(packagesController.getQuote({})).rejects.toThrow(BadRequestException);
    });
  });

  describe("2. POST /packages/purchase (and POST /packages)", () => {
    it("purchases package and requires Idempotency-Key", async () => {
      const res = await packagesController.purchasePackage(testUserA as any, {
        durationDays: 30,
        handle: "alice_brand",
        idempotencyKey: "idem_api_test_001",
        consentRulesUnderstood: true,
        rules: [
          {
            kind: "POST_TRIGGERED",
            serviceId: "srv-likes",
            quantityPerPost: 250,
            maxPosts: 8,
          },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.package.id).toBeTruthy();
      expect(res.package.handle).toBe("alice_brand");
      expect(res.package.status).toBe("ACTIVE");
    });

    it("rejects purchase when Idempotency-Key is missing", async () => {
      await expect(
        packagesController.purchasePackage(testUserA as any, {
          durationDays: 30,
          handle: "alice_brand",
          consentRulesUnderstood: true,
          rules: [{ kind: "POST_TRIGGERED", serviceId: "srv-likes", quantityPerPost: 100, maxPosts: 5 }],
        } as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("3. GET /packages & GET /packages/:id", () => {
    let createdPkgId: string;

    beforeAll(async () => {
      const p = await packagesController.purchasePackage(testUserA as any, {
        durationDays: 7,
        handle: "alice_feed",
        idempotencyKey: "idem_pkg_alice_get",
        consentRulesUnderstood: true,
        rules: [{ kind: "TIME_DRIP", serviceId: "srv-followers", totalQuantity: 700 }],
      });
      createdPkgId = p.package.id;
    });

    it("GET /packages lists all packages for user", async () => {
      const list = await packagesController.listPackages(testUserA as any);
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      expect(list.some((pkg: any) => pkg.id === createdPkgId)).toBe(true);
    });

    it("GET /packages/:id returns package detail for owner", async () => {
      const pkg = await packagesController.getPackage(testUserA as any, createdPkgId);
      expect(pkg.id).toBe(createdPkgId);
      expect(pkg.handle).toBe("alice_feed");
    });

    it("GET /packages/:id enforces IDOR isolation (User B cannot read User A's package)", async () => {
      await expect(packagesController.getPackage(testUserB as any, createdPkgId)).rejects.toThrow(NotFoundException);
    });
  });

  describe("4. POST /packages/:id/trigger (Manual Link Trigger)", () => {
    let triggerPkgId: string;

    beforeAll(async () => {
      const p = await packagesController.purchasePackage(testUserA as any, {
        durationDays: 14,
        handle: "alice_trigger",
        idempotencyKey: "idem_pkg_trigger_01",
        consentRulesUnderstood: true,
        rules: [{ kind: "POST_TRIGGERED", serviceId: "srv-likes", quantityPerPost: 500, maxPosts: 10 }],
      });
      triggerPkgId = p.package.id;
    });

    it("accepts official Instagram post/reel link and extracts mediaKey", async () => {
      const res = await packagesController.triggerManualPost(testUserA as any, triggerPkgId, {
        url: "https://www.instagram.com/reel/C89abcdef123/",
        mediaType: "REEL",
      });

      expect(res.success).toBe(true);
      expect(res.mediaKey).toBe("C89abcdef123");
      expect(res.status).toBe("SCHEDULED");
    });

    it("rejects arbitrary external URLs", async () => {
      await expect(
        packagesController.triggerManualPost(testUserA as any, triggerPkgId, {
          url: "https://malicious-site.com/p/123",
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("enforces IDOR: User B cannot trigger User A's package", async () => {
      await expect(
        packagesController.triggerManualPost(testUserB as any, triggerPkgId, {
          url: "https://www.instagram.com/p/DF21abcxyz/",
        })
      ).rejects.toThrow();
    });
  });

  describe("5. POST /packages/:id/pause & POST /packages/:id/resume", () => {
    let statePkgId: string;

    beforeAll(async () => {
      const p = await packagesController.purchasePackage(testUserA as any, {
        durationDays: 10,
        handle: "alice_state",
        idempotencyKey: "idem_pkg_state_01",
        consentRulesUnderstood: true,
        rules: [{ kind: "TIME_DRIP", serviceId: "srv-followers", totalQuantity: 1000 }],
      });
      statePkgId = p.package.id;
    });

    it("pauses active package", async () => {
      const pauseRes = await packagesController.pausePackage(testUserA as any, statePkgId);
      expect(pauseRes.status).toBe("PAUSED");

      const pkg = await packagesController.getPackage(testUserA as any, statePkgId);
      expect(pkg.status).toBe("PAUSED");
    });

    it("resumes paused package", async () => {
      const resumeRes = await packagesController.resumePackage(testUserA as any, statePkgId);
      expect(resumeRes.status).toBe("ACTIVE");

      const pkg = await packagesController.getPackage(testUserA as any, statePkgId);
      expect(pkg.status).toBe("ACTIVE");
    });
  });

  describe("6. POST /packages/:id/cancel", () => {
    it("cancels package and returns unused reserve", async () => {
      const p = await packagesController.purchasePackage(testUserA as any, {
        durationDays: 20,
        handle: "alice_cancel",
        idempotencyKey: "idem_pkg_cancel_01",
        consentRulesUnderstood: true,
        rules: [{ kind: "TIME_DRIP", serviceId: "srv-followers", totalQuantity: 2000 }],
      });

      const cancelRes = await packagesController.cancelPackage(testUserA as any, p.package.id);
      expect(cancelRes.success).toBe(true);

      const pkg = await packagesController.getPackage(testUserA as any, p.package.id);
      expect(pkg.status).toBe("CANCELLED");
    });
  });

  describe("7. Connections API (OAuth, List, Revoke)", () => {
    it("POST /connections/instagram/start returns authorizeUrl and state with 10m TTL", async () => {
      const res = connectionsController.startInstagramConnect(testUserA as any);
      expect(res.authorizeUrl).toContain("instagram.com/oauth/authorize");
      expect(res.state).toContain("user_api_alice");
    });

    it("GET /connections/instagram/callback connects account and rejects replayed state", async () => {
      const start = connectionsController.startInstagramConnect(testUserA as any);
      const code = mockInstagramServer.createTestAuthCode(testUserA.id, {
        id: "ig_acc_api_alice",
        username: "alice_official",
        accountType: "BUSINESS",
      });

      const conn = await connectionsController.handleInstagramCallback(testUserA as any, code, start.state);
      expect(conn.username).toBe("alice_official");
      expect(conn.platformAccountId).toBe("ig_acc_api_alice");

      // Reused state must fail
      await expect(
        connectionsController.handleInstagramCallback(testUserA as any, code, start.state)
      ).rejects.toThrow(BadRequestException);
    });

    it("GET /connections lists active connections without leaking tokenEnc", async () => {
      const list = await connectionsController.listConnections(testUserA as any);
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      expect((list[0] as any).tokenEnc).toBeUndefined();
    });

    it("DELETE /connections/:id revokes connection", async () => {
      const list = await connectionsController.listConnections(testUserA as any);
      const connId = list[0].id;

      const delRes = await connectionsController.deleteConnection(testUserA as any, connId);
      expect(delRes.success).toBe(true);
    });
  });

  describe("8. Settings API (Admin Configuration)", () => {
    it("GET /settings returns package engine configuration defaults", async () => {
      const settings = settingsController.getSettings();
      expect(settings.packagesEnabled).toBe(true);
      expect(settings.packageMaxDurationDays).toBe(90);
      expect(settings.packageMaxPosts).toBe(100);
      expect(settings.packageMaxPerDay).toBe(10);
      expect(settings.packageMinSpacingMin).toBe(15);
      expect(settings.packageMaxPauseDays).toBe(14);
      expect(settings.packageMarginFloor).toBe(0.15);
      expect(typeof settings.sourceInstagramEnabled).toBe("boolean");
    });

    it("PUT /settings updates package engine configuration", async () => {
      const updated = settingsController.updateSettings({
        packageMaxPosts: 150,
        packageMarginFloor: 0.20,
      });
      expect(updated.success).toBe(true);
      expect(updated.settings.packageMaxPosts).toBe(150);
      expect(updated.settings.packageMarginFloor).toBe(0.20);
    });
  });
});

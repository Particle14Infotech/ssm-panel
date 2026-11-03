import { Test, TestingModule } from "@nestjs/testing";
import { FeatureFlagsService, DEFAULT_FEATURE_FLAGS } from "../src/modules/settings/flags.service";
import { NewOrderBootstrapController } from "../src/modules/orders/new-order-bootstrap.controller";
import { PrismaService } from "../src/common/prisma.service";
import { SMMCacheService } from "../src/common/cache.service";
import { ServiceKind } from "@prisma/client";

describe("R2: Expand Schema, Feature Flags, and Bootstrap API", () => {
  let flagsService: FeatureFlagsService;
  let bootstrapController: NewOrderBootstrapController;
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(async () => {
    const memoryStore = new Map<string, any>();
    mockCache = {
      get: jest.fn(async (key: string) => memoryStore.get(key) || null),
      set: jest.fn(async (key: string, val: any) => memoryStore.set(key, val)),
      del: jest.fn(async (key: string) => memoryStore.delete(key)),
      invalidate: jest.fn(async (key: string) => memoryStore.delete(key)),
      invalidatePattern: jest.fn(async () => memoryStore.clear()),
    };

    mockPrisma = {
      isConnected: true,
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ update }) => ({ key: "feature_flags", value: update.value })),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ balance: 2500.50 }),
      },
      platformConfig: {
        findFirst: jest.fn().mockResolvedValue({
          platform: "instagram",
          dripIntervals: [1, 2, 4, 8, 12, 24],
          durationChips: [1, 5, 7, 10, 14, 20, 25, 30],
          enabledTabs: ["SINGLE", "CUSTOM_DRIP", "COMBOS", "AUTOPILOT"],
        }),
      },
      service: {
        findMany: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where?.distinct) {
            return [{ platform: "INSTAGRAM" }, { platform: "YOUTUBE" }];
          }
          return [
            {
              id: "srv_followers_1",
              name: "Instagram Followers HQ",
              displayName: "Instagram Followers HQ",
              categoryId: "cat_1",
              category: { id: "cat_1", name: "Followers", slug: "followers", sortOrder: 1 },
              ratePer1000: 150.00,
              minQty: 50,
              maxQty: 100000,
              kind: ServiceKind.FOLLOWERS,
              geoCountry: "IN",
              geoRegion: "Asia",
              refillable: true,
              cancellable: true,
              dripFeedSupported: true,
              avgTime: "15 mins",
              serviceType: "DEFAULT",
              linkType: "PROFILE",
            },
            {
              id: "srv_followers_mention_leak",
              name: "Instagram Followers + Mentions Scrape",
              displayName: "Instagram Followers with Mentions",
              categoryId: "cat_1",
              category: { id: "cat_1", name: "Followers", slug: "followers", sortOrder: 1 },
              ratePer1000: 500.00,
              minQty: 100,
              maxQty: 50000,
              kind: ServiceKind.FOLLOWERS, // Intentionally test leak filter
              geoCountry: null,
              geoRegion: null,
              refillable: false,
              cancellable: false,
              dripFeedSupported: false,
              avgTime: "1 hour",
              serviceType: "DEFAULT",
              linkType: "PROFILE",
            },
            {
              id: "srv_likes_1",
              name: "Instagram Likes Fast",
              displayName: "Instagram Likes Fast",
              categoryId: "cat_2",
              category: { id: "cat_2", name: "Likes", slug: "likes", sortOrder: 2 },
              ratePer1000: 45.00,
              minQty: 20,
              maxQty: 50000,
              kind: ServiceKind.LIKES,
              geoCountry: null,
              geoRegion: null,
              refillable: false,
              cancellable: false,
              dripFeedSupported: false,
              avgTime: "Instant",
              serviceType: "DEFAULT",
              linkType: "POST_OR_REEL",
            },
          ];
        }),
      },
      packageTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        NewOrderBootstrapController,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SMMCacheService, useValue: mockCache },
      ],
    }).compile();

    flagsService = module.get<FeatureFlagsService>(FeatureFlagsService);
    bootstrapController = module.get<NewOrderBootstrapController>(NewOrderBootstrapController);
  });

  describe("1. Feature Flags Architecture & Safety Rules", () => {
    it("defaults all flags to false (Rule L3)", async () => {
      const isNewOrderV2 = await flagsService.isEnabled("new_order_v2", "usr_normal_123");
      const isCustomDrip = await flagsService.isEnabled("tab_custom_drip", "usr_normal_123");
      const isCombos = await flagsService.isEnabled("tab_combos", "usr_normal_123");
      const isAutopilot = await flagsService.isEnabled("tab_autopilot", "usr_normal_123");

      expect(isNewOrderV2).toBe(false);
      expect(isCustomDrip).toBe(false);
      expect(isCombos).toBe(false);
      expect(isAutopilot).toBe(false);
    });

    it("auto_detect flag is permanently disabled and cannot be activated", async () => {
      await flagsService.updateFlag("auto_detect", { enabled: true, percentage: 100, allowlist: ["usr_admin"] });
      const enabled = await flagsService.isEnabled("auto_detect", "usr_admin", true);
      expect(enabled).toBe(false);
    });

    it("supports allowlist for gradual canary rollout", async () => {
      await flagsService.updateFlag("new_order_v2", {
        enabled: false,
        allowlist: ["usr_admin_1", "usr_beta_tester"],
        percentage: 0,
      });

      expect(await flagsService.isEnabled("new_order_v2", "usr_admin_1")).toBe(true);
      expect(await flagsService.isEnabled("new_order_v2", "usr_beta_tester")).toBe(true);
      expect(await flagsService.isEnabled("new_order_v2", "usr_random_user")).toBe(false);
    });

    it("one-click kill switch immediately disables the flag", async () => {
      await flagsService.updateFlag("tab_combos", {
        enabled: true,
        allowlist: ["usr_tester"],
        percentage: 50,
      });

      await flagsService.killSwitch("tab_combos");

      expect(await flagsService.isEnabled("tab_combos", "usr_tester")).toBe(false);
      expect(await flagsService.isEnabled("tab_combos", "usr_other")).toBe(false);
    });
  });

  describe("2. GET /new-order/bootstrap API", () => {
    it("returns bootstrap payload with balance, duration chips, and categories", async () => {
      const res = await bootstrapController.getBootstrap("INSTAGRAM", { id: "usr_client_1", role: "CUSTOMER" } as any);

      expect(res).toBeDefined();
      expect(res.platform).toBe("INSTAGRAM");
      expect(res.balance).toBe(2500.50);
      expect(res.durationChips).toEqual([1, 5, 7, 10, 14, 20, 25, 30]);
      expect(res.dripOptions.intervals).toEqual([1, 2, 4, 8, 12, 24]);
      expect(res.flags.new_order_v2).toBe(false);
      expect(res.flags.auto_detect).toBe(false);
    });

    it("strictly enforces kind filtering: FOLLOWERS slot never lists mentions or profile visits", async () => {
      const res = await bootstrapController.getBootstrap("INSTAGRAM");

      // Verify followers slot has legitimate followers service
      expect(res.servicesByKind.FOLLOWERS.some((s: any) => s.id === "srv_followers_1")).toBe(true);

      // Verify leaked mention service is filtered OUT of FOLLOWERS and sent to OTHER
      expect(res.servicesByKind.FOLLOWERS.some((s: any) => s.id === "srv_followers_mention_leak")).toBe(false);
      expect(res.servicesByKind.OTHER.some((s: any) => s.id === "srv_followers_mention_leak")).toBe(true);

      // Verify likes slot
      expect(res.servicesByKind.LIKES.some((s: any) => s.id === "srv_likes_1")).toBe(true);
    });

    it("caches response in Redis for 60 seconds", async () => {
      await bootstrapController.getBootstrap("INSTAGRAM", { id: "usr_cache_test" } as any);

      expect(mockCache.set).toHaveBeenCalledWith(
        "new_order:bootstrap:INSTAGRAM:usr_cache_test",
        expect.any(Object),
        { ttlSeconds: 60 }
      );
    });
  });
});

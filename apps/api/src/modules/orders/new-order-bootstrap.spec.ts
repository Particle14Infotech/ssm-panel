import { Test, TestingModule } from "@nestjs/testing";
import { NewOrderBootstrapController } from "./new-order-bootstrap.controller";
import { PrismaService } from "../../common/prisma.service";
import { SMMCacheService } from "../../common/cache.service";
import { FeatureFlagsService } from "../settings/flags.service";
import { ServiceKind } from "@prisma/client";

describe("NewOrderBootstrapController & R2 Invariants", () => {
  let controller: NewOrderBootstrapController;
  let prisma: any;
  let cache: any;
  let flagsService: FeatureFlagsService;

  beforeEach(async () => {
    prisma = {
      isConnected: true,
      wallet: {
        findUnique: jest.fn().mockResolvedValue({ balance: 2500.5 }),
      },
      platformConfig: {
        findFirst: jest.fn().mockResolvedValue({
          platform: "instagram",
          enabledTabs: ["SINGLE", "CUSTOM_DRIP", "COMBOS", "AUTOPILOT"],
          dripIntervals: [1, 2, 4, 8, 12, 24],
          durationChips: [1, 5, 7, 10, 14, 20, 25, 30],
        }),
      },
      service: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "srv-followers-1",
            categoryId: "cat-1",
            category: { id: "cat-1", name: "Instagram Followers", slug: "ig-followers", sortOrder: 1 },
            name: "HQ Real Followers",
            displayName: "Instagram HQ Followers",
            ratePer1000: 120,
            minQty: 50,
            maxQty: 10000,
            kind: ServiceKind.FOLLOWERS,
            geoCountry: null,
            geoRegion: null,
            refillable: true,
            cancellable: false,
            dripFeedSupported: true,
            avgTime: "15 mins",
            serviceType: "DEFAULT",
            linkType: "PROFILE",
          },
          {
            // Dangerous service that should NEVER appear in FOLLOWERS slot
            id: "srv-followers-bad",
            categoryId: "cat-1",
            category: { id: "cat-1", name: "Instagram Followers", slug: "ig-followers", sortOrder: 1 },
            name: "Instagram Profile Visits & Mentions Scrape",
            displayName: "Instagram Profile Visits",
            ratePer1000: 50,
            minQty: 100,
            maxQty: 5000,
            kind: ServiceKind.FOLLOWERS,
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
            id: "srv-likes-1",
            categoryId: "cat-2",
            category: { id: "cat-2", name: "Instagram Likes", slug: "ig-likes", sortOrder: 2 },
            name: "High Speed Post Likes",
            displayName: "Post Likes",
            ratePer1000: 35,
            minQty: 100,
            maxQty: 50000,
            kind: ServiceKind.LIKES,
            geoCountry: "IN",
            geoRegion: "ASIA",
            refillable: true,
            cancellable: true,
            dripFeedSupported: true,
            avgTime: "5 mins",
            serviceType: "DEFAULT",
            linkType: "POST_OR_REEL",
          },
        ]),
      },
      packageTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(true),
      invalidate: jest.fn().mockResolvedValue(true),
      invalidatePattern: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NewOrderBootstrapController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: SMMCacheService, useValue: cache },
        FeatureFlagsService,
      ],
    }).compile();

    controller = module.get<NewOrderBootstrapController>(NewOrderBootstrapController);
    flagsService = module.get<FeatureFlagsService>(FeatureFlagsService);
  });

  it("returns default flags OFF for unauthenticated / regular users", async () => {
    const res = await controller.getBootstrap("INSTAGRAM");

    expect(res.flags).toBeDefined();
    expect(res.flags.new_order_v2).toBe(false);
    expect(res.flags.tab_custom_drip).toBe(false);
    expect(res.flags.tab_combos).toBe(false);
    expect(res.flags.tab_autopilot).toBe(false);
    expect(res.flags.auto_detect).toBe(false);
  });

  it("enforces API-level kind filtering: FOLLOWERS slot can NEVER contain mentions or profile visits", async () => {
    const res = await controller.getBootstrap("INSTAGRAM", { id: "usr-1", email: "user@test.com", role: "CUSTOMER" } as any);

    expect(res.servicesByKind).toBeDefined();
    expect(res.servicesByKind.FOLLOWERS).toHaveLength(1);
    expect(res.servicesByKind.FOLLOWERS[0].id).toBe("srv-followers-1");

    // The service containing "Mentions" or "Profile Visits" must have been diverted to OTHER
    const followerIds = res.servicesByKind.FOLLOWERS.map((s: any) => s.id);
    expect(followerIds).not.toContain("srv-followers-bad");
    expect(res.servicesByKind.OTHER.map((s: any) => s.id)).toContain("srv-followers-bad");
  });

  it("returns wallet balance for authenticated users and 0 for anonymous users", async () => {
    const anonRes = await controller.getBootstrap("INSTAGRAM");
    expect(anonRes.balance).toBe(0);

    const authRes = await controller.getBootstrap("INSTAGRAM", { id: "usr-1", email: "user@test.com", role: "CUSTOMER" } as any);
    expect(authRes.balance).toBe(2500.5);
  });

  it("supports kill switch to immediately disable any feature flag", async () => {
    // 1. Enable flag first
    await flagsService.updateFlag("new_order_v2", { enabled: true, percentage: 100 });
    let resolved = await flagsService.resolveUserFlags("usr-1", false);
    expect(resolved.new_order_v2).toBe(true);

    // 2. Trigger kill switch
    await flagsService.killSwitch("new_order_v2");
    resolved = await flagsService.resolveUserFlags("usr-1", false);
    expect(resolved.new_order_v2).toBe(false);
  });

  it("ensures auto_detect flag is permanently disabled even if updates are attempted", async () => {
    await flagsService.updateFlag("auto_detect", { enabled: true, percentage: 100 });
    const isEnabled = await flagsService.isEnabled("auto_detect", "admin-1", true);
    expect(isEnabled).toBe(false);
  });
});


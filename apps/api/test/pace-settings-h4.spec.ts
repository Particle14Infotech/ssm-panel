import { SettingsService } from "../src/modules/settings/settings.service";
import { FeatureFlagsService } from "../src/modules/settings/flags.service";

describe("H4: Admin Pace Settings and Observability", () => {
  let settingsService: SettingsService;
  let mockPrisma: any;
  let mockCache: any;
  let flagsService: FeatureFlagsService;

  beforeEach(() => {
    mockPrisma = {
      isConnected: true,
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "ord_1",
            target: "https://www.instagram.com/reel/abc123",
            quantity: 500,
            status: "COMPLETED",
            createdAt: new Date(),
            serviceId: "srv_likes",
            service: { platform: "INSTAGRAM", kind: "LIKES" },
          },
        ]),
      },
      packageExecution: {
        count: jest.fn().mockResolvedValue(5),
        findMany: jest.fn().mockResolvedValue([]),
      },
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    settingsService = new SettingsService(mockPrisma);
    flagsService = new FeatureFlagsService(mockPrisma, mockCache);
  });

  it("1. exposes expand-only pace settings with kind and tier caps", () => {
    const pace = settingsService.getPaceSettings();
    expect(pace).toBeDefined();
    expect(pace.deliveryPaceKindCaps.LIKES).toBe(150);
    expect(pace.deliveryPaceKindCaps.SHARES).toBe(30);
    expect(pace.deliveryPaceCatchupK).toBe(2);
    expect(pace.deliveryPaceStallTimeoutMs).toBe(12 * 3600 * 1000);
  });

  it("2. allows updating pace settings dynamically without schema changes", () => {
    const updateRes = settingsService.updatePaceSettings({
      deliveryPaceKindCaps: { LIKES: 200, SHARES: 50 },
      deliveryPaceCatchupK: 3,
    });

    expect(updateRes.success).toBe(true);
    expect(settingsService.getPaceSettings().deliveryPaceKindCaps.LIKES).toBe(200);
    expect(settingsService.getPaceSettings().deliveryPaceCatchupK).toBe(3);
  });

  it("3. flags service includes drip_v2 and delivery_pace default OFF", async () => {
    const flags = await flagsService.getAllFlags();
    expect(flags.drip_v2).toBeDefined();
    expect(flags.drip_v2.enabled).toBe(false);
    expect(flags.delivery_pace).toBeDefined();
    expect(flags.delivery_pace.enabled).toBe(false);
  });

  it("4. generates pace audit report from dispatch data with top links and metrics", async () => {
    const report = await settingsService.getPaceAuditReport();
    expect(report).toBeDefined();
    expect(report.topLinksByUnits60m.length).toBeGreaterThan(0);
    expect(report.topLinksByUnits60m[0].link).toBe("instagram.com/reel/abc123");
    expect(report.topLinksByUnits60m[0].units).toBe(500);
    expect(report.metrics.queueDepth).toBe(5);
  });
});


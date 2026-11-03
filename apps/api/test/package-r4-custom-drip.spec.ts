import { BadRequestException } from "@nestjs/common";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PackagesQuoteService } from "../src/modules/packages/packages-quote.service";
import { PlatformsService } from "../src/modules/platforms/platforms.service";
import { FeatureFlagsService } from "../src/modules/settings/flags.service";
import { setQuoteSecret } from "../src/modules/packages/package-quote-hash.util";
import { Decimal } from "decimal.js";
import { PackageMode, PackageStatus } from "@prisma/client";

describe("R4: Custom Drip Campaign Tests", () => {
  let service: PackagesService;
  let mockPrisma: any;
  let mockFlags: any;
  let mockQuoteService: any;
  let mockPlatformsService: any;

  const testSecret = "r4-test-secret-key-32-bytes-long-1234567";
  const userId = "user_cust_drip_123";

  const sampleLikesService = {
    id: "srv_likes_1",
    name: "Instagram Likes Fast",
    displayName: "Instagram Likes",
    kind: "LIKES",
    ratePer1000: new Decimal("50.00"),
    minQty: 100,
    maxQty: 10000,
    status: "ACTIVE",
    isDeleted: false,
  };

  const sampleFollowersService = {
    id: "srv_followers_1",
    name: "Instagram Followers Non-Drop",
    displayName: "Instagram Followers",
    kind: "FOLLOWERS",
    ratePer1000: new Decimal("200.00"),
    minQty: 100,
    maxQty: 50000,
    status: "ACTIVE",
    isDeleted: false,
  };

  beforeAll(() => {
    setQuoteSecret("primary", testSecret);
  });

  beforeEach(() => {
    mockFlags = {
      isEnabled: jest.fn().mockResolvedValue(true),
    };

    mockQuoteService = {
      calculateQuote: jest.fn(),
    };

    mockPlatformsService = {
      getConfig: jest.fn(),
    };

    const walletRecord = {
      id: "wallet_123",
      userId,
      balance: new Decimal("5000.00"),
    };

    const packageCreated: any[] = [];
    const slotsCreated: any[] = [];
    const rulesCreated: any[] = [];
    const executionsCreated: any[] = [];
    const ledgerEntries: any[] = [];

    mockPrisma = {
      isConnected: true,
      service: {
        findMany: jest.fn().mockImplementation(async ({ where }: any) => {
          const ids = where?.id?.in || [];
          return [sampleLikesService, sampleFollowersService].filter((s) => ids.includes(s.id));
        }),
      },
      wallet: {
        findUnique: jest.fn().mockResolvedValue(walletRecord),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          walletRecord.balance = data.balance;
          return walletRecord;
        }),
      },
      ledgerEntry: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          ledgerEntries.push(data);
          return { id: "ledger_1", ...data };
        }),
      },
      package: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          packageCreated.push(data);
          return { id: data.id, ...data };
        }),
      },
      packageSlot: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const slot = { id: `slot_${slotsCreated.length + 1}`, ...data };
          slotsCreated.push(slot);
          return slot;
        }),
      },
      packageRule: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const rule = { id: `rule_${rulesCreated.length + 1}`, ...data };
          rulesCreated.push(rule);
          return rule;
        }),
      },
      packageExecution: {
        createMany: jest.fn().mockImplementation(async ({ data }: any) => {
          executionsCreated.push(...data);
          return { count: data.length };
        }),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          executionsCreated.push(data);
          return data;
        }),
      },
      $transaction: jest.fn().mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      }),
    };

    service = new PackagesService(
      mockPrisma,
      mockQuoteService,
      mockPlatformsService,
      mockFlags
    );
  });

  it("TEST-T2-01: rejects zero-item orders", async () => {
    await expect(
      service.getCustomCampaignQuote(userId, {
        targetUrl: "https://instagram.com/reel/abc123",
        platform: "instagram",
        durationDays: 7,
        services: [],
      } as any)
    ).rejects.toThrow(BadRequestException);
  });

  it("TEST-T2-02: rejects quantity below service minQty", async () => {
    await expect(
      service.getCustomCampaignQuote(userId, {
        targetUrl: "https://instagram.com/reel/abc123",
        platform: "instagram",
        durationDays: 7,
        services: [
          {
            serviceId: "srv_likes_1",
            quantity: 50, // minQty is 100
          },
        ],
      } as any)
    ).rejects.toThrow("Instagram Likes: Quantity 50 must be between 100 and 10000.");
  });

  it("TEST-T2-03: returns warning and fastestPossibleDays when daily slice falls below minQty", async () => {
    const quote = await service.getCustomCampaignQuote(userId, {
      targetUrl: "https://instagram.com/reel/abc123",
      platform: "instagram",
      durationDays: 7,
      services: [
        {
          serviceId: "srv_likes_1",
          quantity: 200, // 200 / 7 = 28 < 100 minQty
        },
      ],
    } as any);

    expect(quote.warnings.length).toBeGreaterThan(0);
    expect(quote.warnings[0]).toContain("Fastest recommended duration is 2 day(s)");
    expect(quote.items[0].fastestPossibleDays).toBe(2);
    expect(quote.items[0].dailyQuantity).toBe(28);
  });

  it("TEST-T2-04: quote displays line-item breakdown and matches authoritative charge", async () => {
    const quote = await service.getCustomCampaignQuote(userId, {
      profileUrl: "https://instagram.com/testuser",
      targetUrl: "https://instagram.com/reel/abc123",
      platform: "instagram",
      durationDays: 5,
      services: [
        {
          serviceId: "srv_likes_1",
          quantity: 1000, // Rate 50 per 1000 => 50.00
        },
        {
          serviceId: "srv_followers_1",
          quantity: 500, // Rate 200 per 1000 => 100.00
        },
      ],
    } as any);

    expect(quote.totalCharge).toBe(150.00);
    expect(quote.items.length).toBe(2);
    expect(quote.items[0].lineTotal).toBe(50.00);
    expect(quote.items[1].lineTotal).toBe(100.00);
    expect(quote.quoteHash).toMatch(/^qh_v2_/);
    expect(quote.timeline.length).toBe(5);
  });

  it("TEST-T2-05: rejects tampered quoteHash upon purchase", async () => {
    const quote = await service.getCustomCampaignQuote(userId, {
      profileUrl: "https://instagram.com/testuser",
      targetUrl: "https://instagram.com/reel/abc123",
      platform: "instagram",
      durationDays: 5,
      services: [
        {
          serviceId: "srv_likes_1",
          quantity: 1000,
        },
      ],
    } as any);

    // Tamper with hash
    const tamperedHash = quote.quoteHash.replace(/.$/, "0");

    await expect(
      service.purchaseCustomCampaign(userId, {
        profileUrl: "https://instagram.com/testuser",
        targetUrl: "https://instagram.com/reel/abc123",
        platform: "instagram",
        durationDays: 5,
        quoteHash: tamperedHash,
        services: [
          {
            serviceId: "srv_likes_1",
            quantity: 1000,
          },
        ],
      } as any)
    ).rejects.toThrow(BadRequestException);
  });

  it("TEST-T2-06: successfully purchases custom drip campaign with mode=CUSTOMIZED, creates slot and scheduled executions", async () => {
    const quote = await service.getCustomCampaignQuote(userId, {
      profileUrl: "https://instagram.com/testuser",
      targetUrl: "https://instagram.com/reel/abc123",
      platform: "instagram",
      durationDays: 5,
      services: [
        {
          serviceId: "srv_likes_1",
          quantity: 1000,
        },
      ],
    } as any);

    const purchaseRes = await service.purchaseCustomCampaign(userId, {
      profileUrl: "https://instagram.com/testuser",
      targetUrl: "https://instagram.com/reel/abc123",
      platform: "instagram",
      durationDays: 5,
      quoteHash: quote.quoteHash,
      services: [
        {
          serviceId: "srv_likes_1",
          quantity: 1000,
        },
      ],
    } as any);

    expect(purchaseRes.success).toBe(true);
    expect(purchaseRes.totalCharge).toBe(50.00);
    // 1000 qty over 5 days = 200/day. With minQty=100, dailyQty (200) >= min*2, creating 2 batches/day = 10 executions
    expect(purchaseRes.executionsCount).toBe(10);

    // Verify package created with mode: CUSTOMIZED
    expect(mockPrisma.package.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mode: PackageMode.CUSTOMIZED,
          status: PackageStatus.ACTIVE,
          reserveTotal: new Decimal(50),
        }),
      })
    );

    // Verify slot created
    expect(mockPrisma.packageSlot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          slotNumber: 1,
          status: "ACTIVE",
        }),
      })
    );

    // Verify executions created with slotId
    expect(mockPrisma.packageExecution.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            slotId: expect.any(String),
            seq: 1,
            quantity: 100,
          }),
        ]),
      })
    );

    // Verify ledger entry
    expect(mockPrisma.ledgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: new Decimal(-50),
        }),
      })
    );
  });

  it("TEST-T2-07: rejects purchase when wallet balance is insufficient", async () => {
    mockPrisma.wallet.findUnique.mockResolvedValueOnce({
      id: "wallet_poor",
      userId,
      balance: new Decimal("10.00"), // Only 10 rupees available
    });

    const quote = await service.getCustomCampaignQuote(userId, {
      targetUrl: "https://instagram.com/reel/abc123",
      platform: "instagram",
      durationDays: 5,
      services: [
        {
          serviceId: "srv_likes_1",
          quantity: 1000, // 50 rupees required
        },
      ],
    } as any);

    await expect(
      service.purchaseCustomCampaign(userId, {
        targetUrl: "https://instagram.com/reel/abc123",
        platform: "instagram",
        durationDays: 5,
        quoteHash: quote.quoteHash,
        services: [
          {
            serviceId: "srv_likes_1",
            quantity: 1000,
          },
        ],
      } as any)
    ).rejects.toThrow("Insufficient wallet balance");
  });

  it("TEST-T2-08: respects feature flag tab_custom_drip", async () => {
    mockFlags.isEnabled.mockResolvedValueOnce(false);

    await expect(
      service.getCustomCampaignQuote(userId, {
        targetUrl: "https://instagram.com/reel/abc123",
        platform: "instagram",
        durationDays: 5,
        services: [{ serviceId: "srv_likes_1", quantity: 1000 }],
      } as any)
    ).rejects.toThrow("Custom Drip campaigns are currently unavailable.");
  });
});


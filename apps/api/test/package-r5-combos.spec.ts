import { BadRequestException, HttpException, HttpStatus } from "@nestjs/common";
import { PackagesService } from "../src/modules/packages/packages.service";
import {
  allocateFixedPriceLargestRemainder,
  checkMarginFloor,
} from "../src/modules/packages/package-combos-engine.util";
import { setQuoteSecret } from "../src/modules/packages/package-quote-hash.util";
import { Decimal } from "decimal.js";
import { PackageMode, PackageStatus } from "@prisma/client";

describe("R5: Combo Packages & Largest Remainder Allocation Tests", () => {
  let service: PackagesService;
  let mockPrisma: any;
  let mockFlags: any;
  let mockQuoteService: any;
  let mockPlatformsService: any;

  const testSecret = "r5-combo-secret-key-32-bytes-long-123456";
  const userId = "user_combo_tester_99";

  const sampleTemplate = {
    id: "tmpl_tiktok_viral",
    platform: "TIKTOK",
    slug: "tiktok-viral-combo",
    name: "TikTok Viral Combo",
    badge: "Popular",
    pricingMode: "FIXED",
    active: true,
    archived: false,
  };

  const sampleTier = {
    id: "tier_growth_50k",
    templateId: sampleTemplate.id,
    template: sampleTemplate,
    version: 1,
    name: "Growth Pack",
    price: new Decimal("49.99"), // 4999 paise
    durationDays: 7,
    soldCount: 0,
    active: true,
    items: [
      {
        id: "item_views",
        serviceId: "srv_views_tt",
        quantity: 50000,
        kind: "VIEWS",
        allocationBp: 5000, // 50%
        displayOrder: 1,
        service: {
          id: "srv_views_tt",
          name: "TikTok Video Views",
          displayName: "TikTok Video Views",
          ratePer1000: new Decimal("0.50"), // Retail: 25.00
          providerRate: new Decimal("0.20"), // Cost: 10.00
          minQty: 100,
          maxQty: 1000000,
        },
      },
      {
        id: "item_likes",
        serviceId: "srv_likes_tt",
        quantity: 10000,
        kind: "LIKES",
        allocationBp: 3500, // 35%
        displayOrder: 2,
        service: {
          id: "srv_likes_tt",
          name: "TikTok Post Likes",
          displayName: "TikTok Post Likes",
          ratePer1000: new Decimal("2.00"), // Retail: 20.00
          providerRate: new Decimal("1.00"), // Cost: 10.00
          minQty: 100,
          maxQty: 100000,
        },
      },
      {
        id: "item_shares",
        serviceId: "srv_shares_tt",
        quantity: 2000,
        kind: "SHARES",
        allocationBp: 1500, // 15%
        displayOrder: 3,
        service: {
          id: "srv_shares_tt",
          name: "TikTok Shares",
          displayName: "TikTok Shares",
          ratePer1000: new Decimal("5.00"), // Retail: 10.00
          providerRate: new Decimal("2.50"), // Cost: 5.00
          minQty: 100,
          maxQty: 50000,
        },
      },
    ],
  };

  beforeAll(() => {
    setQuoteSecret("primary", testSecret);
  });

  beforeEach(() => {
    setQuoteSecret("primary", testSecret);
    mockFlags = {
      isEnabled: jest.fn().mockResolvedValue(true),
    };

    mockQuoteService = { calculateQuote: jest.fn() };
    mockPlatformsService = { getConfig: jest.fn() };

    const walletRecord = {
      id: "wallet_user_99",
      userId,
      balance: new Decimal("1000.00"),
    };

    mockPrisma = {
      isConnected: true,
      pricingSettings: {
        findFirst: jest.fn().mockResolvedValue({
          marginFloor: new Decimal("0.15"),
        }),
      },
      packageTemplate: {
        findMany: jest.fn().mockResolvedValue([
          {
            ...sampleTemplate,
            tiers: [sampleTier],
          },
        ]),
      },
      packageTemplateTier: {
        findUnique: jest.fn().mockResolvedValue(sampleTier),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          if (data.soldCount?.increment) {
            sampleTier.soldCount += data.soldCount.increment;
          }
          return sampleTier;
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
        create: jest.fn().mockResolvedValue({ id: "ledger_entry_1" }),
      },
      package: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: data.id,
          ...data,
        })),
      },
      packageSlot: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: "slot_1",
          ...data,
        })),
      },
      packageRule: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: `rule_${Math.random()}`,
          ...data,
        })),
      },
      packageExecution: {
        createMany: jest.fn().mockResolvedValue({ count: 21 }),
        create: jest.fn().mockResolvedValue({ id: "exec_1" }),
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

  describe("1. Mathematical Invariant: Largest Remainder Allocation", () => {
    it("allocates exactly 4999 paise across 3 items with zero remainder loss", () => {
      const items = [
        { id: "item_1", weight: 5000 },
        { id: "item_2", weight: 3500 },
        { id: "item_3", weight: 1500 },
      ];

      const allocations = allocateFixedPriceLargestRemainder(4999, items);

      // Verify exact sum of allocated paise equals price
      const totalAllocatedPaise = allocations.reduce(
        (sum, a) => sum + a.allocatedPaise,
        0
      );
      expect(totalAllocatedPaise).toBe(4999);

      // Verify allocated decimals sum to 49.99
      const totalDecimal = allocations.reduce(
        (sum, a) => sum.plus(a.allocatedDecimal),
        new Decimal(0)
      );
      expect(totalDecimal.toNumber()).toBe(49.99);
    });

    it("breaks ties deterministically by item ID", () => {
      // 10 paise split equally between 3 items: each gets 3 paise, 1 extra paise left
      // remainder is 0.3333 for all 3, so item_a wins tie-break
      const items = [
        { id: "item_c", weight: 1 },
        { id: "item_a", weight: 1 },
        { id: "item_b", weight: 1 },
      ];

      const allocations = allocateFixedPriceLargestRemainder(10, items);
      const a = allocations.find((x) => x.id === "item_a")!;
      const b = allocations.find((x) => x.id === "item_b")!;
      const c = allocations.find((x) => x.id === "item_c")!;

      expect(a.allocatedPaise).toBe(4);
      expect(b.allocatedPaise).toBe(3);
      expect(c.allocatedPaise).toBe(3);
      expect(a.allocatedPaise + b.allocatedPaise + c.allocatedPaise).toBe(10);
    });
  });

  describe("2. Margin Guard & Quotation", () => {
    it("TEST-T3-01: calculates quote with exact line-item allocations matching tier price", async () => {
      const quote = await service.getComboQuote(userId, {
        templateId: sampleTemplate.id,
        tierId: sampleTier.id,
        targetUrl: "https://tiktok.com/@test/video/123456",
      });

      expect(quote.totalCharge).toBe(49.99);
      expect(quote.items.length).toBe(3);

      const sumOfLines = quote.items.reduce(
        (acc: number, item: any) => acc + item.allocatedPaise,
        0
      );
      expect(sumOfLines).toBe(4999);
      expect(quote.quoteHash).toMatch(/^qh_v2_/);
    });

    it("TEST-T3-02: rejects quote with 409 Conflict if provider cost breaches margin floor", async () => {
      // Artificially inflate provider costs so margin < 15%
      sampleTier.items[0].service.providerRate = new Decimal("1.50"); // 75.00 cost alone

      await expect(
        service.getComboQuote(userId, {
          templateId: sampleTemplate.id,
          tierId: sampleTier.id,
          targetUrl: "https://tiktok.com/@test/video/123456",
        })
      ).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.CONFLICT,
        })
      );

      // Restore rate
      sampleTier.items[0].service.providerRate = new Decimal("0.20");
    });
  });

  describe("3. Atomic Purchase & Tier Immutability", () => {
    it("TEST-T3-03: rejects purchase with tampered quoteHash", async () => {
      const quote = await service.getComboQuote(userId, {
        templateId: sampleTemplate.id,
        tierId: sampleTier.id,
        targetUrl: "https://tiktok.com/@test/video/123456",
      });

      const tamperedHash = quote.quoteHash.replace(/.$/, "x");

      await expect(
        service.purchaseCombo(userId, {
          templateId: sampleTemplate.id,
          tierId: sampleTier.id,
          targetUrl: "https://tiktok.com/@test/video/123456",
          quoteHash: tamperedHash,
        })
      ).rejects.toThrow("Invalid or expired quote hash for combo package.");
    });

    it("TEST-T3-04: successful purchase increments soldCount, creates slot, and records allocation snapshot", async () => {
      const initialSoldCount = sampleTier.soldCount;

      const quote = await service.getComboQuote(userId, {
        templateId: sampleTemplate.id,
        tierId: sampleTier.id,
        targetUrl: "https://tiktok.com/@test/video/123456",
      });

      const purchaseRes = await service.purchaseCombo(userId, {
        templateId: sampleTemplate.id,
        tierId: sampleTier.id,
        targetUrl: "https://tiktok.com/@test/video/123456",
        quoteHash: quote.quoteHash,
      });

      expect(purchaseRes.success).toBe(true);
      expect(purchaseRes.totalCharge).toBe(49.99);

      // Tier soldCount incremented
      expect(mockPrisma.packageTemplateTier.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sampleTier.id },
          data: { soldCount: { increment: 1 } },
        })
      );
      expect(sampleTier.soldCount).toBe(initialSoldCount + 1);

      // Package created with mode: TEMPLATE and allocationSnapshot
      expect(mockPrisma.package.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            mode: PackageMode.TEMPLATE,
            status: PackageStatus.ACTIVE,
            reserveTotal: new Decimal("49.99"),
            allocationSnapshot: expect.any(Array),
          }),
        })
      );

      // Initial PackageSlot created
      expect(mockPrisma.packageSlot.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slotNumber: 1,
            targetUrl: "https://tiktok.com/@test/video/123456",
            status: "ACTIVE",
          }),
        })
      );
    });
  });
});


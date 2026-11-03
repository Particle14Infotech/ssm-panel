import { BadRequestException, ConflictException } from "@nestjs/common";
import { PackageTemplatesAdminController } from "../src/modules/packages/package-templates-admin.controller";
import { Decimal } from "decimal.js";

describe("R4: Admin Package Templates & Tier Immutability Guard", () => {
  let controller: PackageTemplatesAdminController;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      packageTemplate: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      packageTemplateTier: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      packageTemplateItem: {
        create: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      }),
    };

    controller = new PackageTemplatesAdminController(mockPrisma);
  });

  it("R4-ADM-01: rejects publishing a template when margin is below 15%", async () => {
    mockPrisma.packageTemplate.findUnique.mockResolvedValue({
      id: "tpl_1",
      active: false,
      tiers: [
        {
          id: "tier_1",
          version: 1,
          soldCount: 0,
          price: new Decimal("200.00"), // 20,000 paise
          items: [
            {
              serviceId: "srv_high_cost",
              quantity: 1000,
              service: {
                status: "ACTIVE",
                isDeleted: false,
                packageEligible: true,
                minQty: 100,
                maxQty: 10000,
                providerCostPer1k: new Decimal("190.00"), // cost 19,000 paise => margin 5%
              },
            },
          ],
        },
      ],
    });

    await expect(controller.publishTemplate("tpl_1")).rejects.toThrow(BadRequestException);
    expect(mockPrisma.packageTemplate.update).not.toHaveBeenCalled();
  });

  it("R4-ADM-02: successfully publishes template when all services are active, eligible, and margin >= 15%", async () => {
    mockPrisma.packageTemplate.findUnique.mockResolvedValue({
      id: "tpl_valid",
      active: false,
      tiers: [
        {
          id: "tier_valid",
          version: 1,
          soldCount: 0,
          price: new Decimal("999.00"), // 99,900 paise
          items: [
            {
              serviceId: "srv_good",
              quantity: 5000,
              service: {
                status: "ACTIVE",
                isDeleted: false,
                packageEligible: true,
                minQty: 100,
                maxQty: 50000,
                providerCostPer1k: new Decimal("30.00"), // cost 15,000 paise => margin 85%
              },
            },
          ],
        },
      ],
    });

    mockPrisma.packageTemplate.update.mockResolvedValue({
      id: "tpl_valid",
      active: true,
      archived: false,
    });

    const res = await controller.publishTemplate("tpl_valid");
    expect(res.active).toBe(true);
    expect(mockPrisma.packageTemplate.update).toHaveBeenCalledWith({
      where: { id: "tpl_valid" },
      data: { active: true, archived: false },
    });
  });

  it("R4-ADM-03: allows in-place tier updates when soldCount === 0", async () => {
    mockPrisma.packageTemplateTier.findUnique.mockResolvedValue({
      id: "tier_fresh",
      templateId: "tpl_1",
      version: 1,
      soldCount: 0,
      price: new Decimal("500.00"),
      durationDays: 7,
      items: [],
    });

    mockPrisma.packageTemplateTier.update.mockResolvedValue({
      id: "tier_fresh",
      price: new Decimal("600.00"),
    });

    await controller.updateTier("tpl_1", "tier_fresh", { price: 600 });

    expect(mockPrisma.packageTemplateTier.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tier_fresh" },
        data: expect.objectContaining({
          price: new Decimal(600),
        }),
      })
    );
    expect(mockPrisma.packageTemplateTier.create).not.toHaveBeenCalled();
  });

  it("R4-ADM-04: enforces SPEC §5.5 Tier Immutability Guard: when soldCount > 0, deactivates old tier and creates immutable version + 1", async () => {
    mockPrisma.packageTemplateTier.findUnique.mockResolvedValue({
      id: "tier_sold",
      templateId: "tpl_1",
      name: "Growth Tier",
      version: 1,
      soldCount: 42, // Already sold to real users!
      price: new Decimal("999.00"),
      durationDays: 7,
      items: [
        {
          serviceId: "srv_likes",
          quantity: 2000,
          kind: "LIKES",
          allocationBp: 5000,
          displayOrder: 1,
        },
      ],
    });

    mockPrisma.packageTemplateTier.create.mockImplementation(async ({ data }: any) => {
      return { id: "tier_new_v2", ...data };
    });

    const result: any = await controller.updateTier("tpl_1", "tier_sold", {
      price: 1199, // price increase
      durationDays: 14,
    });

    // 1. Must flag that it migrated to new version
    expect(result.migratedToNewVersion).toBe(true);
    expect(result.previousVersion).toBe(1);
    expect(result.newTier.version).toBe(2);
    expect(result.newTier.soldCount).toBe(0);

    // 2. Old tier must be deactivated
    expect(mockPrisma.packageTemplateTier.update).toHaveBeenCalledWith({
      where: { id: "tier_sold" },
      data: { active: false },
    });

    // 3. New tier created with version 2
    expect(mockPrisma.packageTemplateTier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: "tpl_1",
        version: 2,
        soldCount: 0,
        price: new Decimal(1199),
        durationDays: 14,
      }),
    });

    // 4. Items copied over to new tier
    expect(mockPrisma.packageTemplateItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tierId: "tier_new_v2",
        serviceId: "srv_likes",
        quantity: 2000,
      }),
    });
  });
});


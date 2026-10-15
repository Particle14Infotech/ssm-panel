import { Test, TestingModule } from "@nestjs/testing";
import { CouponsController } from "./coupons.controller";
import { CouponsService } from "./coupons.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";

describe("CouponsController & Service Logic", () => {
  let controller: CouponsController;
  let service: CouponsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CouponsController],
      providers: [CouponsService],
    }).compile();

    controller = module.get<CouponsController>(CouponsController);
    service = module.get<CouponsService>(CouponsService);
  });

  it("lists default promotional coupons", () => {
    const coupons = controller.findAll();
    expect(Array.isArray(coupons)).toBe(true);
    expect(coupons.length).toBeGreaterThanOrEqual(2);
    expect(coupons.find((c) => c.code === "WELCOME10")).toBeDefined();
  });

  it("creates a new promotional coupon code", () => {
    const res = controller.create({
      code: "SUMMER50",
      discountPct: 50,
      maxDiscount: 1000,
    });
    expect(res.success).toBe(true);
    expect(res.coupon.code).toBe("SUMMER50");
  });

  it("applies coupon correctly respecting percentage and cap", () => {
    const res = controller.apply({ code: "WELCOME10", orderAmount: 1000 });
    expect(res.success).toBe(true);
    expect(res.discountAmount).toBe(100);
    expect(res.finalAmount).toBe(900);
  });

  it("rejects non-existent coupon", () => {
    expect(() => {
      controller.apply({ code: "NON_EXISTENT", orderAmount: 1000 });
    }).toThrow(NotFoundException);
  });

  it("lists and adds deposit bonus tiers", () => {
    const bonuses = controller.findAllBonuses();
    expect(bonuses.length).toBeGreaterThanOrEqual(3);

    const created = controller.createBonus({ minAmount: 10000, bonusPct: 20 });
    expect(created.success).toBe(true);
    expect(created.bonusRule.bonusPct).toBe(20);
  });
});

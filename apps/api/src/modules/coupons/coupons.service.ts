import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";

export interface CouponItem {
  id: string;
  code: string;
  discountPct: number;
  maxDiscount?: number;
  minOrderVal?: number;
  usageLimit: number;
  usedCount: number;
  expiresAt?: string;
  isActive: boolean;
}

export interface BonusRuleItem {
  id: string;
  minAmount: number;
  bonusPct: number;
  isActive: boolean;
}

@Injectable()
export class CouponsService {
  private coupons: CouponItem[] = [
    {
      id: "cpn_welcome10",
      code: "WELCOME10",
      discountPct: 10,
      maxDiscount: 500,
      minOrderVal: 100,
      usageLimit: 1000,
      usedCount: 142,
      isActive: true,
    },
    {
      id: "cpn_festive25",
      code: "FESTIVE25",
      discountPct: 25,
      maxDiscount: 2000,
      minOrderVal: 500,
      usageLimit: 500,
      usedCount: 88,
      isActive: true,
    },
  ];

  private bonusRules: BonusRuleItem[] = [
    { id: "bon_tier1", minAmount: 500, bonusPct: 5, isActive: true },
    { id: "bon_tier2", minAmount: 1000, bonusPct: 10, isActive: true },
    { id: "bon_tier3", minAmount: 5000, bonusPct: 15, isActive: true },
  ];

  findAll() {
    return this.coupons;
  }

  create(body: { code: string; discountPct: number; maxDiscount?: number; minOrderVal?: number }) {
    if (!body.code || !body.discountPct) {
      throw new BadRequestException("Code and discountPct are required.");
    }
    const newCoupon: CouponItem = {
      id: `cpn_${Math.random().toString(36).substring(2, 7)}`,
      code: body.code.toUpperCase().trim(),
      discountPct: Number(body.discountPct),
      maxDiscount: body.maxDiscount ? Number(body.maxDiscount) : undefined,
      minOrderVal: body.minOrderVal ? Number(body.minOrderVal) : undefined,
      usageLimit: 1000,
      usedCount: 0,
      isActive: true,
    };
    this.coupons.push(newCoupon);
    return { success: true, coupon: newCoupon };
  }

  apply(code: string, orderAmount: number) {
    if (!code) throw new BadRequestException("Coupon code required.");
    const coupon = this.coupons.find(
      (c) => c.code.toUpperCase() === code.toUpperCase().trim() && c.isActive
    );
    if (!coupon) throw new NotFoundException(`Coupon "${code}" is invalid or expired.`);
    if (coupon.minOrderVal && orderAmount < coupon.minOrderVal) {
      throw new BadRequestException(`Minimum order value for ${code} is INR ${coupon.minOrderVal}.`);
    }

    let discount = (orderAmount * coupon.discountPct) / 100;
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }

    return {
      success: true,
      code: coupon.code,
      discountPct: coupon.discountPct,
      discountAmount: Number(discount.toFixed(2)),
      finalAmount: Number((orderAmount - discount).toFixed(2)),
    };
  }

  findAllBonuses() {
    return this.bonusRules;
  }

  createBonus(body: { minAmount: number; bonusPct: number }) {
    const newRule: BonusRuleItem = {
      id: `bon_${Math.random().toString(36).substring(2, 7)}`,
      minAmount: Number(body.minAmount),
      bonusPct: Number(body.bonusPct),
      isActive: true,
    };
    this.bonusRules.push(newRule);
    return { success: true, bonusRule: newRule };
  }
}

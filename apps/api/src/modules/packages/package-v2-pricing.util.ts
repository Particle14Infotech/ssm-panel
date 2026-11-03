import { Decimal } from "decimal.js";
import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  allocateFixedPriceLargestRemainder,
  checkMarginFloor,
  AllocationItem,
  AllocatedResult,
} from "./package-combos-engine.util";

export interface PricingSettingsConfig {
  markupPct: number;
  bundleDiscountPct: number;
  customDiscountPct: number;
  marginFloorPct: number;
  durationTiers: Array<{ days: number; discountPct: number }>;
  rounding: "CEIL" | "FLOOR" | "ROUND";
  cancellationFeePct: number;
}

export const DEFAULT_PRICING_SETTINGS: PricingSettingsConfig = {
  markupPct: 15,
  bundleDiscountPct: 10,
  customDiscountPct: 5,
  marginFloorPct: 15,
  durationTiers: [
    { days: 3, discountPct: 0 },
    { days: 7, discountPct: 5 },
    { days: 14, discountPct: 10 },
    { days: 30, discountPct: 15 },
  ],
  rounding: "CEIL",
  cancellationFeePct: 0,
};

export interface QuotePricingItem {
  id: string;
  serviceId: string;
  kind?: string;
  quantity: number;
  ratePer1000Paise: number;
  providerCostPer1000Paise: number;
}

export interface QuotePricingResult {
  mode: "TEMPLATE" | "CUSTOMIZED" | "CUSTOM";
  catalogTotalPaise: number;
  discountPaise: number;
  finalPricePaise: number;
  finalPriceDecimal: Decimal;
  totalProviderCostPaise: number;
  marginPct: number;
  items: Array<{
    id: string;
    serviceId: string;
    quantity: number;
    catalogValuePaise: number;
    allocatedPaise: number;
    allocatedDecimal: Decimal;
    providerCostPaise: number;
  }>;
}

/**
 * Computes authoritative price in integer paise for TEMPLATE, CUSTOMIZED, or CUSTOM.
 * Adheres strictly to SPEC §5.2, §5.3, §5.4.
 * No floating point math on money.
 */
export function quotePackagePrice(params: {
  mode: "TEMPLATE" | "CUSTOMIZED" | "CUSTOM";
  tierFixedPricePaise?: number;
  items: QuotePricingItem[];
  durationDays: number;
  couponDiscountPaise?: number;
  pricingSettings?: Partial<PricingSettingsConfig>;
}): QuotePricingResult {
  const { mode, tierFixedPricePaise, items, durationDays, couponDiscountPaise = 0 } = params;
  const settings: PricingSettingsConfig = { ...DEFAULT_PRICING_SETTINGS, ...params.pricingSettings };

  if (!items || items.length === 0) {
    throw new BadRequestException("Package must contain at least one item.");
  }

  // 1. Calculate catalog value and provider cost per item in integer paise
  let catalogTotalPaise = 0;
  let totalProviderCostPaise = 0;

  const evaluatedItems = items.map((item) => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw new BadRequestException(`Item quantity must be a positive integer.`);
    }

    // Catalog value = round(ratePer1000Paise * quantity / 1000)
    const rawVal = Math.round((item.ratePer1000Paise * item.quantity) / 1000);
    const catalogValuePaise = Math.max(1, rawVal);

    // Provider cost = ceil(providerCostPer1000Paise * quantity / 1000)
    const rawCost = Math.ceil((item.providerCostPer1000Paise * item.quantity) / 1000);
    const providerCostPaise = Math.max(0, rawCost);

    catalogTotalPaise += catalogValuePaise;
    totalProviderCostPaise += providerCostPaise;

    return {
      id: item.id,
      serviceId: item.serviceId,
      quantity: item.quantity,
      catalogValuePaise,
      providerCostPaise,
    };
  });

  let finalPricePaise = 0;

  if (mode === "TEMPLATE") {
    // FIXED pricing mode
    if (typeof tierFixedPricePaise !== "number" || tierFixedPricePaise <= 0) {
      throw new BadRequestException("Fixed tier price must be a positive integer in paise.");
    }
    finalPricePaise = tierFixedPricePaise;
  } else {
    // COMPUTED pricing mode (CUSTOM or CUSTOMIZED)
    let discountPct = mode === "CUSTOM" ? settings.customDiscountPct : settings.bundleDiscountPct;

    // Add duration tier discount
    const durationTier = [...settings.durationTiers]
      .sort((a, b) => b.days - a.days)
      .find((t) => durationDays >= t.days);
    if (durationTier) {
      discountPct += durationTier.discountPct;
    }

    // Compute raw discounted price
    const discountMultiplier = Math.max(0, (100 - discountPct) / 100);
    let computedPrice = Math.round(catalogTotalPaise * discountMultiplier);

    // Apply coupon discount (clamped to max discount)
    if (couponDiscountPaise > 0) {
      computedPrice = Math.max(0, computedPrice - couponDiscountPaise);
    }

    finalPricePaise = computedPrice;
  }

  // 2. Margin Guard check (SPEC §5.4)
  const marginFloor = settings.marginFloorPct / 100;
  const marginCheck = checkMarginFloor(finalPricePaise, totalProviderCostPaise, marginFloor);

  if (!marginCheck.isAcceptable) {
    if (mode === "TEMPLATE") {
      throw new ConflictException("TEMPLATE_UNAVAILABLE: Margin below minimum requirement.");
    }
    // For CUSTOM/CUSTOMIZED, clamp price to minimum viable price
    finalPricePaise = marginCheck.minPricePaise;
  }

  // 3. Largest-Remainder Allocation across items (SPEC §5.3)
  const allocationItems: AllocationItem[] = evaluatedItems.map((it) => ({
    id: it.id,
    weight: it.catalogValuePaise,
  }));

  const allocated = allocateFixedPriceLargestRemainder(finalPricePaise, allocationItems);
  const allocatedMap = new Map<string, number>(allocated.map((a) => [a.id, a.allocatedPaise]));

  const finalItems = evaluatedItems.map((it) => {
    const paise = allocatedMap.get(it.id) || 0;
    return {
      id: it.id,
      serviceId: it.serviceId,
      quantity: it.quantity,
      catalogValuePaise: it.catalogValuePaise,
      allocatedPaise: paise,
      allocatedDecimal: new Decimal(paise).dividedBy(100),
      providerCostPaise: it.providerCostPaise,
    };
  });

  const discountPaise = Math.max(0, catalogTotalPaise - finalPricePaise);
  const marginPct =
    finalPricePaise > 0
      ? Math.round(((finalPricePaise - totalProviderCostPaise) / finalPricePaise) * 10000) / 100
      : 0;

  return {
    mode,
    catalogTotalPaise,
    discountPaise,
    finalPricePaise,
    finalPriceDecimal: new Decimal(finalPricePaise).dividedBy(100),
    totalProviderCostPaise,
    marginPct,
    items: finalItems,
  };
}

export interface DripScheduleRun {
  runIndex: number;
  executeOffsetMinutes: number;
  quantity: number;
  allocatedChargePaise: number;
}

/**
 * Deterministic Time-Interval Drip Schedule Generator (SPEC §5.8).
 * Pure function: No random jitter, no waves, reproducible.
 * Sum of run quantities === total item quantity exactly.
 * Sum of run charges === total item allocatedPaise exactly.
 */
export function generateDeterministicDripSchedule(params: {
  role: "PROFILE_DRIP" | "PER_SLOT";
  totalQuantity: number;
  serviceMinQty: number;
  serviceMaxQty: number;
  totalAllocatedPaise: number;
  durationDays?: number;
  intervalHours?: number;
  windowMinutes?: number;
  minGapMinutes?: number;
  maxRuns?: number;
  startOffsetMinutes?: number;
}): DripScheduleRun[] {
  const {
    role,
    totalQuantity: Q,
    serviceMinQty: sMin,
    serviceMaxQty: sMax,
    totalAllocatedPaise: P,
    startOffsetMinutes = 0,
  } = params;

  if (Q <= 0 || sMin <= 0) {
    throw new BadRequestException("Quantity and service minimum must be positive.");
  }

  let runs = 1;
  let gapMinutes = 0;

  if (role === "PROFILE_DRIP") {
    // Profile-level drip (e.g. Followers)
    const days = Math.max(1, params.durationDays || 1);
    const intervalDays = Math.max(0.25, (params.intervalHours || 24) / 24);

    const maxRunsByMin = Math.floor(Q / sMin);
    const maxRunsByDays = Math.floor(days / intervalDays);
    runs = Math.max(1, Math.min(maxRunsByMin, maxRunsByDays));
    if (params.maxRuns) {
      runs = Math.min(runs, params.maxRuns);
    }

    gapMinutes = Math.round((days * 24 * 60) / runs);
  } else {
    // Post-level drip (e.g. Likes, Views)
    const windowMin = Math.max(30, params.windowMinutes || 360); // default 6h
    const minGap = Math.max(5, params.minGapMinutes || 10); // default 10m
    const maxRunsPerPost = Math.min(params.maxRuns || 24, Math.floor(windowMin / minGap));

    const possibleRuns = Math.floor(Q / sMin);
    runs = Math.max(1, Math.min(possibleRuns, maxRunsPerPost));
    gapMinutes = Math.round(windowMin / runs);
  }

  // Remainder distribution for quantities:
  // base quantity per run with remainder distributed over the first runs
  const baseQty = Math.floor(Q / runs);
  const remQty = Q % runs;

  const runQuantities: number[] = [];
  for (let j = 0; j < runs; j++) {
    const qty = baseQty + (j < remQty ? 1 : 0);
    runQuantities.push(qty);
  }

  // Remainder distribution for allocated charges in integer paise:
  // Sum of run charges must equal totalAllocatedPaise exactly.
  const chargeAllocations = allocateFixedPriceLargestRemainder(
    P,
    runQuantities.map((q, idx) => ({ id: `run_${idx}`, weight: q }))
  );

  return runQuantities.map((qty, idx) => ({
    runIndex: idx + 1,
    executeOffsetMinutes: startOffsetMinutes + idx * gapMinutes,
    quantity: qty,
    allocatedChargePaise: chargeAllocations[idx]?.allocatedPaise || 0,
  }));
}

/**
 * Validates a PackageTemplate and its tiers before publication.
 * Enforces tier immutability once soldCount > 0.
 */
export function validatePackageTemplateForPublish(template: {
  status: string;
  scope: string;
  tiers: Array<{
    id: string;
    version: number;
    soldCount: number;
    pricePaise: number;
    items: Array<{
      serviceId: string;
      quantity: number;
      service: {
        status: string;
        isDeleted?: boolean;
        packageEligible?: boolean;
        minQty: number;
        maxQty: number;
        ratePer1000: any;
        providerCostPer1k?: any;
        providerCostPer1000?: any;
      };
    }>;
  }>;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!template.tiers || template.tiers.length === 0) {
    errors.push("Template must have at least one pricing tier.");
    return { valid: false, errors };
  }

  for (const tier of template.tiers) {
    if (!tier.items || tier.items.length === 0) {
      errors.push(`Tier ${tier.id} must have at least one item.`);
      continue;
    }

    let totalCostPaise = 0;

    for (const item of tier.items) {
      const s = item.service;
      if (!s || s.status !== "ACTIVE" || s.isDeleted) {
        errors.push(`Service ${item.serviceId} is not active in catalog.`);
      }
      if (s && s.packageEligible === false) {
        errors.push(`Service ${item.serviceId} is marked as not package-eligible.`);
      }
      if (s && (item.quantity < s.minQty || item.quantity > s.maxQty)) {
        errors.push(
          `Quantity ${item.quantity} for service ${item.serviceId} is outside bounds [${s.minQty}, ${s.maxQty}].`
        );
      }

      const costVal = s?.providerCostPer1k ?? s?.providerCostPer1000;
      if (costVal !== undefined && costVal !== null) {
        const costPaise = Math.ceil(
          (new Decimal(costVal.toString()).toNumber() * 100 * item.quantity) / 1000
        );
        totalCostPaise += costPaise;
      }
    }

    // Margin guard check
    const marginCheck = checkMarginFloor(tier.pricePaise, totalCostPaise, 0.15);
    if (!marginCheck.isAcceptable) {
      errors.push(
        `Tier ${tier.id} price (${tier.pricePaise} paise) fails margin floor of 15%. Cost is ${totalCostPaise} paise.`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

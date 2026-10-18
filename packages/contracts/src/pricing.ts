import { Decimal } from "decimal.js";
import { z } from "zod";

// Configure Decimal precision and rounding defaults
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface MarginTierConfig {
  maxCostINR: number; // Upper bound of tier (Infinity for top tier)
  marginPercent: number; // e.g. 80 for 80%
}

export interface PricingSettingsConfig {
  usdInrRate: number; // Current USD to INR conversion rate
  providerCurrency: string; // Default: 'USD'
  marginTiers: MarginTierConfig[];
  minMarginPercent: number; // Default: 20.0%
  minProfitPer1k: number; // Default: ₹5.00 floor
  paymentFeePercent: number; // Default: 2.36% (for profit calculations)
  minOrderCharge: number; // Default: ₹1.00 minimum order charge
  roundingStep: number; // Default: 0.50 (round up to nearest 0.50 INR)
  dripSurchargePercent: number; // Default: 0.0%
  priceChangeAlertPercent: number; // Default: 10.0%
}

export const DEFAULT_PRICING_SETTINGS: PricingSettingsConfig = {
  usdInrRate: 84.5,
  providerCurrency: "USD",
  marginTiers: [
    { maxCostINR: 100, marginPercent: 80 }, // cost < 100 -> +80%
    { maxCostINR: 500, marginPercent: 55 }, // 100-500 -> +55%
    { maxCostINR: Infinity, marginPercent: 35 }, // > 500 -> +35%
  ],
  minMarginPercent: 20.0,
  minProfitPer1k: 5.0,
  paymentFeePercent: 2.36,
  minOrderCharge: 1.0,
  roundingStep: 0.5,
  dripSurchargePercent: 0.0,
  priceChangeAlertPercent: 10.0,
};

/**
 * Converts provider rate (e.g. in USD) to INR cost per 1,000 using given FX rate.
 */
export function calculateCostINR(
  providerRate: number | string | Decimal,
  fxRate: number | string | Decimal = DEFAULT_PRICING_SETTINGS.usdInrRate,
  currency: string = "USD"
): Decimal {
  const pRate = new Decimal(providerRate || 0);
  if (pRate.isZero() || pRate.isNegative()) return new Decimal(0);
  if (currency.toUpperCase() === "INR") return pRate;

  const fx = new Decimal(fxRate || 1);
  return pRate.times(fx);
}

/**
 * Rounds value UP to the nearest step (e.g. step = 0.50: 12.12 -> 12.50, 12.60 -> 13.00)
 */
export function roundUpToStep(value: Decimal, step: number = 0.5): Decimal {
  if (value.isZero() || value.isNegative()) return new Decimal(0);
  const stepDec = new Decimal(step);
  return value.dividedBy(stepDec).ceil().times(stepDec);
}

/**
 * Authoritative single pricing function used across catalog sync, preview, order charge, and admin.
 * sellingRate = round_up(max(costINR * (1 + tierMargin), costINR * (1 + MIN_MARGIN), costINR + MIN_PROFIT_PER_1K))
 */
export function calculateSellingRate(
  costINR: number | string | Decimal,
  options: {
    settings?: Partial<PricingSettingsConfig>;
    marginPercentOverride?: number | null;
    fixedSellingRateOverride?: number | null;
    allowBelowMinMargin?: boolean;
  } = {}
): {
  sellingRate: Decimal;
  appliedMarginPercent: number;
  costINR: Decimal;
  isOverride: boolean;
  isBelowCost: boolean;
  warning?: string;
} {
  const cost = new Decimal(costINR || 0);
  const settings: PricingSettingsConfig = {
    ...DEFAULT_PRICING_SETTINGS,
    ...(options.settings || {}),
  };

  // Fixed override check
  if (options.fixedSellingRateOverride !== undefined && options.fixedSellingRateOverride !== null) {
    const fixedRate = new Decimal(options.fixedSellingRateOverride);
    const isBelowCost = fixedRate.lessThan(cost);
    return {
      sellingRate: fixedRate,
      appliedMarginPercent: cost.greaterThan(0)
        ? fixedRate.minus(cost).dividedBy(cost).times(100).toNumber()
        : 100,
      costINR: cost,
      isOverride: true,
      isBelowCost,
      warning: isBelowCost ? "Selling rate is strictly below provider cost!" : undefined,
    };
  }

  // Determine base margin percent
  let marginPct: number;
  let isOverride = false;

  if (options.marginPercentOverride !== undefined && options.marginPercentOverride !== null) {
    marginPct = options.marginPercentOverride;
    isOverride = true;
  } else {
    // Evaluate tiered margin by cost band
    const costNum = cost.toNumber();
    const matchedTier = settings.marginTiers.find((tier) => costNum < tier.maxCostINR);
    marginPct = matchedTier ? matchedTier.marginPercent : 35.0;
  }

  // Enforce minimum margin unless explicitly bypassed by admin
  if (!options.allowBelowMinMargin && marginPct < settings.minMarginPercent) {
    marginPct = settings.minMarginPercent;
  }

  // Calculate candid selling rates based on margin and absolute profit floor
  const rateByMargin = cost.times(new Decimal(1).plus(new Decimal(marginPct).dividedBy(100)));
  const rateByFloor = cost.plus(settings.minProfitPer1k);

  // Take the highest of margin calculation or minimum profit floor
  const unroundedRate = Decimal.max(rateByMargin, rateByFloor);

  // Round UP to the nearest configured step (default 0.50 INR)
  const sellingRate = roundUpToStep(unroundedRate, settings.roundingStep);
  const isBelowCost = sellingRate.lessThan(cost);

  return {
    sellingRate,
    appliedMarginPercent: cost.greaterThan(0)
      ? sellingRate.minus(cost).dividedBy(cost).times(100).toNumber()
      : marginPct,
    costINR: cost,
    isOverride,
    isBelowCost,
  };
}

function toSafeDecimal(val: any, defaultVal = 0): Decimal {
  if (val === undefined || val === null || val === "") return new Decimal(defaultVal);
  if (typeof val === "object" && typeof val.toString === "function") {
    return new Decimal(val.toString());
  }
  return new Decimal(val);
}

/**
 * Calculates total customer charge.
 * Formula: ceil2(sellingRate * totalUnits / 1000)
 * For Drip-feed: totalUnits = quantityPerRun * runs, optional drip surcharge applied.
 */
export function calculateCustomerCharge(
  sellingRate: number | string | Decimal,
  quantity: number,
  runs: number = 1,
  dripSurchargePercent: number = 0,
  minOrderCharge: number = 1.0
): {
  customerCharge: Decimal;
  totalUnits: number;
  rateWithSurcharge: Decimal;
} {
  const sellRateDec = toSafeDecimal(sellingRate, 0);
  const unitsPerRun = Math.max(1, quantity);
  const effectiveRuns = Math.max(1, runs);
  const totalUnits = unitsPerRun * effectiveRuns;

  let effectiveRate = sellRateDec;
  if (effectiveRuns > 1 && dripSurchargePercent > 0) {
    const surchargeFactor = new Decimal(1).plus(new Decimal(dripSurchargePercent).dividedBy(100));
    effectiveRate = sellRateDec.times(surchargeFactor);
  }

  // raw = effectiveRate * totalUnits / 1000
  const rawCharge = effectiveRate.times(totalUnits).dividedBy(1000);
  // Round UP strictly to 2 decimal places
  let customerCharge = rawCharge.toDecimalPlaces(2, Decimal.ROUND_UP);

  // Apply minimum order charge floor (₹1.00)
  if (customerCharge.lessThan(minOrderCharge)) {
    customerCharge = new Decimal(minOrderCharge).toDecimalPlaces(2, Decimal.ROUND_UP);
  }

  return {
    customerCharge,
    totalUnits,
    rateWithSurcharge: effectiveRate.toDecimalPlaces(2, Decimal.ROUND_UP),
  };
}

/**
 * Calculates estimated provider cost for an order based on cost per 1,000 INR.
 */
export function calculateEstimatedProviderCost(
  costRatePer1k: number | string | Decimal,
  totalUnits: number
): Decimal {
  const costRate = toSafeDecimal(costRatePer1k, 0);
  return costRate.times(totalUnits).dividedBy(1000).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

export interface OrderFinancialSnapshotInput {
  sellRatePer1k: number | string | Decimal;
  costRatePer1k: number | string | Decimal;
  quantityPerRun: number;
  runs?: number;
  dripSurchargePercent?: number;
  paymentFeePercent?: number;
  fxRateUsed?: number;
  providerCurrency?: string;
  minOrderCharge?: number;
}

/**
 * Computes estimated financial breakdown for an order.
 * Accepts either an object or positional arguments.
 */
export function calculateOrderFinancialSnapshot(
  arg1: number | string | Decimal | OrderFinancialSnapshotInput,
  costRateINR?: number | string | Decimal,
  quantity?: number,
  runs: number = 1,
  dripSurchargePercent: number = 0,
  paymentFeePercent: number = 2.36
): {
  customerCharge: Decimal;
  charge: Decimal;
  estimatedProviderCost: Decimal;
  estimatedGrossProfit: Decimal;
  paymentFeeEstimate: Decimal;
  estimatedNetProfit: Decimal;
  netMarginPercent: number;
  sellRatePer1k: number;
  costRatePer1k: number;
  fxRateUsed: number;
  providerCurrency: string;
  dripSurchargePercent: number;
  totalQuantity: number;
} {
  let sellRate: any;
  let costRate: any;
  let qty: number;
  let runCount: number;
  let dripSurcharge: number;
  let feePct: number;
  let fxRate = 1.0;
  let currency = "INR";
  let minCharge = 1.0;

  if (typeof arg1 === "object" && !("toNumber" in arg1) && !("toFixed" in arg1)) {
    const input = arg1 as OrderFinancialSnapshotInput;
    sellRate = input.sellRatePer1k;
    costRate = input.costRatePer1k;
    qty = input.quantityPerRun;
    runCount = input.runs || 1;
    dripSurcharge = input.dripSurchargePercent || 0;
    feePct = input.paymentFeePercent !== undefined ? input.paymentFeePercent : 2.36;
    fxRate = input.fxRateUsed || 1.0;
    currency = input.providerCurrency || "INR";
    minCharge = input.minOrderCharge || 1.0;
  } else {
    sellRate = arg1;
    costRate = costRateINR!;
    qty = quantity!;
    runCount = runs || 1;
    dripSurcharge = dripSurchargePercent || 0;
    feePct = paymentFeePercent || 2.36;
  }

  const { customerCharge, totalUnits } = calculateCustomerCharge(
    sellRate,
    qty,
    runCount,
    dripSurcharge,
    minCharge
  );
  const estimatedProviderCost = calculateEstimatedProviderCost(costRate, totalUnits);
  const estimatedGrossProfit = customerCharge.minus(estimatedProviderCost);

  // Payment gateway fee estimate (e.g. 2.36% of charge)
  const paymentFeeEstimate = customerCharge
    .times(new Decimal(feePct).dividedBy(100))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  const estimatedNetProfit = estimatedGrossProfit.minus(paymentFeeEstimate);

  const netMarginPercent = customerCharge.greaterThan(0)
    ? estimatedNetProfit.dividedBy(customerCharge).times(100).toNumber()
    : 0;

  return {
    customerCharge,
    charge: customerCharge,
    estimatedProviderCost,
    estimatedGrossProfit,
    paymentFeeEstimate,
    estimatedNetProfit,
    netMarginPercent,
    sellRatePer1k: toSafeDecimal(sellRate).toNumber(),
    costRatePer1k: toSafeDecimal(costRate).toNumber(),
    fxRateUsed: fxRate,
    providerCurrency: currency,
    dripSurchargePercent: dripSurcharge,
    totalQuantity: totalUnits,
  };
}

/**
 * Reconciles realized revenue, cost, and profit when an order finishes with Partial or Cancelled.
 */
export function calculateRealizedProfit(
  charge: number | string | Decimal,
  actualCostINR: number | string | Decimal,
  refundAmount: number | string | Decimal,
  paymentFeePercent: number = 2.36
): {
  realizedRevenue: Decimal;
  actualProviderCost: Decimal;
  paymentFee: Decimal;
  realizedNetProfit: Decimal;
} {
  const chargeDec = new Decimal(charge || 0);
  const refundDec = new Decimal(refundAmount || 0);
  const actualCost = new Decimal(actualCostINR || 0);

  const realizedRevenue = Decimal.max(0, chargeDec.minus(refundDec));
  const paymentFee = realizedRevenue
    .times(new Decimal(paymentFeePercent).dividedBy(100))
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const realizedNetProfit = realizedRevenue.minus(actualCost).minus(paymentFee);

  return {
    realizedRevenue,
    actualProviderCost: actualCost,
    paymentFee,
    realizedNetProfit,
  };
}

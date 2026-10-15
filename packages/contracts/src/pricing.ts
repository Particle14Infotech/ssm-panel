import Decimal from "decimal.js";

/**
 * Computes price for a given quantity and rate per 1000 items.
 * Formula: (ratePer1000 / 1000) * quantity
 * Returns a fixed-point Decimal string rounded to 4 decimal places.
 */
export function calculateOrderPrice(
  ratePer1000: number | string | Decimal,
  quantity: number | string | Decimal
): {
  unitPrice: Decimal;
  totalPrice: Decimal;
  formattedTotal: string;
} {
  const rate = new Decimal(ratePer1000);
  const qty = new Decimal(quantity);
  const unitPrice = rate.dividedBy(1000);
  const totalPrice = unitPrice.times(qty);

  return {
    unitPrice,
    totalPrice,
    formattedTotal: totalPrice.toFixed(4),
  };
}

/**
 * Calculates provider markup pricing.
 */
export function calculateSellingRate(
  providerRatePer1000: number | string | Decimal,
  markupPercentage: number | string | Decimal,
  fixedMarkup: number | string | Decimal = 0
): {
  sellingRate: Decimal;
  profitPer1000: Decimal;
  marginPercent: Decimal;
} {
  const provider = new Decimal(providerRatePer1000);
  const markupPct = new Decimal(markupPercentage).dividedBy(100);
  const fixed = new Decimal(fixedMarkup);

  const percentageMarkupAmount = provider.times(markupPct);
  const sellingRate = provider.plus(percentageMarkupAmount).plus(fixed);
  const profitPer1000 = sellingRate.minus(provider);
  const marginPercent = sellingRate.isZero()
    ? new Decimal(0)
    : profitPer1000.dividedBy(sellingRate).times(100);

  return {
    sellingRate,
    profitPer1000,
    marginPercent,
  };
}

// Note: calculatePartialRefund is authoritatively exported from ./orders

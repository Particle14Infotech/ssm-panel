import { Decimal } from "decimal.js";

// Strict money formatting & arithmetic without IEEE 754 floating point inaccuracies

export function toPaise(rupees: number | string | Decimal): number {
  return new Decimal(rupees.toString()).times(100).round().toNumber();
}

export function fromPaise(paise: number): Decimal {
  return new Decimal(paise).dividedBy(100);
}

export function formatINR(rupees: number | string | Decimal, decimals: number = 2): string {
  const d = new Decimal(rupees.toString());
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(d.toNumber());
}

/**
 * Calculates order charge strictly:
 * charge = round_half_up(quantity * ratePer1000 / 1000)
 */
export function calculateOrderCharge(quantity: number, ratePer1000: number | Decimal): Decimal {
  const qty = new Decimal(quantity);
  const rate = new Decimal(ratePer1000.toString());
  return qty.times(rate).dividedBy(1000).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/**
 * Calculates partial refund strictly:
 * refund = round_half_up(charge * remains / quantity)
 */
export function calculatePartialRefund(charge: number | Decimal, remains: number, quantity: number): Decimal {
  if (quantity <= 0 || remains <= 0) return new Decimal(0);
  const chg = new Decimal(charge.toString());
  const rem = new Decimal(remains);
  const qty = new Decimal(quantity);
  return chg.times(rem).dividedBy(qty).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

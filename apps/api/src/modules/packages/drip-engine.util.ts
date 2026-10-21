import { Decimal } from "decimal.js";

export interface FollowersDripInput {
  totalQuantity: number;
  serviceMin: number;
  serviceMax: number;
  days: number;
  intervalHours: number;
  ratePer1000: number;
  startAt?: Date;
}

export interface DripRun {
  seq: number;
  executeAt: Date;
  quantity: number;
  allocatedCharge: number;
}

export interface FollowersDripResult {
  runsCount: number;
  totalQuantity: number;
  totalCharge: number;
  runs: DripRun[];
  warning?: string;
}

export interface PerPostDripInput {
  quantity: number;
  serviceMin: number;
  serviceMax: number;
  maxRunsPerPost: number;
  windowMinutes: number;
  minGapMinutes: number;
  ratePer1000: number;
  startAt?: Date;
}

export interface PerPostDripResult {
  runsCount: number;
  quantity: number;
  totalCharge: number;
  gapMinutes: number;
  runs: DripRun[];
  warning?: string;
}

/**
 * Followers pure time-interval drip calculator.
 * runs = min(floor(Q / serviceMin), floor(days / interval))
 * even spacing, remainder to first runs, charge shares sum exactly to totalCharge.
 */
export function calculateFollowersDrip(input: FollowersDripInput): FollowersDripResult {
  const { totalQuantity, serviceMin, serviceMax, days, intervalHours, ratePer1000 } = input;
  const startAt = input.startAt || new Date();

  const totalChargeDec = new Decimal(ratePer1000)
    .times(totalQuantity)
    .dividedBy(1000)
    .toDecimalPlaces(2, Decimal.ROUND_CEIL);

  const totalCharge = totalChargeDec.toNumber();

  const maxRunsFromQty = Math.floor(totalQuantity / serviceMin);
  const intervalDays = intervalHours / 24;
  const maxRunsFromTime = Math.floor(days / intervalDays);

  const runsCount = Math.max(1, Math.min(maxRunsFromQty, maxRunsFromTime));

  let warning: string | undefined = undefined;
  if (runsCount === 1 && days > 1) {
    warning = `Quantity (${totalQuantity}) is too small to split across ${days} days (service minimum per run is ${serviceMin}). A single run will be scheduled.`;
  }

  const baseQty = Math.floor(totalQuantity / runsCount);
  const remQty = totalQuantity % runsCount;

  const runQuantities: number[] = [];
  for (let i = 0; i < runsCount; i++) {
    const q = i < remQty ? baseQty + 1 : baseQty;
    runQuantities.push(q);
  }

  // Exact charge split: last run takes remainder
  const chargeShares: number[] = [];
  let runningCharge = new Decimal(0);

  for (let i = 0; i < runsCount; i++) {
    if (i === runsCount - 1) {
      const lastShare = totalChargeDec.minus(runningCharge);
      chargeShares.push(lastShare.toNumber());
    } else {
      const share = new Decimal(runQuantities[i])
        .times(ratePer1000)
        .dividedBy(1000)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      chargeShares.push(share.toNumber());
      runningCharge = runningCharge.plus(share);
    }
  }

  const spacingMs = (days * 24 * 3600 * 1000) / runsCount;
  const runs: DripRun[] = [];

  for (let i = 0; i < runsCount; i++) {
    const executeAt = new Date(startAt.getTime() + i * spacingMs);
    runs.push({
      seq: i + 1,
      executeAt,
      quantity: runQuantities[i],
      allocatedCharge: chargeShares[i],
    });
  }

  return {
    runsCount,
    totalQuantity,
    totalCharge,
    runs,
    warning,
  };
}

/**
 * Per-post pure time-interval drip calculator.
 * runs = clamp(min(floor(q / min), maxRunsPerPost, floor(window / minGap)), 1)
 * gap = window / runs, deterministic schedule, first run executeAt = startAt (now).
 * remainder to the first runs, allocatedCharge per run sums EXACTLY to ceil(rate x q / 1000).
 */
export function calculatePerPostDrip(input: PerPostDripInput): PerPostDripResult {
  const { quantity, serviceMin, serviceMax, maxRunsPerPost, windowMinutes, minGapMinutes, ratePer1000 } = input;
  const startAt = input.startAt || new Date();

  const totalChargeDec = new Decimal(ratePer1000)
    .times(quantity)
    .dividedBy(1000)
    .toDecimalPlaces(2, Decimal.ROUND_CEIL);

  const totalCharge = totalChargeDec.toNumber();

  const maxFromQty = Math.floor(quantity / serviceMin);
  const maxFromGap = Math.floor(windowMinutes / minGapMinutes);

  const runsCount = Math.max(1, Math.min(maxFromQty, maxRunsPerPost, maxFromGap));
  const gapMinutes = runsCount > 1 ? Math.floor(windowMinutes / runsCount) : windowMinutes;

  let warning: string | undefined = undefined;
  if (runsCount === 1) {
    if (quantity < serviceMin * 2) {
      warning = `Quantity (${quantity}) cannot be split into multiple runs with service minimum ${serviceMin}. A single execution will be dispatched.`;
    } else if (windowMinutes < minGapMinutes * 2) {
      warning = `Delivery window (${windowMinutes}m) cannot accommodate multiple runs with minimum gap ${minGapMinutes}m. A single execution will be dispatched.`;
    }
  }

  const baseQty = Math.floor(quantity / runsCount);
  const remQty = quantity % runsCount;

  const runQuantities: number[] = [];
  for (let i = 0; i < runsCount; i++) {
    const q = i < remQty ? baseQty + 1 : baseQty;
    runQuantities.push(q);
  }

  // Exact charge split: last run takes remainder
  const chargeShares: number[] = [];
  let runningCharge = new Decimal(0);

  for (let i = 0; i < runsCount; i++) {
    if (i === runsCount - 1) {
      const lastShare = totalChargeDec.minus(runningCharge);
      chargeShares.push(lastShare.toNumber());
    } else {
      const share = new Decimal(runQuantities[i])
        .times(ratePer1000)
        .dividedBy(1000)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      chargeShares.push(share.toNumber());
      runningCharge = runningCharge.plus(share);
    }
  }

  const runs: DripRun[] = [];
  for (let i = 0; i < runsCount; i++) {
    // First run is immediate (executeAt = startAt), subsequent runs spaced by gapMinutes
    const executeAt = new Date(startAt.getTime() + i * gapMinutes * 60 * 1000);
    runs.push({
      seq: i + 1,
      executeAt,
      quantity: runQuantities[i],
      allocatedCharge: chargeShares[i],
    });
  }

  return {
    runsCount,
    quantity,
    totalCharge,
    gapMinutes,
    runs,
    warning,
  };
}

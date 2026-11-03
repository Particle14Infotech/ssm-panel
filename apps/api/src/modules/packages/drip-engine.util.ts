import { Decimal } from "decimal.js";

export interface FollowersDripInput {
  totalQuantity: number;
  serviceMin: number;
  serviceMax?: number;
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
  explicitRunsCount?: number;
  explicitIntervalMinutes?: number;
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

  if (!Number.isSafeInteger(totalQuantity) || totalQuantity <= 0) {
    throw new RangeError("Total quantity must be a positive safe integer.");
  }
  if (!Number.isSafeInteger(serviceMin) || serviceMin <= 0) {
    throw new RangeError("Service minimum must be a positive integer.");
  }
  if (
    serviceMax !== undefined &&
    (!Number.isSafeInteger(serviceMax) || serviceMax < serviceMin)
  ) {
    throw new RangeError("Service maximum must be an integer greater than or equal to its minimum.");
  }
  if (!Number.isSafeInteger(days) || days <= 0) {
    throw new RangeError("Schedule duration must be a positive integer.");
  }
  if (!Number.isSafeInteger(intervalHours) || intervalHours <= 0) {
    throw new RangeError("Run interval must be a positive integer.");
  }
  if (!Number.isFinite(ratePer1000) || ratePer1000 < 0) {
    throw new RangeError("Service rate must be a non-negative finite number.");
  }
  if (totalQuantity < serviceMin) {
    throw new RangeError(`Total quantity (${totalQuantity}) is below the service minimum of ${serviceMin}.`);
  }

  const totalChargeDec = new Decimal(ratePer1000)
    .times(totalQuantity)
    .dividedBy(1000)
    .toDecimalPlaces(2, Decimal.ROUND_CEIL);

  const totalCharge = totalChargeDec.toNumber();

  const maxRunsFromQty = Math.floor(totalQuantity / serviceMin);
  const maxRunsFromTime = Math.floor((days * 24) / intervalHours);
  const minRunsFromMax = serviceMax === undefined
    ? 1
    : Math.ceil(totalQuantity / serviceMax);
  const maxFeasibleRuns = Math.min(maxRunsFromQty, maxRunsFromTime);

  if (maxFeasibleRuns < minRunsFromMax) {
    throw new RangeError(
      `Quantity (${totalQuantity}) cannot be split into runs between the service minimum (${serviceMin}) and maximum (${serviceMax ?? "unbounded"}) within ${days} days at ${intervalHours}-hour intervals.`
    );
  }

  const runsCount = Math.max(
    minRunsFromMax,
    Math.min(maxRunsFromQty, maxRunsFromTime)
  );

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

  let runsCount: number;
  if (input.explicitRunsCount && input.explicitRunsCount > 0) {
    // If user explicitly chose 1, 2, 4, etc. runs
    runsCount = Math.max(1, Math.min(input.explicitRunsCount, maxFromQty, maxRunsPerPost));
  } else {
    runsCount = Math.max(1, Math.min(maxFromQty, maxRunsPerPost, maxFromGap));
  }

  let gapMinutes: number;
  if (input.explicitIntervalMinutes && input.explicitIntervalMinutes > 0) {
    gapMinutes = Math.max(1, input.explicitIntervalMinutes);
  } else {
    gapMinutes = runsCount > 1 ? Math.floor(windowMinutes / runsCount) : windowMinutes;
  }

  let warning: string | undefined = undefined;
  if (input.explicitRunsCount && input.explicitRunsCount > runsCount) {
    warning = `Requested ${input.explicitRunsCount} runs clamped to ${runsCount} runs due to service minimum (${serviceMin}) or post limits.`;
  } else if (runsCount === 1) {
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


export interface IntradayPacingItemInput {
  serviceId?: string;
  serviceKind?: string;
  totalQuantity: number;
  durationDays: number;
  minQty: number;
  totalAllocatedCharge: number | Decimal;
  startAt: Date;
  timezone?: string;
}

export interface IntradayPacedRun {
  seq: number;
  dayIndex: number;
  batchIndex: number;
  quantity: number;
  allocatedCharge: Decimal;
  executeAt: Date;
}

/**
 * Calculates continuous, natural intraday micro-batches across active hours for each day of a package.
 * Prevents clustering all daily runs at a single wall-clock minute.
 */
export function calculateIntradayPacedRuns(input: IntradayPacingItemInput): {
  runs: IntradayPacedRun[];
  totalRuns: number;
  totalQuantity: number;
  totalCharge: Decimal;
} {
  const { totalQuantity, durationDays, minQty, totalAllocatedCharge, serviceKind, startAt } = input;
  const runs: IntradayPacedRun[] = [];
  let seq = 1;
  let accumulatedCharge = new Decimal(0);
  const totalChargeDec = new Decimal(totalAllocatedCharge);

  let offsetMinutes = 0;
  const kUpper = (serviceKind || "").toUpperCase();
  if (kUpper.includes("LIKE")) offsetMinutes = 25;
  else if (kUpper.includes("SHARE")) offsetMinutes = 50;
  else if (kUpper.includes("COMMENT")) offsetMinutes = 75;
  else if (kUpper.includes("FOLLOWER")) offsetMinutes = 15;

  const days = Math.max(1, durationDays);
  const baseDaily = Math.floor(totalQuantity / days);
  const remDaily = totalQuantity % days;

  for (let d = 0; d < days; d++) {
    const dailyQty = d < remDaily ? baseDaily + 1 : baseDaily;
    if (dailyQty <= 0) continue;

    const providerMin = Math.max(1, minQty);
    const maxBatches = Math.floor(dailyQty / providerMin);

    let prefBatches = 4;
    if (kUpper.includes("VIEW")) prefBatches = 8;
    else if (kUpper.includes("LIKE")) prefBatches = 4;
    else if (kUpper.includes("SHARE") || kUpper.includes("COMMENT")) prefBatches = 2;
    else if (kUpper.includes("FOLLOWER")) prefBatches = 5;

    const k = Math.max(1, Math.min(prefBatches, maxBatches));
    const baseBatch = Math.floor(dailyQty / k);
    const remBatch = dailyQty % k;

    // 13 active hours = 780 mins (e.g. 09:00 to 22:00)
    const intervalMins = Math.floor(780 / k);

    for (let b = 0; b < k; b++) {
      const batchQty = b < remBatch ? baseBatch + 1 : baseBatch;
      const dayBase = new Date(startAt.getTime() + d * 24 * 3600 * 1000);
      const executeAt = new Date(dayBase.getTime() + (b * intervalMins + offsetMinutes) * 60 * 1000);

      let charge: Decimal;
      if (d === days - 1 && b === k - 1) {
        charge = totalChargeDec.minus(accumulatedCharge);
      } else {
        charge = totalChargeDec
          .times(batchQty)
          .dividedBy(totalQuantity)
          .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }
      accumulatedCharge = accumulatedCharge.plus(charge);

      runs.push({
        seq: seq++,
        dayIndex: d + 1,
        batchIndex: b + 1,
        quantity: batchQty,
        executeAt,
        allocatedCharge: charge,
      });
    }
  }

  return {
    runs,
    totalRuns: runs.length,
    totalQuantity,
    totalCharge: accumulatedCharge,
  };
}

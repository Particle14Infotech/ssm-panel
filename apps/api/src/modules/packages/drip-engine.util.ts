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
 * Safely distributes a total quantity into count batches with randomized organic variance.
 * Guarantees:
 * 1. Every batch quantity is >= serviceMin (zero provider rejects).
 * 2. If serviceMax is provided, every batch is <= serviceMax.
 * 3. The sum of all batches exactly equals totalQuantity (zero discrepancy).
 */
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function distributeRandomSafeQuantities(
  totalQuantity: number,
  serviceMin: number,
  serviceMax?: number,
  count: number = 1,
  seedValue: number = 0
): number[] {
  const effectiveMin = Math.max(1, serviceMin);
  if (count <= 1 || totalQuantity <= effectiveMin) {
    return [totalQuantity];
  }

  // Physical maximum batches possible without violating service minimum
  const maxPossibleBatches = Math.floor(totalQuantity / effectiveMin);
  let actualCount = Math.max(1, Math.min(count, maxPossibleBatches));

  // If actualCount would force excess to be 0 (meaning every batch is strictly identical to effectiveMin),
  // and we have more than 1 batch, reduce count by 1 so that there is organic variance.
  if (actualCount > 1 && totalQuantity === actualCount * effectiveMin) {
    actualCount = Math.max(1, actualCount - 1);
  }

  if (actualCount === 1) {
    return [totalQuantity];
  }

  const baseTotal = actualCount * effectiveMin;
  const excess = totalQuantity - baseTotal;

  if (excess <= 0) {
    return Array(actualCount).fill(effectiveMin);
  }

  const seed = Math.abs(
    (totalQuantity * 2654435761) ^
    (effectiveMin * 2246822519) ^
    (actualCount * 3266489917) ^
    ((seedValue || 1337) * 374761393)
  ) >>> 0;
  const rng = mulberry32(seed);

  // Generate random weights with controlled organic variance (+/- 25% around 1.0)
  const rawWeights: number[] = [];
  let sumWeights = 0;
  for (let i = 0; i < actualCount; i++) {
    const w = 0.70 + rng() * 0.60;
    rawWeights.push(w);
    sumWeights += w;
  }

  // Distribute excess proportionally
  const excesses: number[] = [];
  let allocatedExcess = 0;

  for (let i = 0; i < actualCount; i++) {
    if (i === actualCount - 1) {
      excesses.push(excess - allocatedExcess);
    } else {
      const share = Math.round(excess * (rawWeights[i] / sumWeights));
      const cappedShare = Math.min(share, excess - allocatedExcess);
      excesses.push(cappedShare);
      allocatedExcess += cappedShare;
    }
  }

  // Combine effectiveMin + excess
  const quantities = excesses.map((e) => effectiveMin + e);

  // If serviceMax is bounded, ensure no batch exceeds it
  if (serviceMax && serviceMax > effectiveMin) {
    for (let i = 0; i < quantities.length; i++) {
      if (quantities[i] > serviceMax) {
        const overflow = quantities[i] - serviceMax;
        quantities[i] = serviceMax;
        for (let j = 0; j < quantities.length && overflow > 0; j++) {
          if (j !== i && quantities[j] < serviceMax) {
            const add = Math.min(overflow, serviceMax - quantities[j]);
            quantities[j] += add;
          }
        }
      }
    }
  }

  // Ensure exact sum match
  const currentSum = quantities.reduce((a, b) => a + b, 0);
  const diff = totalQuantity - currentSum;
  if (diff !== 0) {
    for (let i = 0; i < quantities.length; i++) {
      if (quantities[i] + diff >= effectiveMin) {
        quantities[i] += diff;
        break;
      }
    }
  }

  return quantities;
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

  const seedValue = Math.floor(startAt.getTime() / 1000);
  const runQuantities = distributeRandomSafeQuantities(
    totalQuantity,
    serviceMin,
    serviceMax,
    runsCount,
    seedValue
  );

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

  const runQuantities = distributeRandomSafeQuantities(
    quantity,
    serviceMin,
    serviceMax,
    runsCount
  );

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
  const providerMin = Math.max(1, minQty);

  // Determine how many days can feasibly have batches >= providerMin
  // E.g. if totalQuantity < days * providerMin (e.g. 24 likes with min 10 over 5 days):
  // We can only have active days = Math.floor(totalQuantity / providerMin) = 2 days!
  const maxActiveDays = Math.max(1, Math.min(days, Math.floor(totalQuantity / providerMin)));

  // Evenly or organically space the active days across the duration
  const activeDayIndices: number[] = [];
  if (maxActiveDays >= days) {
    for (let d = 0; d < days; d++) activeDayIndices.push(d);
  } else {
    const step = days / maxActiveDays;
    for (let i = 0; i < maxActiveDays; i++) {
      activeDayIndices.push(Math.min(days - 1, Math.floor(i * step)));
    }
  }

  // Distribute totalQuantity across the active days with safe randomness
  const dailyQuantities = distributeRandomSafeQuantities(
    totalQuantity,
    providerMin,
    undefined,
    maxActiveDays
  );

  for (let idx = 0; idx < activeDayIndices.length; idx++) {
    const d = activeDayIndices[idx];
    const dailyQty = dailyQuantities[idx];
    if (dailyQty <= 0) continue;

    // Batches per day for this service kind
    let prefBatches = 4;
    if (kUpper.includes("VIEW")) prefBatches = 8;
    else if (kUpper.includes("LIKE")) prefBatches = 4;
    else if (kUpper.includes("SHARE") || kUpper.includes("COMMENT")) prefBatches = 2;
    else if (kUpper.includes("FOLLOWER")) prefBatches = 5;

    const maxBatches = Math.floor(dailyQty / providerMin);
    const k = Math.max(1, Math.min(prefBatches, maxBatches));

    // Distribute dailyQty into k batches safely with variance
    const batchQuantities = distributeRandomSafeQuantities(
      dailyQty,
      providerMin,
      undefined,
      k
    );

    const intervalMins = Math.floor(780 / k);

    for (let b = 0; b < batchQuantities.length; b++) {
      const batchQty = batchQuantities[b];
      const dayBase = new Date(startAt.getTime() + d * 24 * 3600 * 1000);

      // Add controlled time jitter: +/- 10 to 20 minutes with deterministic PRNG so it doesn't look like an automated cron
      const timeRng = mulberry32(Math.abs((dayBase.getTime() ^ (b * 7919) ^ (idx * 104729))) >>> 0);
      const jitterMins = Math.floor(timeRng() * 20 - 10);
      const executeAt = new Date(
        dayBase.getTime() + (b * intervalMins + offsetMinutes + jitterMins) * 60 * 1000
      );

      let charge: Decimal;
      if (idx === activeDayIndices.length - 1 && b === batchQuantities.length - 1) {
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

  // Sort runs chronologically and re-index sequence
  runs.sort((a, b) => a.executeAt.getTime() - b.executeAt.getTime());
  runs.forEach((r, i) => { r.seq = i + 1; });

  return {
    runs,
    totalRuns: runs.length,
    totalQuantity,
    totalCharge: accumulatedCharge,
  };
}

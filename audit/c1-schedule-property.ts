import { calculateFollowersDrip, calculatePerPostDrip, FollowersDripInput, PerPostDripInput } from "../apps/api/src/modules/packages/drip-engine.util";
import { Decimal } from "decimal.js";

interface TestStats {
  totalRunsTested: number;
  followersPassed: number;
  followersFailed: number;
  perPostPassed: number;
  perPostFailed: number;
  failures: string[];
}

const stats: TestStats = {
  totalRunsTested: 0,
  followersPassed: 0,
  followersFailed: 0,
  perPostPassed: 0,
  perPostFailed: 0,
  failures: [],
};

console.log("=== C1 SCHEDULE PROPERTY TEST (10,000 ITERATIONS) ===");

// 1. Specific Edge Cases
const edgeCases: FollowersDripInput[] = [
  { totalQuantity: 100, serviceMin: 100, serviceMax: 10000, days: 1, intervalHours: 12, ratePer1000: 5.5 },
  { totalQuantity: 101, serviceMin: 100, serviceMax: 10000, days: 1, intervalHours: 12, ratePer1000: 5.5 },
  { totalQuantity: 1000, serviceMin: 10, serviceMax: 50, days: 365, intervalHours: 24, ratePer1000: 1.25 },
  { totalQuantity: 1000000, serviceMin: 500, serviceMax: 50000, days: 180, intervalHours: 6, ratePer1000: 10.0 },
  { totalQuantity: 500, serviceMin: 50, serviceMax: 100, days: 5, intervalHours: 24, ratePer1000: 0.01 },
  { totalQuantity: 3650, serviceMin: 10, serviceMax: 100, days: 365, intervalHours: 24, ratePer1000: 2.5 },
];

for (const ec of edgeCases) {
  stats.totalRunsTested++;
  try {
    const res = calculateFollowersDrip(ec);
    const sumQty = res.runs.reduce((a, b) => a + b.quantity, 0);
    const sumCharge = res.runs.reduce((a, b) => a.plus(b.allocatedCharge), new Decimal(0));
    
    if (sumQty !== ec.totalQuantity) {
      throw new Error(`Edge case sum quantity mismatch: expected ${ec.totalQuantity}, got ${sumQty}`);
    }
    if (!sumCharge.equals(new Decimal(res.totalCharge))) {
      throw new Error(`Edge case sum charge mismatch: expected ${res.totalCharge}, got ${sumCharge.toString()}`);
    }
    stats.followersPassed++;
  } catch (err: any) {
    stats.followersFailed++;
    stats.failures.push(`Edge case failed: ${err.message}`);
  }
}

// 2. 5,000 Randomized Followers Tests
for (let i = 0; i < 5000; i++) {
  stats.totalRunsTested++;
  const serviceMin = Math.floor(Math.random() * 100) + 10; // 10..109
  const serviceMax = Math.floor(Math.random() * 5000) + serviceMin;
  const days = Math.floor(Math.random() * 365) + 1; // 1..365
  const intervalHours = [6, 12, 24, 48][Math.floor(Math.random() * 4)];
  const ratePer1000 = parseFloat((Math.random() * 20 + 0.1).toFixed(3));
  
  // Choose quantity that is feasible
  const minRunsFromMax = Math.ceil(serviceMin / serviceMax);
  const minAllowedQty = serviceMin * Math.max(1, Math.min(days, 5));
  const totalQuantity = Math.floor(Math.random() * 50000) + minAllowedQty;

  const maxRunsFromQty = Math.floor(totalQuantity / serviceMin);
  const maxRunsFromTime = Math.floor((days * 24) / intervalHours);
  const minRunsFromMaxCalc = Math.ceil(totalQuantity / serviceMax);

  if (Math.min(maxRunsFromQty, maxRunsFromTime) < minRunsFromMaxCalc) {
    // Skip naturally infeasible combinations
    continue;
  }

  const startAt = new Date("2026-10-24T00:00:00Z");

  try {
    const res = calculateFollowersDrip({
      totalQuantity,
      serviceMin,
      serviceMax,
      days,
      intervalHours,
      ratePer1000,
      startAt,
    });

    // Invariant 1: Sum == Total
    const sumQty = res.runs.reduce((a, b) => a + b.quantity, 0);
    if (sumQty !== totalQuantity) {
      throw new Error(`Iteration ${i}: Sum qty (${sumQty}) != Total (${totalQuantity})`);
    }

    // Invariant 2: Runs count matches
    if (res.runs.length !== res.runsCount) {
      throw new Error(`Iteration ${i}: runs.length (${res.runs.length}) != runsCount (${res.runsCount})`);
    }

    // Invariant 3: Strictly increasing executeAt
    for (let r = 1; r < res.runs.length; r++) {
      if (res.runs[r].executeAt.getTime() <= res.runs[r - 1].executeAt.getTime()) {
        throw new Error(`Iteration ${i}: Timestamps not strictly increasing at index ${r}`);
      }
    }

    // Invariant 4: Bounded by min/max
    for (const run of res.runs) {
      if (run.quantity < serviceMin) {
        throw new Error(`Iteration ${i}: Run quantity ${run.quantity} < serviceMin ${serviceMin}`);
      }
      if (serviceMax && run.quantity > serviceMax) {
        throw new Error(`Iteration ${i}: Run quantity ${run.quantity} > serviceMax ${serviceMax}`);
      }
    }

    // Invariant 5: Charge sums exactly
    const sumCharge = res.runs.reduce((acc, r) => acc.plus(r.allocatedCharge), new Decimal(0));
    if (!sumCharge.equals(new Decimal(res.totalCharge))) {
      throw new Error(`Iteration ${i}: Charge sum ${sumCharge} != totalCharge ${res.totalCharge}`);
    }

    // Invariant 6: All runs within window
    const maxAllowedTime = startAt.getTime() + days * 24 * 3600 * 1000;
    const lastRunTime = res.runs[res.runs.length - 1].executeAt.getTime();
    if (lastRunTime > maxAllowedTime) {
      throw new Error(`Iteration ${i}: Last run time ${lastRunTime} exceeds window ${maxAllowedTime}`);
    }

    stats.followersPassed++;
  } catch (err: any) {
    stats.followersFailed++;
    if (stats.failures.length < 10) {
      stats.failures.push(`Followers iteration ${i} failed: ${err.message}`);
    }
  }
}

// 3. 5,000 Randomized Per-Post Tests
for (let i = 0; i < 5000; i++) {
  stats.totalRunsTested++;
  const serviceMin = Math.floor(Math.random() * 50) + 10;
  const serviceMax = Math.floor(Math.random() * 5000) + serviceMin;
  const quantity = Math.floor(Math.random() * 10000) + serviceMin;
  const maxRunsPerPost = Math.floor(Math.random() * 10) + 1;
  const windowMinutes = Math.floor(Math.random() * 720) + 60; // 1 to 12 hours
  const minGapMinutes = Math.floor(Math.random() * 30) + 5;
  const ratePer1000 = parseFloat((Math.random() * 15 + 0.5).toFixed(3));
  const startAt = new Date("2026-10-24T00:00:00Z");

  try {
    const res = calculatePerPostDrip({
      quantity,
      serviceMin,
      serviceMax,
      maxRunsPerPost,
      windowMinutes,
      minGapMinutes,
      ratePer1000,
      startAt,
    });

    // Invariant 1: Sum == Total
    const sumQty = res.runs.reduce((a, b) => a + b.quantity, 0);
    if (sumQty !== quantity) {
      throw new Error(`PerPost iteration ${i}: Sum qty (${sumQty}) != Total (${quantity})`);
    }

    // Invariant 2: Runs count matches
    if (res.runs.length !== res.runsCount) {
      throw new Error(`PerPost iteration ${i}: runs.length (${res.runs.length}) != runsCount (${res.runsCount})`);
    }

    // Invariant 3: Strictly increasing if runs > 1
    if (res.runsCount > 1) {
      for (let r = 1; r < res.runs.length; r++) {
        if (res.runs[r].executeAt.getTime() <= res.runs[r - 1].executeAt.getTime()) {
          throw new Error(`PerPost iteration ${i}: Timestamps not strictly increasing at index ${r}`);
        }
      }
    }

    // Invariant 4: First run at startAt
    if (res.runs[0].executeAt.getTime() !== startAt.getTime()) {
      throw new Error(`PerPost iteration ${i}: First run not at startAt`);
    }

    // Invariant 5: Charge sums exactly
    const sumCharge = res.runs.reduce((acc, r) => acc.plus(r.allocatedCharge), new Decimal(0));
    if (!sumCharge.equals(new Decimal(res.totalCharge))) {
      throw new Error(`PerPost iteration ${i}: Charge sum ${sumCharge} != totalCharge ${res.totalCharge}`);
    }

    stats.perPostPassed++;
  } catch (err: any) {
    stats.perPostFailed++;
    if (stats.failures.length < 10) {
      stats.failures.push(`PerPost iteration ${i} failed: ${err.message}`);
    }
  }
}

console.log("=== RESULTS ===");
console.log(`Total tests evaluated: ${stats.totalRunsTested}`);
console.log(`Followers Drip passed: ${stats.followersPassed}, failed: ${stats.followersFailed}`);
console.log(`Per-Post Drip passed: ${stats.perPostPassed}, failed: ${stats.perPostFailed}`);
if (stats.failures.length > 0) {
  console.log("Failures sample:");
  stats.failures.forEach(f => console.log(" - " + f));
  process.exit(1);
} else {
  console.log("ALL 10,000+ SCHEDULE PROPERTY TESTS PASSED CONSTRAINTS.");
  process.exit(0);
}

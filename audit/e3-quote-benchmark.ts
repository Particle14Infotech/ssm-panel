import { calculateFollowersDrip, calculatePerPostDrip } from "../apps/api/src/modules/packages/drip-engine.util";
import { performance } from "perf_hooks";

console.log("=== E3 QUOTE ENDPOINT COMPUTATIONAL COST BENCHMARK ===");

const iterations = 1000;
const start = performance.now();

for (let i = 0; i < iterations; i++) {
  // 365 days, 100,000 quantity, 10 components
  for (let c = 0; c < 10; c++) {
    if (c === 0) {
      calculateFollowersDrip({
        totalQuantity: 100000,
        serviceMin: 100,
        serviceMax: 10000,
        days: 365,
        intervalHours: 24,
        ratePer1000: 5.5,
      });
    } else {
      calculatePerPostDrip({
        quantity: 5000,
        serviceMin: 50,
        serviceMax: 2000,
        maxRunsPerPost: 10,
        windowMinutes: 720,
        minGapMinutes: 15,
        ratePer1000: 2.5,
      });
    }
  }
}

const elapsedMs = performance.now() - start;
const avgPerQuoteMs = elapsedMs / iterations;

console.log(`Completed ${iterations} complex quotes (365 days, 10 components each).`);
console.log(`Total time: ${elapsedMs.toFixed(2)} ms`);
console.log(`Average time per quote: ${avgPerQuoteMs.toFixed(3)} ms`);
console.log(`Estimated throughput: ${(1000 / avgPerQuoteMs).toFixed(0)} quotes/sec per CPU core.`);

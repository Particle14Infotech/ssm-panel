import { Decimal } from "decimal.js";
import {
  distributeRandomSafeQuantities,
  calculateFollowersDrip,
  calculateIntradayPacedRuns,
} from "./drip-engine.util";

describe("Service-Safe Random Drip Split Engine", () => {
  describe("distributeRandomSafeQuantities", () => {
    it("strictly enforces minQty and conserves exact total quantity", () => {
      // 1000 quantity, minQty = 100, 8 runs
      for (let trial = 0; trial < 10; trial++) {
        const batches = distributeRandomSafeQuantities(1000, 100, undefined, 8);
        expect(batches.length).toBe(8);
        const sum = batches.reduce((a, b) => a + b, 0);
        expect(sum).toBe(1000);
        for (const qty of batches) {
          expect(qty).toBeGreaterThanOrEqual(100);
        }
      }
    });

    it("handles constrained totals safely without sub-minimum runs", () => {
      // 24 likes, minQty = 10, requested 5 runs -> must clamp to at most 2 runs
      const batches = distributeRandomSafeQuantities(24, 10, undefined, 5);
      expect(batches.length).toBeLessThanOrEqual(2);
      const sum = batches.reduce((a, b) => a + b, 0);
      expect(sum).toBe(24);
      for (const qty of batches) {
        expect(qty).toBeGreaterThanOrEqual(10);
      }
    });

    it("handles single feasible batch when total < 2 * minQty", () => {
      // 12 shares, minQty = 10 -> must return [12]
      const batches = distributeRandomSafeQuantities(12, 10, undefined, 5);
      expect(batches).toEqual([12]);
    });

    it("introduces natural organic variance for larger pools", () => {
      // 428 followers across 3 runs
      const batches = distributeRandomSafeQuantities(428, 1, undefined, 3);
      expect(batches.length).toBe(3);
      const sum = batches.reduce((a, b) => a + b, 0);
      expect(sum).toBe(428);
      // Not robotic identical
      const allEqual = batches.every((v) => v === batches[0]);
      expect(allEqual).toBe(false);
    });
  });

  describe("calculateIntradayPacedRuns", () => {
    it("distributes combo rules across days without violating provider minQty", () => {
      const result = calculateIntradayPacedRuns({
        serviceId: "srv_likes",
        serviceKind: "LIKES",
        totalQuantity: 24,
        durationDays: 5,
        minQty: 10,
        totalAllocatedCharge: 0.44,
        startAt: new Date(),
      });

      // Total quantity must be 24
      const sumQty = result.runs.reduce((a, b) => a + b.quantity, 0);
      expect(sumQty).toBe(24);

      // All runs must have quantity >= 10
      for (const r of result.runs) {
        expect(r.quantity).toBeGreaterThanOrEqual(10);
      }

      // Total charge must equal 0.44
      const sumCharge = result.runs
        .reduce((acc, b) => acc.plus(new Decimal(b.allocatedCharge.toString())), new Decimal(0))
        .toNumber();
      expect(Number(sumCharge.toFixed(2))).toBe(0.44);
    });
  });

  describe("calculateFollowersDrip", () => {
    it("generates natural randomized daily follower counts that sum exactly to total", () => {
      const result = calculateFollowersDrip({
        totalQuantity: 1000,
        serviceMin: 1,
        days: 7,
        intervalHours: 24,
        ratePer1000: 69.0,
        startAt: new Date(),
      });

      expect(result.runs.length).toBe(7);
      const sum = result.runs.reduce((a, b) => a + b.quantity, 0);
      expect(sum).toBe(1000);

      // Charge must sum to 69.00
      const totalCharge = result.runs.reduce((a, b) => a + b.allocatedCharge, 0);
      expect(Number(totalCharge.toFixed(2))).toBe(69.0);

      for (const r of result.runs) {
        expect(r.quantity).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

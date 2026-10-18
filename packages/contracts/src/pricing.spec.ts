import {
  calculateCostINR,
  roundUpToStep,
  calculateSellingRate,
  calculateCustomerCharge,
  calculateEstimatedProviderCost,
  calculateOrderFinancialSnapshot,
  calculateRealizedProfit,
  DEFAULT_PRICING_SETTINGS,
} from "./pricing";
import { Decimal } from "decimal.js";

describe("Pricing and Profit Engine Invariants (@smm/contracts)", () => {
  describe("1. Currency FX & Cost Conversion (calculateCostINR)", () => {
    it("converts USD provider cost to INR using FX rate", () => {
      const costINR = calculateCostINR(0.5, 84.5, "USD");
      expect(costINR.toNumber()).toBe(42.25);
    });

    it("leaves INR provider cost unchanged", () => {
      const costINR = calculateCostINR(120.0, 84.5, "INR");
      expect(costINR.toNumber()).toBe(120.0);
    });

    it("safely handles 0 or negative values", () => {
      expect(calculateCostINR(0, 84.5).toNumber()).toBe(0);
      expect(calculateCostINR(-5, 84.5).toNumber()).toBe(0);
    });
  });

  describe("2. Step Rounding (roundUpToStep)", () => {
    it("rounds UP strictly to nearest 0.50 INR step", () => {
      expect(roundUpToStep(new Decimal("12.00"), 0.5).toNumber()).toBe(12.0);
      expect(roundUpToStep(new Decimal("12.01"), 0.5).toNumber()).toBe(12.5);
      expect(roundUpToStep(new Decimal("12.49"), 0.5).toNumber()).toBe(12.5);
      expect(roundUpToStep(new Decimal("12.50"), 0.5).toNumber()).toBe(12.5);
      expect(roundUpToStep(new Decimal("12.51"), 0.5).toNumber()).toBe(13.0);
    });

    it("works with custom step (e.g. 1.00 INR)", () => {
      expect(roundUpToStep(new Decimal("15.10"), 1.0).toNumber()).toBe(16.0);
    });
  });

  describe("3. Tiered Selling Rate Calculation (calculateSellingRate)", () => {
    it("applies Tier 1 (+80%) for cost < 100 INR", () => {
      // cost = 50 INR -> 50 * 1.80 = 90.00
      const res = calculateSellingRate(50);
      expect(res.sellingRate.toNumber()).toBe(90.0);
      expect(res.isBelowCost).toBe(false);
    });

    it("applies Tier 2 (+55%) for cost 100 - 500 INR", () => {
      // cost = 200 INR -> 200 * 1.55 = 310.00
      const res = calculateSellingRate(200);
      expect(res.sellingRate.toNumber()).toBe(310.0);
      expect(res.isBelowCost).toBe(false);
    });

    it("applies Tier 3 (+35%) for cost > 500 INR", () => {
      // cost = 600 INR -> 600 * 1.35 = 810.00
      const res = calculateSellingRate(600);
      expect(res.sellingRate.toNumber()).toBe(810.0);
      expect(res.isBelowCost).toBe(false);
    });

    it("enforces absolute minimum profit floor (MIN_PROFIT_PER_1K = 5 INR)", () => {
      // cost = 4 INR -> 4 * 1.80 = 7.20. But 4 + 5 = 9.00 -> rounded to step = 9.00
      const res = calculateSellingRate(4);
      expect(res.sellingRate.toNumber()).toBe(9.0);
    });

    it("enforces MIN_MARGIN_PERCENT (20%) when custom margin override is too low", () => {
      // marginPercentOverride = 10% (below 20% floor) -> clamped to 20%
      const res = calculateSellingRate(100, { marginPercentOverride: 10 });
      // 100 * 1.20 = 120.00
      expect(res.sellingRate.toNumber()).toBe(120.0);
    });

    it("allows below-minimum margin only when explicitly permitted by admin", () => {
      const res = calculateSellingRate(100, {
        marginPercentOverride: 10,
        allowBelowMinMargin: true,
      });
      // 100 * 1.10 = 110.00
      expect(res.sellingRate.toNumber()).toBe(110.0);
    });

    it("detects when selling rate is strictly below cost (Guardrail)", () => {
      const res = calculateSellingRate(100, {
        fixedSellingRateOverride: 90, // Loss-making fixed price
      });
      expect(res.isBelowCost).toBe(true);
      expect(res.warning).toContain("strictly below provider cost");
    });
  });

  describe("4. Customer Charge Calculation (calculateCustomerCharge)", () => {
    it("calculates exact charge for normal orders and rounds UP strictly", () => {
      // 100 units @ 33.33/1k = 3.333 -> rounds UP to 3.34
      const res = calculateCustomerCharge(33.33, 100, 1);
      expect(res.customerCharge.toNumber()).toBe(3.34);
      expect(res.totalUnits).toBe(100);
    });

    it("calculates exact charge for drip-feed orders (qtyPerRun * runs)", () => {
      // 100 per run * 5 runs = 500 total @ 70/1k = 35.00
      const res = calculateCustomerCharge(70.0, 100, 5);
      expect(res.customerCharge.toNumber()).toBe(35.0);
      expect(res.totalUnits).toBe(500);
    });

    it("applies optional DRIPFEED_SURCHARGE_PERCENT to drip orders", () => {
      // 100 per run * 5 runs = 500 total @ 100/1k with 10% surcharge
      // effective rate = 110/1k -> 110 * 500 / 1000 = 55.00
      const res = calculateCustomerCharge(100.0, 100, 5, 10);
      expect(res.customerCharge.toNumber()).toBe(55.0);
    });

    it("enforces MIN_ORDER_CHARGE floor (1.00 INR)", () => {
      // 1 unit @ 10/1k = 0.01 INR -> clamped to 1.00 INR
      const res = calculateCustomerCharge(10.0, 1, 1);
      expect(res.customerCharge.toNumber()).toBe(1.0);
    });
  });

  describe("5. Order Financial Snapshot & Profit Breakdown", () => {
    it("computes estimated provider cost, gross profit, gateway fee, and net profit", () => {
      // Sell: 100/1k, Cost: 50/1k, Qty: 1000, Runs: 1
      // Charge = 100.00
      // Provider Cost = 50.00
      // Gross Profit = 50.00
      // Payment Fee (2.36%) = 2.36
      // Net Profit = 47.64
      const snapshot = calculateOrderFinancialSnapshot(100.0, 50.0, 1000, 1, 0, 2.36);
      expect(snapshot.customerCharge.toNumber()).toBe(100.0);
      expect(snapshot.estimatedProviderCost.toNumber()).toBe(50.0);
      expect(snapshot.estimatedGrossProfit.toNumber()).toBe(50.0);
      expect(snapshot.paymentFeeEstimate.toNumber()).toBe(2.36);
      expect(snapshot.estimatedNetProfit.toNumber()).toBe(47.64);
      expect(snapshot.netMarginPercent).toBeCloseTo(47.64, 2);
    });

    it("computes financial snapshot accurately for drip-feed orders", () => {
      // 200 per run * 5 runs = 1000 total. Sell: 200, Cost: 100
      const snapshot = calculateOrderFinancialSnapshot(200.0, 100.0, 200, 5, 0, 2.36);
      expect(snapshot.customerCharge.toNumber()).toBe(200.0);
      expect(snapshot.estimatedProviderCost.toNumber()).toBe(100.0);
      expect(snapshot.estimatedGrossProfit.toNumber()).toBe(100.0);
      expect(snapshot.paymentFeeEstimate.toNumber()).toBe(4.72);
      expect(snapshot.estimatedNetProfit.toNumber()).toBe(95.28);
    });
  });

  describe("6. Realized Profit on Partial / Cancelled Orders (calculateRealizedProfit)", () => {
    it("adjusts realized revenue and profit proportionally after partial refund", () => {
      // Charge = 100, Refund = 40 (60% delivered)
      // Realized Revenue = 60
      // Actual Cost = 30
      // Payment Fee on realized revenue = 60 * 2.36% = 1.42
      // Net Profit = 60 - 30 - 1.42 = 28.58
      const res = calculateRealizedProfit(100, 30, 40, 2.36);
      expect(res.realizedRevenue.toNumber()).toBe(60.0);
      expect(res.paymentFee.toNumber()).toBe(1.42);
      expect(res.realizedNetProfit.toNumber()).toBe(28.58);
    });
  });
});

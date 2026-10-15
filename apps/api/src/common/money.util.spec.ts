import {
  toPaise,
  fromPaise,
  formatINR,
  calculateOrderCharge,
  calculatePartialRefund,
} from "./money.util";
import { Decimal } from "decimal.js";

describe("Money Utilities & Zero-Float Invariants (SRS §5-22, §53)", () => {
  describe("toPaise & fromPaise conversion", () => {
    it("converts rupees to integer paise without float inaccuracies", () => {
      expect(toPaise(100)).toBe(10000);
      expect(toPaise(0.01)).toBe(1);
      expect(toPaise("14.99")).toBe(1499);
      expect(toPaise(new Decimal("250.75"))).toBe(25075);
    });

    it("converts paise back to Decimal rupees", () => {
      expect(fromPaise(10000).toNumber()).toBe(100);
      expect(fromPaise(1).toNumber()).toBe(0.01);
      expect(fromPaise(1499).toString()).toBe("14.99");
    });
  });

  describe("formatINR", () => {
    it("formats Indian Rupee currency correctly with symbol", () => {
      const formatted = formatINR(1500.5);
      expect(formatted).toMatch(/₹/);
      expect(formatted).toContain("1,500.50");
    });
  });

  describe("calculateOrderCharge", () => {
    it("calculates exact charges with ROUND_HALF_UP formula: round(quantity * ratePer1000 / 1000)", () => {
      // 100 followers at 180 INR / 1000 = 18.00 INR
      const charge1 = calculateOrderCharge(100, 180);
      expect(charge1.toString()).toBe("18");

      // 5000 views at 22 INR / 1000 = 110.00 INR
      const charge2 = calculateOrderCharge(5000, 22);
      expect(charge2.toString()).toBe("110");

      // Fractional rounding test: 333 qty at 15.55 rate
      // 333 * 15.55 / 1000 = 5.17815 => round half up = 5.18
      const charge3 = calculateOrderCharge(333, new Decimal("15.55"));
      expect(charge3.toString()).toBe("5.18");
    });
  });

  describe("calculatePartialRefund", () => {
    it("calculates partial refund accurately: round(charge * remains / quantity)", () => {
      // Charge 18.00 INR, quantity 100, remains 50 => refund 9.00 INR
      const refund1 = calculatePartialRefund(18, 50, 100);
      expect(refund1.toString()).toBe("9");

      // Charge 110.00 INR, quantity 5000, remains 1500 => refund 33.00 INR
      const refund2 = calculatePartialRefund(110, 1500, 5000);
      expect(refund2.toString()).toBe("33");

      // Remains 0 => refund 0
      const refundZero = calculatePartialRefund(18, 0, 100);
      expect(refundZero.toString()).toBe("0");
    });
  });
});

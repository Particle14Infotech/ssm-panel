import { test, expect } from "@playwright/test";
import {
  canTransition,
  assertValidTransition,
  calculateOrderCharge,
  calculatePartialRefund,
  OrderStatus,
  OrderStatusSchema,
} from "@smm/contracts";

test.describe("Order State Machine & Invariants In Depth", () => {
  const allStatuses: OrderStatus[] = [
    "PENDING",
    "PROCESSING",
    "IN_PROGRESS",
    "COMPLETED",
    "PARTIAL",
    "CANCELLED",
    "FAILED",
    "REFUNDED",
  ];

  // Specific valid transitions defined by SRS §41
  const expectedValidPairs: Record<OrderStatus, OrderStatus[]> = {
    PENDING: ["PROCESSING", "CANCELLED", "FAILED"],
    PROCESSING: ["IN_PROGRESS", "COMPLETED", "PARTIAL", "CANCELLED", "FAILED"],
    IN_PROGRESS: ["COMPLETED", "PARTIAL", "CANCELLED"],
    PARTIAL: ["REFUNDED"],
    CANCELLED: ["REFUNDED"],
    FAILED: ["REFUNDED"],
    COMPLETED: [],
    REFUNDED: [],
  };

  test("exhaustively tests all 64 (from, to) state transitions", () => {
    let testedCount = 0;

    for (const from of allStatuses) {
      for (const to of allStatuses) {
        testedCount++;
        const shouldBeValid = expectedValidPairs[from].includes(to);
        const result = canTransition(from, to);

        expect(result).toBe(shouldBeValid);

        if (shouldBeValid) {
          expect(() => assertValidTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertValidTransition(from, to)).toThrow(
            /Illegal Order Status Transition/
          );
        }
      }
    }

    expect(testedCount).toBe(64);
  });

  test("verifies terminal states (COMPLETED and REFUNDED) have 0 outgoing transitions", () => {
    for (const status of allStatuses) {
      expect(canTransition("COMPLETED", status)).toBe(false);
      expect(canTransition("REFUNDED", status)).toBe(false);
      expect(() => assertValidTransition("COMPLETED", status)).toThrow();
      expect(() => assertValidTransition("REFUNDED", status)).toThrow();
    }
  });

  test("verifies money path pricing invariants: charge = rate x qty / 1000", () => {
    // Standard price
    expect(calculateOrderCharge(50, 5000)).toBe(250);
    expect(calculateOrderCharge(1.2, 2500)).toBe(3);
    expect(calculateOrderCharge(0.85, 10000)).toBe(8.5);

    // With discount
    expect(calculateOrderCharge(100, 1000, 10)).toBe(90);
    expect(calculateOrderCharge(100, 1000, 0)).toBe(100);

    // Negative or zero guards
    expect(calculateOrderCharge(0, 1000)).toBe(0);
    expect(calculateOrderCharge(50, 0)).toBe(0);
  });

  test("verifies partial refund invariant formula: refund = charge x (remains / quantity)", () => {
    // Charge $10 for 1000 units, 400 remain unfulfilled -> refund $4
    expect(calculatePartialRefund(10, 1000, 400)).toBe(4);

    // Charge $250 for 5000 units, 1500 remain -> refund $75
    expect(calculatePartialRefund(250, 5000, 1500)).toBe(75);

    // Edge cases: remains = 0 -> 0 refund
    expect(calculatePartialRefund(250, 5000, 0)).toBe(0);

    // Edge cases: remains >= total quantity -> full refund capped at charge
    expect(calculatePartialRefund(100, 1000, 1000)).toBe(100);
    expect(calculatePartialRefund(100, 1000, 1500)).toBe(100);
  });
});

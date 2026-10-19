import { coerceBoolean, splitChargeShare, generateRunSchedule } from "@smm/contracts";
import { Decimal } from "decimal.js";

describe("Phase 1: Robust Boolean Coercion Fixtures", () => {
  it("coerces truthy fixtures to true", () => {
    expect(coerceBoolean(true)).toBe(true);
    expect(coerceBoolean(1)).toBe(true);
    expect(coerceBoolean("1")).toBe(true);
    expect(coerceBoolean("true")).toBe(true);
    expect(coerceBoolean("TRUE")).toBe(true);
    expect(coerceBoolean("True")).toBe(true);
    expect(coerceBoolean("yes")).toBe(true);
    expect(coerceBoolean("YES")).toBe(true);
    expect(coerceBoolean("on")).toBe(true);
    expect(coerceBoolean("  true  ")).toBe(true);
    expect(coerceBoolean("  1  ")).toBe(true);
  });

  it("coerces falsy fixtures to false", () => {
    expect(coerceBoolean(false)).toBe(false);
    expect(coerceBoolean(0)).toBe(false);
    expect(coerceBoolean("0")).toBe(false);
    expect(coerceBoolean("false")).toBe(false);
    expect(coerceBoolean("FALSE")).toBe(false);
    expect(coerceBoolean("no")).toBe(false);
    expect(coerceBoolean("off")).toBe(false);
    expect(coerceBoolean("")).toBe(false);
    expect(coerceBoolean("   ")).toBe(false);
    expect(coerceBoolean(null)).toBe(false);
    expect(coerceBoolean(undefined)).toBe(false);
  });
});

describe("Phase 3: Charge Share Split Math", () => {
  it("ensures sum of shares exactly equals total charge with zero loss", () => {
    const testCases = [
      { total: 100, runs: 3 },
      { total: 100.01, runs: 3 },
      { total: 77.77, runs: 7 },
      { total: 35.50, runs: 4 },
      { total: 10.00, runs: 6 },
      { total: 1.00, runs: 3 },
      { total: 999.99, runs: 13 },
      { total: 285.58, runs: 5 },
    ];

    for (const { total, runs } of testCases) {
      const shares = splitChargeShare(total, runs);
      expect(shares.length).toBe(runs);

      const sum = shares.reduce((acc, s) => acc.plus(new Decimal(s)), new Decimal(0));
      expect(sum.toNumber()).toBe(total);
    }
  });

  it("handles edge cases (runs = 1, runs <= 0)", () => {
    expect(splitChargeShare(50, 1)).toEqual([50]);
    expect(splitChargeShare(50, 0)).toEqual([]);
  });

  it("generates correct scheduled timestamps", () => {
    const start = new Date("2026-10-19T10:00:00.000Z");
    const schedule = generateRunSchedule(start, 3, 30);
    expect(schedule.length).toBe(3);
    expect(schedule[0].scheduledAt.toISOString()).toBe("2026-10-19T10:00:00.000Z");
    expect(schedule[1].scheduledAt.toISOString()).toBe("2026-10-19T10:30:00.000Z");
    expect(schedule[2].scheduledAt.toISOString()).toBe("2026-10-19T11:00:00.000Z");
  });
});

describe("Phase 3 & 5: Provider Link Restriction Detection", () => {
  const { isLinkRestrictionError, aggregateRunStatuses } = require("@smm/contracts");

  it("identifies active link error variants", () => {
    expect(isLinkRestrictionError("There is already an active order with this link")).toBe(true);
    expect(isLinkRestrictionError("active order exists")).toBe(true);
    expect(isLinkRestrictionError("Duplicate link in progress")).toBe(true);
    expect(isLinkRestrictionError("Order already in progress for this URL")).toBe(true);
    expect(isLinkRestrictionError("link already in processing queue")).toBe(true);
  });

  it("does not falsely identify unrelated errors as link restrictions", () => {
    expect(isLinkRestrictionError("Incorrect charge or zero balance")).toBe(false);
    expect(isLinkRestrictionError("Invalid quantity: min is 100")).toBe(false);
    expect(isLinkRestrictionError("Service unavailable: maintenance mode")).toBe(false);
    expect(isLinkRestrictionError(null)).toBe(false);
    expect(isLinkRestrictionError("")).toBe(false);
  });

  describe("Parent Status Aggregation Matrix", () => {
    it("aggregates all SCHEDULED runs to PENDING", () => {
      expect(aggregateRunStatuses(["SCHEDULED", "SCHEDULED", "SCHEDULED"])).toBe("PENDING");
    });

    it("aggregates active runs to IN_PROGRESS", () => {
      expect(aggregateRunStatuses(["COMPLETED", "PROCESSING", "SCHEDULED"])).toBe("IN_PROGRESS");
      expect(aggregateRunStatuses(["DISPATCHING", "SCHEDULED"])).toBe("IN_PROGRESS");
    });

    it("aggregates all COMPLETED runs to COMPLETED", () => {
      expect(aggregateRunStatuses(["COMPLETED", "COMPLETED", "COMPLETED"])).toBe("COMPLETED");
    });

    it("aggregates mixture of completed and failed/canceled to PARTIAL", () => {
      expect(aggregateRunStatuses(["COMPLETED", "COMPLETED", "FAILED"])).toBe("PARTIAL");
      expect(aggregateRunStatuses(["COMPLETED", "CANCELED", "CANCELED"])).toBe("PARTIAL");
      expect(aggregateRunStatuses(["COMPLETED", "PARTIAL", "FAILED"])).toBe("PARTIAL");
    });

    it("aggregates all canceled/failed to CANCELLED", () => {
      expect(aggregateRunStatuses(["CANCELED", "CANCELED"])).toBe("CANCELLED");
      expect(aggregateRunStatuses(["FAILED", "FAILED"])).toBe("CANCELLED");
    });
  });

  describe("Customer Cancellation Mid-Way (2 of 5 runs complete)", () => {
    it("calculates exact refund for unsent runs", () => {
      const totalCharge = 50.00;
      const runs = 5;
      const shares = splitChargeShare(totalCharge, runs);

      // Runs 0 & 1 completed
      const completedRuns = [0, 1];
      // Runs 2, 3, 4 cancelled
      const cancelledRuns = [2, 3, 4];

      const refundAmount = cancelledRuns.reduce((acc, idx) => acc.plus(new Decimal(shares[idx])), new Decimal(0));
      const retainedAmount = completedRuns.reduce((acc, idx) => acc.plus(new Decimal(shares[idx])), new Decimal(0));

      expect(refundAmount.plus(retainedAmount).toNumber()).toBe(totalCharge);
      expect(refundAmount.toNumber()).toBe(30.00);
      expect(retainedAmount.toNumber()).toBe(20.00);
    });
  });
});


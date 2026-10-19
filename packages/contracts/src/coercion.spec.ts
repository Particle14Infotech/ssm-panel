import { coerceBoolean, splitChargeShare, generateRunSchedule } from "./coercion";
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

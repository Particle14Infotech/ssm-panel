import fc from "fast-check";
import Decimal from "decimal.js";
import {
  calculateDeliverySchedule,
  snapToDeliveryWindow,
  isInsideDeliveryWindow,
  type DeliveryWindowConfig,
  type CalculateScheduleInput,
} from "@smm/contracts";

describe("D1 Pure Delivery Schedule Engine", () => {
  const baseStart = "2026-11-01T06:00:00.000Z"; // 11:30 AM IST / 06:00 UTC

  describe("Deterministic Snap to Window", () => {
    it("leaves time unchanged when already inside window", () => {
      const window: DeliveryWindowConfig = {
        timezone: "Asia/Kolkata",
        ranges: [{ startHour: 9, startMinute: 0, endHour: 21, endMinute: 0 }],
      };
      // 06:00 UTC = 11:30 IST (inside 09:00 - 21:00)
      const instant = new Date("2026-11-01T06:00:00.000Z");
      expect(isInsideDeliveryWindow(instant, window)).toBe(true);

      const snapped = snapToDeliveryWindow(instant, window);
      expect(snapped.toISOString()).toBe("2026-11-01T06:00:00.000Z");
    });

    it("snaps forward to window start when before morning window", () => {
      const window: DeliveryWindowConfig = {
        timezone: "Asia/Kolkata",
        ranges: [{ startHour: 10, startMinute: 0, endHour: 20, endMinute: 0 }],
      };
      // 02:00 UTC = 07:30 IST (before 10:00 IST)
      const instant = new Date("2026-11-01T02:00:00.000Z");
      expect(isInsideDeliveryWindow(instant, window)).toBe(false);

      const snapped = snapToDeliveryWindow(instant, window);
      // 10:00 IST = 04:30 UTC
      expect(snapped.toISOString()).toBe("2026-11-01T04:30:00.000Z");
      expect(isInsideDeliveryWindow(snapped, window)).toBe(true);
    });

    it("snaps forward to next day when after evening window", () => {
      const window: DeliveryWindowConfig = {
        timezone: "Asia/Kolkata",
        ranges: [{ startHour: 9, startMinute: 0, endHour: 18, endMinute: 0 }],
      };
      // 14:00 UTC = 19:30 IST (after 18:00 IST)
      const instant = new Date("2026-11-01T14:00:00.000Z");
      expect(isInsideDeliveryWindow(instant, window)).toBe(false);

      const snapped = snapToDeliveryWindow(instant, window);
      // Next day 09:00 IST = 03:30 UTC on 2026-11-02
      expect(snapped.toISOString()).toBe("2026-11-02T03:30:00.000Z");
      expect(isInsideDeliveryWindow(snapped, window)).toBe(true);
    });

    it("handles windows crossing midnight (e.g. 22:00 to 04:00)", () => {
      const window: DeliveryWindowConfig = {
        timezone: "Asia/Kolkata",
        ranges: [{ startHour: 22, startMinute: 0, endHour: 4, endMinute: 0 }],
      };
      // 17:00 UTC = 22:30 IST (inside 22:00 - 04:00)
      const insideLate = new Date("2026-11-01T17:00:00.000Z");
      expect(isInsideDeliveryWindow(insideLate, window)).toBe(true);

      // 20:30 UTC = 02:00 IST next day (inside 22:00 - 04:00)
      const insideEarly = new Date("2026-11-01T20:30:00.000Z");
      expect(isInsideDeliveryWindow(insideEarly, window)).toBe(true);

      // 06:30 UTC = 12:00 IST midday (outside window)
      const outsideMidday = new Date("2026-11-01T06:30:00.000Z");
      expect(isInsideDeliveryWindow(outsideMidday, window)).toBe(false);

      const snapped = snapToDeliveryWindow(outsideMidday, window);
      // Should snap to 22:00 IST same day = 16:30 UTC
      expect(snapped.toISOString()).toBe("2026-11-01T16:30:00.000Z");
      expect(isInsideDeliveryWindow(snapped, window)).toBe(true);
    });

    it("respects day-of-week filters (e.g. weekdays only Mon-Fri)", () => {
      const window: DeliveryWindowConfig = {
        timezone: "Asia/Kolkata",
        ranges: [{ startHour: 10, startMinute: 0, endHour: 18, endMinute: 0 }],
        daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
      };
      // 2026-11-01 is Sunday (weekday 0 in IST)
      // 05:30 UTC = 11:00 AM IST on Sunday
      const sundayTime = new Date("2026-11-01T05:30:00.000Z");
      expect(isInsideDeliveryWindow(sundayTime, window)).toBe(false);

      const snapped = snapToDeliveryWindow(sundayTime, window);
      // Should advance to Monday 2026-11-02 10:00 AM IST = 04:30 UTC
      expect(snapped.toISOString()).toBe("2026-11-02T04:30:00.000Z");
      expect(isInsideDeliveryWindow(snapped, window)).toBe(true);
    });
  });

  describe("DST & Cross-Timezone Handling", () => {
    it("handles Europe/London transition", () => {
      const window: DeliveryWindowConfig = {
        timezone: "Europe/London",
        ranges: [{ startHour: 14, startMinute: 0, endHour: 20, endMinute: 0 }],
      };
      const instant = new Date("2026-10-25T08:00:00.000Z");
      const snapped = snapToDeliveryWindow(instant, window);
      expect(isInsideDeliveryWindow(snapped, window)).toBe(true);
    });

    it("handles America/New_York transition", () => {
      const window: DeliveryWindowConfig = {
        timezone: "America/New_York",
        ranges: [{ startHour: 10, startMinute: 0, endHour: 16, endMinute: 0 }],
      };
      const instant = new Date("2026-11-01T04:00:00.000Z");
      const snapped = snapToDeliveryWindow(instant, window);
      expect(isInsideDeliveryWindow(snapped, window)).toBe(true);
    });
  });

  describe("calculateDeliverySchedule Multi-Service Engine", () => {
    it("generates deterministic runs with exact remainder allocation and monotonic spacing", () => {
      const input: CalculateScheduleInput = {
        startTime: baseStart,
        durationDays: 7,
        deliveryWindow: {
          timezone: "Asia/Kolkata",
          ranges: [{ startHour: 10, startMinute: 0, endHour: 20, endMinute: 0 }],
        },
        items: [
          {
            itemId: "item_likes",
            serviceId: "srv_likes",
            totalQuantity: 1000,
            runs: 7,
            ratePer1000: 50,
            minGapMinutes: 60,
          },
          {
            itemId: "item_views",
            serviceId: "srv_views",
            totalQuantity: 2500,
            runs: 7,
            ratePer1000: 10,
            minGapMinutes: 60,
            startOffsetMinutes: 15,
          },
        ],
      };

      const result = calculateDeliverySchedule(input);

      // Quantities conservation
      const totalLikes = result.runs
        .filter((r) => r.itemId === "item_likes")
        .reduce((sum, r) => sum + r.quantity, 0);
      expect(totalLikes).toBe(1000);

      const totalViews = result.runs
        .filter((r) => r.itemId === "item_views")
        .reduce((sum, r) => sum + r.quantity, 0);
      expect(totalViews).toBe(2500);

      // Monotonic execution times per item
      const likesRuns = result.runs.filter((r) => r.itemId === "item_likes");
      for (let i = 1; i < likesRuns.length; i++) {
        const prev = new Date(likesRuns[i - 1].executeAt).getTime();
        const curr = new Date(likesRuns[i].executeAt).getTime();
        expect(curr).toBeGreaterThan(prev);
        // >= minGap
        expect(curr - prev).toBeGreaterThanOrEqual(60 * 60 * 1000);
      }

      // Every run must be inside the delivery window
      for (const run of result.runs) {
        expect(
          isInsideDeliveryWindow(new Date(run.executeAt), input.deliveryWindow!)
        ).toBe(true);
      }

      expect(result.fitsDuration).toBe(true);
      expect(result.warnings.length).toBe(0);
    });

    it("emits warning when window is too narrow for run count and minGap without silent truncation", () => {
      const input: CalculateScheduleInput = {
        startTime: baseStart,
        durationDays: 1,
        deliveryWindow: {
          timezone: "Asia/Kolkata",
          ranges: [{ startHour: 10, startMinute: 0, endHour: 11, endMinute: 0 }], // only 1 hour wide
        },
        items: [
          {
            itemId: "item_likes",
            serviceId: "srv_likes",
            totalQuantity: 1000,
            runs: 5, // 5 runs with 60 min gap cannot fit in 1 hour
            ratePer1000: 50,
            minGapMinutes: 60,
          },
        ],
      };

      const result = calculateDeliverySchedule(input);
      // Must not silently truncate quantity or runs!
      expect(result.runs.length).toBe(5);
      expect(result.runs.reduce((s, r) => s + r.quantity, 0)).toBe(1000);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("exceeds duration");
      expect(result.fitsDuration).toBe(false);
    });
  });

  describe("Property-Based Tests (fast-check)", () => {
    it("property: deterministic for equal inputs", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 14 }),
          fc.integer({ min: 100, max: 10000 }),
          fc.integer({ min: 1, max: 14 }),
          (durationDays, totalQuantity, runs) => {
            const input: CalculateScheduleInput = {
              startTime: "2026-11-01T08:00:00.000Z",
              durationDays,
              deliveryWindow: {
                timezone: "Asia/Kolkata",
                ranges: [{ startHour: 9, startMinute: 0, endHour: 21, endMinute: 0 }],
              },
              items: [
                {
                  itemId: "prop_item",
                  serviceId: "prop_srv",
                  totalQuantity,
                  runs,
                  ratePer1000: 10,
                },
              ],
            };

            const res1 = calculateDeliverySchedule(input);
            const res2 = calculateDeliverySchedule(input);

            expect(res1.runs.length).toBe(res2.runs.length);
            for (let i = 0; i < res1.runs.length; i++) {
              expect(res1.runs[i].executeAt).toBe(res2.runs[i].executeAt);
              expect(res1.runs[i].quantity).toBe(res2.runs[i].quantity);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it("property: sum of quantities equals totalQuantity exactly", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 30 }),
          fc.integer({ min: 10, max: 50000 }),
          fc.integer({ min: 1, max: 30 }),
          (durationDays, totalQuantity, runs) => {
            const input: CalculateScheduleInput = {
              startTime: "2026-11-01T08:00:00.000Z",
              durationDays,
              items: [
                {
                  itemId: "item_p",
                  serviceId: "srv_p",
                  totalQuantity,
                  runs,
                  ratePer1000: 25,
                },
              ],
            };

            const res = calculateDeliverySchedule(input);
            const sum = res.runs.reduce((acc, r) => acc + r.quantity, 0);
            expect(sum).toBe(totalQuantity);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});


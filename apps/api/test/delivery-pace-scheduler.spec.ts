import fc from "fast-check";
import {
  calculateDeliveryPacedSchedule,
  CalculatePacedScheduleInput,
} from "@smm/contracts";

describe("DeliveryPaceScheduler (H2 Property-Based & Invariant Suite)", () => {
  it("guarantees determinism: same input produces identical schedule", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 20000 }),
        fc.integer({ min: 10, max: 50 }),
        fc.integer({ min: 500, max: 5000 }),
        fc.integer({ min: 50, max: 500 }),
        fc.integer({ min: 30, max: 120 }),
        (qty, min, max, paceCap, minGap) => {
          const input: CalculatePacedScheduleInput = {
            startTime: "2026-11-01T10:00:00.000Z",
            durationDays: 3,
            deliveryWindow: {
              timezone: "Asia/Kolkata",
              ranges: [{ startHour: 9, endHour: 21 }],
            },
            items: [
              {
                itemId: "item-1",
                serviceId: "srv-likes",
                totalQuantity: qty,
                ratePer1000: 25.5,
                providerMin: min,
                providerMax: max,
                paceCapPerHour: paceCap,
                minGapMinutes: minGap,
              },
            ],
          };

          const res1 = calculateDeliveryPacedSchedule(input);
          const res2 = calculateDeliveryPacedSchedule(input);

          expect(res1.allRuns.length).toBe(res2.allRuns.length);
          expect(res1.effectivePacePerHour).toBe(res2.effectivePacePerHour);
          expect(res1.finishesAt.toISOString()).toBe(res2.finishesAt.toISOString());
          for (let i = 0; i < res1.allRuns.length; i++) {
            expect(res1.allRuns[i].quantity).toBe(res2.allRuns[i].quantity);
            expect(res1.allRuns[i].allocatedChargePaise).toBe(
              res2.allRuns[i].allocatedChargePaise
            );
            expect(res1.allRuns[i].executeAt.toISOString()).toBe(
              res2.allRuns[i].executeAt.toISOString()
            );
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it("guarantees integer conservation: sum of quantities == Q exactly, sum of paise == totalPaise exactly", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 50000 }),
        fc.integer({ min: 10, max: 100 }),
        fc.integer({ min: 1000, max: 100000 }),
        fc.integer({ min: 100, max: 2000 }),
        fc.float({ min: 1.0, max: 100.0 }),
        (qty, min, max, paceCap, rate) => {
          if (qty < min) return; // Below min covered in separate test

          const input: CalculatePacedScheduleInput = {
            startTime: "2026-11-01T08:00:00.000Z",
            durationDays: 5,
            deliveryWindow: { timezone: "UTC" },
            items: [
              {
                itemId: "item-pbt",
                serviceId: "srv-views",
                totalQuantity: qty,
                ratePer1000: rate,
                providerMin: min,
                providerMax: max,
                paceCapPerHour: paceCap,
                minGapMinutes: 60,
              },
            ],
          };

          const res = calculateDeliveryPacedSchedule(input);
          const itemRes = res.items[0];

          // Quantity sum
          const sumQty = itemRes.runs.reduce((acc, r) => acc + r.quantity, 0);
          expect(sumQty).toBe(qty);

          // Charge paise sum
          const sumPaise = itemRes.runs.reduce(
            (acc, r) => acc + r.allocatedChargePaise,
            0
          );
          expect(sumPaise).toBe(itemRes.totalChargePaise);

          // Every run within provider limits
          for (const run of itemRes.runs) {
            expect(run.quantity).toBeGreaterThanOrEqual(min);
            expect(run.quantity).toBeLessThanOrEqual(max);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it("enforces minimum gap spacing and respects paceCapPerHour without exceeding it", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500, max: 5000 }),
        fc.integer({ min: 100, max: 500 }),
        fc.integer({ min: 30, max: 120 }),
        (qty, paceCap, minGap) => {
          const input: CalculatePacedScheduleInput = {
            startTime: "2026-11-01T00:00:00.000Z",
            deliveryWindow: { timezone: "UTC" },
            items: [
              {
                itemId: "item-pace",
                serviceId: "srv-pace",
                totalQuantity: qty,
                ratePer1000: 10,
                providerMin: 20,
                providerMax: 10000,
                paceCapPerHour: paceCap,
                minGapMinutes: minGap,
              },
            ],
          };

          const res = calculateDeliveryPacedSchedule(input);
          const runs = res.items[0].runs;

          for (let i = 1; i < runs.length; i++) {
            const gapMs =
              runs[i].executeAt.getTime() - runs[i - 1].executeAt.getTime();
            const gapMins = gapMs / (60 * 1000);
            expect(gapMins).toBeGreaterThanOrEqual(minGap);

            // Effective pace between runs should not exceed paceCap (with 1 unit integer rounding margin)
            const gapHours = gapMins / 60;
            const runPace = runs[i].quantity / gapHours;
            expect(runPace).toBeLessThanOrEqual(paceCap + 1.0);
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  it("handles complex timezones and Daylight Saving Time (Asia/Kolkata, Europe/London, America/New_York)", () => {
    const timezones = ["Asia/Kolkata", "Europe/London", "America/New_York"];

    for (const tz of timezones) {
      const input: CalculatePacedScheduleInput = {
        startTime: "2026-10-25T12:00:00.000Z", // Around autumn DST transition
        durationDays: 4,
        deliveryWindow: {
          timezone: tz,
          ranges: [{ startHour: 10, endHour: 20 }],
        },
        items: [
          {
            itemId: `item-tz-${tz}`,
            serviceId: "srv-dst",
            totalQuantity: 2000,
            ratePer1000: 50,
            providerMin: 50,
            providerMax: 5000,
            paceCapPerHour: 250,
            minGapMinutes: 60,
          },
        ],
      };

      const res = calculateDeliveryPacedSchedule(input);
      expect(res.items[0].runs.length).toBeGreaterThan(1);
      const sumQty = res.items[0].runs.reduce((a, b) => a + b.quantity, 0);
      expect(sumQty).toBe(2000);
    }
  });

  it("emits a clear warning when Q < providerMin and refuses to silently merge", () => {
    const input: CalculatePacedScheduleInput = {
      startTime: "2026-11-01T12:00:00.000Z",
      deliveryWindow: { timezone: "UTC" },
      items: [
        {
          itemId: "item-small",
          serviceId: "srv-small",
          totalQuantity: 5, // Q = 5
          ratePer1000: 20,
          providerMin: 50, // providerMin = 50
          providerMax: 1000,
          paceCapPerHour: 100,
          minGapMinutes: 60,
        },
      ],
    };

    const res = calculateDeliveryPacedSchedule(input);
    expect(res.items[0].runsCount).toBe(0);
    expect(res.items[0].fitsDuration).toBe(false);
    expect(res.items[0].warnings.length).toBeGreaterThan(0);
    expect(res.items[0].warnings[0]).toContain(
      "Quantity 5 is below provider minimum threshold of 50"
    );
  });
});


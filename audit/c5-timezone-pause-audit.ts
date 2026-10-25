import { formatInstantForDateTimeLocal, localDateTimeToInstant } from "../packages/contracts/src/packages";
import { calculateFollowersDrip } from "../apps/api/src/modules/packages/drip-engine.util";

console.log("=== C5 TIMEZONE, DST & PAUSE/RESUME AUDIT ===");

// 1. Timezone DST Test: America/New_York across Spring Forward DST Change (March 2026)
// US DST: Second Sunday in March (March 8, 2026 at 2:00 AM -> clocks jump to 3:00 AM)
const nyTimezone = "America/New_York";
const preDstLocal = "2026-03-07T12:00"; // EST (UTC-5)
const postDstLocal = "2026-03-09T12:00"; // EDT (UTC-4)

const preDstUtc = localDateTimeToInstant(preDstLocal, nyTimezone);
const postDstUtc = localDateTimeToInstant(postDstLocal, nyTimezone);

console.log(`Pre-DST Local:  ${preDstLocal} (${nyTimezone}) -> Instant: ${preDstUtc}`);
console.log(`Post-DST Local: ${postDstLocal} (${nyTimezone}) -> Instant: ${postDstUtc}`);

// Format back to verify roundtrip fidelity
const preDstFormatted = formatInstantForDateTimeLocal(preDstUtc, nyTimezone);
const postDstFormatted = formatInstantForDateTimeLocal(postDstUtc, nyTimezone);

if (preDstFormatted === preDstLocal && postDstFormatted === postDstLocal) {
  console.log("VERIFIED: America/New_York roundtrip maintains local wall-clock across DST change.");
} else {
  console.error("FAIL: DST conversion roundtrip error!");
  process.exit(1);
}

// 2. Asia/Kolkata (Non-DST Fixed UTC+5:30)
const kolkataTz = "Asia/Kolkata";
const kolkataLocal = "2026-10-24T20:30";
const kolkataUtc = localDateTimeToInstant(kolkataLocal, kolkataTz);
const kolkataFormatted = formatInstantForDateTimeLocal(kolkataUtc, kolkataTz);
console.log(`Asia/Kolkata Local: ${kolkataLocal} -> Instant: ${kolkataUtc} -> Formatted: ${kolkataFormatted}`);
if (kolkataFormatted !== kolkataLocal) {
  console.error("FAIL: Asia/Kolkata roundtrip mismatch!");
  process.exit(1);
}
console.log("VERIFIED: Asia/Kolkata timezone mapping verified.");

// 3. Pause / Resume Regeneration Invariant: delivered + scheduled == total
console.log("\n[Pause/Resume Regeneration Check]");
const totalQuantity = 10000;
const totalDays = 30;
const serviceMin = 50;

// Initial 30-day schedule
const initialSchedule = calculateFollowersDrip({
  totalQuantity,
  serviceMin,
  days: totalDays,
  intervalHours: 24,
  ratePer1000: 5.0,
  startAt: new Date("2026-10-01T00:00:00Z"),
});

console.log(`Initial runs: ${initialSchedule.runsCount}, Total Quantity: ${initialSchedule.totalQuantity}`);

// Simulate 10 runs delivered
const runsDelivered = 10;
const deliveredQuantity = initialSchedule.runs.slice(0, runsDelivered).reduce((a, b) => a + b.quantity, 0);
console.log(`Delivered runs: ${runsDelivered}, Delivered quantity: ${deliveredQuantity}`);

// Package is paused for 5 days, then resumed
const remainingQuantity = totalQuantity - deliveredQuantity;
const remainingDays = totalDays - runsDelivered; // 20 days remaining

const resumedSchedule = calculateFollowersDrip({
  totalQuantity: remainingQuantity,
  serviceMin,
  days: remainingDays,
  intervalHours: 24,
  ratePer1000: 5.0,
  startAt: new Date("2026-10-16T00:00:00Z"), // resumed 5 days later
});

const scheduledResumedQuantity = resumedSchedule.runs.reduce((a, b) => a + b.quantity, 0);
const invariantSum = deliveredQuantity + scheduledResumedQuantity;
console.log(`Resumed scheduled quantity: ${scheduledResumedQuantity}`);
console.log(`Delivered (${deliveredQuantity}) + Resumed Scheduled (${scheduledResumedQuantity}) = ${invariantSum} (Expected: ${totalQuantity})`);

if (invariantSum === totalQuantity) {
  console.log("VERIFIED: delivered + scheduled == total invariant strictly holds upon resume.");
} else {
  console.error("FAIL: Resume invariant violation!");
  process.exit(1);
}

// 4. Long windows: 90, 180, 365 days
console.log("\n[Long Windows Evaluation]");
for (const days of [90, 180, 365]) {
  const longSched = calculateFollowersDrip({
    totalQuantity: 50000,
    serviceMin: 10,
    days,
    intervalHours: 24,
    ratePer1000: 3.5,
  });
  const sum = longSched.runs.reduce((a, b) => a + b.quantity, 0);
  console.log(`Window ${days} days: ${longSched.runsCount} runs generated, sum = ${sum} (Valid: ${sum === 50000})`);
  if (sum !== 50000) {
    console.error(`FAIL on long window ${days} days`);
    process.exit(1);
  }
}
console.log("VERIFIED: Long duration schedules (90, 180, 365 days) compute correctly with exact sums.");

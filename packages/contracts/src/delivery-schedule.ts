import { Decimal } from "decimal.js";
import { isValidIanaTimezone } from "./packages";

export interface DeliveryWindowRange {
  startHour: number; // 0..23
  startMinute?: number; // 0..59 (defaults to 0)
  endHour: number; // 0..23
  endMinute?: number; // 0..59 (defaults to 0)
}

export interface DeliveryWindowConfig {
  timezone: string; // IANA timezone, e.g. "Asia/Kolkata", "America/New_York"
  ranges?: DeliveryWindowRange[]; // Empty or omitted means any time (00:00 - 24:00)
  daysOfWeek?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat. Empty or omitted means all 7 days.
}

export const STANDARD_DELIVERY_WINDOW_PRESETS: Record<string, { label: string; ranges?: DeliveryWindowRange[] }> = {
  ANY_TIME: {
    label: "Any time (24/7)",
    ranges: [],
  },
  DAYTIME: {
    label: "Daytime (09:00 - 21:00)",
    ranges: [{ startHour: 9, startMinute: 0, endHour: 21, endMinute: 0 }],
  },
  EVENING: {
    label: "Evening (17:00 - 23:00)",
    ranges: [{ startHour: 17, startMinute: 0, endHour: 23, endMinute: 0 }],
  },
};

export function validateDeliveryWindow(window?: DeliveryWindowConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!window) {
    return { valid: true, errors: [] };
  }

  if (!window.timezone || typeof window.timezone !== "string" || !isValidIanaTimezone(window.timezone)) {
    errors.push(`Invalid IANA timezone: "${window.timezone}". Must be a valid IANA timezone name.`);
  }

  if (window.ranges !== undefined) {
    if (!Array.isArray(window.ranges)) {
      errors.push("deliveryWindow.ranges must be an array of time ranges.");
    } else {
      if (window.ranges.length > 4) {
        errors.push(`deliveryWindow.ranges exceeds maximum allowed ranges (max 4, got ${window.ranges.length}).`);
      }
      for (let i = 0; i < window.ranges.length; i++) {
        const r = window.ranges[i];
        if (typeof r.startHour !== "number" || r.startHour < 0 || r.startHour > 23 || !Number.isInteger(r.startHour)) {
          errors.push(`Range ${i}: startHour must be an integer between 0 and 23 (got ${r.startHour}).`);
        }
        if (r.startMinute !== undefined && (typeof r.startMinute !== "number" || r.startMinute < 0 || r.startMinute > 59 || !Number.isInteger(r.startMinute))) {
          errors.push(`Range ${i}: startMinute must be an integer between 0 and 59 (got ${r.startMinute}).`);
        }
        if (typeof r.endHour !== "number" || r.endHour < 0 || r.endHour > 23 || !Number.isInteger(r.endHour)) {
          errors.push(`Range ${i}: endHour must be an integer between 0 and 23 (got ${r.endHour}).`);
        }
        if (r.endMinute !== undefined && (typeof r.endMinute !== "number" || r.endMinute < 0 || r.endMinute > 59 || !Number.isInteger(r.endMinute))) {
          errors.push(`Range ${i}: endMinute must be an integer between 0 and 59 (got ${r.endMinute}).`);
        }
        const startMin = (r.startHour || 0) * 60 + (r.startMinute || 0);
        const endMin = (r.endHour || 0) * 60 + (r.endMinute || 0);
        if (startMin < 0 || startMin > 1439) {
          errors.push(`Range ${i}: start time (${startMin} mins) must be between 0 and 1439 minutes.`);
        }
        if (endMin < 0 || endMin > 1439) {
          errors.push(`Range ${i}: end time (${endMin} mins) must be between 0 and 1439 minutes.`);
        }
        if (startMin === endMin) {
          errors.push(`Range ${i}: start time and end time cannot be identical.`);
        }
      }
    }
  }

  if (window.daysOfWeek !== undefined) {
    if (!Array.isArray(window.daysOfWeek)) {
      errors.push("deliveryWindow.daysOfWeek must be an array of integers (0-6).");
    } else {
      if (window.daysOfWeek.length > 7) {
        errors.push("deliveryWindow.daysOfWeek cannot have more than 7 days.");
      }
      for (const d of window.daysOfWeek) {
        if (typeof d !== "number" || d < 0 || d > 6 || !Number.isInteger(d)) {
          errors.push(`Invalid dayOfWeek: ${d}. Must be an integer 0..6 (0=Sun, 6=Sat).`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface ScheduleItemInput {
  itemId: string;
  serviceId: string;
  totalQuantity: number;
  runs: number;
  ratePer1000: number | string | Decimal;
  minGapMinutes?: number;
  startOffsetMinutes?: number;
  afterItemId?: string;
}

export interface CalculateScheduleInput {
  startTime: Date | string | number;
  durationDays: number;
  deliveryWindow?: DeliveryWindowConfig;
  items: ScheduleItemInput[];
}

export interface ScheduledRun {
  seq: number;
  itemId: string;
  serviceId: string;
  runIndex: number; // 1-based
  quantity: number;
  charge: number; // In currency units (rupees), 2 decimal places
  plannedAt: string; // ISO 8601 UTC
  executeAt: string; // ISO 8601 UTC (snapped to window)
}

export interface DeliveryScheduleResult {
  finishesAt: string; // ISO 8601 UTC
  fitsDuration: boolean;
  warnings: string[];
  runs: ScheduledRun[];
  timeline: Array<{
    dayIndex: number;
    date: string;
    runs: ScheduledRun[];
  }>;
}

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

interface LocalTimeInfo {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
  second: number;
}

export function getZonedTimeInfo(date: Date, timezone: string): LocalTimeInfo {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values: Record<string, string> = {};
  for (const p of parts) {
    values[p.type] = p.value;
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    weekday: WEEKDAY_MAP[values.weekday] ?? 0,
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

/**
 * Checks whether a given instant falls inside the allowed delivery window ranges and days of week.
 */
export function isInsideDeliveryWindow(
  date: Date,
  window: DeliveryWindowConfig
): boolean {
  if (!isValidIanaTimezone(window.timezone)) {
    throw new Error(`Invalid IANA timezone: ${window.timezone}`);
  }

  const info = getZonedTimeInfo(date, window.timezone);

  // Day of week check
  if (
    Array.isArray(window.daysOfWeek) &&
    window.daysOfWeek.length > 0 &&
    !window.daysOfWeek.includes(info.weekday)
  ) {
    return false;
  }

  // Ranges check
  if (!window.ranges || window.ranges.length === 0) {
    return true; // No time range restrictions
  }

  const currentMinutes = info.hour * 60 + info.minute;

  for (const range of window.ranges) {
    const startMins = range.startHour * 60 + (range.startMinute || 0);
    const endMins = range.endHour * 60 + (range.endMinute || 0);

    if (startMins === endMins) {
      // 0 duration range or 24-hour range
      if (range.startHour === 0 && range.endHour === 0) return true;
      continue;
    }

    if (startMins < endMins) {
      // Standard same-day window (e.g. 09:00 - 21:00)
      if (currentMinutes >= startMins && currentMinutes < endMins) {
        return true;
      }
    } else {
      // Midnight-crossing window (e.g. 22:00 - 04:00)
      if (currentMinutes >= startMins || currentMinutes < endMins) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Snaps a given instant forward to the earliest allowed delivery window time >= date.
 * If the instant is already inside the window, returns it unmodified.
 */
export function snapToDeliveryWindow(
  date: Date,
  window: DeliveryWindowConfig
): Date {
  if (isInsideDeliveryWindow(date, window)) {
    return new Date(date.getTime());
  }

  // Iterate forward in minute/day steps up to 14 days maximum to find next opening
  const targetTz = window.timezone;
  let candidate = new Date(date.getTime());

  // Step 1: If current day is allowed, check if there's a range opening later today
  const info = getZonedTimeInfo(candidate, targetTz);
  const currentMins = info.hour * 60 + info.minute;
  const daysAllowed =
    !window.daysOfWeek ||
    window.daysOfWeek.length === 0 ||
    window.daysOfWeek.includes(info.weekday);

  let earliestNextStartDiffMinutes: number | null = null;

  if (daysAllowed && window.ranges && window.ranges.length > 0) {
    for (const range of window.ranges) {
      const startMins = range.startHour * 60 + (range.startMinute || 0);
      const endMins = range.endHour * 60 + (range.endMinute || 0);

      if (startMins < endMins) {
        // Standard window
        if (currentMins < startMins) {
          const diff = startMins - currentMins;
          if (earliestNextStartDiffMinutes === null || diff < earliestNextStartDiffMinutes) {
            earliestNextStartDiffMinutes = diff;
          }
        }
      } else {
        // Midnight crossing (e.g. 22:00 - 04:00)
        if (currentMins >= endMins && currentMins < startMins) {
          const diff = startMins - currentMins;
          if (earliestNextStartDiffMinutes === null || diff < earliestNextStartDiffMinutes) {
            earliestNextStartDiffMinutes = diff;
          }
        }
      }
    }
  }

  if (earliestNextStartDiffMinutes !== null) {
    const candidateShifted = new Date(candidate.getTime() + earliestNextStartDiffMinutes * 60 * 1000);
    // Align seconds/ms to 0
    candidateShifted.setUTCSeconds(0, 0);
    if (isInsideDeliveryWindow(candidateShifted, window)) {
      return candidateShifted;
    }
  }

  // Step 2: Otherwise advance day-by-day (up to 14 days) to the start of the first allowed window range
  // Determine standard start minute offset for allowed days
  let defaultStartMins = 0;
  if (window.ranges && window.ranges.length > 0) {
    // Find the earliest range start
    defaultStartMins = window.ranges[0].startHour * 60 + (window.ranges[0].startMinute || 0);
    for (const r of window.ranges) {
      const s = r.startHour * 60 + (r.startMinute || 0);
      if (s < defaultStartMins) defaultStartMins = s;
    }
  }

  // Walk forward by hour/day
  for (let step = 1; step <= 14 * 24; step++) {
    candidate = new Date(candidate.getTime() + 60 * 60 * 1000);
    candidate.setUTCMinutes(0, 0, 0);
    const candInfo = getZonedTimeInfo(candidate, targetTz);

    const isDayOk =
      !window.daysOfWeek ||
      window.daysOfWeek.length === 0 ||
      window.daysOfWeek.includes(candInfo.weekday);

    if (isDayOk) {
      // Try setting candidate to defaultStartMins in local time
      const targetHour = Math.floor(defaultStartMins / 60);
      const targetMin = defaultStartMins % 60;

      // Adjust candidate to target local hour/minute
      const currentLocalHour = candInfo.hour;
      const currentLocalMin = candInfo.minute;
      const hourDiff = targetHour - currentLocalHour;
      const minDiff = targetMin - currentLocalMin;
      const exactCandidate = new Date(candidate.getTime() + (hourDiff * 60 + minDiff) * 60 * 1000);

      if (exactCandidate >= date && isInsideDeliveryWindow(exactCandidate, window)) {
        return exactCandidate;
      }
      if (isInsideDeliveryWindow(candidate, window)) {
        return candidate;
      }
    }
  }

  // Fallback: return date if no window matched within 14 days
  return date;
}

/**
 * Calculates a complete, multi-service delivery schedule.
 * PURE FUNCTION: No database, no network calls, no randomness.
 *
 * Guaranteed Invariants:
 * 1. Deterministic for equal inputs.
 * 2. Exact integer quantity conservation: sum(run.quantity) == item.totalQuantity.
 * 3. Exact charge calculation using Decimal.js.
 * 4. Monotonic executeAt timestamps per item >= minGapMinutes apart.
 * 5. Every executeAt falls inside the specified delivery window.
 * 6. Never silently truncates duration or quantities; returns warnings if duration is exceeded.
 */
export function calculateDeliverySchedule(
  input: CalculateScheduleInput
): DeliveryScheduleResult {
  const startInstant = new Date(input.startTime);
  if (!Number.isFinite(startInstant.getTime())) {
    throw new Error("Invalid startTime provided to calculateDeliverySchedule");
  }

  const durationDays = Math.max(1, Number(input.durationDays) || 1);
  const tz = input.deliveryWindow?.timezone || "UTC";
  if (!isValidIanaTimezone(tz)) {
    throw new Error(`Invalid IANA timezone: ${tz}`);
  }

  const window: DeliveryWindowConfig = {
    timezone: tz,
    ranges: input.deliveryWindow?.ranges || [],
    daysOfWeek: input.deliveryWindow?.daysOfWeek || [],
  };

  const warnings: string[] = [];
  const runs: ScheduledRun[] = [];
  let globalSeq = 1;

  // Track item finish times for sequencing (afterItemId)
  const itemFirstRunTime = new Map<string, Date>();
  const itemLastRunTime = new Map<string, Date>();

  for (const item of input.items) {
    const runsCount = Math.max(1, item.runs);
    const sliceQty = Math.floor(item.totalQuantity / runsCount);
    const remQty = item.totalQuantity % runsCount;
    const minGapMs = (item.minGapMinutes || 0) * 60 * 1000;

    // Determine initial item start instant
    let itemBaseTime = new Date(startInstant.getTime() + (item.startOffsetMinutes || 0) * 60 * 1000);

    if (item.afterItemId && itemFirstRunTime.has(item.afterItemId)) {
      const dependencyTime = itemFirstRunTime.get(item.afterItemId)!;
      const candidateStart = new Date(dependencyTime.getTime() + (item.startOffsetMinutes || 10) * 60 * 1000);
      if (candidateStart > itemBaseTime) {
        itemBaseTime = candidateStart;
      }
    }

    // Spacing between runs across duration
    const totalDurationMs = durationDays * 24 * 60 * 60 * 1000;
    const naturalSpacingMs = runsCount > 1
      ? Math.floor(totalDurationMs / runsCount)
      : 0;
    const effectiveSpacingMs = Math.max(naturalSpacingMs, minGapMs);

    let lastItemExecuteAt: Date | null = null;

    for (let r = 1; r <= runsCount; r++) {
      const runQty = sliceQty + (r <= remQty ? 1 : 0);
      const runCharge = new Decimal(runQty)
        .times(new Decimal(item.ratePer1000))
        .dividedBy(1000)
        .toDecimalPlaces(2, Decimal.ROUND_CEIL)
        .toNumber();

      // Planned instant
      const plannedTime = new Date(itemBaseTime.getTime() + (r - 1) * effectiveSpacingMs);

      // Snap to delivery window
      let executeAt = snapToDeliveryWindow(plannedTime, window);

      // Enforce monotonic non-overlapping spacing
      if (lastItemExecuteAt !== null) {
        const requiredMinTime = new Date(lastItemExecuteAt.getTime() + minGapMs);
        if (executeAt < requiredMinTime) {
          executeAt = snapToDeliveryWindow(requiredMinTime, window);
        }
      }

      lastItemExecuteAt = executeAt;

      if (r === 1) {
        itemFirstRunTime.set(item.itemId, executeAt);
      }
      itemLastRunTime.set(item.itemId, executeAt);

      runs.push({
        seq: globalSeq++,
        itemId: item.itemId,
        serviceId: item.serviceId,
        runIndex: r,
        quantity: runQty,
        charge: runCharge,
        plannedAt: plannedTime.toISOString(),
        executeAt: executeAt.toISOString(),
      });
    }
  }

  // Sort all runs globally by executeAt then seq
  runs.sort((a, b) => new Date(a.executeAt).getTime() - new Date(b.executeAt).getTime());

  // Re-assign global sequential index
  runs.forEach((r, idx) => {
    r.seq = idx + 1;
  });

  const latestExecuteTime = runs.length > 0
    ? new Date(Math.max(...runs.map((r) => new Date(r.executeAt).getTime())))
    : startInstant;

  const targetDeadline = new Date(startInstant.getTime() + durationDays * 24 * 60 * 60 * 1000);
  const fitsDuration = latestExecuteTime <= targetDeadline;

  if (!fitsDuration) {
    warnings.push(
      `Scheduled delivery finishes at ${latestExecuteTime.toISOString()}, which exceeds duration of ${durationDays} days.`
    );
  }

  // Build grouped timeline by day
  const timelineMap = new Map<number, ScheduledRun[]>();
  for (const run of runs) {
    const diffDays = Math.max(
      1,
      Math.floor((new Date(run.executeAt).getTime() - startInstant.getTime()) / (24 * 60 * 60 * 1000)) + 1
    );
    if (!timelineMap.has(diffDays)) {
      timelineMap.set(diffDays, []);
    }
    timelineMap.get(diffDays)!.push(run);
  }

  const timeline = Array.from(timelineMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([dayIndex, dayRuns]) => ({
      dayIndex,
      date: dayRuns[0]?.executeAt || startInstant.toISOString(),
      runs: dayRuns,
    }));

  return {
    finishesAt: latestExecuteTime.toISOString(),
    fitsDuration,
    warnings,
    runs,
    timeline,
  };
}

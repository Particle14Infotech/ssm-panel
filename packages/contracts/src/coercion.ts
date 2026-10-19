import { Decimal } from "decimal.js";

/**
 * Robust boolean coercion helper
 * Truthy: true, 1, "1", "true", "yes", "on" (case-insensitive, trimmed)
 * Falsy: false, 0, "0", "false", "no", "off", "", null, undefined
 */
export function coerceBoolean(val: any): boolean {
  if (val === true || val === 1) return true;
  if (val === false || val === 0 || val === null || val === undefined) return false;
  
  if (typeof val === "string") {
    const normalized = val.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off" || normalized === "") {
      return false;
    }
  }

  return Boolean(val);
}

/**
 * Distributes total charge across N runs with exact 2-decimal precision.
 * Guarantees that sum(shares) === totalCharge, avoiding any rounding leakage.
 * Any remainder paise/cents are added to the last run.
 */
export function splitChargeShare(totalCharge: number | Decimal, runs: number): number[] {
  if (runs <= 0) return [];
  if (runs === 1) return [new Decimal(totalCharge).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()];

  const total = new Decimal(totalCharge).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const baseShare = total.dividedBy(runs).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  
  const shares: number[] = [];
  let allocated = new Decimal(0);

  for (let i = 0; i < runs - 1; i++) {
    shares.push(baseShare.toNumber());
    allocated = allocated.plus(baseShare);
  }

  // Remainder goes to the last run
  const lastShare = total.minus(allocated).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  shares.push(lastShare.toNumber());

  return shares;
}

/**
 * Generates run execution schedule with timestamps.
 */
export function generateRunSchedule(
  startTime: Date,
  runs: number,
  intervalMinutes: number
): { runIndex: number; scheduledAt: Date }[] {
  const schedule: { runIndex: number; scheduledAt: Date }[] = [];
  const startMs = startTime.getTime();

  for (let i = 0; i < runs; i++) {
    const scheduledAt = new Date(startMs + i * intervalMinutes * 60 * 1000);
    schedule.push({ runIndex: i, scheduledAt });
  }

  return schedule;
}

/**
 * Detects common SMM provider link restriction error messages.
 * e.g., "active order exists", "already in progress", "order on this link", etc.
 */
export function isLinkRestrictionError(errorMessage?: string | null): boolean {
  if (!errorMessage) return false;
  const lower = errorMessage.toLowerCase();
  return (
    lower.includes("active order exists") ||
    lower.includes("order on this link") ||
    lower.includes("active order with this link") ||
    lower.includes("link is already in progress") ||
    lower.includes("order already in progress") ||
    lower.includes("duplicate link") ||
    lower.includes("you have active order") ||
    lower.includes("wait until current order") ||
    lower.includes("already in progress") ||
    lower.includes("link has active order") ||
    lower.includes("pending order on this link") ||
    lower.includes("processing queue")
  );
}

/**
 * Aggregates child run statuses into a parent order status.
 * Spec:
 * - Pending: no run dispatched yet (all runs SCHEDULED)
 * - In progress: any run active or scheduled
 * - Completed: all runs completed
 * - Partial: at least one completed and some failed/canceled/partial
 * - Canceled: nothing delivered, everything refunded (all failed or canceled)
 */
export function aggregateRunStatuses(runStatuses: string[]): "PENDING" | "IN_PROGRESS" | "COMPLETED" | "PARTIAL" | "CANCELLED" {
  if (!runStatuses || runStatuses.length === 0) return "PENDING";

  const allScheduled = runStatuses.every((s) => s === "SCHEDULED");
  if (allScheduled) return "PENDING";

  const allCompleted = runStatuses.every((s) => s === "COMPLETED");
  if (allCompleted) return "COMPLETED";

  const anyCompleted = runStatuses.some((s) => s === "COMPLETED" || s === "PARTIAL");
  const anyActiveOrScheduled = runStatuses.some((s) =>
    ["SCHEDULED", "DISPATCHING", "UNCERTAIN", "PROCESSING"].includes(s)
  );

  if (anyActiveOrScheduled) {
    return "IN_PROGRESS";
  }

  if (anyCompleted) {
    return "PARTIAL";
  }

  // Nothing delivered, everything refunded (all FAILED, CANCELED, or CANCELLED)
  return "CANCELLED";
}

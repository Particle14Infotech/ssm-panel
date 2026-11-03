import { Decimal } from "decimal.js";
import {
  DeliveryWindowConfig,
  snapToDeliveryWindow,
} from "./delivery-schedule";
import { isValidIanaTimezone } from "./packages";

export interface DeliveryPacedItemInput {
  itemId: string;
  serviceId: string;
  serviceName?: string;
  serviceKind?: string;
  totalQuantity: number;
  ratePer1000: number; // in rupees
  providerMin: number;
  providerMax: number;
  paceCapPerHour: number; // Max allowed units per hour for this kind
  minGapMinutes?: number; // Minimum spacing between dispatches
  startOffsetMinutes?: number; // Offset from campaign start
  afterItemId?: string; // Dependency sequencing
}

export interface CalculatePacedScheduleInput {
  startTime: string | Date;
  durationDays?: number;
  deliveryWindow?: DeliveryWindowConfig;
  items: DeliveryPacedItemInput[];
}

export interface PacedScheduledRun {
  seq: number;
  itemId: string;
  serviceId: string;
  quantity: number;
  allocatedCharge: number; // In rupees, exact to 2 decimal places
  allocatedChargePaise: number; // Exact integer paise
  executeAt: Date;
  gapMinutesFromPrev?: number;
}

export interface PacedItemScheduleResult {
  itemId: string;
  serviceId: string;
  totalQuantity: number;
  totalCharge: number;
  totalChargePaise: number;
  runsCount: number;
  finishesAt: Date;
  effectivePacePerHour: number;
  fitsDuration: boolean;
  warnings: string[];
  runs: PacedScheduledRun[];
}

export interface PacedDeliveryScheduleResult {
  finishesAt: Date;
  effectivePacePerHour: number;
  fitsDuration: boolean;
  warnings: string[];
  items: PacedItemScheduleResult[];
  allRuns: PacedScheduledRun[];
}

/**
 * Pure deterministic scheduling module with strict rate and provider limit enforcement.
 *
 * Rules:
 * 1. Zero database, zero network, zero randomness.
 * 2. perRun = min(providerMax, paceCapPerHour * gapHours).
 * 3. If perRun < providerMin, increase gap so perRun >= providerMin.
 * 4. runs = ceil(Q / perRun), remainder spread evenly over initial runs.
 * 5. Sum of quantities equals Q exactly.
 * 6. Sum of allocated charges equals item total charge to the exact paisa (last run takes remainder).
 * 7. If Q < providerMin, warning emitted, never silently merged into a bigger order.
 */
export function calculateDeliveryPacedSchedule(
  input: CalculatePacedScheduleInput
): PacedDeliveryScheduleResult {
  const startInstant = new Date(input.startTime);
  if (!Number.isFinite(startInstant.getTime())) {
    throw new Error("Invalid startTime provided to calculateDeliveryPacedSchedule");
  }

  const durationDays = Math.max(1, Number(input.durationDays) || 1);
  const plannedEndInstant = new Date(
    startInstant.getTime() + durationDays * 24 * 60 * 60 * 1000
  );

  const tz = input.deliveryWindow?.timezone || "UTC";
  if (!isValidIanaTimezone(tz)) {
    throw new Error(`Invalid IANA timezone: ${tz}`);
  }

  const window: DeliveryWindowConfig = {
    timezone: tz,
    ranges: input.deliveryWindow?.ranges || [],
    daysOfWeek: input.deliveryWindow?.daysOfWeek || [],
  };

  const itemResults: PacedItemScheduleResult[] = [];
  const allRuns: PacedScheduledRun[] = [];
  const globalWarnings: string[] = [];
  let globalSeq = 1;

  // Track sequencing dependencies
  const itemStartTimes = new Map<string, Date>();
  const itemEndTimes = new Map<string, Date>();

  for (const item of input.items) {
    const warnings: string[] = [];
    const Q = Math.max(0, Math.floor(item.totalQuantity));
    const providerMin = Math.max(1, Math.floor(item.providerMin));
    const providerMax = Math.max(providerMin, Math.floor(item.providerMax));
    const paceCap = Math.max(1, Math.floor(item.paceCapPerHour));
    const minGapMin = Math.max(1, Math.floor(item.minGapMinutes || 60));

    // Total item charge in exact paise (1 INR = 100 paise)
    const itemTotalChargePaise = Math.round(
      (Q * item.ratePer1000 * 100) / 1000
    );
    const itemTotalCharge = itemTotalChargePaise / 100;

    // Check if total quantity is strictly below provider minimum
    if (Q < providerMin) {
      warnings.push(
        `Quantity ${Q} is below provider minimum threshold of ${providerMin} for service "${item.serviceName || item.serviceId}". Order cannot be fulfilled without violating provider constraints.`
      );
      globalWarnings.push(...warnings);

      const emptyRes: PacedItemScheduleResult = {
        itemId: item.itemId,
        serviceId: item.serviceId,
        totalQuantity: Q,
        totalCharge: itemTotalCharge,
        totalChargePaise: itemTotalChargePaise,
        runsCount: 0,
        finishesAt: startInstant,
        effectivePacePerHour: 0,
        fitsDuration: false,
        warnings,
        runs: [],
      };
      itemResults.push(emptyRes);
      continue;
    }

    // Determine initial gap in hours
    let effectiveGapMinutes = minGapMin;
    let gapHours = effectiveGapMinutes / 60;

    // perRun = min(providerMax, paceCapPerHour * gapHours)
    let perRun = Math.min(providerMax, Math.floor(paceCap * gapHours));

    // If perRun < providerMin, increase the gap so that perRun >= providerMin
    if (perRun < providerMin) {
      // Required hours to accumulate providerMin units without exceeding paceCap:
      gapHours = Math.ceil(providerMin / paceCap);
      effectiveGapMinutes = gapHours * 60;
      perRun = providerMin;
    }

    // Number of runs = ceil(Q / perRun), bounded so no run drops below providerMin
    let runsCount = Math.max(1, Math.ceil(Q / perRun));
    if (Q >= providerMin) {
      const maxPossibleRuns = Math.floor(Q / providerMin);
      runsCount = Math.max(1, Math.min(runsCount, maxPossibleRuns));
    }
    const baseQty = Math.floor(Q / runsCount);
    const remainderQty = Q % runsCount;

    // Item starting time
    let itemBaseTime = new Date(
      startInstant.getTime() + (item.startOffsetMinutes || 0) * 60 * 1000
    );

    // Dependency sequencing: start after designated afterItemId
    if (item.afterItemId && itemStartTimes.has(item.afterItemId)) {
      const depStartTime = itemStartTimes.get(item.afterItemId)!;
      const candidateStart = new Date(
        depStartTime.getTime() + (item.startOffsetMinutes || 15) * 60 * 1000
      );
      if (candidateStart > itemBaseTime) {
        itemBaseTime = candidateStart;
      }
    }

    const itemRuns: PacedScheduledRun[] = [];
    let allocatedPaiseSum = 0;
    let lastRunInstant: Date | null = null;

    for (let r = 1; r <= runsCount; r++) {
      // First remainderQty runs get +1 to conserve exact total quantity Q
      const runQty = baseQty + (r <= remainderQty ? 1 : 0);

      // Charge in exact integer paise
      let runPaise = 0;
      if (r === runsCount) {
        // Last run takes remainder of total paise to ensure sum exact
        runPaise = itemTotalChargePaise - allocatedPaiseSum;
      } else {
        runPaise = Math.round((runQty * item.ratePer1000 * 100) / 1000);
      }
      allocatedPaiseSum += runPaise;
      const runCharge = runPaise / 100;

      // Planned instant spaced by effectiveGapMinutes
      const plannedTime = new Date(
        itemBaseTime.getTime() + (r - 1) * effectiveGapMinutes * 60 * 1000
      );

      // Snap to delivery window & enforce gap >= effectiveGapMinutes
      let executeAt = snapToDeliveryWindow(plannedTime, window);
      if (lastRunInstant !== null) {
        const requiredMinTime = new Date(
          lastRunInstant.getTime() + effectiveGapMinutes * 60 * 1000
        );
        if (executeAt < requiredMinTime) {
          executeAt = snapToDeliveryWindow(requiredMinTime, window);
        }
      }

      const gapFromPrev = lastRunInstant
        ? Math.round((executeAt.getTime() - lastRunInstant.getTime()) / 60000)
        : 0;

      lastRunInstant = executeAt;

      if (r === 1) {
        itemStartTimes.set(item.itemId, executeAt);
      }
      itemEndTimes.set(item.itemId, executeAt);

      const runRecord: PacedScheduledRun = {
        seq: globalSeq++,
        itemId: item.itemId,
        serviceId: item.serviceId,
        quantity: runQty,
        allocatedCharge: runCharge,
        allocatedChargePaise: runPaise,
        executeAt,
        gapMinutesFromPrev: gapFromPrev,
      };

      itemRuns.push(runRecord);
      allRuns.push(runRecord);
    }

    const itemFinishesAt = lastRunInstant || startInstant;
    const itemTotalDurationHours = Math.max(
      1,
      (itemFinishesAt.getTime() - startInstant.getTime()) / (3600 * 1000)
    );
    const effectivePace = Math.round((Q / itemTotalDurationHours) * 10) / 10;
    const fitsDuration = itemFinishesAt <= plannedEndInstant;

    if (!fitsDuration) {
      warnings.push(
        `Delivery finish time (${itemFinishesAt.toISOString()}) extends beyond the planned duration (${plannedEndInstant.toISOString()}) to maintain the pace cap of ${paceCap} units/hour.`
      );
      globalWarnings.push(...warnings);
    }

    itemResults.push({
      itemId: item.itemId,
      serviceId: item.serviceId,
      totalQuantity: Q,
      totalCharge: itemTotalCharge,
      totalChargePaise: itemTotalChargePaise,
      runsCount,
      finishesAt: itemFinishesAt,
      effectivePacePerHour: effectivePace,
      fitsDuration,
      warnings,
      runs: itemRuns,
    });
  }

  // Sort all runs chronologically
  allRuns.sort((a, b) => a.executeAt.getTime() - b.executeAt.getTime());

  let overallFinishesAt = startInstant;
  for (const item of itemResults) {
    if (item.finishesAt > overallFinishesAt) {
      overallFinishesAt = item.finishesAt;
    }
  }

  const overallDurationHours = Math.max(
    1,
    (overallFinishesAt.getTime() - startInstant.getTime()) / (3600 * 1000)
  );
  const totalQuantitySum = itemResults.reduce(
    (acc, it) => acc + it.totalQuantity,
    0
  );
  const effectiveOverallPace =
    Math.round((totalQuantitySum / overallDurationHours) * 10) / 10;
  const overallFitsDuration = overallFinishesAt <= plannedEndInstant;

  return {
    finishesAt: overallFinishesAt,
    effectivePacePerHour: effectiveOverallPace,
    fitsDuration: overallFitsDuration,
    warnings: globalWarnings,
    items: itemResults,
    allRuns,
  };
}


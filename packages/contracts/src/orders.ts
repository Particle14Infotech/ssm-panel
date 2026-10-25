import { z } from "zod";
import { Decimal } from "decimal.js";

export const OrderStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "IN_PROGRESS",
  "COMPLETED",
  "PARTIAL",
  "CANCELLED",
  "FAILED",
  "REFUNDED",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const DripModeSchema = z.enum(["NONE", "NATIVE", "MANAGED"]);
export type DripMode = z.infer<typeof DripModeSchema>;

export const OrderRunStatusSchema = z.enum([
  "SCHEDULED",
  "DISPATCHING",
  "UNCERTAIN",
  "PROCESSING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "CANCELED",
]);
export type OrderRunStatus = z.infer<typeof OrderRunStatusSchema>;

export const OrderRunItemSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  runIndex: z.number().int(),
  quantity: z.number().int(),
  scheduledAt: z.string(),
  status: OrderRunStatusSchema,
  providerOrderId: z.string().nullable().optional(),
  attempts: z.number().int(),
  nextAttemptAt: z.string().nullable().optional(),
  lastError: z.string().nullable().optional(),
  delivered: z.number().int(),
  chargeShare: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type OrderRunItem = z.infer<typeof OrderRunItemSchema>;

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["PROCESSING", "IN_PROGRESS", "CANCELLED", "FAILED"] as const,
  PROCESSING: ["IN_PROGRESS", "COMPLETED", "PARTIAL", "CANCELLED", "FAILED"] as const,
  IN_PROGRESS: ["COMPLETED", "PARTIAL", "CANCELLED", "FAILED"] as const,
  PARTIAL: ["REFUNDED"] as const,
  CANCELLED: ["REFUNDED"] as const,
  FAILED: ["REFUNDED"] as const,
  COMPLETED: [] as const, // Terminal state
  REFUNDED: [] as const,  // Terminal state
};

/**
 * Pure function enforcing the strict authoritative Order State Machine transitions.
 * Returns true if valid, false otherwise.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false;
  const allowed = VALID_ORDER_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Asserts valid transition or throws an explicit error describing the violation.
 */
export function assertValidTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Illegal Order Status Transition: cannot transition from ${from} to ${to}. Allowed transitions for ${from}: [${
        VALID_ORDER_TRANSITIONS[from]?.join(", ") || "none (terminal)"
      }]`
    );
  }
}

/**
 * Shared, authoritative pricing calculation
 * Example: rate 50/1000 x 5000 qty = 250
 * Rounds UP (ceil) to 2 decimal places.
 */
export function calculateOrderCharge(
  ratePer1000: number,
  quantity: number,
  discountPercent: number = 0,
  runs: number = 1
): number {
  if (ratePer1000 <= 0 || quantity <= 0 || runs <= 0) return 0;
  const totalUnits = new Decimal(quantity).times(runs);
  const raw = totalUnits.times(ratePer1000).dividedBy(1000);
  const discountFactor = new Decimal(100).minus(Math.max(0, Math.min(100, discountPercent))).dividedBy(100);
  const withDiscount = raw.times(discountFactor);
  return withDiscount.toDecimalPlaces(2, Decimal.ROUND_UP).toNumber();
}

/**
 * Shared partial refund calculation formula:
 * refund = charge x (remains / totalQuantity)
 */
export function calculatePartialRefund(
  charge: number,
  quantity: number,
  remains: number,
  totalQuantity?: number
): number {
  const effectiveTotal = totalQuantity !== undefined && totalQuantity > 0 ? totalQuantity : quantity;
  if (charge <= 0 || effectiveTotal <= 0 || remains <= 0) return 0;
  const clampedRemains = Math.min(effectiveTotal, Math.max(0, remains));
  const refundAmount = new Decimal(charge).times(clampedRemains).dividedBy(effectiveTotal);
  return refundAmount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export const CreateOrderInputBaseSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  target: z.string().min(1, "A valid target link or handle is required"),
  quantity: z.number().int().positive("Quantity must be greater than 0"),
  isDripFeed: z.boolean().default(false),
  runs: z.number().int().positive().optional(),
  interval: z.number().int().positive().optional(),
  comments: z.string().optional(),
  couponCode: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

export const CreateOrderInputSchema = CreateOrderInputBaseSchema.superRefine((data, ctx) => {
  if (data.isDripFeed) {
    if (data.runs === undefined || data.runs === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Runs parameter is required when drip-feed is enabled",
        path: ["runs"],
      });
    } else if (data.runs < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Runs must be at least 2 for drip-feed orders",
        path: ["runs"],
      });
    }

    if (data.interval === undefined || data.interval === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Interval parameter is required when drip-feed is enabled",
        path: ["interval"],
      });
    } else if (data.interval < 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Interval must be at least 5 minutes for drip-feed orders",
        path: ["interval"],
      });
    }
  } else {
    if (data.runs !== undefined && data.runs !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Runs cannot be specified for non-drip-feed orders",
        path: ["runs"],
      });
    }
    if (data.interval !== undefined && data.interval !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Interval cannot be specified for non-drip-feed orders",
        path: ["interval"],
      });
    }
  }
});
export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;

export const OrderItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userEmail: z.string().optional(),
  serviceId: z.string(),
  serviceName: z.string(),
  platform: z.string(),
  target: z.string(),
  quantity: z.number(),
  isDripFeed: z.boolean().optional(),
  runs: z.number().nullable().optional(),
  intervalMinutes: z.number().nullable().optional(),
  quantityPerRun: z.number().nullable().optional(),
  totalQuantity: z.number().optional(),
  charge: z.number(),
  startCount: z.number().nullable().optional(),
  remains: z.number().nullable().optional(),
  status: OrderStatusSchema,
  dripMode: DripModeSchema.optional(),
  runsList: z.array(OrderRunItemSchema).optional(),
  providerOrderId: z.string().nullable().optional(),
  providerId: z.string().nullable().optional(),
  packageExecutionId: z.string().nullable().optional(),
  providerName: z.string().nullable().optional(),
  idempotencyKey: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  refillable: z.boolean().optional(),
  cancellable: z.boolean().optional(),
  providerEvents: z.array(z.any()).optional(),
  isPrepaid: z.boolean().optional(),
  packageRunId: z.string().nullable().optional(),
  packageExecution: z
    .object({
      id: z.string(),
      seq: z.number().int(),
      packageId: z.string(),
      status: z.string(),
      remainingQuantity: z.number().int().optional(),
      quantity: z.number().int().optional(),
      package: z
        .object({
          id: z.string(),
          platform: z.string().optional(),
          handle: z.string().optional(),
          status: z.string().optional(),
          rules: z.array(z.any()).optional(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
  packageRun: z
    .object({
      id: z.string(),
      runIndex: z.number(),
      packageId: z.string(),
      package: z
        .object({
          id: z.string(),
          name: z.string(),
          status: z.string(),
          totalRuns: z.number(),
          completedRuns: z.number(),
          failedRuns: z.number().optional(),
          cancelledRuns: z.number().optional(),
        })
        .optional(),
    })
    .nullable()
    .optional(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

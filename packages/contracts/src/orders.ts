import { z } from "zod";

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

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["PROCESSING", "CANCELLED", "FAILED"] as const,
  PROCESSING: ["IN_PROGRESS", "COMPLETED", "PARTIAL", "CANCELLED", "FAILED"] as const,
  IN_PROGRESS: ["COMPLETED", "PARTIAL", "CANCELLED"] as const,
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
 */
export function calculateOrderCharge(
  ratePer1000: number,
  quantity: number,
  discountPercent: number = 0
): number {
  if (ratePer1000 <= 0 || quantity <= 0) return 0;
  const raw = (ratePer1000 * quantity) / 1000;
  const withDiscount = raw * (1 - Math.max(0, Math.min(100, discountPercent)) / 100);
  return Math.round(withDiscount * 10000) / 10000;
}

/**
 * Shared partial refund calculation formula:
 * refund = charge x (remains / quantity)
 */
export function calculatePartialRefund(
  charge: number,
  quantity: number,
  remains: number
): number {
  if (charge <= 0 || quantity <= 0 || remains <= 0) return 0;
  const clampedRemains = Math.min(quantity, Math.max(0, remains));
  const refundAmount = (charge * clampedRemains) / quantity;
  return Math.round(refundAmount * 10000) / 10000;
}

export const CreateOrderInputSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  target: z.string().min(1, "A valid target link or handle is required"),
  quantity: z.number().int().positive("Quantity must be greater than 0"),
  runs: z.number().int().positive().optional(),
  interval: z.number().int().positive().optional(),
  comments: z.string().optional(),
  couponCode: z.string().optional(),
  idempotencyKey: z.string().optional(),
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
  charge: z.number(),
  startCount: z.number().nullable().optional(),
  remains: z.number().nullable().optional(),
  status: OrderStatusSchema,
  providerOrderId: z.string().nullable().optional(),
  providerName: z.string().nullable().optional(),
  idempotencyKey: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  refillable: z.boolean().optional(),
  cancellable: z.boolean().optional(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

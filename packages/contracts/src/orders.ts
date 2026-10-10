import { z } from "zod";

export const OrderStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "IN_PROGRESS",
  "COMPLETED",
  "PARTIAL",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const CreateOrderInputSchema = z.object({
  serviceId: z.string().min(1, "Service is required"),
  target: z.string().url("A valid public target URL or handle is required"),
  quantity: z.number().int().positive("Quantity must be greater than 0"),
  runs: z.number().int().positive().optional(),
  interval: z.number().int().positive().optional(),
  comments: z.string().optional(),
  couponCode: z.string().optional(),
});
export type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;

export const OrderItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  platform: z.string(),
  target: z.string(),
  quantity: z.number(),
  charge: z.number(),
  startCount: z.number().nullable().optional(),
  remains: z.number().nullable().optional(),
  status: OrderStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  refillable: z.boolean().optional(),
  cancellable: z.boolean().optional(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

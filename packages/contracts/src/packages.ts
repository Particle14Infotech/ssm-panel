import { z } from "zod";

export const PackageTargetTypeSchema = z.enum(["PROFILE", "POST_OR_REEL"]);
export type PackageTargetType = z.infer<typeof PackageTargetTypeSchema>;

export const PackageItemInputSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required"),
  target: z.string().min(1, "Target URL or profile link is required"),
  targetType: PackageTargetTypeSchema.default("PROFILE"),
  quantity: z.number().int().positive("Quantity must be positive"),
});
export type PackageItemInput = z.infer<typeof PackageItemInputSchema>;

export const PackageQuoteInputSchema = z.object({
  name: z.string().optional(),
  items: z.array(PackageItemInputSchema).min(1, "At least one item is required").max(10, "Maximum 10 items per package"),
  days: z.number().int().min(2, "Duration must be at least 2 days").max(60, "Maximum duration is 60 days"),
  intervalHours: z.number().int().min(1).max(72).optional(),
});
export type PackageQuoteInput = z.infer<typeof PackageQuoteInputSchema>;

export const PackageRunPreviewSchema = z.object({
  runIndex: z.number().int(),
  scheduledAt: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  target: z.string(),
  quantity: z.number().int(),
  chargeShare: z.number(),
});
export type PackageRunPreview = z.infer<typeof PackageRunPreviewSchema>;

export const PackageQuoteResponseSchema = z.object({
  valid: z.boolean(),
  totalCharge: z.number(),
  totalRuns: z.number(),
  days: z.number(),
  items: z.array(
    z.object({
      serviceId: z.string(),
      serviceName: z.string(),
      target: z.string(),
      targetType: PackageTargetTypeSchema,
      totalQuantity: z.number(),
      charge: z.number(),
      ratePer1000: z.number(),
      runs: z.number(),
      minQty: z.number(),
      maxQty: z.number(),
    })
  ),
  timeline: z.array(PackageRunPreviewSchema),
  warnings: z.array(z.string()),
});
export type PackageQuoteResponse = z.infer<typeof PackageQuoteResponseSchema>;

export const PackagePurchaseInputSchema = PackageQuoteInputSchema.extend({
  idempotencyKey: z.string().optional(),
});
export type PackagePurchaseInput = z.infer<typeof PackagePurchaseInputSchema>;

export const PackageStatusSchema = z.enum(["ACTIVE", "COMPLETED", "CANCELLED", "PARTIAL"]);
export type PackageStatus = z.infer<typeof PackageStatusSchema>;

export const PackageRunStatusSchema = z.enum([
  "SCHEDULED",
  "DISPATCHING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);
export type PackageRunStatus = z.infer<typeof PackageRunStatusSchema>;

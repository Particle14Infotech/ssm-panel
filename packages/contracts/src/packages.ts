import { z } from "zod";

export const PackageTargetTypeSchema = z.enum(["PROFILE", "POST_OR_REEL"]);
export type PackageTargetType = z.infer<typeof PackageTargetTypeSchema>;

export const MediaTypeSchema = z.enum(["IMAGE", "VIDEO", "REEL", "CAROUSEL_ALBUM"]);
export type MediaType = z.infer<typeof MediaTypeSchema>;

export const PackageItemInputSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required"),
  target: z.string().min(1, "Target URL or profile link is required"),
  targetType: PackageTargetTypeSchema.default("PROFILE"),
  quantity: z.number().int().positive("Quantity must be positive"),
  enabled: z.boolean().default(true).optional(),
  quantityPerPost: z.number().int().nonnegative().optional(),
  maximumPostsToProcess: z.number().int().positive().optional(),
  delayAfterPublication: z.number().int().nonnegative().optional(), // in minutes
  eligibleMediaTypes: z.array(MediaTypeSchema).optional(),
  minimumIntervalBetweenActions: z.number().int().nonnegative().optional(),
  allowedTimeWindow: z
    .object({
      startHour: z.number().int().min(0).max(23).optional(),
      endHour: z.number().int().min(0).max(23).optional(),
    })
    .optional(),
  timezone: z.string().optional(),
  retryPolicy: z.object({ maxRetries: z.number().int().min(0).max(5).optional() }).optional(),
  failurePolicy: z.enum(["CONTINUE", "PAUSE"]).optional(),
});
export type PackageItemInput = z.infer<typeof PackageItemInputSchema>;

export const PackageQuoteInputSchema = z.object({
  name: z.string().optional(),
  connectionId: z.string().optional(),
  accountUsername: z.string().optional(),
  autoPostEnabled: z.boolean().default(true).optional(),
  items: z.array(PackageItemInputSchema).min(1, "At least one item is required").max(10, "Maximum 10 items per package"),
  days: z.number().int().min(2, "Duration must be at least 2 days").max(365, "Maximum duration is 365 days"),
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
  autoPostEnabled: z.boolean().optional(),
  connection: z
    .object({
      id: z.string(),
      username: z.string(),
      accountType: z.string(),
      connectionStatus: z.string(),
    })
    .optional()
    .nullable(),
  items: z.array(
    z.object({
      serviceId: z.string(),
      serviceName: z.string(),
      target: z.string(),
      targetType: PackageTargetTypeSchema,
      totalQuantity: z.number(),
      quantityPerPost: z.number().optional(),
      delayAfterPublication: z.number().optional(),
      eligibleMediaTypes: z.array(z.string()).optional(),
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

export const PackageStatusSchema = z.enum([
  "DRAFT",
  "QUOTED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "EXPIRED",
  "PARTIAL",
  "RECONNECT_REQUIRED",
]);
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

// Instagram Connection Contracts
export const InstagramConnectInputSchema = z.object({
  platformAccountId: z.string().min(1, "Platform account ID is required"),
  username: z.string().min(1, "Username is required"),
  accountType: z.enum(["PERSONAL", "BUSINESS", "CREATOR"]).default("BUSINESS").optional(),
  accessToken: z.string().optional(),
  expiresInSeconds: z.number().int().positive().optional(),
  grantedScopes: z.array(z.string()).optional(),
});
export type InstagramConnectInput = z.infer<typeof InstagramConnectInputSchema>;

export const InstagramConnectionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  platformAccountId: z.string(),
  username: z.string(),
  accountType: z.string(),
  tokenExpiresAt: z.string().nullable().optional(),
  grantedScopes: z.array(z.string()),
  connectionStatus: z.enum(["CONNECTED", "EXPIRED", "DISCONNECTED", "RECONNECT_REQUIRED"]),
  lastDetectedAt: z.string().nullable().optional(),
  connectedAt: z.string(),
  disconnectedAt: z.string().nullable().optional(),
});
export type InstagramConnection = z.infer<typeof InstagramConnectionSchema>;

export const MonitoredMediaSchema = z.object({
  id: z.string(),
  connectionId: z.string(),
  packageId: z.string().nullable().optional(),
  mediaId: z.string(),
  permalink: z.string().nullable().optional(),
  mediaType: z.string(),
  caption: z.string().nullable().optional(),
  publishedAt: z.string(),
  firstDetectedAt: z.string(),
});
export type MonitoredMedia = z.infer<typeof MonitoredMediaSchema>;

export const AutomationExecutionSchema = z.object({
  id: z.string(),
  packageId: z.string(),
  packageItemId: z.string(),
  mediaId: z.string(),
  actionType: z.string(),
  status: z.enum(["PENDING", "SCHEDULED", "PROCESSING", "COMPLETED", "FAILED", "SKIPPED", "CANCELLED"]),
  quantity: z.number(),
  scheduledAt: z.string(),
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  childOrderId: z.string().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
});
export type AutomationExecution = z.infer<typeof AutomationExecutionSchema>;

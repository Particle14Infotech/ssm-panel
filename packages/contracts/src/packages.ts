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
  maxPosts: z.number().int().positive().optional(),
  deliveryWindowMin: z.number().int().nonnegative().optional(),
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

export const PackageRuleKindSchema = z.enum(["POST_TRIGGERED", "TIME_DRIP"]);
export type PackageRuleKind = z.infer<typeof PackageRuleKindSchema>;

export const PackageRuleInputSchema = z.object({
  kind: PackageRuleKindSchema,
  serviceId: z.string().min(1, "Service ID is required"),
  quantityPerPost: z.number().int().nonnegative().default(0),
  totalQuantity: z.number().int().nonnegative().optional(),
  mediaTypes: z.array(MediaTypeSchema).default([]),
  delayMinutes: z.number().int().nonnegative().default(0),
  deliveryWindowMin: z.number().int().nonnegative().default(0),
  maxPosts: z.number().int().positive().default(1),
  maxPerDay: z.number().int().nonnegative().default(0),
  minSpacingMin: z.number().int().nonnegative().default(0),
});
export type PackageRuleInput = z.infer<typeof PackageRuleInputSchema>;

export const SupportedPlatformSchema = z.enum([
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "x",
  "telegram",
]);
export type SupportedPlatform = z.infer<typeof SupportedPlatformSchema>;

export const PlatformConfigSchema = z.object({
  id: z.string(),
  platform: SupportedPlatformSchema,
  displayName: z.string(),
  handleRegex: z.string(),
  handleMaxLength: z.number().int(),
  hostAllowlist: z.array(z.string()),
  pathPattern: z.string(),
  mediaKeyExtractor: z.string(),
  urlContainsHandle: z.boolean(),
  eligibleRuleKinds: z.array(z.string()),
  followersIntervals: z.array(z.number().int()),
  minGapMinutes: z.number().int(),
  maxRunsPerPost: z.number().int(),
  defaultWindowMinutes: z.number().int(),
  limits: z.record(z.any()).default({}),
  active: z.boolean().default(true),
});
export type PlatformConfig = z.infer<typeof PlatformConfigSchema>;

export const PackageQuoteItemSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  kind: PackageRuleKindSchema,
  ratePer1000: z.number(),
  quantity: z.number(),
  maxPosts: z.number(),
  charge: z.number(),
  minQty: z.number().optional(),
  maxQty: z.number().optional(),
  deliveryWindowMin: z.number().optional(),
});
export type PackageQuoteItem = z.infer<typeof PackageQuoteItemSchema>;

export const PackageQuoteInputSchema = z.object({
  platform: SupportedPlatformSchema.default("instagram"),
  handle: z.string().min(1, "Handle is required"),
  followersDrip: z
    .object({
      serviceId: z.string(),
      quantity: z.number().int().positive(),
      days: z.number().int().positive().max(365),
      intervalHours: z.number().int().positive(),
    })
    .optional(),
  postRules: z
    .array(
      z.object({
        serviceId: z.string(),
        maxPosts: z.number().int().positive(),
        maxQtyPerPost: z.number().int().positive(),
        defaultWindowMin: z.number().int().positive().default(180),
      })
    )
    .optional(),
  rules: z.array(PackageRuleInputSchema).optional(),
  items: z.array(PackageItemInputSchema).optional(),
  durationDays: z.number().int().min(1).max(365).optional(),
  days: z.number().int().min(1).max(365).optional(),
  consentRulesUnderstood: z.boolean().optional(),
});
export type PackageQuoteInput = z.infer<typeof PackageQuoteInputSchema>;

export const PackageRunPreviewSchema = z.object({
  runIndex: z.number().int(),
  scheduledAt: z.string(),
  serviceId: z.string(),
  serviceName: z.string(),
  target: z.string().optional(),
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
      target: z.string().optional(),
      targetType: PackageTargetTypeSchema.optional(),
      kind: PackageRuleKindSchema.optional(),
      totalQuantity: z.number(),
      quantityPerPost: z.number().optional(),
      charge: z.number(),
      ratePer1000: z.number(),
      runs: z.number().optional(),
      maxPosts: z.number().optional(),
      minQty: z.number().optional(),
      maxQty: z.number().optional(),
      deliveryWindowMin: z.number().optional(),
    })
  ),
  timeline: z.array(PackageRunPreviewSchema),
  warnings: z.array(z.string()),
  disclaimer: z.string().default("Maximum total; unused is refunded at the end"),
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
]);
export type PackageStatus = z.infer<typeof PackageStatusSchema>;

export const PackageExecutionStatusSchema = z.enum([
  "DETECTED",
  "SCHEDULED",
  "DISPATCHED",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "CANCELLED",
  "SKIPPED_PAUSED",
  "SKIPPED_QUOTA",
  "SKIPPED_TYPE",
  "SKIPPED_DELETED",
  "SKIPPED_LIMIT",
]);
export type PackageExecutionStatus = z.infer<typeof PackageExecutionStatusSchema>;

export const TriggerPreviewInputSchema = z.object({
  url: z.string().url("A valid URL is required"),
  mediaType: z.string().optional(),
});
export type TriggerPreviewInput = z.infer<typeof TriggerPreviewInputSchema>;

export const TriggerExecutionInputSchema = z.object({
  url: z.string().url("A valid URL is required"),
  mediaType: z.string().optional(),
  rules: z
    .array(
      z.object({
        ruleId: z.string(),
        quantity: z.number().int().positive(),
        deliveryWindowMin: z.number().int().positive().optional(),
      })
    )
    .optional(),
});
export type TriggerExecutionInput = z.infer<typeof TriggerExecutionInputSchema>;

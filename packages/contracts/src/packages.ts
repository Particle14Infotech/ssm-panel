import { z } from "zod";

export const PACKAGE_PROVIDER_STATUS_STALLED_REASON =
  "Provider status polling paused 24 hours after child-order creation without a terminal result. An admin can resume status checks; the child order will not be resubmitted.";

export function isValidIanaTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const IanaTimezoneSchema = z
  .string()
  .trim()
  .min(1, "Timezone is required")
  .refine(isValidIanaTimezone, "Timezone must be a valid IANA timezone");

type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function getZonedDateTimeParts(date: Date, timezone: string): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function sameLocalDateTime(
  left: LocalDateTimeParts,
  right: LocalDateTimeParts
): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute
  );
}

export function formatInstantForDateTimeLocal(
  instant: string | Date,
  timezone: string
): string {
  const date = instant instanceof Date ? instant : new Date(instant);
  if (!Number.isFinite(date.getTime()) || !isValidIanaTimezone(timezone)) {
    throw new RangeError("A valid instant and IANA timezone are required.");
  }

  const parts = getZonedDateTimeParts(date, timezone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function localDateTimeToInstant(
  value: string,
  timezone: string
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match || !isValidIanaTimezone(timezone)) {
    throw new RangeError("A valid local date/time and IANA timezone are required.");
  }

  const desired: LocalDateTimeParts = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
  };
  const wallTimeAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute
  );
  if (
    !sameLocalDateTime(
      {
        year: new Date(wallTimeAsUtc).getUTCFullYear(),
        month: new Date(wallTimeAsUtc).getUTCMonth() + 1,
        day: new Date(wallTimeAsUtc).getUTCDate(),
        hour: new Date(wallTimeAsUtc).getUTCHours(),
        minute: new Date(wallTimeAsUtc).getUTCMinutes(),
      },
      desired
    )
  ) {
    throw new RangeError("The local date/time is invalid.");
  }

  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = new Date(wallTimeAsUtc + hours * 60 * 60 * 1000);
    const localParts = getZonedDateTimeParts(sample, timezone);
    const localAsUtc = Date.UTC(
      localParts.year,
      localParts.month - 1,
      localParts.day,
      localParts.hour,
      localParts.minute
    );
    offsets.add(localAsUtc - sample.getTime());
  }

  const candidates = [...offsets]
    .map((offset) => new Date(wallTimeAsUtc - offset))
    .filter((candidate) =>
      sameLocalDateTime(getZonedDateTimeParts(candidate, timezone), desired)
    );

  if (candidates.length === 0) {
    throw new RangeError(
      "This local time does not exist in the selected timezone because of a daylight-saving transition."
    );
  }
  if (candidates.length > 1) {
    throw new RangeError(
      "This local time occurs twice in the selected timezone because of a daylight-saving transition."
    );
  }

  return candidates[0].toISOString();
}

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
  timezone: IanaTimezoneSchema.optional(),
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
  userId: z.string().optional(),
  platform: SupportedPlatformSchema.default("instagram"),
  handle: z.string().min(1, "Handle is required"),
  timezone: IanaTimezoneSchema.default("UTC"),
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
  scheduledAt: z.string().datetime({ offset: true }),
  serviceId: z.string(),
  serviceName: z.string(),
  target: z.string().optional(),
  quantity: z.number().int(),
  chargeShare: z.number(),
});
export type PackageRunPreview = z.infer<typeof PackageRunPreviewSchema>;

export const PackageQuoteResponseSchema = z.object({
  valid: z.boolean(),
  timezone: IanaTimezoneSchema,
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
  disclaimer: z.string().default("Maximum total; unused balance is automatically refunded to your wallet upon package completion or cancellation."),
  quoteHash: z.string().optional(),
  expiresAt: z.string().optional(),
});
export type PackageQuoteResponse = z.infer<typeof PackageQuoteResponseSchema>;

export const PackagePurchaseInputSchema = PackageQuoteInputSchema.extend({
  idempotencyKey: z.string().optional(),
  quoteHash: z.string().min(1, "quoteHash is required to purchase a package."),
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

export const RescheduleExecutionInputSchema = z.object({
  executeAt: z.string().datetime({ offset: true, message: "executeAt must be an ISO-8601 timestamp with an offset" }),
});
export type RescheduleExecutionInput = z.infer<typeof RescheduleExecutionInputSchema>;

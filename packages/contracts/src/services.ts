import { z } from "zod";

export const ServicePlatformSchema = z.enum([
  "ALL",
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "X_TWITTER",
  "TELEGRAM",
  "FACEBOOK",
  "SPOTIFY",
  "LINKEDIN",
  "TWITCH",
]);
export type ServicePlatform = z.infer<typeof ServicePlatformSchema>;

export const ServiceTypeSchema = z.enum([
  "FOLLOWERS",
  "LIKES",
  "VIEWS",
  "COMMENTS",
  "SHARES",
  "SUBSCRIBERS",
  "WATCH_HOURS",
  "CUSTOM",
]);
export type ServiceType = z.infer<typeof ServiceTypeSchema>;

export const ServiceStatusSchema = z.enum(["ACTIVE", "DISABLED", "MAINTENANCE"]);
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

export const ServiceLinkTypeSchema = z.enum(["PROFILE", "POST_OR_REEL", "CHANNEL", "CUSTOM"]);
export type ServiceLinkType = z.infer<typeof ServiceLinkTypeSchema>;

export const ServiceItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string().optional(),
  categoryId: z.string(),
  categoryName: z.string(),
  platform: ServicePlatformSchema,
  ratePer1000: z.number(),
  minQty: z.number().int().positive(),
  maxQty: z.number().int().positive(),
  description: z.string(),
  refillable: z.boolean(),
  cancellable: z.boolean(),
  dripFeedSupported: z.boolean().optional(),
  dripFeedMinRuns: z.number().int().positive().nullable().optional(),
  dripFeedMaxRuns: z.number().int().positive().nullable().optional(),
  dripFeedMinInterval: z.number().int().positive().nullable().optional(),
  dripFeedMaxInterval: z.number().int().positive().nullable().optional(),
  serviceType: z.string().optional(),
  linkType: ServiceLinkTypeSchema.optional(),
  avgStartTime: z.string().optional(),
  avgProcessingSpeed: z.string().optional(),
  status: ServiceStatusSchema,
  badge: z.string().optional(),
  providerCostPer1k: z.number().optional(),
  costINR: z.number().optional(),
  marginPercent: z.number().optional(),
  priceBelowCost: z.boolean().optional(),
  packageEligible: z.boolean().default(false).optional(),
  allowManagedDrip: z.boolean().optional(),
  providerId: z.string().nullable().optional(),
  providerServiceId: z.string().nullable().optional(),
  providerName: z.string().optional(),
  routingMode: z.enum(["MANUAL", "AUTO_FAILOVER"]).optional(),
  backupProviderId: z.string().nullable().optional(),
  backupProviderServiceId: z.string().nullable().optional(),
  backupProviderName: z.string().optional(),
  rawMeta: z.record(z.any()).optional(),
});
export type ServiceItem = z.infer<typeof ServiceItemSchema>;

export const CategoryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  platform: ServicePlatformSchema,
  sortOrder: z.number(),
  serviceCount: z.number().optional(),
});
export type CategoryItem = z.infer<typeof CategoryItemSchema>;

/**
 * Strips emojis, decorative symbols, bracket spam, and repeated spaces from raw service names.
 * Keeps meaningful bracketed tags (e.g. [30 days refill], [Instant], [Non Drop]).
 */
export function cleanServiceName(rawName: string): { displayName: string; tags: string[] } {
  if (!rawName) return { displayName: "", tags: [] };

  const tags: string[] = [];
  
  // Extract meaningful tags inside brackets: [30 days refill], [HQ], [Non-Drop], etc.
  const tagRegex = /\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(rawName)) !== null) {
    const content = match[1].trim();
    // Ignore empty or purely punctuation brackets
    if (content.length > 0 && !/^[\s\-_*~]+$/.test(content)) {
      tags.push(content);
    }
  }

  // Strip emojis (Unicode Extended Pictographic and common emoji ranges)
  let cleaned = rawName.replace(/\p{Extended_Pictographic}/gu, " ");
  
  // Strip decorative symbols (stars, lightning, shapes, bullets) using unicode range escapes
  cleaned = cleaned.replace(/[\u2600-\u26FF\u2700-\u27BF\u2B50\u2022\u25BA\u25BC\u25B6\u25C0\u25AA\u25AB\u2728\u25C6\u25A0|~`]/g, " ");

  // Strip empty brackets [] or brackets containing only punctuation/junk
  cleaned = cleaned.replace(/\[\s*\]/g, " ");

  // Collapse consecutive whitespaces and trim
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return { displayName: cleaned || rawName, tags };
}

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

export const ServiceItemSchema = z.object({
  id: z.string(),
  name: z.string(),
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
  avgStartTime: z.string().optional(),
  avgProcessingSpeed: z.string().optional(),
  status: ServiceStatusSchema,
  badge: z.string().optional(),
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

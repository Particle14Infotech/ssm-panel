import { z } from "zod";

export const FavoriteItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  serviceId: z.string(),
  customName: z.string().nullable().optional(),
  targetUrl: z.string(),
  defaultQuantity: z.number().int().positive(),
  isDripFeed: z.boolean().default(false),
  dripRuns: z.number().int().positive().nullable().optional(),
  dripInterval: z.number().int().positive().nullable().optional(),
  comments: z.string().nullable().optional(),
  config: z.record(z.any()).nullable().optional(),
  configHash: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  service: z
    .object({
      id: z.string(),
      name: z.string(),
      displayName: z.string().nullable().optional(),
      platform: z.string(),
      ratePer1000: z.number(),
      minQty: z.number(),
      maxQty: z.number(),
      status: z.string(),
      dripFeedSupported: z.boolean().optional(),
      allowManagedDrip: z.boolean().optional(),
    })
    .optional(),
});
export type FavoriteItem = z.infer<typeof FavoriteItemSchema>;

export const CreateFavoriteInputSchema = z.object({
  serviceId: z.string().min(1, "Service ID is required"),
  customName: z.string().max(100).optional(),
  targetUrl: z.string().min(1, "Target URL or username is required"),
  defaultQuantity: z.number().int().positive("Quantity must be positive"),
  isDripFeed: z.boolean().optional(),
  dripRuns: z.number().int().positive().optional(),
  dripInterval: z.number().int().positive().optional(),
  comments: z.string().optional(),
  config: z.record(z.any()).optional(),
  configHash: z.string().optional(),
});
export type CreateFavoriteInput = z.infer<typeof CreateFavoriteInputSchema>;

export const FavoriteSuggestionSchema = z.object({
  serviceId: z.string(),
  serviceName: z.string(),
  platform: z.string(),
  targetUrl: z.string(),
  orderCount: z.number(),
  avgQuantity: z.number(),
  lastOrderedAt: z.string(),
  ratePer1000: z.number().optional(),
});
export type FavoriteSuggestion = z.infer<typeof FavoriteSuggestionSchema>;

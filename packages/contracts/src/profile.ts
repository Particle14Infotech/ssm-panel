import { z } from "zod";

export const UserProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),
  balance: z.number().default(0),
  currency: z.string().default("INR"),
  tier: z.enum(["STARTER", "GROWTH", "PRO_SCALE", "ENTERPRISE"]).default("STARTER"),
  apiKey: z.string().optional(),
  webhookUrl: z.string().optional(),
  twoFactorEnabled: z.boolean().default(false),
  ipWhitelist: z.array(z.string()).default([]),
  notificationPreferences: z.object({
    orderUpdates: z.boolean().default(true),
    marketingAlerts: z.boolean().default(false),
    securityAlerts: z.boolean().default(true),
    lowBalanceAlert: z.boolean().default(true),
    balanceThreshold: z.number().default(500),
  }),
  totalSpent: z.number().default(0),
  totalOrders: z.number().default(0),
  createdAt: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UpdateProfileInputSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),
  webhookUrl: z.string().url().or(z.literal("")).optional(),
  ipWhitelist: z.array(z.string()).optional(),
  notificationPreferences: z
    .object({
      orderUpdates: z.boolean().optional(),
      marketingAlerts: z.boolean().optional(),
      securityAlerts: z.boolean().optional(),
      lowBalanceAlert: z.boolean().optional(),
      balanceThreshold: z.number().optional(),
    })
    .optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

export const ChangePasswordInputSchema = z
  .object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof ChangePasswordInputSchema>;

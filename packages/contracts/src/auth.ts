import { z } from "zod";

export const UserRoleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "RESELLER", "CUSTOMER"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStatusSchema = z.enum(["ACTIVE", "DISABLED"]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const LoginInputSchema = z.object({
  usernameOrEmail: z.string().min(3, "Username or email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  twoFactorCode: z.string().optional(),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const RegisterInputSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string(),
  termsAccepted: z.boolean().refine((val) => val === true, "You must accept the terms"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
export type RegisterInput = z.infer<typeof RegisterInputSchema>;

export const ForgotPasswordInputSchema = z.object({
  email: z.string().email("Invalid email address"),
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordInputSchema>;

export const ResetPasswordInputSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordInputSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  email: z.string().email(),
  role: UserRoleSchema,
  status: UserStatusSchema,
  balance: z.string(),
  twoFactorEnabled: z.boolean(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

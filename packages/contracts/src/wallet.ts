import { z } from "zod";

export const TransactionTypeSchema = z.enum([
  "DEPOSIT",
  "ORDER_DEBIT",
  "REFUND",
  "ADMIN_ADJUST",
  "BONUS",
  "COUPON",
]);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TransactionItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  amount: z.number(),
  bonus: z.number().default(0),
  method: z.string(),
  status: z.enum(["SUCCESS", "PENDING", "FAILED"]),
  referenceId: z.string(),
  createdAt: z.string(),
});
export type TransactionItem = z.infer<typeof TransactionItemSchema>;

export const WalletTransactionSchema = z.object({
  id: z.string(),
  type: TransactionTypeSchema,
  amount: z.number(),
  balanceAfter: z.number(),
  note: z.string().optional(),
  createdAt: z.string(),
  referenceId: z.string().optional(),
});
export type WalletTransaction = z.infer<typeof WalletTransactionSchema>;

export const DepositInputSchema = z.object({
  gateway: z.enum(["STRIPE", "CRYPTO", "PAYPAL", "MANUAL", "UPI", "RAZORPAY"]),
  amount: z.number().min(100, "Minimum deposit is ₹100").max(500000, "Maximum deposit is ₹500,000"),
  couponCode: z.string().optional(),
});
export type DepositInput = z.infer<typeof DepositInputSchema>;

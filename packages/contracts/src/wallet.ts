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
  gateway: z.enum(["STRIPE", "CRYPTO", "PAYPAL", "MANUAL"]),
  amount: z.number().min(5, "Minimum deposit is $5").max(10000, "Maximum deposit is $10,000"),
  couponCode: z.string().optional(),
});
export type DepositInput = z.infer<typeof DepositInputSchema>;

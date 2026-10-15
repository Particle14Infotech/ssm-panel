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

export const PaymentMethodSchema = z.enum(["UPI", "CARD", "NETBANKING"]);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export interface PaymentGatewaySession {
  sessionId: string;
  referenceId: string;
  redirectUrl: string;
  amount: number;
  bonusAmount: number;
  totalCredit: number;
  method: PaymentMethod;
  status: "SUCCESS" | "PENDING" | "FAILED";
}

export interface PaymentGateway {
  createDepositSession(input: {
    userId: string;
    amount: number;
    method: PaymentMethod;
    couponCode?: string;
    idempotencyKey?: string;
  }): Promise<PaymentGatewaySession>;
  verifyDepositSession(referenceId: string): Promise<PaymentGatewaySession>;
}

export interface BonusRule {
  id: string;
  minAmount: number;
  bonusPercent: number;
  active: boolean;
}

export const DEFAULT_BONUS_RULES: BonusRule[] = [
  { id: "tier-1", minAmount: 1000, bonusPercent: 10, active: true },
  { id: "tier-2", minAmount: 500, bonusPercent: 5, active: true },
];

export function calculateDepositBonus(
  amount: number,
  rules: BonusRule[] = DEFAULT_BONUS_RULES
): { bonusPercent: number; bonusAmount: number; totalCredit: number } {
  if (amount <= 0) return { bonusPercent: 0, bonusAmount: 0, totalCredit: 0 };
  
  // Find highest applicable active rule
  const matchedRule = rules
    .filter((r) => r.active && amount >= r.minAmount)
    .sort((a, b) => b.minAmount - a.minAmount)[0];

  const bonusPercent = matchedRule ? matchedRule.bonusPercent : 0;
  const bonusAmount = Math.round((amount * bonusPercent) / 100 * 100) / 100;
  const totalCredit = Math.round((amount + bonusAmount) * 100) / 100;

  return { bonusPercent, bonusAmount, totalCredit };
}

export const TransactionItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  amount: z.number(),
  bonus: z.number().default(0),
  method: PaymentMethodSchema,
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
  method: PaymentMethodSchema,
  amount: z.number().min(100, "Minimum deposit is ₹100").max(500000, "Maximum deposit is ₹500,000"),
  couponCode: z.string().optional(),
  idempotencyKey: z.string().optional(),
});
export type DepositInput = z.infer<typeof DepositInputSchema>;

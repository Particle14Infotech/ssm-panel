# 🧠 Feature Brain: 02 - Wallet, Ledger & Payments

## 1. Quick Summary
Core financial balance engine. Handles double-entry ledger logic: user wallet balance, bonus tiers, payment gateway webhook deposits, deductions on order placement, and automatic refunds for canceled/partial orders.

## 2. Key Files
- **Contracts / Schema:** `packages/contracts/src/wallet.ts`
  - `WalletBalanceResponseSchema` (`balance`, `currency: 'INR'`, `tier`)
  - `DepositRequestSchema` (`amount`, `method`)
  - `TransactionSchema` (`type: 'DEPOSIT' | 'ORDER_CHARGE' | 'REFUND' | 'BONUS'`, `amount`, `status`)
- **API Controller/Service:** `apps/api/src/modules/wallet/`
  - `wallet.controller.ts`
- **Web UI Screens:**
  - `apps/web/app/(customer)/app/wallet/page.tsx`
  - `apps/web/app/(customer)/app/transactions/page.tsx`

## 3. Business Rules & Financial Guarantees (ADR-001)
> ⚠️ **MANDATORY RULE (Stage 2 LLD):**
> Paise ke har lock aur unique guarantee ko ya to DB constraint (`CHECK balance >= 0`, `UNIQUE idempotencyKey`) mein rakha jayega ya `$queryRaw` row lock (`FOR UPDATE`) mein, aur iska integration test **real Postgres container** par run hoga.
> Complete ADR: [ADR-001-stage2-lld-money-locks.md](file:///d:/projects/internship%20projects/SMM/docs/brain/ADR-001-stage2-lld-money-locks.md)

- **Deposit Bonus Rules:**
  - $\ge ₹1,000 \implies +10\%$ Extra credit
  - $\ge ₹500 \implies +5\%$ Extra credit
  - $< ₹500 \implies 0\%$ Extra credit
- **Precision:** All monetary calculations must use exact fixed decimals (`decimal.js` or `DECIMAL(12, 2)` in SQL).
- **Atomic Double-Entry:** No balance decrement without a recorded `Transaction` entry.

## 4. Target Database Schema
```prisma
model Wallet {
  id        String   @id @default(uuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id])
  balance   Decimal  @default(0.00) @db.Decimal(12, 2)
  currency  String   @default("INR")
  updatedAt DateTime @updatedAt
  txns      Transaction[]
}

model Transaction {
  id          String   @id @default(uuid())
  walletId    String
  wallet      Wallet   @relation(fields: [walletId], references: [id])
  type        TxnType  // DEPOSIT, ORDER_CHARGE, REFUND, BONUS
  amount      Decimal  @db.Decimal(12, 2)
  bonusAmount Decimal  @default(0.00) @db.Decimal(12, 2)
  referenceId String?
  orderId     String?
  status      TxnStatus // PENDING, SUCCESS, FAILED
  createdAt   DateTime @default(now())
}
```

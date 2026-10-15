# 📐 Architecture Decision Record (ADR-001): Stage 2 LLD - Money Locks, DB Constraints & Real Postgres Integration Tests

- **Status:** ACCEPTED
- **Date:** 2026-10-11
- **Scope:** Financial Transactions, Wallet Balances, Ledger Invariants, Prisma Schema, Postgres Database Constraints
- **Affected Packages:** `apps/api`, `packages/contracts`, `apps/worker`, `infra`

---

## 1. Context & Problem Statement

SMM platform mein paise ke transactions (deposits, order charges, automated refunds for partial/canceled orders, bonus credits) system ka sabse critical core hain.

Agar concurrency handling sirf application-level in-memory logic par chhod di jaye:
1. Race conditions ho sakti hain (double debit ya double refund).
2. Negative balance exploit ho sakta hai (agar do orders simultaneous aate hain).
3. ORM abstraction layer (jaise standard Prisma `update`) kabhi-kabhi row locks (`SELECT ... FOR UPDATE`) ko guarantee nahi karta.

---

## 2. Decision: The Money Invariant Rule

> **MANDATORY ARCHITECTURAL RULE:**
> 1. **Prisma ORM** ko primary data access engine ke roop mein use kiya jayega.
> 2. **Money Row Locks & Raw Queries:** Paise ke kisi bhi lock, deduction ya credit ke liye ya to **strict DB constraints** (`CHECK`, `UNIQUE`, foreign keys) use honge, ya phir **Prisma `$queryRaw`** ke through raw SQL row-level locks (`SELECT ... FOR UPDATE`) aur atomic updates (`UPDATE "Wallet" SET balance = balance - $1 WHERE id = $2 AND balance >= $1`) use honge.
> 3. **Real Postgres Integration Tests:** Har financial flow aur invariant ka integration test mock memory par nahi, balki **Real PostgreSQL container instance** (`postgres:16-alpine`) par chalaya jayega.

---

## 3. Concrete Database Constraints & Guarantees

### A. Non-Negative Wallet Balance Constraint (`CHECK balance >= 0`)
Database level par constraint ensure karega ki chahe code mein koi bhi bug ho, wallet ka balance kabhi zero se niche nahi ja sakta:
```sql
ALTER TABLE "Wallet" ADD CONSTRAINT "check_wallet_balance_non_negative" CHECK (balance >= 0.00);
```

### B. Atomic Row-Locking & Mutation Protocol (`$queryRaw`)
Application level par balance deduct karte waqt concurrency safe pattern:

```typescript
// Example: Safe Atomic Order Deduction inside prisma.$transaction
await prisma.$transaction(async (tx) => {
  // 1. Pessimistic Row Lock with FOR UPDATE
  const [lockedWallet] = await tx.$queryRaw<Array<{ id: string; balance: number }>>`
    SELECT id, balance 
    FROM "Wallet" 
    WHERE "userId" = ${userId}::uuid 
    FOR UPDATE
  `;

  if (!lockedWallet || Number(lockedWallet.balance) < requiredCharge) {
    throw new InsufficientFundsException("Insufficient wallet balance");
  }

  // 2. Atomic Deduct with WHERE condition
  const rowsAffected = await tx.$executeRaw`
    UPDATE "Wallet" 
    SET balance = balance - ${requiredCharge}::decimal, "updatedAt" = NOW() 
    WHERE id = ${lockedWallet.id}::uuid AND balance >= ${requiredCharge}::decimal
  `;

  if (rowsAffected === 0) {
    throw new ConcurrentModificationException("Balance updated concurrently");
  }

  // 3. Append Double-Entry Transaction Ledger Entry
  await tx.transaction.create({
    data: {
      walletId: lockedWallet.id,
      type: "ORDER_CHARGE",
      amount: -requiredCharge,
      orderId: order.id,
      status: "SUCCESS"
    }
  });
});
```

### C. Unique Idempotency Key Constraint
Har external deposit webhook ya payment callback ke paas ek database-level unique constraint hoga:
```prisma
model Transaction {
  id              String    @id @default(uuid())
  idempotencyKey  String?   @unique
  referenceId     String?   @unique
  ...
}
```

---

## 4. Integration Testing Mandate on Real Postgres

- **Environment:** Test suite seedha `.env.test` mein defined Postgres connection (`DATABASE_URL=postgresql://smm_user:smm_password@localhost:5432/smm_db?schema=public`) par chalegi.
- **Race Condition Verification Test:**
  - 10 simultaneous parallel order placement requests bhejkar check kiya jayega ki ek bhi duplicate deduction ya negative balance na ho.
- **Strict Invariant Checks:**
  - $\sum(\text{Wallet.balance}) = \sum(\text{Transactions.amount})$ (Double-entry balance check).

---

## 5. Consequences

- **Pros:**
  - High concurrency mein bhi 100% financial integrity.
  - Zero possibility of negative wallet exploit.
  - Fail-fast at database engine level.
- **Trade-offs:**
  - Raw SQL (`$queryRaw` / `$executeRaw`) transactions mein likhna padega rather than pure generic Prisma helper methods.
  - Integration tests require a running Postgres container.

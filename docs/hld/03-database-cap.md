# 🗄️ HLD 03: Database Architecture & CAP Theorem Guarantees

**Status:** IMPLEMENTED  
**Date:** 2026-10-12  

---

## 1. CAP Theorem Decision: PostgreSQL as CP System

> **ARCHITECTURAL DECISION:**  
> **PostgreSQL is the single source of truth** and is strictly operated as a **CP system** (Consistency over Availability).  
> Financial balances, double-entry ledgers, and order lifecycles must never be stale, guessed, or double-spent. If PostgreSQL primary is unreachable, the system intentionally rejects writes with HTTP 503 rather than permitting inconsistent financial state.
> 
> **Redis is strictly NOT a source of truth.** It is an ephemeral acceleration cache and queuing buffer.

---

## 2. Comprehensive System Failure-Behaviour Matrix

| Failure Mode | Direct System Impact | Expected Resilient Behavior | Safety Guarantee | Status |
| :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL Primary Down** | All write mutations & balance reads fail | API fails cleanly with `503 Service Unavailable`. Zero partial writes, no balance guessing. | Invariant preserved: Money state never corrupted. | **Implemented** |
| **Redis Cache / Queue Down** | Ephemeral cache & queues unavailable | API continues serving database reads. Rate limiting falls back to in-memory. Order placement writes to PostgreSQL `Outbox` table. | Zero lost orders; relayed as soon as Redis recovers. | **Implemented** |
| **Upstream Provider Down / 5xx** | Provider orders fail or timeout | Exponential backoff (max 3 retries). Circuit breaker trips open. Automatic failover to backup provider or refund on exhaustion. | Single-refund guarantee enforced by state machine. | **Implemented** |
| **Worker Process Down** | Queue jobs unconsumed | New orders remain in `PENDING` state in the database. When worker restarts, queues drain sequentially. | State machine blocks illegal transitions. | **Implemented** |

---

## 3. Strict Money & Invariant Rules

1. **Pessimistic Row Locking (`SELECT ... FOR UPDATE`)**:
   - Any balance modification or deduction must acquire a row lock on `"Wallet"` inside a single database transaction.
2. **Atomic Verification**:
   - `UPDATE "Wallet" SET balance = balance - $1 WHERE id = $2 AND balance >= $1`
3. **Double-Entry Ledger Tracking**:
   - For every debit or credit, a matching `"LedgerEntry"` row is inserted in the exact same transaction:
   $$\text{Wallet.balance} = \sum(\text{LedgerEntry.amount})$$
4. **CHECK Constraints at the Engine Level**:
   - `ALTER TABLE "Wallet" ADD CONSTRAINT "check_balance_non_negative" CHECK (balance >= 0.00);`
5. **Read Replicas (if enabled)**:
   - Read replicas are strictly restricted to heavy analytics, admin exports, and reporting. Read replicas are **never used for balance checks or order placements**.

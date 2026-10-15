# Architecture Decision Record (ADR) 003: Financial Money Representation & Ledger Invariants

- **Status:** Accepted
- **Date:** 2026-10-13
- **Author:** Principal Backend Engineer
- **Deciders:** Backend Engineering Team, Core Architecture

---

## 1. Context

SMM Panels handle financial transactions (deposits, order charges, partial refunds, admin adjustments) with high concurrency. In high-frequency order placement, floating-point math (IEEE 754) introduces precision degradation and rounding accumulation errors (e.g., `0.1 + 0.2 === 0.30000000000000004`). In addition, payment gateways like Razorpay operate exclusively in integer smallest currency units (paise for INR).

---

## 2. Decision

The platform adopts a unified, immutable money model across database storage, business logic arithmetic, and payment gateway boundaries:

### A. Database Storage (PostgreSQL & Prisma)
- **Wallet Balance & Ledger Entries:** Represented as `Decimal(12, 2)` in PostgreSQL (`Wallet.balance`, `LedgerEntry.amount`).
- **Service Rates & Order Charges:** Represented as `Decimal(10, 2)` (`Service.ratePer1000`, `Order.charge`).
- **Currency:** Strictly Indian Rupees (`INR`), with paise fractions (2 decimal places).

### B. Business Logic Arithmetic
- **Strict Decimal Arithmetic:** All price, charge, and refund calculations use `decimal.js`. Native JavaScript `Number` floats are strictly forbidden for pricing computations.
- **Rounding Mode:** `ROUND_HALF_UP` (`Decimal.ROUND_HALF_UP`) to 2 decimal places:
  - **Order Charge:** $\text{charge} = \text{round\_half\_up}\left(\frac{\text{quantity} \times \text{ratePer1000}}{1000}\right)$
  - **Partial Refund:** $\text{refund} = \text{round\_half\_up}\left(\frac{\text{charge} \times \text{remains}}{\text{quantity}}\right)$

### C. Payment Gateway & Smallest Currency Unit (Paise)
- External gateway adapters (Razorpay, webhook signatures) communicate financial values in **integer paise** ($1\text{ INR} = 100\text{ paise}$).
- Explicit conversion utility functions are enforced:
  - `toPaise(rupees: number | string | Decimal): number`
  - `fromPaise(paise: number): Decimal`

### D. Ledger & Concurrency Invariants
1. **Pessimistic Row-Level Locking:** All balance mutations execute inside interactive transactions using `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`.
2. **Immutable Double-Entry Ledger:** Every balance modification creates a corresponding `LedgerEntry` (negative for charges, positive for deposits and refunds).
3. **Single Refund Per Order:** Guaranteed at the database constraint level via compound unique index `@@unique([orderId, type], name: "unique_refund_per_order")`.
4. **Conservation of Balance:** For every wallet:
   $$\text{balance} == \sum \text{LedgerEntry.amount}$$

---

## 3. Consequences

- **Positive:** Absolute protection against floating-point drift, zero double-refund risks, complete audit trail for financial disputes.
- **Negative:** Requires explicit `Decimal` construction in application logic; raw SQL queries must cast appropriately.

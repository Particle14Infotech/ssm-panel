# ⚙️ LLD 03: Functionality, Sequence Flows & Invariants

**Status:** IMPLEMENTED  
**Date:** 2026-10-12  

---

## 1. Flow Sequence Diagrams & Business Rules

### A. Place Order Flow
```mermaid
sequenceDiagram
    participant Customer
    participant API as Orders Controller / Service
    participant DB as PostgreSQL
    participant Outbox as OutboxEvent

    Customer->>API: POST /api/v1/orders/create + Idempotency-Key
    API->>API: Validate target URL, min/max limits, active status
    API->>API: Calculate charge: ceil(ratePer1000 * quantity / 1000)
    API->>DB: BEGIN TRANSACTION
    API->>DB: Check unique (userId, idempotencyKey)
    API->>DB: SELECT balance FROM "Wallet" FOR UPDATE
    API->>DB: Assert balance >= charge (else abort with 400 Insufficient Funds)
    API->>DB: UPDATE "Wallet" SET balance = balance - charge
    API->>DB: INSERT INTO "LedgerEntry" (ORDER_CHARGE)
    API->>DB: INSERT INTO "Order" (status: PENDING)
    API->>Outbox: INSERT INTO "OutboxEvent" (ORDER_CREATED)
    API->>DB: COMMIT TRANSACTION
    API-->>Customer: 201 Created (Order Object)
```

**Business Rules:**
1. Server-side price calculation is authoritative: $\text{charge} = \lceil\frac{\text{ratePer1000} \times \text{quantity}}{1000}\rceil$.
2. Wallet row lock (`FOR UPDATE`) guarantees no concurrent race conditions can cause a negative balance.
3. Order creation, ledger debit, and outbox event write happen in **exactly one atomic transaction**.
4. Duplicate `Idempotency-Key` returns existing order without creating a duplicate charge.

---

### B. Outbox Relay -> BullMQ -> Provider Worker Engine
```mermaid
sequenceDiagram
    participant Outbox as Outbox Table
    participant Relay as Relay Daemon
    participant Redis as BullMQ ('order-submit')
    participant Worker as SMM Worker Engine
    participant Provider as External Provider API

    Outbox->>Relay: Poll pending events (status: PENDING, availableAt <= NOW())
    Relay->>Redis: Enqueue job to 'order-submit'
    Relay->>Outbox: Mark OutboxEvent status = PUBLISHED
    Redis->>Worker: Consume job
    Worker->>Provider: POST /api/v2 { action: 'add', service, link, quantity }
    alt Provider Success
        Provider-->>Worker: { order: 98124 }
        Worker->>Worker: Transition Order to PROCESSING
    else Provider Timeout / 5xx
        Worker->>Worker: Exponential backoff with jitter (Retries 1..3)
        alt Retries Exhausted
            Worker->>Worker: Trip Circuit Breaker & Open Incident
            Worker->>Worker: Calculate Partial/Full Refund: round_half_up(charge * remains / quantity)
            Worker->>Worker: Append ONE REFUND entry to Ledger & Transition to REFUNDED
        end
    end
```

---

## 2. Order State Machine Transition Matrix

| Current State (`from`) | Permitted Next States (`to`) | Terminal? | Notes |
| :--- | :--- | :--- | :--- |
| **`PENDING`** | `PROCESSING`, `CANCELLED`, `FAILED` | No | Initial state after placement |
| **`PROCESSING`** | `IN_PROGRESS`, `COMPLETED`, `PARTIAL`, `CANCELLED`, `FAILED` | No | Acknowledged by worker / provider |
| **`IN_PROGRESS`** | `COMPLETED`, `PARTIAL`, `CANCELLED` | No | Active delivery |
| **`PARTIAL`** | `REFUNDED` | No | Triggers automated partial refund |
| **`CANCELLED`** | `REFUNDED` | No | Triggers automated full refund |
| **`FAILED`** | `REFUNDED` | No | Triggers automated full refund |
| **`COMPLETED`** | *None* | **YES** | Terminal success state |
| **`REFUNDED`** | *None* | **YES** | Terminal refund state |

Every illegal transition throws an authoritative `Illegal Order Status Transition` error and is exhaustively covered by `e2e/state-machine.spec.ts`.

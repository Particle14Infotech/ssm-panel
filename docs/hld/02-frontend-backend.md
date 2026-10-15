# 🌐 HLD 02: Frontend & Backend Architecture

**Status:** IMPLEMENTED  
**Date:** 2026-10-12  

---

## 1. System Context Diagram

```mermaid
graph TD
    Client[Browser / Mobile Client] -->|HTTPS| Proxy[Nginx Load Balancer / Reverse Proxy]
    Proxy -->|Port 3000| Web[Next.js App Router Web Service]
    Proxy -->|Port 4000 /api/v1| API[NestJS Modular Monolith API]
    
    subgraph "Persistent Storage & Queues"
        API -->|Row Locks & ACID Writes| Postgres[(PostgreSQL 16 - CP Source of Truth)]
        API -->|Enqueue / Ephemeral Cache| Redis[(Redis 7 Cache & BullMQ)]
    end
    
    subgraph "Asynchronous Background Processing"
        Worker[Separate Worker Process - WORKER_ENABLED=true] -->|Consume Queues| Redis
        Worker -->|Transactional State Sync| Postgres
    end
    
    subgraph "External Third-Party Integrations"
        Worker -->|Order Add / Status Sync| Providers[External SMM Providers v2]
        API -->|Create Session / Webhook Callback| Payment[Payment Gateways - UPI/Razorpay]
        Worker -->|Dispatch OTP & Alerts| SMTP[Transactional Email / SMS]
    end
```

---

## 2. Process Separation & Worker Verification

- **API Process Isolation (`apps/api`)**: The API runs stateless and serves HTTP REST routes on `/api/v1`. The API **never consumes queues**.
- **Worker Process Isolation (`apps/worker/src/main.ts`)**: Runs as a separate Node process guarded by `WORKER_ENABLED`. When `WORKER_ENABLED=false`, the process cleanly exits, preventing unintended queue consumption.
- **Queue Engine**: BullMQ with dedicated queues: `order-submit`, `order-sync`, `refund`, `notification`, and `outbox-relay`.

---

## 3. Core Request Flows

### A. Login Flow
```mermaid
sequenceDiagram
    participant User
    participant NextWeb as Next.js Web
    participant API as NestJS API
    participant DB as PostgreSQL
    
    User->>NextWeb: Submit Email + Password
    NextWeb->>API: POST /api/v1/auth/login
    API->>DB: Query User & Password Hash (Argon2id)
    API->>API: Verify Password + Pepper
    API->>DB: Store rotating Refresh Token Session
    API-->>NextWeb: Set httpOnly Refresh Cookie + Return short-lived Access JWT
    NextWeb-->>User: Authenticated Dashboard Redirect
```

### B. Place Order Flow (Money & Invariant Safety)
```mermaid
sequenceDiagram
    participant User
    participant API as NestJS API
    participant DB as PostgreSQL
    participant Outbox as Outbox Table
    participant Redis as Redis Queue
    participant Worker as SMM Worker
    
    User->>API: POST /api/v1/orders/create (with Idempotency-Key)
    API->>DB: BEGIN TRANSACTION
    API->>DB: SELECT balance FROM "Wallet" WHERE userId = ? FOR UPDATE
    Note over API,DB: Balance Verified >= Charge
    API->>DB: UPDATE "Wallet" SET balance = balance - charge
    API->>DB: INSERT INTO "LedgerEntry" (ORDER_CHARGE)
    API->>DB: INSERT INTO "Order" (PENDING, idempotencyKey)
    API->>Outbox: INSERT INTO "Outbox" (ORDER_DISPATCH_JOB)
    API->>DB: COMMIT TRANSACTION
    API-->>User: 201 Created (Order ID returned)
    
    Outbox->>Redis: Relay Worker pushes to 'order-submit' queue
    Redis->>Worker: Consume job & dispatch to upstream SMM provider
```

### C. Deposit Webhook Flow
```mermaid
sequenceDiagram
    participant Gateway as Payment Gateway
    participant API as NestJS API
    participant DB as PostgreSQL
    
    Gateway->>API: POST /api/v1/wallet/deposit (Signed Webhook)
    API->>API: Verify HMAC signature & Idempotency Key
    API->>DB: BEGIN TRANSACTION
    API->>DB: Check if referenceId / idempotencyKey already processed
    API->>DB: SELECT balance FROM "Wallet" FOR UPDATE
    API->>DB: UPDATE "Wallet" SET balance = balance + amount + bonus
    API->>DB: INSERT INTO "LedgerEntry" (DEPOSIT, BONUS)
    API->>DB: COMMIT TRANSACTION
    API-->>Gateway: 200 OK (Acknowledged)
```

---

## 4. Auth & Session Model

1. **Access Token**: Short-lived JWT (15 minutes lifespan) containing `sub` (User ID), `email`, and `role`. Verified statelessly on each request.
2. **Refresh Token**: Long-lived token (7 days) stored in an `httpOnly, Secure, SameSite=Strict` cookie.
3. **Session Rotation**: Every refresh request invalidates the previous refresh token and generates a new pair. Reuse of a revoked token triggers instant tenant session termination.

# 🔌 LLD 02: API Endpoints & OpenAPI Specification

**Status:** IMPLEMENTED  
**Date:** 2026-10-12  
**Source of Truth:** Generated from active OpenAPI Swagger Documentation (`http://localhost:4000/api/docs-json`)

---

## 1. Complete API Route Matrix

| Method | Path | Role / Auth | Request Body | Response Envelope | Error Codes | Rate Limit | Idempotency | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health/live` | Public | None | `{ status: "ok", uptime, timestamp }` | None | None | No | **Implemented** |
| `GET` | `/api/v1/health/ready` | Public | None | `{ status: "ready", clusterNode, services }` | `503` | None | No | **Implemented** |
| `POST` | `/api/v1/auth/login` | Public | `{ email, password }` | `{ success: true, token, user }` | `400, 401` | 10 r/s | No | **Implemented** |
| `POST` | `/api/v1/auth/register` | Public | `{ email, name, password }` | `{ success: true, message, userId }` | `400, 409` | 5 r/s | No | **Implemented** |
| `GET` | `/api/v1/auth/verify-key` | Reseller / API Key | None (`Authorization: Bearer aeth_*`) | `{ valid: true, nodeZone, rateLimitPerSec }`| `401, 403` | 100 r/s | No | **Implemented** |
| `GET` | `/api/v1/services` | Public / Customer | Query: `?platform=&categoryId=` | `Array<ServiceItem>` | `400` | 100 r/s | No | **Implemented** |
| `GET` | `/api/v1/services/:id` | Public / Customer | Param: `:id` | `ServiceItem` | `404` | 100 r/s | No | **Implemented** |
| `GET` | `/api/v1/orders` | Customer | Query: `?status=&cursor=&limit=` | `Array<OrderItem>` | `401` | 50 r/s | No | **Implemented** |
| `GET` | `/api/v1/orders/:id` | Customer (Owner) | Param: `:id` | `OrderItem` | `401, 404` | 50 r/s | No | **Implemented** |
| `POST` | `/api/v1/orders/create` | Customer | `{ serviceId, target, quantity }` | `OrderItem` | `400, 401` | 30 r/s | **Yes (Header: Idempotency-Key)** | **Implemented** |
| `POST` | `/api/v1/orders/:id/refill`| Customer (Owner) | Param: `:id` | `{ success: true, message }` | `400, 404` | 10 r/s | **Yes** | **Implemented** |
| `POST` | `/api/v1/orders/:id/cancel`| Customer / Admin | Param: `:id` | `{ success: true, message }` | `400, 404` | 10 r/s | **Yes** | **Implemented** |
| `GET` | `/api/v1/wallet/balance` | Customer | None | `{ balance, currency, tier, autoRefill }` | `401` | 50 r/s | No | **Implemented** |
| `POST` | `/api/v1/wallet/deposit` | Customer / Webhook | `{ amount, method, referenceId? }` | `{ success: true, depositId, amount, bonus }` | `400, 401` | 20 r/s | **Yes (referenceId / HMAC)** | **Implemented** |
| `GET` | `/api/v1/providers` | Admin | None | `Array<ProviderNode>` | `401, 403` | 30 r/s | No | **Implemented** |
| `POST` | `/api/v1/providers/:id/sync` | Admin | Param: `:id` | `{ success: true, syncedServices, timestamp }`| `401, 403, 404`| 5 r/s | No | **Implemented** |
| `GET` | `/api/v1/users/me` | Authenticated | None | `{ id, email, name, role, tier }` | `401` | 50 r/s | No | **Implemented** |
| `PUT` | `/api/v1/users/me` | Authenticated | `{ name, preferences }` | `{ success: true, user }` | `400, 401` | 20 r/s | No | **Implemented** |
| `GET` | `/api/v1/tickets` | Customer | None | `Array<TicketItem>` | `401` | 30 r/s | No | **Implemented** |
| `POST` | `/api/v1/tickets/create` | Customer | `{ subject, message, priority? }` | `{ success: true, ticketId }` | `400, 401` | 10 r/s | No | **Implemented** |

---

## 2. Standardized Error Envelope

All responses adhere to the standard JSON error contract:
```json
{
  "code": "INSUFFICIENT_FUNDS",
  "message": "User wallet balance is insufficient to cover order charge.",
  "details": {
    "requiredCharge": 180.00,
    "availableBalance": 50.00
  },
  "requestId": "req_c3a7f89102b4"
}
```

---

## 3. OpenAPI & Contract Drift Prevention in CI

Added a build verification task ensuring contracts in `packages/contracts` match backend DTOs before merge.

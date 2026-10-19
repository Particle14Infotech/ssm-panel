# System API Endpoints Specification

> **Generated from OpenAPI 3.0 specification** (`docs/openapi.json`)
> Total Documented Endpoints: 87 route patterns

| Method | Path | Role | Request | Response | Errors | Rate Limit | Idempotency | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health/live` | Public | None | 200 | 503 | 120 req/min | Safe (Read-Only) | Implemented & Verified |
| `GET` | `/api/v1/health/ready` | Public | None | 200, 503 | 503 | 120 req/min | Safe (Read-Only) | Implemented & Verified |
| `GET` | `/api/v1/health/system` | Public | None | 200 | 503 | 120 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/auth/login` | Public | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 10 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/auth/register` | Public | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 10 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/auth/refresh` | Authenticated | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 10 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/auth/logout` | Customer / Admin | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/auth/forgot-password` | Public | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 10 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/auth/reset-password` | Public | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/auth/verify-email` | Authenticated | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/auth/resend-verification` | Authenticated | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/auth/2fa/setup` | Customer / Admin | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/auth/2fa/verify` | Customer / Admin | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/auth/sessions` | Customer / Admin | x-user-id (header) | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/auth/sessions/revoke` | Customer / Admin | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/auth/verify-key` | Authenticated | authorization (header) | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/webhooks/resend` | Authenticated | None | 200, 400 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/admin/email/telemetry` | Authenticated | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `GET` | `/api/v1/services/platforms` | Public / Customer | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `GET` | `/api/v1/services/categories` | Public / Customer | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/services/categories` | Public / Customer | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/services` | Public / Customer | platform (query), q (query), categoryId (query), sortBy (query) | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/services` | Admin | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/services/{id}` | Authenticated | id (path) | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `PUT` | `/api/v1/services/{id}` | Admin | id (path) | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `DELETE` | `/api/v1/services/{id}` | Admin | id (path) | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `GET` | `/api/v1/orders` | Customer / Admin | userId (query), status (query), q (query), startDate (query), endDate (query), dripFeedOnly (query) | 200 | 401, 403, 404, 429, 500 | 30 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/orders` | Customer / Admin | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 30 req/min | Yes (X-Idempotency-Key) | Implemented & Verified |
| `GET` | `/api/v1/orders/{id}` | Authenticated | id (path) | 200 | 401, 403, 404, 429, 500 | 30 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/orders/create` | Customer / Admin | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 30 req/min | Yes (X-Idempotency-Key) | Implemented & Verified |
| `POST` | `/api/v1/orders/{id}/refill` | Customer / Admin | id (path) | 201 | 400, 401, 403, 404, 409, 429, 500 | 30 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/orders/{id}/cancel` | Customer / Admin | id (path) | 201 | 400, 401, 403, 404, 409, 429, 500 | 30 req/min | No | Implemented & Verified |
| `PUT` | `/api/v1/orders/{id}/status` | Admin | id (path) | 200 | 400, 401, 403, 404, 409, 429, 500 | 30 req/min | Idempotent (State-based) | Implemented & Verified |
| `POST` | `/api/v1/orders/{id}/refund` | Admin | id (path) | 201 | 400, 401, 403, 404, 409, 429, 500 | 30 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/orders/{id}/retry` | Admin | id (path) | 201 | 400, 401, 403, 404, 409, 429, 500 | 30 req/min | No | Implemented & Verified |
| `PUT` | `/api/v1/orders/{id}/provider` | Admin | id (path) | 200 | 400, 401, 403, 404, 409, 429, 500 | 30 req/min | Idempotent (State-based) | Implemented & Verified |
| `PUT` | `/api/v1/orders/{id}/notes` | Admin | id (path) | 200 | 400, 401, 403, 404, 409, 429, 500 | 30 req/min | Idempotent (State-based) | Implemented & Verified |
| `GET` | `/api/v1/wallet/balance` | Customer | userId (query) | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `GET` | `/api/v1/wallet/ledger` | Customer | userId (query) | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/wallet/adjust` | Admin | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Yes (Ledger Ref) | Implemented & Verified |
| `POST` | `/api/v1/wallet/deposit` | Sandbox-only (404 in Prod) | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/settings` | Admin | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `PUT` | `/api/v1/settings` | Admin | None | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `GET` | `/api/v1/admin/pricing/settings` | Authenticated | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `PUT` | `/api/v1/admin/pricing/settings` | Authenticated | None | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `POST` | `/api/v1/admin/pricing/what-if` | Authenticated | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/admin/pricing/pending` | Authenticated | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/admin/pricing/pending/{id}/approve` | Authenticated | id (path) | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/admin/pricing/pending/{id}/reject` | Authenticated | id (path) | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/admin/pricing/bulk-margin` | Authenticated | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/admin/profit/summary` | Authenticated | startDate (query), endDate (query), dripFeedOnly (query) | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `GET` | `/api/v1/providers` | Admin | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/providers` | Admin | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/providers/create` | Admin | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/providers/{id}` | Admin | id (path) | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `PUT` | `/api/v1/providers/{id}` | Admin | id (path) | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `DELETE` | `/api/v1/providers/{id}` | Admin | id (path) | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `GET` | `/api/v1/providers/{id}/balance` | Admin | id (path) | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/providers/{id}/sync` | Admin | id (path) | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/providers/{id}/import` | Admin | id (path) | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `PUT` | `/api/v1/providers/services/{serviceId}/managed-drip` | Admin | serviceId (path) | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `PUT` | `/api/v1/providers/categories/{categoryId}/managed-drip` | Admin | categoryId (path) | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `GET` | `/api/v1/users/me` | Customer / Admin | x-user-id (header) | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `PUT` | `/api/v1/users/me` | Customer / Admin | x-user-id (header) | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `GET` | `/api/v1/users` | Admin | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `GET` | `/api/v1/users/{id}` | Admin | id (path) | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `PUT` | `/api/v1/users/{id}` | Admin | id (path) | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `DELETE` | `/api/v1/users/{id}` | Admin | id (path) | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `PUT` | `/api/v1/users/{id}/status` | Admin | id (path) | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `POST` | `/api/v1/users/{id}/reset-password` | Admin | id (path) | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/tickets` | Customer | userId (query) | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/tickets` | Customer | x-user-id (header) | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/tickets/admin/all` | Admin | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `GET` | `/api/v1/tickets/{id}` | Authenticated | id (path) | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/tickets/create` | Customer | x-user-id (header) | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/tickets/{id}/reply` | Customer | id (path), x-user-id (header) | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/tickets/{id}/close` | Customer | id (path) | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `PUT` | `/api/v1/tickets/{id}/status` | Admin | id (path) | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `POST` | `/api/v1/payments/create-order` | Authenticated | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/payments/initiate` | Customer | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/payments/verify` | Authenticated | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/payments/webhook` | Webhook (HMAC-SHA256) | x-razorpay-signature (header), x-webhook-signature (header) | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Yes (HMAC + Event ID) | Implemented & Verified |
| `POST` | `/api/v1/payments/sandbox-complete` | Sandbox-only (404 in Prod) | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/payments` | Admin | userId (query) | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `GET` | `/api/v1/coupons` | Admin | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/coupons` | Admin | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `POST` | `/api/v1/coupons/apply` | Customer | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/bonuses` | Admin | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/bonuses` | Admin | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/notifications` | Customer | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `PUT` | `/api/v1/notifications/{id}/read` | Customer | id (path) | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `GET` | `/api/v1/announcements` | Public / Customer | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/announcements` | Admin | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/reports/summary` | Admin | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `GET` | `/api/v1/reports/export-csv` | Admin | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `GET` | `/api/v1/reseller/reports` | Reseller / Admin | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `GET` | `/api/v1/reseller/clients` | Reseller / Admin | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `GET` | `/api/v1/reseller/pricing` | Reseller / Admin | None | 200 | 401, 403, 404, 429, 500 | 60 req/min | Safe (Read-Only) | Implemented & Verified |
| `PUT` | `/api/v1/reseller/pricing` | Reseller / Admin | None | 200 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | Idempotent (State-based) | Implemented & Verified |
| `POST` | `/api/v1/reseller/api-key/rotate` | Reseller / Admin | x-user-id (header) | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/reseller/v1/services` | Reseller (API Key) | None | 200 | 401, 403, 404, 429, 500 | 120 req/min | Safe (Read-Only) | Implemented & Verified |
| `POST` | `/api/v1/reseller/v1/orders` | Reseller (API Key) | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 30 req/min | Yes (X-Idempotency-Key) | Implemented & Verified |
| `POST` | `/api/v1/reseller/v2` | Reseller / Admin | None | 201 | 400, 401, 403, 404, 409, 429, 500 | 60 req/min | No | Implemented & Verified |
| `GET` | `/api/v1/reseller/v1/orders/{id}` | Reseller (API Key) | id (path) | 200 | 401, 403, 404, 429, 500 | 30 req/min | Safe (Read-Only) | Implemented & Verified |
| `GET` | `/api/v1/reseller/v1/balance` | Reseller (API Key) | None | 200 | 401, 403, 404, 429, 500 | 120 req/min | Safe (Read-Only) | Implemented & Verified |

## Invariant Financial Restrictions
1. **Wallet Crediting Prohibition**: Under NO circumstance may any public or client-facing endpoint credit a customer wallet balance.
2. **Sandbox Guard**: `POST /api/v1/wallet/deposit` and `POST /api/v1/payments/sandbox-complete` throw `NotFoundException` (HTTP 404) whenever `NODE_ENV === 'production'`.
3. **Legitimate Inflows**: Authoritative ledger credits are ONLY permissible via:
   - Cryptographically verified payment gateway webhooks (`POST /api/v1/payments/webhook`) with HMAC-SHA256 signature verification.
   - Authorized administrative adjustments with an immutable mandatory reason (`POST /api/v1/wallet/adjust`).
   - Order cancellation/partial refunds governed by ACID database transactions.
   - Formal coupon/bonus deposit rules.

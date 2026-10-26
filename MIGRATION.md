# Strangler Migration: NestJS (`@smm/api`) to Fastify (`@smm/server`)

**Status:** Active Gradual Strangler Migration  
**Branch:** `chore/fastify-migration`  
**Current Default:** 100% NestJS backend (`/api/v1/*`)  

---

## 1. Architecture Overview

To transition backend services from NestJS to Fastify safely without downtime, we employ a **Strangler Fig pattern**.

- The frontend (`apps/web`) acts as the proxy routing layer through Next.js rewrites (`apps/web/next.config.js`).
- **Default for every route is NestJS**.
- Routing to `@smm/server` is strictly opt-in per-route or per-prefix via the `FASTIFY_ROUTE_PREFIXES` environment variable.
- Shared Prisma schema, shared PostgreSQL database, and shared Redis cache. No schema migrations or data changes occur during migration.
- Fastify shares the same JWT secrets (`JWT_ACCESS_SECRET` / `JWT_SECRET`), claims structure, request ID propagation (`X-Request-Id`), rate limiting tiers, and error response envelopes (`{ code, message, details, requestId, timestamp, path }`).

---

## 2. Ported Modules (Verified with Passing Contract Diff Tests)

All ported modules have contract diff tests running directly against NestJS and Fastify instances asserting identical status codes, headers, and JSON body payloads.

| Module | Endpoints | Status | Contract Test File |
| :--- | :--- | :--- | :--- |
| **Health** | `GET /health`<br>`GET /api/v1/health/live`<br>`GET /api/v1/health/ready`<br>`GET /api/v1/health/system` | ✅ Complete | `test/health.contract.test.ts`<br>`test/health.test.ts` |
| **Catalog** | `GET /api/v1/catalog/grouped` | ✅ Complete | `test/services.contract.test.ts` |
| **Services** | `GET /api/v1/services/platforms`<br>`GET /api/v1/services/categories`<br>`GET /api/v1/services/grouped`<br>`POST /api/v1/services/categories` (Admin)<br>`GET /api/v1/services`<br>`GET /api/v1/services/:id`<br>`POST /api/v1/services` (Admin)<br>`PUT /api/v1/services/:id` (Admin)<br>`DELETE /api/v1/services/:id` (Admin) | ✅ Complete | `test/services.contract.test.ts` |
| **Platforms** | `GET /api/v1/platforms`<br>`GET /api/v1/platforms/:platform`<br>`GET /api/v1/admin/platforms`<br>`GET /api/v1/admin/platforms/blocklist`<br>`POST /api/v1/admin/platforms/blocklist`<br>`DELETE /api/v1/admin/platforms/blocklist/:id`<br>`GET /api/v1/admin/platforms/:id`<br>`POST /api/v1/admin/platforms`<br>`PUT /api/v1/admin/platforms/:id` | ✅ Complete | `test/platforms.contract.test.ts` |
| **User Profile (Read)** | `GET /api/v1/users/me` | ✅ Complete | `test/users.contract.test.ts` |
| **Admin Read-Only** | `GET /api/v1/users`<br>`GET /api/v1/users/:id`<br>`GET /api/v1/settings`<br>`PUT /api/v1/settings` | ✅ Complete | `test/users.contract.test.ts` |
| **Notifications** | `GET /api/v1/notifications`<br>`PUT /api/v1/notifications/:id/read` | ✅ Complete | `test/notifications.contract.test.ts` |

---

## 3. What Remains on NestJS

The following critical domains remain untouched on NestJS (`@smm/api`) and BullMQ worker (`@smm/worker`):

1. **Auth & Sessions:** `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`
2. **Orders & Execution:** `POST /api/v1/orders`, `POST /api/v1/orders/create`, `GET /api/v1/orders`, `GET /api/v1/orders/:id`, `POST /api/v1/orders/:id/refill`, `POST /api/v1/orders/:id/cancel`
3. **Packages Engine:** `POST /api/v1/packages/quote`, `POST /api/v1/packages`, `GET /api/v1/packages`, background execution scheduler
4. **Wallet, Ledger & Payments:** `GET /api/v1/wallet/balance`, `POST /api/v1/wallet/deposit`, `POST /api/v1/payments/razorpay/webhook`, internal double-entry ledgers
5. **Provider Integrations:** Provider sync, balance check, dispatch, auto-failover, Reseller API
6. **Support Tickets & Favorites:** `POST /api/v1/tickets`, `GET /api/v1/favorites`
7. **BullMQ Background Workers:** Outbox event processor, drip feed runner, order status polling

---

## 4. Migration Order for Remaining Modules (Money Flows Last)

To strictly prevent risk to financial transactions, data isolation, and order delivery, remaining modules will be migrated in the following sequence:

```
[Phase 4A: Non-Financial User Features]
  ├── Support Tickets (/api/v1/tickets)
  └── Favorites (/api/v1/favorites)
        ↓
[Phase 4B: Authentication & Identity]
  ├── Password Hashing (Argon2id)
  └── Auth Token Issuance & Refresh Rotation (/api/v1/auth/*)
        ↓
[Phase 4C: Provider Sync & Reseller API]
  ├── Provider Catalog Ingestion (/api/v1/providers)
  └── Reseller v2 Order Ingress (/api/v1/reseller/*)
        ↓
[Phase 4D: Order Lifecycle & Queue Dispatch]
  ├── Canonical Order Placement (/api/v1/orders)
  └── Refill & Cancel Requests
        ↓
[Phase 4E: Package Campaign Engine]
  ├── Honest Quote & Guardrails Engine
  └── Scheduled Run Dispatcher
        ↓
[Phase 4F: Money Flows & Webhooks - FINAL STEP]
  ├── Wallet Balance & Transaction History
  ├── Double-Entry Ledger Posting
  └── Razorpay Payment Webhooks (HMAC-SHA256 signature validation)
```

---

## 5. Rollback & Failover Procedures

The routing layer requires **no code rebuilds or redeployments** to rollback.

### Instant Rollback to NestJS
To instantly route all traffic back to NestJS:
1. In environment variables, set:
   ```env
   FASTIFY_ROUTE_PREFIXES=
   ```
   (or unset `INTERNAL_FASTIFY_URL`).
2. Restart the web server / proxy.
3. 100% of traffic immediately routes to NestJS `/api/v1/*`.

### Selective Per-Prefix Routing
To enable Fastify for verified modules only:
```env
# Point web proxy to Fastify service
INTERNAL_FASTIFY_URL=http://server:4100

# Enable only verified stable prefixes
FASTIFY_ROUTE_PREFIXES=health,catalog,services,platforms,notifications
```

---

## 6. Environment Flags

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `INTERNAL_FASTIFY_URL` | Fastify backend URL accessible by web proxy | `http://server:4100` (Docker) or `http://127.0.0.1:4100` (Local) |
| `FASTIFY_ROUTE_PREFIXES` | Comma-separated list of prefixes routed to Fastify | Blank (default = all NestJS) |
| `PORT` | Listening port for `@smm/server` | `4100` |
| `JWT_ACCESS_SECRET` | Primary secret for JWT signature verification | Shared with NestJS |
| `JWT_SECRET` | Fallback secret for JWT signature verification | Shared with NestJS |
| `DATABASE_URL` | PostgreSQL connection string | Shared with NestJS |
| `REDIS_URL` | Redis connection URL | Shared with NestJS |
| `DISABLE_RATE_LIMITER` | Disables rate limiter for contract tests | `false` |

---

## 7. Verification Proof

### Test Execution
Run test suites across `@smm/server`:
```bash
pnpm --filter @smm/server test
```
**Results:**
- `test/health.test.ts` (Fastify standalone health checks)
- `test/health.contract.test.ts` (Fastify vs NestJS live/ready/system contract diff)
- `test/services.contract.test.ts` (Fastify vs NestJS services & catalog contract diff)
- `test/platforms.contract.test.ts` (Fastify vs NestJS public & admin platform rules contract diff)
- `test/users.contract.test.ts` (Fastify vs NestJS profile & admin user inspection contract diff)
- `test/notifications.contract.test.ts` (Fastify vs NestJS notification stream contract diff)

**Total:** 6 test suites, 36 passing contract and unit tests.

### Build & Lint
```bash
pnpm --filter @smm/server lint
pnpm --filter @smm/server build
```
**Status:** 0 lint errors, 0 TypeScript compile errors.

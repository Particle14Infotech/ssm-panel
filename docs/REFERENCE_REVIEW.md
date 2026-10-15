# Reference Repositories Review (B0)

## 1. Repository Inventory & Maintenance Assessment

| # | Repository | License | Last Commit | Tests Present | CI Configured | Maintenance Status | Adoption Decision |
|---|---|---|---|---|---|---|---|
| 1 | `masabinhok/nestjs-jwt-rbac-boilerplate` | MIT | 2025-11-19 | Unit & E2E (Jest) | None | Moderately active, cleanly structured | **Adopt ideas selectively**: HttpOnly cookies, refresh token rotation with family revocation, Pino logging with PII redaction, exception filter envelope |
| 2 | `jeiel2013/NestForge` | None (Unlicensed) | 2026-09-24 (Active) | Basic Jest | None | Active scaffolding tool, but lacks explicit OSS license | **Read-only inspiration**: High-level config and folder concepts only. Do not copy code. |
| 3 | `robyajo/bns` | None (Unlicensed) | 2026-05-25 | Unit & E2E (Jest) | None | Semi-active, NestJS + Prisma setup | **Read-only inspiration**: Prisma and Redis config concepts. |
| 4 | `SenhorRG/eShopOnContainers-NestJS` | MIT | 2026-07-02 | Unit, Smoke, E2E, Integration | Comprehensive GitHub Actions (3 workflows) | Active, educational architecture repo | **Adopt outbox concepts**: Outbox table status lifecycle (`PENDING` -> `PROCESSING` -> `PUBLISHED`), retry attempts, backoff, and idempotency tracking. Reject RabbitMQ (we use BullMQ + Redis). |
| 5 | `FabriquetaDeSoftware/saas-and-ecommerce-boilerplate-nestjs` | MIT | 2026-10-03 (Active) | Unit & E2E | None (tests known failing in upstream) | Active boilerplate | **Adopt Nginx & Redis concepts**: Reverse proxy headers, cache-aside fallback, BullMQ separation. |
| 6 | `notiz-dev/nestjs-prisma-starter` | MIT | 2023-11-17 (3 yrs ago) | Unit & E2E | GitHub Actions | Unmaintained / Stale | **Folder layout reference only**: Stale GraphQL repo; reject architectural patterns. |

---

## 2. Cross-Area Architecture & Gap Analysis

| Area | Reference Approach (File / Repo) | Our Approach (`apps/api`, `apps/worker`, `prisma`) | Gap (Yes/No) | Risk | Decision & Implementation Plan |
|---|---|---|---|---|---|
| **Project Structure & Boundaries** | `NestForge` / `nestjs-jwt-rbac-boilerplate` modular monolith: `src/modules/*`, `src/common/*`, `src/config/*` | `apps/api/src/modules/*`, `apps/api/src/common/*`, standalone `apps/worker` | **No** | Low | Retain existing clean modular monolith layout. Keep `apps/worker` strictly separated as the sole queue/outbox consumer. |
| **Config & Env Validation** | `nestjs-jwt-rbac-boilerplate/src/config` using class-validator / Joi | `apps/api` uses `dotenv`, raw `process.env` in several places | **Yes** | Low | Implement fail-fast Zod-validated environment config schema (`apps/api/src/config/env.schema.ts`). Refuse boot on missing/default secrets in production. |
| **Auth & Sessions** | `nestjs-jwt-rbac-boilerplate/src/modules/auth`: HttpOnly cookies, JWT access + refresh token in DB, session revocation | `apps/api/src/modules/auth/auth.service.ts`: JWT in memory/bearer, simple session table | **Yes** | Medium | Upgrade to strict refresh token rotation with reuse detection (family invalidation), HttpOnly/Secure/SameSite cookies, CSRF protection on cookie-based state mutations, and Argon2id hashing. |
| **RBAC & Authorization** | `nestjs-jwt-rbac-boilerplate/src/common/guards/roles.guard.ts`: Role decorator + RolesGuard | `apps/api/src/modules/auth`: Basic role checks in service methods | **Yes** | Low | Introduce `@Roles()` decorator, `RolesGuard`, and deny-by-default route guards with strict resource ownership verification. |
| **DTO Validation** | `nestjs-jwt-rbac-boilerplate`: `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` | `apps/api/src/main.ts`: Basic ValidationPipe enabled | **No** | Low | Existing ValidationPipe is configured; strengthen payload size limits and parameter parsing. |
| **Exception Filters & Response Envelope** | `nestjs-jwt-rbac-boilerplate/src/common/filters/http-exception.filter.ts`: Uniform `{ statusCode, message, error, timestamp, path }` | `apps/api`: NestJS default unhandled exception format | **Yes** | Low | Implement `GlobalExceptionFilter` producing exact envelope: `{ code, message, details, requestId, timestamp }`. |
| **Logging & Request IDs** | `nestjs-jwt-rbac-boilerplate`: Pino logger middleware with basic redaction | `apps/api`: Standard console.log / Nest Logger | **Yes** | Low | Integrate `pino-http` with automatic `x-request-id` generation/propagation and strict PII/secret redaction (`password`, `token`, `secret`, `apiKey`). |
| **DB Transactions & Concurrency** | Standard Prisma client calls across all repos | `apps/api/src/modules/orders/orders.service.ts` & `apps/api/src/modules/wallet/wallet.service.ts` use `prisma.$executeRawUnsafe` with `SELECT ... FOR UPDATE` | **No** | Zero | **REJECT reference approaches**: Retain our money design (`SELECT ... FOR UPDATE`, double-entry integer paise/Decimal, strict ledger balance matching, idempotency keys). |
| **Prisma Pooling & Sizing** | `bns`: basic PrismaService | `apps/api/src/common/prisma.service.ts`: basic instantiation without connection limit configs | **Yes** | Low | Document and configure Prisma pool limits (`connection_limit = 10`), distinguish Neon/PgBouncer pooled connection strings from direct migration strings. |
| **Queues & Jobs** | `FabriquetaDeSoftware`: BullMQ in main web process | `apps/worker/src/main.ts`: Standalone worker process with BullMQ | **Yes** | Low | Retain strict rule: only `worker.ts` consumes queues. Integrate BullMQ with `noeviction` Redis verification on startup. Add Dead-Letter Queue (DLQ) and admin retry. |
| **Outbox Relay & Concurrency** | `eShopOnContainers-NestJS`: Outbox table polled with retry count and status enum | `apps/worker/src/main.ts`: In-memory polling without `SKIP LOCKED` | **Yes** | Medium | Upgrade outbox relay in worker: use `SELECT ... FOR UPDATE SKIP LOCKED` batching with exponential backoff and max attempts. |
| **Caching** | `FabriquetaDeSoftware`: Redis cache module | `apps/api/src/common/cache.service.ts`: Basic Redis cache | **Yes** | Low | Add cache-aside with explicit invalidation for service catalog, settings, and dashboard metrics, with resilient fallback when Redis is unreachable. |
| **Rate Limiting** | `nestjs-jwt-rbac-boilerplate`: `@nestjs/throttler` in-memory | `apps/api`: None configured | **Yes** | Low | Implement multi-tiered rate limiting backed by Redis (auth tier, public tier, reseller API key tier). |
| **Health & Graceful Shutdown** | `nestjs-jwt-rbac-boilerplate/src/modules/health`: Terminus health check | `apps/api/src/modules/health`: Basic controller without `enableShutdownHooks` | **Yes** | Low | Add `enableShutdownHooks()`, drain in-flight requests, terminate BullMQ workers cleanly, and implement `/health/live` and `/health/ready` (checking PostgreSQL and Redis). |
| **API Docs & Versioning** | `nestjs-jwt-rbac-boilerplate`: Global `/api/v1` prefix and Swagger setup | `apps/api/src/main.ts`: `/api/v1` and Swagger enabled | **No** | Low | Strengthen OpenAPI documentation with automated contract drift checking against `packages/contracts`. |
| **Security Headers & CORS** | `nestjs-jwt-rbac-boilerplate`: Helmet and CORS | `apps/api/src/main.ts`: Helmet and CORS active | **No** | Low | Ensure strict Content Security Policy (CSP) and origin whitelisting. |

---

## 3. Reference Conflicts with Our Core Money Rules (REJECTED)

The following practices observed in reference repositories conflict with our production SMM financial design and are **strictly rejected**:
1. **Application-level balance increment without locks**: Reference repos perform `user.update({ data: { balance: { increment: amount } } })` which is prone to race conditions. We **strictly maintain** `SELECT ... FOR UPDATE` inside Prisma raw transactions on `Wallet`.
2. **Float / Number balance storage**: Reference models use generic JavaScript numbers/floats. We **strictly enforce** `Decimal(12, 2)` / integer paise with exact ledger reconciliation (`sum(ledger) == wallet.balance`).
3. **Queue consumption inside the API process**: Reference repos instantiate BullMQ / RabbitMQ workers inside NestJS HTTP controllers. We **strictly enforce** that queue consumers run solely inside `apps/worker`.
4. **Direct refunds without DB constraints**: Reference repos lack database-level uniqueness on refunds. We **strictly enforce** `@@unique([orderId, type], name: "unique_refund_per_order")` and prevent multiple refunds for any single order.

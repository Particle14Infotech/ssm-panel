# Production Infrastructure & Live Facts Audit (R0.a)

**Audit Date:** 2026-10-29  
**Source Commit:** a52981b  
**Branch:** chore/fastify-migration  
**Scope:** Live system topology, orchestration, runtime configuration, and constraints.

---

## 1. Verified Architecture & Deployment Topology

| Component | Verified Deployment Method | Runtime Specification & Port Mapping | Instances / Concurrency |
| :--- | :--- | :--- | :--- |
| **Frontend (`smm_web`)** | Docker Container (`infra/Dockerfile.web`) via `docker-compose.prod.yml` | Next.js 15 Standalone Node runtime on `0.0.0.0:3000->3000/tcp` | 1 container instance |
| **Backend API (`smm_api`)** | Docker Container (`infra/Dockerfile.api`) via `docker-compose.prod.yml` | NestJS / Fastify runtime on `0.0.0.0:4000->4000/tcp` | 1 container instance (Docker) *(PM2 config specifies 2 cluster instances on local/bare-metal)* |
| **Worker Daemon (`smm_worker`)** | Docker Container (`infra/Dockerfile.worker`) via `docker-compose.prod.yml` | Node.js BullMQ & Polling Engine (`apps/worker/src/main.ts`) | 1 singleton worker container |
| **Database (`smm_postgres`)** | Docker Container (`postgres:16-alpine`) | PostgreSQL 16 on `127.0.0.1:5432`, volume `postgres_data` | Single primary database node |
| **Cache & Queue (`smm_redis`)** | Docker Container (`redis:7-alpine`) | Redis 7 on `127.0.0.1:6379`, `--appendonly yes --maxmemory-policy noeviction`, volume `redis_data` | Single Redis node |
| **Reverse Proxy** | Host Nginx (`infra/nginx/smm.conf`) | Upstream proxy to port 3000 (web) and 4000 (api), rate-limited (`100r/s` general, `10r/s` auth) | Nginx system service |
| **Telemetry & Mail** | Docker (`smm_otel`, `smm_mailhog`) | OpenTelemetry collector (`4318`), Mailhog test SMTP (`1025`, `8025`) | Development / staging telemetry |

---

## 2. Process Orchestration & Build Process
- **Monorepo Manager:** `pnpm@9.15.9` + `turbo@2.4.4`.
- **Node Runtime:** Node v22.
- **Build Pipeline:**
  1. Contracts build: `pnpm --filter @smm/contracts build` (compiles TypeScript interfaces, validation schemas, and timing math).
  2. Prisma client generation: `prisma generate` (schema at `prisma/schema.prisma`).
  3. App build: `pnpm --filter @smm/web build` / `pnpm --filter @smm/api build`.
- **Packaging:** Multi-stage Docker build producing self-contained runner containers.

---

## 3. Database Connection Pool Budget Math
Derived from `infra/pm2/ecosystem.config.js` and PostgreSQL 16 default configuration:
- `max_connections`: 100
- `superuser_reserved_connections`: 5
- Application Maximum Budget: 95
- `smm_api` connection limit: 20 per instance (pool size = 20)
- `smm_worker` connection limit: 10 (pool size = 10)
- Total Active Pool: 30 connections (or 50 if 2 API cluster workers run).
- Safety Headroom: $\ge 45$ connections reserved for migrations, `pg_dump`, and maintenance.

---

## 4. Security & Environment Configuration
- **Env Storage:** Host `/root/ssm-panel/.env` loaded into Docker Compose.
- **Secrets:** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `PASSWORD_PEPPER`, `PROVIDER_KEY_SECRET`, `QUOTE_SECRET`, `ENCRYPTION_KEY`.
- **Providers:** Upstream SMM Provider API keys stored encrypted in `Provider.apiKeyEncrypted` using AES-256-GCM via `PROVIDER_KEY_SECRET`.

---

## 5. Numbered Question List for User / Production Operator

1. **Automated VPS Database Backup Schedule:** Is there an existing cron job running `pg_dump` on the VPS to offsite/remote storage, or are backups currently triggered on demand?
2. **Nginx Domain Binding & SSL:** Is Nginx terminating SSL with Let's Encrypt certbot for a live public domain (e.g., `smm-panel.com`) or currently bound to the raw VPS IP / local hosts?
3. **Staging Environment Access:** Do we have a staging copy database instance on the VPS (or local isolated PostgreSQL) to run migration timing benchmarks as required by Rule L4?


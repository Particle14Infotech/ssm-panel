# 🏗️ HLD 01: Technology Architecture

**Status:** IMPLEMENTED  
**Date:** 2026-10-12  

---

## 1. System Technology Matrix

| Layer | Technology Selected | Version | Repo Location | Status | Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Runtime** | Node.js | `v22.20.0` | Global | **Implemented** | Long-term support, native ESM, high-throughput V8 event loop. |
| **Package Manager**| pnpm | `12.10.1` | Root (`package.json`) | **Implemented** | Deterministic lockfile, content-addressable store, workspace linking. |
| **Monorepo Engine** | Turborepo | `2.11.7` | Root (`turbo.json`) | **Implemented** | High-speed pipeline orchestrator with workspace caching. |
| **Web Frontend** | Next.js App Router | `14.2.35` | `apps/web` | **Implemented** | Hybrid SSR/SSG, route groups `(auth)`, `(customer)`, `admin`. |
| **UI Design System**| Tailwind + shadcn/ui | `3.4.19` | `packages/config`, `apps/web` | **Implemented** | Consistent design tokens, dark futuristic palette, responsive layout. |
| **API Backend** | NestJS | `10.4.15` | `apps/api` | **Implemented** | Modular monolith, clean separation of concerns, OpenAPI docs. |
| **Contracts** | TypeScript + Zod | `5.9.3` / `3.25.76`| `packages/contracts` | **Implemented** | End-to-end type safety, runtime schema validation. |
| **Primary Database**| PostgreSQL | `16.x` | Primary Source of Truth | **Implemented** | ACID transactions, row-level pessimistic locks, financial ledger integrity. |
| **Cache & Queues** | Redis + BullMQ | `7.x` / `5.81.5` | `apps/worker`, `apps/api` | **Implemented** | High-throughput async job distribution and ephemeral cache-aside. |
| **Process Manager**| PM2 / Nginx | Native | `infra/pm2`, `infra/nginx` | **Implemented** | Native process clustering and reverse proxy without Docker. |

---

## 2. ADR Summaries

See comprehensive architecture decision records in:
- [ADR-001: Stage 2 LLD - Money Locks & Invariants](file:///d:/projects/internship%20projects/SMM/docs/brain/ADR-001-stage2-lld-money-locks.md)
- [ADR-002: Technology Stack & Hosting Architecture](file:///d:/projects/internship%20projects/SMM/docs/adr/ADR-002-technology-stack.md)

---

## 3. Production Hosting Architecture (Zero Docker)

Docker is **strictly not used** in production or development environments. The system relies on:
1. **Frontend App (`@smm/web`)**: Hosted as Node SSR processes on PaaS/VPS behind Nginx reverse proxy.
2. **API Monolith (`@smm/api`)**: Multi-instance cluster mode managed by PM2 on port 4000 (and clustered workers).
3. **Async Worker Engine (`@smm/worker`)**: Single dedicated daemon instance managed by PM2 (`WORKER_ENABLED=true`).
4. **Managed PostgreSQL**: Dedicated managed PostgreSQL 16 cluster with connection pooling (PgBouncer).
5. **Managed Redis**: High-availability Managed Redis cluster for BullMQ queues and cache.

# 📐 ADR-002: Technology Stack & Hosting Architecture (No Docker)

- **Status:** ACCEPTED
- **Date:** 2026-10-12
- **Scope:** Full-Stack Architecture, Monorepo Tools, Database, Messaging, Hosting Model

---

## 1. Context & Decisions

1. **Frontend: Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui**
   - High-performance SSR, streaming edge rendering, Route Groups `(auth)`, `(customer)`, `admin`, modern component primitives with accessible interactive design.
2. **Backend: NestJS 10 Modular Monolith + REST + OpenAPI**
   - Enterprise architectural boundaries, strict dependency injection, class validation pipes, clean Swagger contracts, zero microservice network latency for core business workflows.
3. **Database: PostgreSQL 16 (CP System, Strict Invariants)**
   - Authoritative source of truth for all wallet balances, ledger entries, and order lifecycles. Strictly relies on pessimistic row locking (`SELECT ... FOR UPDATE`), transactional rollbacks, and DB constraints.
4. **Cache & Queue: Redis 7 + BullMQ**
   - High-throughput ephemeral cache-aside layer and async job queue. Redis is strictly not a source of truth; persistent outbox pattern guarantees delivery.
5. **Security & Identity: Argon2id + Rotating Refresh Sessions + RBAC**
   - Industry-standard password hashing, stateless short-lived access JWTs + rotating `httpOnly` refresh tokens, and granular permission sets.
6. **Hosting Model: Bare Metal / PaaS / Dedicated VPS (Zero Docker)**
   - Production instances run as native Node processes managed by PM2 cluster mode behind an Nginx reverse proxy, coupled with Managed PostgreSQL (AWS RDS / Supabase / DigitalOcean) and Managed Redis (Upstash / Redis Cloud).

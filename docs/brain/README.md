# 🧠 SMM Project Brain: Index & Architecture Quick-Map

Yeh brain repository ka centralized knowledge index hai taaki tokens waste kiye bina directly kisi bhi feature ke contract, implementation aur flow ko target kiya ja sake.

---

## 🗺️ System Map & Roles

| Service / App | Location | Purpose | Tech Stack | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Contracts** | `packages/contracts/src` | Central TypeScript & Zod schemas for all DTOs | TypeScript, Zod | Stable |
| **Web Frontend** | `apps/web` | Landing page, Customer app, Admin dashboard | Next.js 14 App Router, Three.js, Tailwind | UI Active |
| **API Backend** | `apps/api` | REST API, auth, business logic, endpoints | NestJS 10, Express, Swagger | Stubs / Needs Real DB |
| **Worker Engine**| `apps/worker` | Async queues (order dispatch, sync, refunds) | Node.js, BullMQ, Redis | Scaffolded |
| **Database & Cache**| `infra/docker-compose.yml` | PostgreSQL 16 (Port 5432) & Redis 7 (Port 6379) | Docker, Alpine | Container Ready |

## 📜 Architectural Decisions (ADR)
- [ADR-001: Stage 2 LLD - Money Locks, DB Constraints & Real Postgres Integration Tests](file:///d:/projects/internship%20projects/SMM/docs/brain/ADR-001-stage2-lld-money-locks.md)
  - **Rule:** Paise ke har lock aur unique guarantee ko ya to DB constraint mein rakha jayega ya `$queryRaw` row lock (`FOR UPDATE`) mein, aur integration test real Postgres par chalaya jayega.

---

## 📂 Feature Brain Map

Har feature ke liye detailed brain docs `docs/brain/` mein banaye gaye hain:

1. [Auth & Identity Brain](file:///d:/projects/internship%20projects/SMM/docs/brain/01-auth.md)
   - Scope: Sign in, Sign up, Sessions, RBAC (Customer vs Admin), JWT/Cookies.
2. [Wallet, Ledger & Payments Brain](file:///d:/projects/internship%20projects/SMM/docs/brain/02-wallet-payments.md)
   - Scope: Balance management, deposits, bonus calculations, transactions, refund ledger.
3. [Services & Catalog Brain](file:///d:/projects/internship%20projects/SMM/docs/brain/03-services-catalog.md)
   - Scope: Service categories, pricing per 1k, min/max limits, speed indicators, status.
4. [Orders & Lifecycle Brain](file:///d:/projects/internship%20projects/SMM/docs/brain/04-orders-lifecycle.md)
   - Scope: Order placement, balance verification, queue ingress, status pipeline (Pending -> Processing -> Completed/Partial/Cancelled).
5. [Provider Integrations Brain](file:///d:/projects/internship%20projects/SMM/docs/brain/05-providers.md)
   - Scope: External SMM provider APIs (Standard v2 format), balance polling, dispatch, status synchronization.
6. [Tickets & Support Brain](file:///d:/projects/internship%20projects/SMM/docs/brain/06-tickets-support.md)
   - Scope: Support tickets, messages, order disputes, priority resolution.
7. [Frontend 3D & UI Brain](file:///d:/projects/internship%20projects/SMM/docs/brain/07-ui-3d.md)
   - Scope: CrownStage, CrownModel (crown.glb), materials, shaders, fallbacks.

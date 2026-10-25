# High-Level Design (HLD): Feature Batch 2

## 1. Executive Summary & Architectural Scope
Feature Batch 2 expands the SMM platform across customer catalog navigation, neutral timeline visualization, safe package lifecycle operations (pause, resume, link swap, speed-up), lock-and-verify batch delivery, custom comment sequencing, duration pricing tiers, and geographic delivery windows.

### Strict Scope & Policy Boundary (SRS §50 Compliance)
Per SRS §50 ("Platform Security Bypass and Artificial Engagement Policy"):
- **Excluded Features:** No randomized quantity/interval jitter, no local night-mode sleep wave curves, no "stealth" or "anti-ban" claims, no phone farms, residential proxies, scraping-based post detection, AI-generated comments, ad-network tiers, or YouPI-PG payments.
- **Allowed Neutral Primitives:** Deterministic pacing within min/max bounds and explicit customer-selected delivery windows (e.g. "09:00 to 21:00 IST", default off).

---

## 2. System Architecture Flow

```mermaid
flowchart LR
  subgraph WebClient ["Web (Next.js 14 App Router)"]
    NO["New Order: Category & Service Catalog"]
    PB["Package Builder & Timeline Chart"]
    FV["Favorites Drawer & Prefill"]
  end

  subgraph APIService ["API (NestJS Modular Monolith)"]
    CAT["Catalog Module (/catalog/grouped)"]
    PKG["Package Module (pause, resume, swap, speed-up)"]
    PRC["Pricing & Duration Tiers"]
    CMT["Comment Moderation & Ingestion"]
    WAL["Wallet & Ledger Service"]
    FAV["Favorites Service (config JSON)"]
  end

  subgraph WorkerService ["Worker (Scheduled Tasks & Background Processing)"]
    SCH["Scheduler Tick (1-min loop)"]
    LKV["Lock-and-Verify Engine"]
    RTR["Provider Router & Safe Failover"]
    REC["Nightly Reconciler Job"]
  end

  subgraph Datastores ["Datastores & Infrastructure"]
    PG[("PostgreSQL (Neon)")]
    RD[("Redis / In-Memory Cache")]
    PROV[("Upstream SMM Providers")]
  end

  WebClient -->|HTTPS REST| APIService
  APIService -->|SQL (Prisma)| PG
  APIService -->|Token Buckets & Rate Limits| RD
  WorkerService -->|Row Locking FOR UPDATE| PG
  WorkerService -->|Status Poll & Order Placement| PROV
  REC -->|Invariant Auditing| PG
  REC -->|Fetch Gateway Truth| PROV
```

---

## 3. Core Component Responsibilities

### 3.1 Catalog & Order Builder (`Web` & `apps/api`)
- **Grouped Catalog (`GET /catalog/grouped`):** Single database query aggregating services by active category. Uncategorized services map to `"Other"`. Empty or inactive categories are excluded from response.
- **Delivery Timeline Visualization:** Displays chronological execution milestones directly from `quote.timeline`. No comparative charts against hypothetical "unsafe" delivery curves.
- **Quantity Balance Hint:** Analyzes items in the current package builder (e.g. likes-to-views ratio) and provides non-intrusive advisory recommendations without mutating cart contents or auto-injecting items.
- **Favorites (`GET/POST /favorites`):** Stores generic order/package configuration in `Favorite.config` (JSON) indexed by `configHash`. Enforces IDOR protection (`userId` ownership).

### 3.2 Package State Machine Extensions (`apps/api`)
- **Pause & Resume:** Pauses future scheduled executions (`SCHEDULED` $\rightarrow$ `PAUSED`). On resume, recalculates forward execution schedule, updates `pausedDays`, and enforces maximum pause duration cap.
- **Link Swap:** Permits swapping target URL for post-triggered packages within the same platform up to a hard cap of 2 swaps per package. Enforces unique `mediaKey` per package.
- **Speed-Up:** Adjusts future execution spacing while strictly respecting provider minimum gap (`minGapMinutes`) and platform limits.

### 3.3 Lock-and-Verify Execution (`apps/worker`)
- Dispatches child orders sequentially per media link.
- Before dispatching batch $N+1$, verifies batch $N$ status against provider.
- If batch $N$ is still `PROCESSING` or provider fails to respond within timeout $T$, sets execution state to `STALLED`, pauses the package, and emits an admin alert to prevent duplicate orders or runaway charges.

### 3.4 Nightly Reconciliation Worker (`apps/worker`)
- **Financial Balance:** Compares wallet balance against the sum of ledger transactions (`type IN (CREDIT, DEBIT, REFUND)`).
- **Package Invariant:** Asserts $Q_{\text{purchased}} = Q_{\text{delivered}} + Q_{\text{refunded}} + Q_{\text{remaining}}$ for every active package.
- **Provider Status Drift:** Identifies executions older than threshold in `DISPATCHED` or `UNCERTAIN` status and queries provider for resolution.

# PACKAGE FLOW — AS BUILT (PK0)

- Commit: `7548e1c` (`fix(web): ensure services catalog loads unconditionally and unify auth token cookie resolution`)
- Branch: `main` (contains `feature/package-engine` in full; `overnight/polish` is 85 commits behind and has NO package feature)
- Dev DB NAME: `neondb` · Test DB NAME: `neondb` — **same database, same host** (`DATABASE_URL_TEST` is not a separate DB). Evidence: `docs/evidence/20261026-pk0-db-compare.txt`
- Date: 2026-10-26
- Evidence files: `20261026-pk0-migrate-status.txt`, `20261026-pk0-devdb-state.txt`, `20261026-pk0-devdb-columns.txt`, `20261026-pk0-db-compare.txt`, `20261026-pk0-contract-diff.txt`

> Earlier correction worth recording: a first naive SQL probe reported `Service.packageEligible` missing; the information_schema probe (`20261026-pk0-devdb-columns.txt`) shows the column **exists** — the first query failed because unquoted camelCase folds to lowercase in Postgres.

## PK0 checklist answers

| Check | Result | Evidence |
|---|---|---|
| Pending migrations applied? | **NO migration history at all**: `prisma migrate status` reports all 14 migrations "not yet applied"; there is no `_prisma_migrations` table. The DB schema exists (all package tables present) — it was provisioned without recording migration history (consistent with `prisma db push` usage). `prisma migrate deploy` on boot would attempt baseline `CREATE TABLE` against existing tables. | `20261026-pk0-migrate-status.txt`, `20261026-pk0-db-compare.txt` |
| Prisma client generated? | YES — `node_modules/.prisma/client/index.js` present. | — |
| PlatformConfig seeded? | **NO — 0 rows** in dev DB. Seeding happens only at API boot (`apps/api/src/modules/platforms/platforms.service.ts:17-70` `seedDefaultPlatforms()` in `onModuleInit`), so the API has not successfully booted against this DB since the table was created. | `20261026-pk0-devdb-state.txt` |
| packageEligible services? | 37 active services with `packageEligible = true` (field is `Service.packageEligible`, schema.prisma:241; checked in `packages-quote.service.ts:341`). `prisma/seed.ts` does **not** set it — 37 rows came from another seed/import path. | `20261026-pk0-db-compare.txt` |
| Env secrets (names only) | `.env` has: `DATABASE_URL, DIRECT_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, PASSWORD_PEPPER, PROVIDER_KEY_SECRET, PROVIDER_KEY_ENCRYPTION_KEY, COOKIE_SECRET, REDIS_*, PACKAGES_ENABLED, …`. **`QUOTE_SECRET` is NOT set in `.env`** (present in `.env.example`); hash util falls back to `JWT_SECRET` (`package-quote-hash.util.ts:42-60`). `PACKAGES_REQUIRE_QUOTE_HASH` exists in `.env.example` but is read nowhere. | `.env` name listing (session log) |
| Worker runs package tick? Who owns it? | YES — `apps/worker/src/main.ts` (`SMMWorkerEngine.start()` line 206-213): 10 s interval → `pollAndDispatchPackageExecutions()` (1813-2103), gated by `PACKAGES_ENABLED === "true"` and non-production (1814-1816). Claiming: `SELECT … FOR UPDATE OF e SKIP LOCKED` (1855-1886) after locking Package `FOR UPDATE` (1843-1852). **API also runs a 10 s scheduler** (`packages-scheduler.service.ts:25-37`) but only for settlement, not dispatch. | Explore map (session) |
| In-memory fallbacks? | YES, many (see "Fallbacks" below) — DB-down is silently absorbed in several package paths instead of 503. | Explore map (session) |
| Contract diff (web ↔ API routes)? | `pnpm check:contracts` passes (24 calls, all YES) — but its list **does not include any `/packages` call**. Manual comparison: every URL string the web calls (`CustomerContext.tsx:798-892`, `packages/page.tsx`, `packages/[id]/page.tsx`) matches a controller route in `packages.controller.ts`. Web sends purchase idempotency key in the **body**; controller reads body (service 145-148) — matches. | `20261026-pk0-contract-diff.txt` + Explore map |
| `PACKAGES_ENABLED` value in `.env` | Name confirmed present (value not recorded here). Guard 503s unless `"true"` and non-production (`packages-enabled.guard.ts:31-36`); worker mirrors the gate (main.ts:1814-1816). | — |

## A. Create (platform → handle → drip → post rules → quote)

**Built as designed.**
- `POST /platforms` reads: `apps/api/src/modules/platforms/platforms.controller.ts:10` (`GET /platforms`), config from `PlatformConfig` + `DEFAULT_PLATFORM_CONFIGS` (`platform-rules.util.ts:38`).
- Handle normalization/validation: `platform-rules.util.ts` `normalizeHandle` (180), `validateHandle` (188), `validatePlatformLink` (236, rejects short-link hosts at 289); blocklist `PlatformHandleBlocklist` + `isHandleBlocked` (243).
- Drip inputs & post rules: contracts `packages/contracts/src/packages.ts` `PackageRuleInputSchema` (183), quote service normalization (207-294).

**Differs.** Contract `SupportedPlatformSchema` (197) allows only instagram/tiktok/youtube/facebook/x/telegram, but `DEFAULT_PLATFORM_CONFIGS` also defines linkedin + spotify (`platform-rules.util.ts:38`, spotify TIME_DRIP-only) — a config/contract mismatch.

## B. Quote

**Built as designed.**
- `POST /packages/quote` — `packages.controller.ts:34` (OptionalJwtAuthGuard), rate-limited 30/min user + 60/min IP, 60 s cache (`packages.service.ts:60-124`); caps checked first (`packages-quote.service.ts:23-30`); margin floor 15% (32, 359-365); reserve math (368-484).
- `quoteHash`: HMAC-SHA256 `qh_v2_<kid>_<expiresAtMs>_<hmac>` over canonical JSON incl. userId + `::expires=<ms>`, TTL 10 min, timing-safe verify (`package-quote-hash.util.ts:3, 127-160, 174-254`).

**Differs.**
- Golden-case "too small → 1 run + quote warning": `calculateFollowersDrip` (`drip-engine.util.ts:53-159`) always produces ≥1 run; a specific quote *warning* field was not found in the quote response mapping (verify in PK1-3).
- In-memory fallback fabricates services with `packageEligible: true` and fake rates when DB disconnected (`packages-quote.service.ts:304-317`) — quotes can be silently fictional.

## C. Purchase

**Built as designed.**
- `POST /packages/purchase` and alias `POST /packages` (`packages.controller.ts:54, 69`); idempotency via body `idempotencyKey` + DB unique `unique_package_idempotency_per_user` (schema 630; service 145-179 returns `isReplay`).
- One transaction: quoteHash verify → 409 `QUOTE_CHANGED` (210-226); one ACTIVE package per (platform, handle) (236-247); max 5 active handles (250-265); wallet `SELECT … FOR UPDATE` (268-271); debit + `PACKAGE_PURCHASE` negative ledger (287-301); Package ACTIVE + rules; TIME_DRIP executions precomputed with `source: SCHEDULE` (356-386).

**Differs.** Idempotency-Key is accepted from body for purchase (web sends body) — the `Idempotency-Key` **header** is only honored for `/triggers` (controller 208-213). Intent "Idempotency-Key and quoteHash" is satisfied in effect but via different transports for purchase vs trigger.

## D. Start (per post)

**Built as designed.**
- `POST /packages/:id/triggers/preview` — zero side effects (`packages.service.ts:412-496`).
- `POST /packages/:id/triggers` — Idempotency-Key header/body (`controller:201-213`); service checks ACTIVE, atomic quota `UPDATE … usedCount+1 WHERE usedCount < maxPosts`-style increment, quantity ≤ maxQtyPerPost, unique `(packageId, mediaKey)`, executions created (first now, rest spaced) (`packages.service.ts:412-692`; schema unique at 668-672).
- Backward-compat `POST /packages/:id/trigger` auto-generates the key (controller 240-252) — weaker but present.

## E. Dispatch

**Built as designed.**
- Worker tick every 10 s: due SCHEDULED executions (take 25, `executeAt <= now`, main.ts 1831-1836); per candidate one transaction locking Package FOR UPDATE then claim `FOR UPDATE SKIP LOCKED` (1843-1886); gates PAUSED/CANCELLED/endAt (1889-1931); predecessor gate for SCHEDULE seq>1 (1933-1997); claim to DISPATCHED via guarded `updateMany` (2020-2033); **prepaid child order with real `allocatedCharge`** (`isPrepaid: true`, main.ts 2035-2049) + `ORDER_CREATED` outbox (2065-2081) in the same transaction.

**Differs.**
- Worker silently falls back to plain `findMany` (no SKIP LOCKED) if the raw claim query throws (main.ts 274-283) — dual-instance safety degrades silently.
- Package orders with **no active provider** still fall through to simulated completion paths (main.ts 769-775 guard covers real-provider orders only; simulated branch `1419-1440`, `1562-1564`, `1113-1157`).

## F. Money

**Built as designed.**
- Reserve: POST_TRIGGERED `unitCharge = ceil(rate × qtyPerPost / 1000) × maxPosts`; TIME_DRIP `ceil(rate × totalQty / 1000)` split across runs, last run absorbs paise remainder (`packages-quote.service.ts:368-484`; `drip-engine.util.ts:125-137`). All Decimal/ROUND_CEIL.
- Invariant `reserveTotal = consumed + alreadyRefunded + netRefundDue` (`package-accounting.util.ts:28`); PARTIAL consumes proportional ceil (58-67); used by cancel (782-927) and settlement (scheduler 50-175; settle 934-1016) — refund exactly once via unique `Refund(packageId, reason)` (migration 20261025000000) with `PACKAGE_REFUND` ledger.
- Failed/partial child orders: worker `handleFinalOrderFailure` (587-681) / `handlePartialRefund` (996-1108) — wallet FOR UPDATE + REFUND ledger idempotency; canonical `refundExecution` (`packages.service.ts:2133-2372`) with provider cross-check, invariant sum ≤ allocatedCharge, two-man rule > ₹500, audit.

**Differs.** `renewPackage` writes ledger `type: "PURCHASE"` (`packages.service.ts:1738`) — not a valid `TransactionType` enum value; would fail against a real DB.

## G. Control (pause/resume/cancel, endAt settlement)

**Built as designed.** `POST /packages/:id/pause|resume|cancel` (controller 145-165, 348); settlement sweep in API scheduler (`packages-scheduler.service.ts:50-175`) + worker restart resilience; executions statuses include `SKIPPED_PAUSED` etc. (schema 58-71).

**Differs.** `Package.autoRenew`, `renewalOfId`, `pausedAt`, `PackageRule.swapCount` are written via `as any` but **have no Prisma columns** (service 1239, 1756-1757, 1787) — auto-renew/swap persistence will fail against a real DB. Contract `PackageStatusSchema` includes DRAFT/QUOTED/FAILED/PARTIAL not present in the Prisma enum.

## Fallbacks / sandbox paths that hide DB errors (PK5 targets)

1. `apps/api/src/common/prisma.service.ts` — `isConnected = false` on connect failure (24, 34); API boots degraded.
2. `packages.service.ts` 2018-2024 — `reportProblem` returns **fake ticket id** when disconnected; 2062-2071 — admin summary returns hardcoded 100/60/40.
3. `packages-quote.service.ts` 304-317 — fabricated services on disconnect.
4. `typeof prisma.package.findFirst === "function"` no-op chains throughout packages.service (1026-1032, 1083-1089, 1167-1189, …).
5. `cache.service.ts` — in-memory rate-limit/cache fallback when Redis absent (10, 16-22, 67, 135).
6. `auth.service.ts` 32-34 — in-memory sandbox users/sessions.
7. Worker simulated providers for non-real-provider orders (main.ts 530, 1113-1157, 1258, 1419-1440, 1562-1564).
8. Worker SKIP LOCKED fallback to plain findMany (main.ts 274-283).

## Known schema/contract drift list (PK2 candidates)

| # | Issue | Where |
|---|---|---|
| 1 | `_prisma_migrations` table absent; all 14 migrations unapplied per migrate status | `20261026-pk0-migrate-status.txt` |
| 2 | Dev DB == test DB (`neondb`); `DATABASE_URL_TEST` not separate | `20261026-pk0-db-compare.txt` |
| 3 | PlatformConfig 0 rows until first API boot seeds it | `20261026-pk0-devdb-state.txt` |
| 4 | `as any` writes to non-existent columns (autoRenew, renewalOfId, pausedAt, swapCount) | packages.service.ts:1239, 1756-1757, 1787 |
| 5 | Ledger type `"PURCHASE"` not in TransactionType enum | packages.service.ts:1738 |
| 6 | Contract PackageStatus enum ⊃ Prisma enum | contracts packages.ts:321 vs schema 40-46 |
| 7 | SupportedPlatform contract ⊂ DEFAULT_PLATFORM_CONFIGS (linkedin, spotify extra) | platform-rules.util.ts:38 |
| 8 | `PACKAGES_REQUIRE_QUOTE_HASH` env read nowhere | .env.example:117 |
| 9 | Contract-diff script omits all `/packages` calls | scripts/check-contract-diff.js:33+ |
| 10 | Feature hard-disabled in production by guard (503) regardless of `PACKAGES_ENABLED` | packages-enabled.guard.ts:31-36 |

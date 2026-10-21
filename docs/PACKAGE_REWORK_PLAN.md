# SMM Package Feature Rework Plan: Platform + Handle Engine

**Status**: DRAFT - PENDING APPROVAL (Milestone M0)  
**Date**: 2026-10-21  
**Architect**: Principal Backend Engineer  
**Policy Record**: `{"planning": "deep", "context_depth": "dependency", "verification_depth": "impact", "delegation": "none", "reason_codes": ["architectural-pivot", "schema-migration", "remove-meta-oauth"]}`

---

## 1. Executive Summary & Objective

The Package feature is pivoting away completely from Instagram OAuth / Meta Graph API connections (`SourceConnection`, `MonitoredMedia`, `MockInstagram`, token jobs, webhook listeners). In its place, the system introduces a **platform-agnostic, handle-based package engine** supporting 6 major platforms (`instagram`, `tiktok`, `youtube`, `facebook`, `x`, `telegram`) with:
1. **Platform + Handle Architecture**: Customer enters their handle (e.g. `@creator`), validated against platform-specific regex rules, with no OAuth connection required.
2. **Time-Interval Drip Engine**: Followers/profile drip and per-post drip executed deterministically by our own worker time-interval scheduler (bypassing flaky provider-native drip parameters).
3. **Per-Post Start Flow**: Customer pastes a post/video link into their active package dashboard, previews the split (quantity, interval, delivery window), and triggers execution in an atomic, idempotent transaction.
4. **Strict Money Invariant**: Integer paise reserve calculations, child orders with real `allocatedCharge` (never 0), idempotent settlement at `endAt`, and verified conservation:
   $$\text{purchased} \equiv \text{consumed} + \text{refunded} + \text{remaining}$$
5. **Copy Hygiene**: Strict enforcement of prohibited buzzwords (`verified`, `authorized`, `auto-detect`, `instant`, `organic`, `natural`, `undetectable`, `guaranteed`), mandatory consent checkbox, and transparent disclosure: *"We do not verify account ownership."*

---

## 2. Milestone M0 Audit: What to REMOVE, KEEP, and ADD

### A. Items to REMOVE (Milestone M1)

| Category | Component / Asset | File Path / Identifier | Rationale |
| :--- | :--- | :--- | :--- |
| **Database Tables** | `SourceConnection` | `prisma/schema.prisma:L582-L607` | Meta OAuth connection storage (access tokens, expiration, failure counts) is obsolete. |
| **Database Tables** | `MonitoredMedia` | `prisma/schema.prisma:L661-L678` | Instagram Graph API media cache is obsolete. |
| **Database Enums** | `MonitoredMediaState` | `prisma/schema.prisma:L58-L62` | Enum (`BASELINE`, `NEW`, `DELETED`) only used by `MonitoredMedia`. |
| **Database Columns** | `Package.connectionId` | `prisma/schema.prisma:L611-L612` | Packages will bind directly to `(platform, handle)`. |
| **Database Columns** | `PackageExecution.mediaId` | `prisma/schema.prisma:L687-L688` | Replaced by direct `targetUrl` and `mediaKey` fields on execution/trigger. |
| **API Module** | `InstagramModule` | `apps/api/src/modules/instagram/` (entire folder) | Contains OAuth controller, service, token encryption, and mock server. |
| **API Files** | `instagram.controller.ts` | `apps/api/src/modules/instagram/instagram.controller.ts` | OAuth endpoints (`/connections/instagram/*`, `/integrations/instagram/*`). |
| **API Files** | `instagram.service.ts` | `apps/api/src/modules/instagram/instagram.service.ts` | OAuth token exchange, polling loop, baseline filtering. |
| **API Files** | `mock-instagram.ts` | `apps/api/src/modules/instagram/mock-instagram.ts` | Mock Instagram server used for sandboxed OAuth testing. |
| **API Files** | `crypto.util.ts` | `apps/api/src/modules/instagram/crypto.util.ts` | Token encryption utility specific to OAuth tokens. |
| **API Routes** | `POST /connections/instagram/start` | `apps/api/src/modules/instagram/instagram.controller.ts:L22` | OAuth start endpoint. |
| **API Routes** | `GET /connections/instagram/callback` | `apps/api/src/modules/instagram/instagram.controller.ts:L29` | OAuth callback endpoint. |
| **API Routes** | `GET /connections` | `apps/api/src/modules/instagram/instagram.controller.ts:L46` | Connection listing endpoint. |
| **API Routes** | `DELETE /connections/:id` | `apps/api/src/modules/instagram/instagram.controller.ts:L53` | Connection deletion endpoint. |
| **API Routes** | `POST /connections/instagram/deauthorize` | `apps/api/src/modules/instagram/instagram.controller.ts:L63` | Meta deauthorization webhook. |
| **API Routes** | `POST /connections/instagram/data-deletion` | `apps/api/src/modules/instagram/instagram.controller.ts:L69` | Meta data-deletion webhook. |
| **API Routes** | Legacy `/integrations/instagram/*` | `apps/api/src/modules/instagram/instagram.controller.ts:L80` | Legacy alias routes. |
| **API Routes** | `GET /packages/:id/posts` | `apps/api/src/modules/packages/packages.controller.ts:L94` | Returns `MonitoredMedia` rows. |
| **Env Variables** | `SOURCE_INSTAGRAM_ENABLED` | `apps/api/src/modules/settings/settings.service.ts:L29` | Feature flag for Meta API. |
| **Env Variables** | `INSTAGRAM_APP_ID` | `.env.example`, `mock-instagram.ts` | Meta app client ID. |
| **Env Variables** | `INSTAGRAM_APP_SECRET` | `.env.example` | Meta app secret. |
| **Env Variables** | `INSTAGRAM_REDIRECT_URI` | `.env.example`, `mock-instagram.ts` | Meta OAuth redirect URI. |
| **Test Suites** | `package-engine-p3.spec.ts` | `apps/api/test/package-engine-p3.spec.ts` | Dedicated 100% to Instagram Connect, Token Jobs & Polling. |
| **Documentation** | `docs/INSTAGRAM_SETUP.md` | `docs/INSTAGRAM_SETUP.md` | Meta App Review and setup guide. |
| **Web Context** | `pollInstagramConnection` | `apps/web/context/CustomerContext.tsx:L830` | Frontend polling helper. |

---

### B. Items to KEEP (Preserved Intact)

| Component | Location | Reason to Keep |
| :--- | :--- | :--- |
| **Escrow Money Model** | `apps/api/src/modules/packages/packages.service.ts`, `packages-quote.service.ts` | Integer paise quote calculation, wallet row lock (`SELECT ... FOR UPDATE`), and `PACKAGE_PURCHASE` ledger entry. |
| **Child Order Pipeline** | `apps/api/src/modules/packages/packages-scheduler.service.ts`, `apps/worker/src/main.ts` | Child orders carry real `allocatedCharge` (never 0) and `isPrepaid = true`, avoiding double billing while preserving refund math. |
| **Worker Scheduler Tick** | `apps/api/src/modules/packages/packages-scheduler.service.ts`, `apps/worker/src/main.ts` | Concurrency-safe execution dispatcher with single-owner polling (`FOR UPDATE OF e SKIP LOCKED`). |
| **Settlement & Expiry** | `packages-scheduler.service.ts:settleExpiredPackages` | Automatic sweep refunding unspent reserve at `endAt` via `PACKAGE_REFUND` with unique constraint idempotency. |
| **Refund Uniqueness** | `prisma/schema.prisma:L403` (`@@unique([packageId, reason])`) | Prevents duplicate settlement or cancellation refunds. |
| **Pause & Resume Engine** | `packages.service.ts` | Skips executions during pause, tracks `pausedDays`, and extends `endAt` safely up to `packageMaxPauseDays`. |
| **Financial Invariant** | `package-engine-p5-invariants.spec.ts` (`Scenario 1`) | $\text{purchased} \equiv \text{consumed} + \text{refunded} + \text{remaining}$. |

---

### C. Items to ADD (Milestones M2 to M7)

| Milestone | Component / Entity | Description & Specifications |
| :--- | :--- | :--- |
| **M2** | Table `PlatformConfig` | Database table for platform rules: `id`, `platform`, `displayName`, `handleRegex`, `handleMaxLength`, `hostAllowlist` (text[]), `pathPattern`, `mediaKeyExtractor`, `urlContainsHandle` (bool), `eligibleRuleKinds` (text[]), `followersIntervals` (int[]), `minGapMinutes`, `maxRunsPerPost`, `defaultWindowMinutes`, `limits` (jsonb), `active` (bool). |
| **M2** | Seed Data | Production-grade regex and validation rules for 6 platforms: `instagram`, `tiktok`, `youtube`, `facebook`, `x`, `telegram`. |
| **M2** | Endpoints | `GET /platforms` (public platform listing), `GET /admin/platforms`, `POST /admin/platforms`, `PUT /admin/platforms/:id` (admin CRUD). |
| **M2** | URL Link Validation | Host allowlist check, path regex, mediaKey extractor. Strict rejection of shortlinks (`bit.ly`, `t.co`, `tinyurl`, `goo.gl`) with clear message: *"Shortened URLs are not supported. Please paste the direct platform link."* |
| **M2** | Service Eligibility | `Service.packageEligible` boolean flag + API query filter `GET /services?platform=...&packageEligible=true`. |
| **M3** | Package Creation Flow | Zod contract schema for `(platform, handle, followersDrip, postRules)`. Max N handles per user, `UNIQUE(platform, handle)` for active packages, admin handle blocklist check. |
| **M3** | Honest Quote API | `POST /packages/quote` returns exact price without side effects, displays rate per 1,000, quantity, maxPosts, total labelled: *"Maximum total; unused is refunded at the end."* |
| **M4** | Time-Interval Drip Engine | Pure time-interval scheduler. Followers drip precomputed at purchase (`source: SCHEDULE`). Per-post drip: `runs = clamp(min(floor(q/min), maxRunsPerPost, floor(window/minGap)), 1)`. Deterministic schedule, remainder absorbed into early runs. Clear warning if quantity cannot be split into multiple runs. |
| **M5** | Start Flow Endpoints | `POST /packages/:id/triggers/preview` (pure validation & schedule preview) and `POST /packages/:id/triggers` (atomic execution creation, quota decrement, requires `Idempotency-Key`, `UNIQUE(packageId, mediaKey)`). |
| **M5** | Customer UI | Active Package Card with Link Input Box, Service selection checkboxes, quantity & delivery window controls, Start button disabled during submission, progress timeline view. |
| **M6** | Money & Settlement | Exact reserve formulas: $\text{reserve} = \lceil\text{rate} \times \text{maxQtyPerPost} / 1000\rceil \times \text{maxPosts}$. Unspent reserve settled once via `PACKAGE_REFUND`. |
| **M7** | UI Fixes & Hygiene | Fix "Internal server error" on Package tab with proper error boundaries and request IDs. Remove Highlights/stories/Threads from Instagram package options. Add empty state copy: *"Add your handle to create your first package"*. Show ownership disclaimer: *"We do not verify account ownership."* |
| **M8** | 14-Scenario Test Suite | End-to-end unit, invariant, and integration test coverage for all 14 required verification scenarios. |

---

## 3. Database Migration Blueprint (M1 / M2)

### Schema DDL Changes:
```sql
-- 1. Create PlatformConfig Table
CREATE TABLE "PlatformConfig" (
    "id" VARCHAR(64) PRIMARY KEY,
    "platform" VARCHAR(32) NOT NULL UNIQUE,
    "displayName" VARCHAR(64) NOT NULL,
    "handleRegex" TEXT NOT NULL,
    "handleMaxLength" INT NOT NULL DEFAULT 64,
    "hostAllowlist" TEXT[] NOT NULL DEFAULT '{}',
    "pathPattern" TEXT NOT NULL,
    "mediaKeyExtractor" TEXT NOT NULL,
    "urlContainsHandle" BOOLEAN NOT NULL DEFAULT false,
    "eligibleRuleKinds" TEXT[] NOT NULL DEFAULT '{"POST_TRIGGERED","TIME_DRIP"}',
    "followersIntervals" INT[] NOT NULL DEFAULT '{1,2,4,8,12,24}',
    "minGapMinutes" INT NOT NULL DEFAULT 15,
    "maxRunsPerPost" INT NOT NULL DEFAULT 10,
    "defaultWindowMinutes" INT NOT NULL DEFAULT 180,
    "limits" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add PlatformConfig & PackageEngine fields to Service
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "packageEligible" BOOLEAN NOT NULL DEFAULT false;

-- 3. Modify Package Table: Drop connectionId, add platform, handle unique index
ALTER TABLE "Package" DROP CONSTRAINT IF EXISTS "Package_connectionId_fkey";
ALTER TABLE "Package" DROP COLUMN IF EXISTS "connectionId";
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "platform" VARCHAR(32) NOT NULL DEFAULT 'INSTAGRAM';

-- 4. Modify PackageExecution Table: Drop mediaId, add mediaKey and targetUrl
ALTER TABLE "PackageExecution" DROP CONSTRAINT IF EXISTS "PackageExecution_mediaId_fkey";
ALTER TABLE "PackageExecution" DROP COLUMN IF EXISTS "mediaId";
ALTER TABLE "PackageExecution" ADD COLUMN IF NOT EXISTS "mediaKey" VARCHAR(128);
ALTER TABLE "PackageExecution" ADD COLUMN IF NOT EXISTS "targetUrl" TEXT;
CREATE UNIQUE INDEX "PackageExecution_packageId_mediaKey_seq_key" ON "PackageExecution"("packageId", "mediaKey", "seq");

-- 5. Drop Unused Tables and Enums (executed ONLY upon user OK in M1)
-- DROP TABLE IF EXISTS "MonitoredMedia" CASCADE;
-- DROP TABLE IF EXISTS "SourceConnection" CASCADE;
-- DROP TYPE IF EXISTS "MonitoredMediaState";
```

---

## 4. Copy & Compliance Rules

The following terms are **strictly prohibited** in all UI strings, API messages, error handlers, and documentation:
- `"verified"`
- `"authorized"`
- `"auto-detect"`
- `"instant"`
- `"organic"`
- `"natural"`
- `"undetectable"`
- `"guaranteed"`

### Required Compliance Strings:
1. **Account Ownership Disclaimer**: *"We do not verify account ownership. Delivery is fulfilled strictly to the public handle and post links provided."*
2. **Consent Checkbox**: *"I understand the platform terms of service and agree to the delivery rules."*
3. **Maximum Total Disclosure**: *"Maximum total; unused balance is automatically refunded to your wallet upon package completion or cancellation."*

---

## 5. Next Steps & Stop Point

Milestone M0 is complete.
Per the prompt instruction:
> **STOP POINTS after M0 and M3: M0 AUDIT: list every file, route, table, env var, test and doc tied to Instagram connect... Write docs/PACKAGE_REWORK_PLAN.md: remove / keep / add. STOP.**

Awaiting user approval to proceed to **Milestone M1 (Remove)**.

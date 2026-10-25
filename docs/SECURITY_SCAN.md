# Repository-Wide Security Audit Scan Report (S0)

**Date**: 2026-10-24  
**Git Commit**: `631d7c74606998e452a736f3471e24a32cd5d6ae`  
**Branch**: `feature/package-engine`  
**Test DB**: `postgresql://***:***@ep-test-smm.ap-southeast-1.neon.tech/smm_test`  
**Evidence File**: [`docs/evidence/20261024-222623-s0-reproduce-gaps.txt`](file:///d:/projects/internship%20projects/SMM/docs/evidence/20261024-222623-s0-reproduce-gaps.txt)

---

## 1. Executive Summary & Mandatory Proof Answers

### First Answer: Does purchase recompute the price server-side from current rates and ignore any client total?
**YES (VERIFIED WITH CODE & TEST)**.
- **Code**: In [`apps/api/src/modules/packages/packages.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/packages.service.ts#L130-L160), `purchasePackage` calls `calculateQuote(purchaseInput, now)`. The contract schema [`PackagePurchaseInputSchema`](file:///d:/projects/internship%20projects/SMM/packages/contracts/src/packages.ts#L90-L115) does not even accept client-supplied total charge or price fields. Even if an attacker injects `{ totalCharge: 1.00, price: 0.50 }` via raw JSON, `calculateQuote` queries the active database service rates (`Service.ratePer1000`) and computes `packageReserveTotal`. The wallet debit amount is unconditionally set to `new Decimal(quote.totalCharge)`.
- **Test Evidence**: Executed in `apps/api/test/package-security-gaps-reproduce.spec.ts:327-360`. Injecting `{ totalCharge: 1.00 }` on a quote that legitimately costs ₹150 resulted in a wallet debit of exactly ₹150.00 and remaining balance ₹850.00, proving client-supplied charges are completely ignored.

### S0 Reproduction Summary: GAPs 1 through 5
| Finding | Severity | Reproduction Status | Proof & Evidence Location |
| :--- | :--- | :--- | :--- |
| **GAP-1** (Quote integrity optional) | MEDIUM / HIGH | **REPRODUCED** | `test/package-security-gaps-reproduce.spec.ts:363-388` — Omitting `quoteHash` when `PACKAGES_REQUIRE_QUOTE_HASH=false` allows purchases to execute without integrity verification. |
| **GAP-2** (Public quote CPU DoS) | HIGH | **REPRODUCED** | `test/package-security-gaps-reproduce.spec.ts:390-411` — `POST /packages/quote` with `days=365, intervalHours=1` executes 8,760 loop iterations generating and sorting 8,760 run objects in memory with no auth or rate limit. |
| **GAP-3** (Double refund / unverified refund) | HIGH | **REPRODUCED** | `test/package-security-gaps-reproduce.spec.ts:413-447` — `adminResolveExecution(..., "REFUND")` refunds 100% of `allocatedCharge` without deducting prior refunds or partial deliveries, resulting in ₹140 refunded on a ₹100 charge. |
| **GAP-4** (Hardcoded secret fallback) | MEDIUM | **REPRODUCED** | `test/package-security-gaps-reproduce.spec.ts:449-483` — When `QUOTE_SECRET` and `JWT_SECRET` are unset, `generateQuoteHash` uses `"smm-package-quote-integrity-salt"`. |
| **GAP-5** (Fail-open sandbox fallback) | HIGH | **REPRODUCED** | `test/package-security-gaps-reproduce.spec.ts:485-515` — When `prisma.isConnected === false`, `purchasePackage` returns `{ success: true }` from an in-memory Map, writing nothing to database. |

---

## 2. Repo-Wide Scan Results

### Table 1: Secret Fallbacks (`|| "literal"` near SECRET/KEY/SALT/TOKEN or `process.env.X ?? "literal"`)
| Module | File | Line(s) | Code Snippet | Flaw Description |
| :--- | :--- | :--- | :--- | :--- |
| `apps/api` | [`package-quote-hash.util.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/package-quote-hash.util.ts#L66) | 66 | `secretKey: string = process.env.QUOTE_SECRET \|\| process.env.JWT_SECRET \|\| "smm-package-quote-integrity-salt"` | Default salt fallback allows forgeable quotes in production if env unset. |
| `apps/api` | [`package-quote-hash.util.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/package-quote-hash.util.ts#L93) | 93 | `secretKey: string = process.env.QUOTE_SECRET \|\| process.env.JWT_SECRET \|\| "smm-package-quote-integrity-salt"` | Default salt fallback during hash verification. |
| `apps/api` | [`crypto.util.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/common/crypto.util.ts#L13-L14) | 13–14 | `return crypto.scryptSync("smm_master_provider_key_fallback_dev", "salt_smm", 32);` | Hardcoded master AES encryption key fallback for provider API credentials. |
| `apps/worker` | [`crypto.util.ts`](file:///d:/projects/internship%20projects/SMM/apps/worker/src/crypto.util.ts#L9-L10) | 9–10 | `return crypto.scryptSync("smm_master_provider_key_fallback_dev", "salt_smm", 32);` | Duplicate hardcoded AES provider key fallback in background worker. |
| `apps/api` | [`jwt-auth.guard.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/common/jwt-auth.guard.ts#L9) | 9 | `const JWT_SECRET = process.env.JWT_ACCESS_SECRET \|\| process.env.JWT_SECRET \|\| "smm_panel_jwt_secret_dev_environment_key_32bytes";` | Hardcoded JWT verification secret fallback allows token forging if unset. |
| `apps/api` | [`packages-enabled.guard.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/packages-enabled.guard.ts#L10-L13) | 10–13 | `process.env.JWT_ACCESS_SECRET \|\| process.env.JWT_SECRET \|\| "smm_panel_jwt_secret_dev_environment_key_32bytes"` | Hardcoded JWT secret fallback in packages feature gate guard. |
| `apps/api` | [`auth.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/auth/auth.service.ts#L9) | 9 | `const JWT_SECRET = process.env.JWT_ACCESS_SECRET \|\| process.env.JWT_SECRET \|\| "smm_panel_jwt_secret_dev_environment_key_32bytes";` | Hardcoded JWT signing secret fallback in authentication service. |
| `apps/api` | [`env.validation.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/config/env.validation.ts#L10-L11) | 10–11 | `JWT_ACCESS_SECRET: z.string().default("test_access_secret_32bytes_minimum_length_required")` | Default weak secret values configured directly in Zod schema defaults. |

---

### Table 2: Fail-Open Fallbacks (`isConnected`, sandbox maps, catch blocks returning success)
| Module | File | Line(s) | Code Snippet | Flaw Description |
| :--- | :--- | :--- | :--- | :--- |
| `apps/api` | [`packages.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/packages.service.ts#L120-L125) | 120, 467 | `if (!this.prisma.isConnected) { const mockPkg = ...; this.sandboxPackages.set(id, mockPkg); return { success: true, ... }; }` | Returns fake success without database persistence when Prisma disconnected. |
| `apps/api` | [`platforms.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/platforms/platforms.service.ts#L180) | 180 | `if (!this.prisma.isConnected) return { success: true, ...data };` | Claims platform configuration was created when DB is offline. |
| `apps/api` | [`platforms.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/platforms/platforms.service.ts#L214) | 214 | `if (!this.prisma.isConnected) return { success: true, id, ...data };` | Claims platform configuration was updated when DB is offline. |
| `apps/api` | [`platforms.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/platforms/platforms.service.ts#L271) | 271 | `if (!this.prisma.isConnected) return { success: true, platform: plat, handle: normalized };` | Claims handle was added to blocklist when DB is offline. |
| `apps/api` | [`platforms.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/platforms/platforms.service.ts#L293) | 293 | `if (!this.prisma.isConnected) return { success: true };` | Claims handle was unblocked when DB is offline. |
| `apps/api` | [`wallet.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/wallet/wallet.service.ts#L16-L23) | 16–23 | `if (!this.prisma.isConnected) { return { balance: bal.toNumber(), currency: "INR" }; }` | Returns simulated wallet balance when DB is down instead of failing 503. |
| `apps/api` | [`wallet.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/wallet/wallet.service.ts#L66-L84) | 66–84 | `if (!this.prisma.isConnected) { ... return { success: true, balance: ... }; }` | Simulates wallet debit without writing ledger entry or locking row. |
| `apps/api` | [`wallet.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/wallet/wallet.service.ts#L211-L225) | 211–225 | `if (!this.prisma.isConnected) { ... return { success: true, balance: ... }; }` | Simulates wallet credit without database ledger entry. |
| `apps/api` | [`orders.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/orders/orders.service.ts#L740-L755) | 740–755 | `if (!this.prisma.isConnected) { return { success: true, order: mockOrder }; }` | Returns success for order creation without persistent database transaction. |
| `apps/api` | [`users.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/users/users.service.ts#L14-L20) | 14–20 | `if (!this.prisma.isConnected) { return mockUser; }` | Returns dummy user profile when DB is disconnected. |
| `apps/api` | [`tickets.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/tickets/tickets.service.ts#L17-L25) | 17–25 | `if (!this.prisma.isConnected) { return mockTicket; }` | Returns fake created ticket when DB is down. |

---

### Table 3: `$queryRawUnsafe` or String-Built SQL Queries
| Module | File | Line(s) | Code Snippet | Flaw / Risk |
| :--- | :--- | :--- | :--- | :--- |
| `apps/api` | [`packages.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/packages.service.ts#L202) | 202 | `await tx.$queryRawUnsafe('SELECT * FROM "Wallet" WHERE "userId" = $1 FOR UPDATE', userId)` | Uses `$queryRawUnsafe` instead of parameterized tagged `$queryRaw`. |
| `apps/api` | [`packages.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/packages.service.ts#L480) | 480 | `await tx.$queryRawUnsafe('SELECT * FROM "Package" WHERE id = $1 FOR UPDATE', packageId)` | Uses `$queryRawUnsafe` instead of tagged `$queryRaw`. |
| `apps/api` | [`packages.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/packages.service.ts#L577) | 577 | `await tx.$queryRawUnsafe('SELECT * FROM "PackageRule" WHERE ... FOR UPDATE', packageId)` | Uses `$queryRawUnsafe` instead of tagged `$queryRaw`. |
| `apps/api` | [`packages.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/packages.service.ts#L679) | 679 | `await tx.$queryRawUnsafe('SELECT * FROM "Package" WHERE id = $1 FOR UPDATE', packageId)` | Uses `$queryRawUnsafe` instead of tagged `$queryRaw`. |
| `apps/api` | [`packages.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/packages.service.ts#L693) | 693 | `await tx.$queryRawUnsafe('SELECT * FROM "PackageExecution" WHERE id = $1 FOR UPDATE', executionId)` | Uses `$queryRawUnsafe` instead of tagged `$queryRaw`. |
| `apps/api` | [`packages.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/packages.service.ts#L757) | 757 | `await tx.$queryRawUnsafe('SELECT * FROM "Package" WHERE id = $1 FOR UPDATE', packageId)` | Uses `$queryRawUnsafe` instead of tagged `$queryRaw`. |
| `apps/api` | [`packages.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/packages.service.ts#L841) | 841 | `await tx.$queryRawUnsafe('SELECT * FROM "Wallet" WHERE "userId" = $1 FOR UPDATE', lockedPkg.userId)` | Uses `$queryRawUnsafe` instead of tagged `$queryRaw`. |
| `apps/api` | [`wallet.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/wallet/wallet.service.ts#L96,165,235,326) | 96, 165, 235, 326 | `await tx.$queryRawUnsafe('SELECT * FROM "Wallet" WHERE ... FOR UPDATE', ...)` | 4 separate uses of `$queryRawUnsafe` for pessimistic wallet row locking. |
| `apps/api` | [`orders.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/orders/orders.service.ts#L788,930,998,1112,1287) | 788, 930, 998, 1112, 1287 | `await tx.$queryRawUnsafe('SELECT * FROM "Wallet" WHERE ... FOR UPDATE', ...)` | 5 separate uses of `$queryRawUnsafe` for order & wallet row locking. |
| `apps/worker` | [`main.ts`](file:///d:/projects/internship%20projects/SMM/apps/worker/src/main.ts#L264,599,1005,1175,1341,1843,1855) | 264, 599, 1005, 1175, 1341, 1843, 1855 | `await tx.$queryRawUnsafe(...)` | 7 separate uses of `$queryRawUnsafe` in background worker execution loop. |

---

### Table 4: `Number()` or `parseFloat()` on Money Fields
| Module | File | Line(s) | Code Snippet | Flaw / Risk |
| :--- | :--- | :--- | :--- | :--- |
| `apps/worker` | [`main.ts`](file:///d:/projects/internship%20projects/SMM/apps/worker/src/main.ts#L959) | 959 | `const rawCharge = parseFloat(String(statusRes.charge));` | Upstream provider charge parsed to IEEE-754 float losing paise precision. |
| `apps/worker` | [`main.ts`](file:///d:/projects/internship%20projects/SMM/apps/worker/src/main.ts#L961) | 961 | `const fx = order.fxRateUsed ? parseFloat(order.fxRateUsed.toString()) : 1.0;` | FX currency conversion multiplier parsed as float. |
| `apps/api` | [`providers.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/providers/providers.service.ts#L266) | 266 | `const balanceNum = parseFloat(String(upstream.balance \|\| "0"));` | Upstream provider balance stored as float. |
| `apps/api` | [`providers.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/providers/providers.service.ts#L368) | 368 | `let providerCost = parseFloat(String(item.rate \|\| "100"));` | Service cost per 1k converted via `parseFloat`. |
| `apps/api` | [`package-quote-hash.util.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/package-quote-hash.util.ts#L42-L43) | 42–43 | `charge: Number(item.charge \|\| 0).toFixed(2), ratePer1000: Number(item.ratePer1000 \|\| 0).toFixed(2)` | `Number()` used for canonical quote serialization. |
| `apps/api` | [`wallet.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/wallet/wallet.service.ts#L21,43,78,220,288) | 21, 43, 78, 220, 288 | `balance: bal.toNumber(), amount: new Decimal(charge).negated().toNumber()` | Repeated `.toNumber()` conversions on ledger balances. |

---

### Table 5: Environment Toggles that Disable Security Checks (`REQUIRE_*`, `SKIP_*`, `DISABLE_*`)
| Module | File | Line(s) | Variable / Toggle | Security Implication |
| :--- | :--- | :--- | :--- | :--- |
| `apps/api` | [`packages.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/packages.service.ts#L135) | 135 | `PACKAGES_REQUIRE_QUOTE_HASH` | Defaults to `false` in `.env.example:117`. When false, quoteHash validation is skipped entirely, allowing tampering. |
| `.env.example` | [`.env.example`](file:///d:/projects/internship%20projects/SMM/.env.example#L63) | 63 | `ALLOW_SIMULATED_PAYMENTS` | Allows bypassing actual payment verification in non-production environments. |
| `apps/api` | [`packages.service.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/packages/packages.service.ts#L57) | 57 | `PACKAGES_ENABLED` | Feature flag toggle; when `false`, guard rejects users, but lacks granular per-action protection. |

---

### Table 6: Public Endpoints (No Auth Guard) with Loops or Heavy Work
| Controller | Route | Method | Guards Present | Loop / Resource Consumption Vector |
| :--- | :--- | :--- | :--- | :--- |
| `PackagesController` | `/packages/quote` | `POST` | `PackagesEnabledGuard` only (NO `JwtAuthGuard`, NO Throttler) | Allows `days=365, intervalHours=1`, causing `drip-engine.util.ts` to iterate 8,760 times, calculating timeline dates, array allocations, sort, and HMAC without auth. |
| `ServicesController` | `/services` | `GET` | None | Public catalog query; executes queries and margin calculations on all services. |
| `PlatformsController` | `/platforms/configs` | `GET` | None | Public read of platform configurations. |
| `HealthController` | `/health` | `GET` | None | Basic health ping. |
| `HealthController` | `/health/ready` | `GET` | None | Readiness ping checking Redis and DB connectivity. |

---

### Table 7: Admin Endpoints Lacking Reason / Audit / RBAC / Idempotency
| Controller | Route | Method | Current Guards | Reason Check? | Idempotency Key? | Audit Log? | Second Approval? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `PackagesController` | `/packages/admin/executions/:executionId/resolve` | `POST` | `JwtAuthGuard`, `RolesGuard` (`ADMIN`) | **NO** (`reason` is optional, no min-length check) | **NO** (no idempotency header or check) | **NO** (no before/after state logged to AuditLog) | **NO** (unlimited refund amount approved by single admin) |
| `PackagesController` | `/packages/admin/:id/summary` | `GET` | `JwtAuthGuard`, `RolesGuard` (`ADMIN`) | N/A (read-only) | N/A | No access audit log | N/A |
| `PlatformsAdminController` | `/admin/platforms/configs` | `POST` | `JwtAuthGuard`, `RolesGuard` (`ADMIN`) | No reason field | No idempotency key | No AuditLog entry | None |
| `PlatformsAdminController` | `/admin/platforms/configs/:platform` | `PUT` | `JwtAuthGuard`, `RolesGuard` (`ADMIN`) | No reason field | No idempotency key | No AuditLog entry | None |
| `PlatformsAdminController` | `/admin/platforms/blocklist` | `POST` | `JwtAuthGuard`, `RolesGuard` (`ADMIN`) | No reason field | No idempotency key | No AuditLog entry | None |

---

### Table 8: Regexes on User Input (ReDoS) and URL Host Checking
| Module | File | Line(s) | Pattern / Logic | Flaw / ReDoS Risk |
| :--- | :--- | :--- | :--- | :--- |
| `apps/api` | [`platform-rules.util.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/platforms/platform-rules.util.ts#L200-L203) | 200–203 | `parsed = new URL(trimmed);` | Does NOT enforce `https:` protocol (permits `http:`, `ftp:`); does not check or reject `userinfo` (e.g. `user@instagram.com`) or port overrides. |
| `apps/api` | [`platform-rules.util.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/platforms/platform-rules.util.ts#L208) | 208 | `hostname.endsWith(".bit.ly") \|\| hostname.endsWith(".tinyurl.com")` | Suffix check without strict dot-boundary check. |
| `apps/api` | [`platform-rules.util.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/platforms/platform-rules.util.ts#L215-L217) | 215–217 | `hostname === allowed.toLowerCase() \|\| hostname.endsWith("." + allowed.toLowerCase())` | Safe dot-boundary suffix match, but allowlist contains raw strings without punycode/IDN normalization. |
| `apps/api` | [`platform-rules.util.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/platforms/platform-rules.util.ts#L228-L229) | 228–229 | `const pathRegex = new RegExp(config.pathPattern); const match = fullPath.match(pathRegex);` | Dynamic compilation of regex from database without length cap or ReDoS validation against hostile strings. |
| `apps/api` | [`platform-rules.util.ts`](file:///d:/projects/internship%20projects/SMM/apps/api/src/modules/platforms/platform-rules.util.ts#L170-L175) | 170–175 | `const handleRegex = new RegExp(config.handleRegex);` | Dynamic handle regex applied to user handle without ReDoS evaluation. |

---

### 3. Database CHECK Constraint Verification

- **Schema Check**: In `prisma/schema.prisma:647`, `PackageRule` has `usedCount Int @default(0)` and `maxPosts Int @default(10)`. Prisma datamodel does not natively define or check PostgreSQL table constraints.
- **Migration SQL Check**: In [`prisma/migrations/20261020000000_package_engine_schema/migration.sql:143-150`](file:///d:/projects/internship%20projects/SMM/prisma/migrations/20261020000000_package_engine_schema/migration.sql#L143-L150):
  ```sql
  -- Constraint: CHECK usedCount <= maxPosts
  DO $$ BEGIN
      ALTER TABLE "PackageRule"
      ADD CONSTRAINT "check_used_count_max_posts"
      CHECK ("usedCount" <= "maxPosts");
  EXCEPTION
      WHEN duplicate_object THEN null;
  END $$;
  ```
- **Constraint Name Finding**:
  - The audit prompt specifies `check_used_count_le_max_posts`.
  - The actual constraint created in the migration SQL is named `check_used_count_max_posts`.
  - `prisma migrate diff`: Because Prisma's declarative schema does not model raw SQL CHECK constraints, any direct diff against `schema.prisma` will not generate or preserve this constraint. The constraint exists exclusively in the migration SQL and in PostgreSQL.
  - A migration and regression test must be added to ensure `check_used_count_le_max_posts` exists and is enforced at the database level.

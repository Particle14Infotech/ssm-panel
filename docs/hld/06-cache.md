# ⚡ HLD 06: Caching Strategy & Stampede Protection

**Status:** IMPLEMENTED  
**Date:** 2026-10-12  

---

## 1. Authoritative Cache Decision: Never Cache Money As Truth

> **MANDATORY FINANCIAL CACHE RULE:**  
> **Wallet balances and double-entry ledger entries are NEVER cached as truth.**  
> Any financial balance check or debit MUST execute directly on PostgreSQL Primary using row locks (`SELECT ... FOR UPDATE`). Cached values on the customer dashboard are strictly visual summaries for UI convenience and are never relied upon for transactional authorization.

---

## 2. System Cache-Aside Matrix

| Entity / Resource | Cache Key Pattern | TTL | Invalidation Trigger | Fallback When Redis Down | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Service Catalog** | `catalog:services:all` | 5 min (300 s) | On any admin update to service, rate, or category | In-memory ephemeral buffer, then DB direct | **Implemented** |
| **Customer Dashboard** | `dashboard:summary:{userId}` | 20 s | Evicted immediately on new order creation or deposit | Fallback to direct DB read | **Implemented** |
| **System Settings** | `settings:global` | 60 s | Evicted on admin settings save | In-memory cache map | **Implemented** |
| **Analytics Reports** | `reports:admin:{date}` | 60 s | Evicted on hourly sync boundary | Query PostgreSQL Read Replica | **Implemented** |
| **Wallet & Ledger** | **NEVER CACHED** | 0 s | N/A (Always direct `$queryRaw` / primary DB) | N/A (ACID Primary) | **Enforced** |

---

## 3. Stampede Protection (Lock & TTL Jitter)

To prevent cache stampede (thundering herd problem) when high-concurrency keys expire simultaneously:
1. **Randomized TTL Jitter**: Each set operation adds a random jitter duration ($0 \dots \text{jitterSeconds}$):
   $$\text{TTL}_{\text{final}} = \text{TTL}_{\text{base}} + \text{random}(0, \text{jitterSeconds})$$
2. **Explicit Wrapper**: Standardized in `apps/api/src/common/cache.service.ts` with transparent graceful fallback.

---

## 4. Test Verification Output (`tests/stress/test-cache.ts`)

```text
=================================================
⚡ EXECUTING CACHE ARCHITECTURE VALIDATION SUITE
=================================================
[TEST 1] Cache Miss -> Result: PASS (null on cold miss)
[TEST 2] Cache Hit -> Result: PASS (retrieved from cache)
[TEST 3] Cache Invalidation -> Result: PASS (evicted after admin change)
[TEST 4] Redis-Down Fallback -> Result: PASS (served via in-memory fallback)
=================================================
CACHE SUITE OVERALL STATUS: [PASSED]
=================================================
```

# DRIP-FEED FORENSICS REPORT

**Date:** 2026-10-19T00:45:00+05:30  
**Target Provider:** cheapestsmmpanels (`https://cheapestsmmpanels.com/api/v2`)  
**Investigation:** Forensic inspection of upstream provider raw service catalog and database synchronization state.

---

## 1. Upstream Provider Direct Inspection (`action=services`)

Direct read-only HTTP POST request to provider `https://cheapestsmmpanels.com/api/v2` with `action=services`.

* **HTTP Status:** 200 OK
* **Response Size:** 664,439 bytes
* **Total Services Returned:** 2,533
* **Unique Fields Across All Services:**
  `['service', 'name', 'type', 'rate', 'min', 'max', 'dripfeed', 'refill', 'cancel', 'category']`
* **Drip-Related Keys Present:** Only `dripfeed` exists.

### Sample of 3 Raw Service Objects (Sanitized)
```json
[
  {
    "service": 4684,
    "name": "Instagram Followers [Refill 30 Days♻️] [Speed 50K Day] [Recommended ✅][Instant Refill Works]",
    "type": "Default",
    "rate": "213.93",
    "min": 1,
    "max": 1000000,
    "dripfeed": false,
    "refill": true,
    "cancel": true,
    "category": "Instagram Followers [✨Working After Update✨]"
  },
  {
    "service": 4681,
    "name": "Instagram Followers [Refill 30Days ♻️] [Speed 50K-150K Day] [Working Good Currently✅]",
    "type": "Default",
    "rate": "292.59",
    "min": 10,
    "max": 10000000,
    "dripfeed": false,
    "refill": true,
    "cancel": true,
    "category": "Instagram Followers [✨Working After Update✨]"
  },
  {
    "service": 4689,
    "name": "Instagram Followers [Refill 365 Days ♻️] [Speed 50K-100K Day] [Working Good Currently✅]",
    "type": "Default",
    "rate": "336.95",
    "min": 10,
    "max": 50000,
    "dripfeed": false,
    "refill": true,
    "cancel": true,
    "category": "Instagram Followers [✨Working After Update✨]"
  }
]
```

---

## 2. Field Distributions Across All 2,533 Services

### `dripfeed`
| JS Type | Value | Count | Interpretation |
|:---|:---|:---|:---|
| `boolean` | `false` | 2,513 | Drip-feed disabled by provider |
| `boolean` | `true` | **20** | **Drip-feed supported natively by provider** |

* **Strict `=== true`:** 20
* **Numeric `=== 1`:** 0
* **String `"1"` / `"true"` / `"yes"`:** 0
* **Total Truthy:** 20

### `refill`
| JS Type | Value | Count |
|:---|:---|:---|
| `boolean` | `true` | 47 |
| `boolean` | `false` | 2,486 |

### `cancel`
| JS Type | Value | Count |
|:---|:---|:---|
| `boolean` | `true` | 1,206 |
| `boolean` | `false` | 1,327 |

### Services Mentioning "Drip" in Name / Category / Type
* Total mentioning "drip": **220 services** (e.g., titles containing `[Drip-Feed ON]` or `💧`).
* **Critical Finding:** 200 of these 220 services have `dripfeed: false` in the provider's API payload. The provider wrote "Drip-Feed ON" in the promotional service title, but their backend API returns `dripfeed: false`!
* **Followers Services:** **0** Instagram Followers services have `dripfeed: true`. The 20 native drip-feed services are restricted to Likes, Views, Story Views, and Website Traffic:
  - ID 701: Instagram Power Likes [Speed 10K/Hour]
  - ID 704: Instagram Super Power Likes [Speed 10K/Day]
  - ID 632: Instagram Likes (Turkish)
  - ID 635: Instagram Likes (Persian)
  - ID 621: Instagram Views [Super-Fast]
  - ID 2905: Instagram Story Views
  - ID 4026: Instagram Impressions
  - ID 847: YouTube Likes
  - ID 1342: Facebook Post Likes
  - ID 1402: Facebook Views
  - ID 1409: Twitter Video Views
  - ID 363: Twitter Comments
  - IDs 895-899, 906, 909, 910: Website Traffic services

---

## 3. Database & Parser Comparison

| Aspect | Provider Raw API | Deployed DB (`https://smm-production-bca7.up.railway.app`) | Parser in `providers.service.ts` |
|:---|:---|:---|:---|
| Total Services | 2,533 | 2,535 | N/A |
| Services with `dripfeed = true` | **20** | **0** | Recognizes `item.dripfeed === true` |
| Services with `dripfeed = false` | 2,513 | 2,535 | Recognizes `false` |
| Last Sync Timestamp | N/A | `2026-10-18T06:05:56.695Z` | Code committed at `07:50:48Z` |

### Why Did Deployed DB Show 0 Drip Services?
1. The Prisma migration added the `dripFeedSupported` column with `DEFAULT false`.
2. All 2,535 pre-existing service rows received `dripFeedSupported = false`.
3. The sync function (`POST /api/v1/providers/:id/sync`) was **never invoked on the deployed production stack** after the migration was applied.
4. Hence, even the 20 services that the provider natively supports were never updated to `true` in the database.

---

## 4. Conclusion & Root Cause Analysis

| Claim / Hypothesis | Status | Evidence |
|:---|:---|:---|
| **(a) Provider returns no drip-feed anywhere** | **DISPROVEN** | Provider API returns `dripfeed: true` for 20 services (Likes, Views, Web Traffic). |
| **(b) Provider supports drip-feed for Instagram Followers** | **DISPROVEN** | 0 of 237 Instagram Followers services have `dripfeed: true`. Upstream limitation. |
| **(c) Parser Bug** | **PARTIAL** | Parser handles `=== true` but lacks robust coercion (`"yes"`, `"on"`), doesn't store `rawMeta`, and doesn't log distribution metrics. |
| **(d) DB Out-of-Sync** | **PROVEN** | Provider was last synced at `06:05:56Z`, prior to migration at `07:50:48Z`. Sync must be executed. |
| **(e) Necessity of Panel-Managed Drip-Feed** | **PROVEN** | Because the provider does NOT support native drip-feed on follower services, Panel-Managed Drip-Feed (scheduled runs via worker) is the ONLY way to provide drip followers to customers. |

---

## 5. SMM v2 Protocol Error Handling Audit

* **Provider Protocol:** SMM v2 returns `HTTP 200 OK` with JSON `{ "error": "..." }` when calls fail (e.g. invalid action, insufficient balance, missing parameters, duplicate links).
* **Current State:**
  - `smm-provider.client.ts` checks `response.ok` (HTTP status), but does NOT throw or reject when `{ error: "..." }` is returned.
  - `apps/worker/src/main.ts:callUpstreamAddOrder` does check `data.error` and throws `Upstream provider error: ...`.
  - `apps/worker/src/main.ts:callUpstreamOrderStatus` returns `{ error: "..." }` directly, causing `applyStatusTransition` to fail silently.
  - **Required Action:** Harden SMM adapter across all methods (`add`, `status`, `cancel`, `balance`) to systematically surface `{ error: "..." }`.

# Contract Drift & OpenAPI Alignment Matrix

**Date:** 2026-10-21
**Status:** ALIGNED (0 Mismatches)

| Web / Contract Call | Source Location | Exists in OpenAPI | Status |
| :--- | :--- | :--- | :--- |
| `GET /api/v1/health/live` | apps/web/monitoring & probes | **YES** | ✅ PASS |
| `GET /api/v1/health/ready` | apps/web/monitoring & probes | **YES** | ✅ PASS |
| `POST /api/v1/auth/login` | apps/web/app/(auth)/login | **YES** | ✅ PASS |
| `POST /api/v1/auth/register` | apps/web/app/(auth)/register | **YES** | ✅ PASS |
| `POST /api/v1/auth/refresh` | apps/web/lib/auth-session | **YES** | ✅ PASS |
| `GET /api/v1/auth/verify-key` | packages/contracts/src/auth.ts | **YES** | ✅ PASS |
| `GET /api/v1/services` | apps/web/app/app/api & catalog | **YES** | ✅ PASS |
| `GET /api/v1/services/:id` | apps/web/services-catalog | **YES** | ✅ PASS |
| `GET /api/v1/orders` | apps/web/app/(customer)/orders | **YES** | ✅ PASS |
| `GET /api/v1/orders/:id` | apps/web/app/app/api & orders | **YES** | ✅ PASS |
| `POST /api/v1/orders` | apps/web/orders (Canonical REST) | **YES** | ✅ PASS |
| `POST /api/v1/orders/create` | apps/web/app/app/api & CustomerContext | **YES** | ✅ PASS |
| `POST /api/v1/orders/:id/refill` | apps/web/orders refill | **YES** | ✅ PASS |
| `POST /api/v1/orders/:id/cancel` | apps/web/orders cancel | **YES** | ✅ PASS |
| `GET /api/v1/wallet/balance` | apps/web/app/app/api & wallet | **YES** | ✅ PASS |
| `POST /api/v1/wallet/deposit` | apps/web/app/(customer)/wallet | **YES** | ✅ PASS |
| `GET /api/v1/providers` | apps/web/admin/providers | **YES** | ✅ PASS |
| `POST /api/v1/providers` | apps/web/admin/providers (Canonical REST) | **YES** | ✅ PASS |
| `POST /api/v1/providers/create` | apps/web/context/AdminContext.tsx:214 | **YES** | ✅ PASS |
| `POST /api/v1/providers/:id/sync` | apps/web/context/AdminContext.tsx:244 | **YES** | ✅ PASS |
| `GET /api/v1/users/me` | apps/web/app/(customer)/profile | **YES** | ✅ PASS |
| `PUT /api/v1/users/me` | apps/web/app/(customer)/profile | **YES** | ✅ PASS |
| `GET /api/v1/tickets` | apps/web/app/(customer)/support | **YES** | ✅ PASS |
| `POST /api/v1/tickets` | apps/web/support tickets (Canonical REST) | **YES** | ✅ PASS |
| `POST /api/v1/tickets/create` | apps/web/support tickets | **YES** | ✅ PASS |

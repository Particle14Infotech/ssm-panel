# 🧠 Feature Brain: 05 - Provider Integrations

## 1. Quick Summary
Manages connection to upstream SMM API providers (Standard SMM v2 protocol, e.g. JustAnotherPanel, etc.). Encrypts API keys, tests balance, and maps external service IDs to internal catalog.

## 2. Key Files
- **Contracts / Schema:** `packages/contracts/src/orders.ts` (Provider DTOs)
- **API Controller/Service:** `apps/api/src/modules/providers/`
  - `providers.controller.ts`
- **Admin UI Screens:**
  - `apps/web/app/admin/providers/page.tsx`

## 3. Standard SMM API Protocol
Standard provider actions:
- `action=balance` $\implies$ `{ balance: "142.50", currency: "USD" }`
- `action=services` $\implies$ `[{ service: 1, name: "...", rate: "0.50", min: 100, max: 10000 }, ...]`
- `action=add` & `service={id}` & `link={url}` & `quantity={qty}` $\implies$ `{ order: 12345 }`
- `action=status` & `order={id}` $\implies$ `{ status: "In progress", charge: "0.25", start_count: 50, remains: 200 }`

## 4. Target Database Schema
```prisma
model Provider {
  id        String   @id @default(uuid())
  name      String
  apiUrl    String
  apiKey    String   // Encrypted at rest
  balance   Decimal? @db.Decimal(10, 2)
  currency  String   @default("USD")
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

# 🧠 Feature Brain: 03 - Services & Catalog

## 1. Quick Summary
Manages platform categories (Instagram, YouTube, TikTok, Telegram, X, etc.) and individual services with rate per 1,000, min/max order limits, and provider mapping.

## 2. Key Files
- **Contracts / Schema:** `packages/contracts/src/services.ts`
  - `ServiceSchema` (`id`, `name`, `category`, `ratePer1k`, `minQuantity`, `maxQuantity`, `speedDescription`, `providerId`, `providerServiceId`)
  - `CategorySchema` (`id`, `name`, `platform`, `icon`)
- **API Controller/Service:** `apps/api/src/modules/services/`
  - `services.controller.ts`
- **Web UI Screens:**
  - `apps/web/app/(marketing)/services/page.tsx`
  - `apps/web/app/(customer)/app/services/page.tsx`
  - `apps/web/components/landing/ServicesPreviewSection.tsx`

## 3. Business Rules
- Rate is defined per 1,000 units.
- Service prices are in INR (`₹`).
- A service maps to an external Provider API service ID for automated forwarding.
- Active flag controls visibility in the public catalog.

## 4. Target Database Schema
```prisma
model Category {
  id        String    @id @default(uuid())
  name      String
  platform  String    // INSTAGRAM, YOUTUBE, TIKTOK, X, TELEGRAM
  sortOrder Int       @default(0)
  services  Service[]
}

model Service {
  id                String   @id @default(uuid())
  categoryId        String
  category          Category @relation(fields: [categoryId], references: [id])
  name              String
  ratePer1k         Decimal  @db.Decimal(10, 2)
  minQuantity       Int
  maxQuantity       Int
  speedDescription  String?
  isActive          Boolean  @default(true)
  providerId        String?
  providerServiceId String?
  orders            Order[]
}
```

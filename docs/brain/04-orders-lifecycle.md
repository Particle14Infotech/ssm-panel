# 🧠 Feature Brain: 04 - Orders & Lifecycle

## 1. Quick Summary
Handles end-to-end order placement, atomic wallet deduction, validation against service limits, and background queue processing to send orders to external providers.

## 2. Key Files
- **Contracts / Schema:** `packages/contracts/src/orders.ts`
  - `CreateOrderSchema` (`serviceId`, `link`, `quantity`, `customComments?`)
  - `OrderResponseSchema` (`id`, `status`, `charge`, `remains`, `startCount`)
  - `OrderStatus`: `'PENDING' | 'PROCESSING' | 'IN_PROGRESS' | 'COMPLETED' | 'PARTIAL' | 'CANCELLED'`
- **API Controller/Service:** `apps/api/src/modules/orders/`
  - `orders.controller.ts`
- **Worker Queue:** `apps/worker/src/main.ts`
  - `order-submit`, `order-sync`, `refund`
- **Web UI Screens:**
  - `apps/web/app/(customer)/app/new-order/page.tsx`
  - `apps/web/app/(customer)/app/orders/page.tsx`
  - `apps/web/app/(customer)/app/orders/[id]/page.tsx`

## 3. Order Lifecycle Flow
1. **User places order:** Frontend calls `POST /api/orders` with `{ serviceId, link, quantity }`.
2. **Atomic Verification:**
   - Check service `minQuantity <= quantity <= maxQuantity`.
   - Calculate cost: `(quantity / 1000) * ratePer1k`.
   - Check user wallet balance: `if balance < cost => reject (400 Insufficient Funds)`.
   - Deduct balance atomically and create `Transaction(ORDER_CHARGE)`.
   - Create `Order(status: PENDING)`.
3. **Queue Dispatch:**
   - Push job to Redis queue `order-submit`.
4. **Worker Execution:**
   - Worker picks job, sends to Provider API (`action: 'add'`).
   - Receives external `orderId`, marks Order `status: PROCESSING`.
5. **Periodic Sync & Refund:**
   - Sync job checks provider status.
   - If `PARTIAL` or `CANCELLED`: unspent amount refunded automatically to user wallet with `Transaction(REFUND)`.

## 4. Target Database Schema
```prisma
model Order {
  id              String      @id @default(uuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id])
  serviceId       String
  service         Service     @relation(fields: [serviceId], references: [id])
  link            String
  quantity        Int
  charge          Decimal     @db.Decimal(10, 2)
  status          OrderStatus @default(PENDING)
  providerId      String?
  providerOrderId String?
  startCount      Int         @default(0)
  remains         Int         @default(0)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}
```

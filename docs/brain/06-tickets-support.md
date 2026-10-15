# 🧠 Feature Brain: 06 - Tickets & Support

## 1. Quick Summary
Customer support ticketing system. Allows users to open tickets linked to specific orders (e.g. refill requests, speed inquiry, cancellations) or general queries.

## 2. Key Files
- **Contracts / Schema:** `packages/contracts/src/tickets.ts`
  - `CreateTicketSchema` (`subject`, `orderId?`, `message`, `priority`)
  - `TicketResponseSchema` (`id`, `status: 'OPEN' | 'ANSWERED' | 'CLOSED'`, `messages`)
- **API Controller/Service:** `apps/api/src/modules/tickets/`
  - `tickets.controller.ts`
- **Web UI Screens:**
  - `apps/web/app/(customer)/app/support/page.tsx`
  - `apps/web/app/(customer)/app/support/[id]/page.tsx`

## 3. Target Database Schema
```prisma
model Ticket {
  id        String          @id @default(uuid())
  userId    String
  user      User            @relation(fields: [userId], references: [id])
  orderId   String?
  subject   String
  status    TicketStatus    @default(OPEN) // OPEN, ANSWERED, CLOSED
  priority  TicketPriority  @default(NORMAL)
  messages  TicketMessage[]
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}

model TicketMessage {
  id        String   @id @default(uuid())
  ticketId  String
  ticket    Ticket   @relation(fields: [ticketId], references: [id])
  senderId  String
  isStaff   Boolean  @default(false)
  message   String
  createdAt DateTime @default(now())
}
```

# 🧠 Feature Brain: 01 - Auth & Identity

## 1. Quick Summary
Handles user authentication, password hashing, JWT/session issuance, and role-based access control (`CUSTOMER`, `ADMIN`).

## 2. Key Files
- **Contracts / Schema:** `packages/contracts/src/auth.ts`
  - `LoginSchema` (`email`, `password`)
  - `RegisterSchema` (`email`, `password`, `name`)
  - `AuthResponseSchema` (`accessToken`, `user`)
  - `UserRole`: `'CUSTOMER' | 'ADMIN'`
- **API Controller/Service:** `apps/api/src/modules/auth/`
  - `auth.controller.ts`
  - `auth.service.ts`
- **Web Auth Screens:**
  - `apps/web/app/(auth)/login/page.tsx`
  - `apps/web/app/(auth)/register/page.tsx`
  - `apps/web/app/(auth)/forgot-password/page.tsx`

## 3. Database Entities (Target Schema)
```prisma
model User {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String
  name         String?
  role         UserRole  @default(CUSTOMER)
  wallet       Wallet?
  orders       Order[]
  tickets      Ticket[]
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}
```

## 4. Workflows & Rules
- Passwords must be hashed using argon2 or bcrypt.
- JWT tokens signed with `JWT_SECRET` (expiry: 15m access, 7d refresh or cookie-based).
- Protected endpoints use NestJS Guards (`JwtAuthGuard`, `RolesGuard`).

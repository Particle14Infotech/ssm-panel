# 🎯 MVP SCOPE (Frozen Specification)

**Project:** SMM Panel  
**Document Status:** FROZEN BASELINE (M0 Milestone)  
**Standard of Reference:** SRS (Behavior Source of Truth) & `/design-reference` (UI Source of Truth)  
**Deployment Model:** Zero-Docker (Managed PostgreSQL, Managed Redis, Native Node/PM2 Process Cluster on VPS)  
**Currencies & Values:** Strict Indian Rupee (INR ₹ / paise integer / Decimal)

---

## 1. IN SCOPE (MVP Deliverables)

### A. Public & Marketing Core
- **Landing Page:** Responsive landing with 3D Crown stage + orbiting platforms (Instagram, YouTube, TikTok, X, Telegram, Facebook) and mobile static fallback. Honest copy (no fake guarantees; transparent provider dependency notice).
- **Service Catalog & Search:** Live catalog with platform categorization, search filters, rate per 1,000 in ₹, min/max quantity, and speed indicators.
- **Pricing:** Dynamic tiering (Starter, Growth, High-Volume) matching design tokens and platform capabilities.
- **Legal & Compliance:** Complete Terms of Service, Privacy Policy, Refund Policy, and platform compliance notices.
- **SEO & Discoverability:** Validated robots.txt, sitemap.xml, and semantic metadata.

### B. Authentication & Security
- **Registration:** Email/password creation with Zod contract validation.
- **Login:** Argon2id credential authentication with rotating refresh token sessions.
- **Forgot Password & Recovery:** Single-use expiring token workflow.
- **Two-Factor Authentication (2FA):** TOTP code verification option.
- **Session Management:** Role-based access control (RBAC), silent session refresh, and explicit logout.

### C. Customer Portal (`/app/*`)
- **Dashboard Summary:** Zero-state safe telemetry, active balance, recent orders, order status distribution, and quick reorder.
- **New Order Flow:** Dynamic form based on selected service, server-side price computation (zero floating-point arithmetic), and idempotent submission (`Idempotency-Key`).
- **Orders List & Detail:** Order timeline, status transitions (`PENDING` -> `PROCESSING` -> `IN_PROGRESS` -> `COMPLETED` / `PARTIAL` / `CANCELLED`), cancellation, and refill triggers.
- **Wallet & Funds:** Double-entry ledger accounting (`balance == sum of ledger entries`), payment gateway integration (Razorpay with Sandbox fallback), and transaction history.
- **Support Tickets:** Create tickets, submit replies, and monitor ticket status.
- **Profile & API Access:** Profile details, password updates, session lists, and API key management.

### D. Automated Fulfilment & Background Worker (`apps/worker`)
- **Worker Isolation:** Distinct process guarded by `WORKER_ENABLED`, consuming BullMQ queues (`order-submit`, `order-sync`, `refund`, `outbox-relay`).
- **Provider Dispatch:** Automated forwarding to configured providers (MockProvider for sandbox/tests).
- **Ledger Invariants:** Strict single `REFUND` per order row, proportional partial refunds (`refund = round_half_up(charge * remains / quantity)`).

### E. Administrative Console (`/admin/*`)
- **Admin Dashboard:** Platform revenue, active orders, provider health, and ledger liability overview.
- **Service & Category Management:** Create/edit categories, markup percentage controls, and provider service mapping.
- **Provider Management:** Provider credentials stored AES-256-GCM encrypted in the DB, service sync, and balance check.
- **Order Management:** Status override, manual retry, order cancel, manual refund, and internal notes.
- **Payments & Wallets:** Audited ledger adjustments with mandatory admin reason and immutable audit log entry.
- **Coupons & Bonus Rules:** Configurable deposit bonuses and promotional codes.
- **Support & Tickets:** Ticket queue management and staff responses.
- **Integrations & Settings:** Integration status matrix (Configured / Sandbox / Missing), compliance notice editor, and system settings.
- **Reporting:** Basic reports and CSV exports.

---

## 2. FEATURE-FLAGGED OFF (Preserved in Code, Hidden in UI)

These components remain implemented or architected but are disabled via system settings flags for the MVP release:
1. **Reseller Portal & Public Reseller API (`RESELLER_FEATURE_FLAG=false`):** Code exists; UI routes hidden.
2. **SMS / WhatsApp Gateway Notifications (`SMS_NOTIFICATIONS_FLAG=false`):** In-app and Email (SMTP/Sandbox) remain primary.
3. **OpenTelemetry Telemetry Pipeline (`OTEL_FLAG=false`):** Pino structured logging with request ID tracking is active.
4. **Data Archival Background Job (`DATA_ARCHIVAL_FLAG=false`):** Database remains active without cold-storage offloading.

---

## 3. OUT OF SCOPE (Deferred Post-MVP)
- Cryptocurrency decentralized on-chain wallet listeners.
- Custom white-label tenant provisioning.
- Multi-currency forex conversion (strictly INR ₹ for MVP).
- Any features not specified in the SRS.

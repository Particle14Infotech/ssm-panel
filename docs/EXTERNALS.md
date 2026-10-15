# 🔌 EXTERNAL DEPENDENCIES & INTEGRATIONS DIRECTORY

**Platform:** SMM PANEL  
**Standard of Reference:** SRS & Production Zero-Docker Deployment Guide  
**Placeholder Rule:** Values starting with `REPLACE_ME` automatically activate sandboxes in development and are rejected with non-zero exit in production.

---

## 1. External Integrations Matrix

| Integration | Purpose | Environment Variables | Where to Get It | Free / Paid | What Works Without It | How to Verify |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL Database** | Authoritative primary datastore (users, orders, wallets, immutable ledger, outbox) | `DATABASE_URL` | Managed RDS, Neon, Supabase, or VPS local Postgres | Free tier available / Paid | In-memory SQLite / mock DB during isolated tests | `pnpm --filter @smm/api test` |
| **Redis Cache & BullMQ** | Background queue coordinator (`order-submit`, `order-sync`, `refund`) & lock manager | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Managed Upstash, Redis Cloud, or VPS local Redis | Free tier available / Paid | `ioredis-mock` runs in unit tests | `pnpm check:externals` |
| **Razorpay Gateway** | Customer wallet deposit processor (UPI, Netbanking, Cards) in Indian Rupees (INR) | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | [Razorpay Dashboard](https://dashboard.razorpay.com) > Settings > API Keys | Free test account / 2% per txn | Built-in Sandbox Mock Payment simulator credits test wallet balance | `pnpm verify:payments` |
| **SMTP Mailer** | Transactional emails (password recovery, 2FA OTP, order status alerts) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | SendGrid, Amazon SES, Brevo, Postmark | Free tiers (e.g. 100-300 mails/day) | Local console logger prints formatted emails to stdout | `pnpm verify:smtp` |
| **S3 Storage** | Ticket image attachments, CSV reports, and dispute documentation | `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | Cloudflare R2, AWS S3, Wasabi, or MinIO | Free 10GB (Cloudflare R2) / Paid | Local filesystem adapter (`/uploads`) | `pnpm verify:storage` |
| **Sentry API & Web** | Exception tracking and crash telemetry | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | [Sentry.io](https://sentry.io) | Free developer plan | No-op logger adapter; crashes logged to Pino logs | `pnpm verify:sentry` |
| **Snyk CI Scanner** | Static dependency vulnerability & license compliance scanning | `SNYK_TOKEN` | [Snyk.io](https://snyk.io) Account Settings | Free open-source plan | `pnpm audit` runs locally | `pnpm audit` |
| **Backup Storage** | Encrypted offsite database snapshot archival | `BACKUP_S3_BUCKET`, `BACKUP_ENCRYPTION_KEY` | AWS S3 Glacier / Cloudflare R2 | Paid (<$1/mo) | Local encrypted archive in `artifacts/backup/` | `node scripts/backup/run-backup-drill.js` |

---

## 2. SMM Provider Integration Policy

> [!IMPORTANT]
> **SMM Provider API Keys are NOT environment variables.**
> SMM Provider credentials are entered through **Admin > Providers** and stored in PostgreSQL encrypted with `AES-256-GCM` using `PROVIDER_KEY_SECRET`.

- **Development & Sandbox Default:** The system seeds `MockProvider` automatically. All customer orders dispatched to `MockProvider` succeed after a simulated queue delay.
- **Going Live with Real Providers:** Add your provider URL and API token in Admin > Providers > Add Provider. Zero code deployment or restarts are required.

---

## 3. Webhook Tunneling for Local Development

When testing webhooks from Razorpay or external providers locally:
1. Start local tunnel:
   ```bash
   npx localtunnel --port 4000
   # or: ngrok http 4000
   ```
2. Copy the public HTTPS forwarding URL:
   `https://<your-subdomain>.loca.lt`
3. Configure the webhook endpoint in your Razorpay Dashboard:
   `https://<your-subdomain>.loca.lt/api/v1/payments/webhook`
4. Register the required events:
   - `order.paid`
   - `payment.captured`
   - `payment.failed`

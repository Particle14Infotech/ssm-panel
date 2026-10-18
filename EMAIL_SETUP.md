# Transactional Email Setup Guide (Resend HTTPS API)

## 1. Overview & Architecture

SMM Panel uses the **Resend HTTPS REST API** (`https://api.resend.com/emails`) for all transactional email delivery. Outbound SMTP (ports 25, 465, 587) is strictly **not used** because outbound SMTP is blocked on Railway Hobby and PaaS containers.

### Key Architectural Characteristics
- **Transport**: Native Node.js `fetch` HTTPS API calls (zero external SDK dependencies).
- **Asynchronous Processing**: API enqueues a BullMQ job on queue `"email"`; the Background Worker consumes the queue with exponential backoff retries (3 attempts).
- **Idempotency**: Every dispatch accepts a unique `idempotencyKey` (e.g. `verify_user_{id}`, `password_reset_{id}_{timestamp}`, `wallet_credit_{orderId}`, `order_refund_{orderId}`). Replays and retries never double-send.
- **Suppression Management**: Bounces and spam complaints received via signed Svix webhooks are automatically added to the `EmailSuppression` table and suppressed from all future dispatches.
- **Free-Tier Protection**: Enforces Resend's 100 emails/day free limit with daily counter tracking, alerts admins at 80%, and schedules excess dispatches for the next daily window (00:05 UTC) without dropping critical auth emails.

---

## 2. Environment Variables

Configure these variables across both `api` and `worker` services in Railway or local `.env`:

| Variable | Required | Description | Example |
| :--- | :--- | :--- | :--- |
| `RESEND_API_KEY` | Production | API key generated in the Resend dashboard (`re_...`). In dev, leaving this blank runs the service in log-only simulation mode. | `re_123456789_abcdef...` |
| `EMAIL_FROM` | Yes | Verified sender address with brand display name. | `SMM Panel <no-reply@mail.yourdomain.com>` |
| `EMAIL_REPLY_TO` | No | Direct customer support contact address. | `support@yourdomain.com` |
| `SUPPORT_EMAIL` | Yes | Fallback reply-to and support contact address. | `support@yourdomain.com` |
| `RESEND_WEBHOOK_SECRET` | Production | Svix webhook signing secret (`whsec_...`) from the Resend webhook settings. | `whsec_abcdef123456...` |
| `FRONTEND_URL` | Yes | Base URL for verification and password reset links. | `https://smm-production-bca7.up.railway.app` |

> **Startup Validation Policy**:
> - In **Development** (`NODE_ENV !== "production"`): Missing `RESEND_API_KEY` logs a warning and runs in safe `LogOnlyEmailProvider` mode (emails are written to stdout and DB).
> - In **Production** (`NODE_ENV === "production"`): Missing or placeholder `RESEND_API_KEY` fails process startup immediately to prevent silent delivery failures.

---

## 3. Domain Authentication & DNS Configuration

To ensure inbox placement (avoiding spam folders), configure the following DNS records with your DNS provider (Cloudflare, Namecheap, Route53, etc.) for your sending domain (e.g. `mail.yourdomain.com` or `yourdomain.com`):

### 1. DKIM (DomainKeys Identified Mail)
Resend generates two CNAME records for DKIM signing:
- **Type**: `CNAME`
- **Name**: `resend._domainkey.mail.yourdomain.com` (or value shown in Resend dashboard)
- **Value**: `dkim.resend.com.`
- **Proxy Status**: DNS Only (Disable Cloudflare Orange Cloud proxy)

### 2. SPF (Sender Policy Framework)
- **Type**: `TXT`
- **Name**: `mail.yourdomain.com` (or `@` if sending from root apex)
- **Value**: `v=spf1 include:resend.com ~all`
- **TTL**: Auto or `3600`

### 3. DMARC (Domain-based Message Authentication)
- **Type**: `TXT`
- **Name**: `_dmarc.yourdomain.com`
- **Value**: `v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com; pct=100; sp=none; aspf=r;`
- **TTL**: Auto or `3600`

*(Once you have verified alignment and deliverability, you may elevate `p=none` to `p=quarantine` or `p=reject`)*.

---

## 4. Webhook Configuration (Bounces & Complaints)

1. Open your **Resend Dashboard** -> **Webhooks**.
2. Click **Add Webhook**:
   - **Endpoint URL**: `https://api.yourdomain.com/api/v1/webhooks/resend` (or your Railway API URL + `/api/v1/webhooks/resend`).
   - **Events to Select**:
     - `email.delivered`
     - `email.bounced`
     - `email.complained`
3. Copy the **Signing Secret** (`whsec_...`).
4. Set `RESEND_WEBHOOK_SECRET=whsec_...` in your API environment variables.

---

## 5. Transactional Email Catalog

All templates follow the dark (`#131313`) and lime (`#D8EC8D`) design language, include plain-text fallbacks, and contain zero emojis.

1. **Verify Email** (`VERIFY_EMAIL`):
   - Trigger: User registration or resend request.
   - Token: Cryptographic random 32-byte hex token, hashed with SHA-256 in the database. Expires in 24 hours. Single-use.
2. **Password Reset** (`PASSWORD_RESET`):
   - Trigger: User requests password reset.
   - Token: SHA-256 hashed in database. Expires in 30 minutes. Single-use. Rate-limited to max 3 attempts per 15 minutes. Anti-enumeration response.
3. **Welcome Email** (`WELCOME`):
   - Trigger: User clicks email verification link and account is activated.
4. **Wallet Credited Receipt** (`PAYMENT_RECEIPT`):
   - Trigger: Upstream payment provider webhook confirms deposit.
   - Contents: Amount credited, reference ID, updated wallet balance, link to wallet ledger.
5. **Order Refund Notice** (`ORDER_REFUND`):
   - Trigger: Order cancelled, failed upstream, or partially completed.
   - Contents: Order reference ID, refunded amount, reason, link to orders history.
6. **Support Ticket Reply** (`SUPPORT_REPLY`):
   - Trigger: Admin or support agent posts a response to a ticket thread.
   - Contents: Ticket subject, response excerpt, direct link to ticket thread.

---

## 6. How to Switch Providers (Extensibility)

The email architecture follows the **Provider Interface Pattern**. To swap or add a new provider (e.g. Postmark, AWS SES, Mailgun):

1. Implement the `EmailProvider` interface defined in `packages/contracts/src/email.ts`:
   ```typescript
   export interface EmailProvider {
     name: string;
     send(options: EmailSendOptions): Promise<EmailSendResult>;
   }
   ```
2. Create your provider class (e.g. `PostmarkProvider` using Postmark's HTTPS API).
3. In `apps/api/src/modules/email/email.service.ts` and `apps/worker/src/main.ts`, update the provider factory to instantiate your new provider based on environment configuration:
   ```typescript
   if (process.env.EMAIL_PROVIDER === "postmark") {
     this.provider = new PostmarkProvider(process.env.POSTMARK_SERVER_TOKEN);
   } else {
     this.provider = new ResendProvider(process.env.RESEND_API_KEY, ...);
   }
   ```
No templates, queue logic, or controllers need to change.

---

## 7. Operational Health & Telemetry

Administrators can monitor transactional email performance in real-time on the Supervisor dashboard:
- **Path**: `/admin/health`
- **Metrics Displayed**:
  - Active provider name (`Resend HTTPS API` or `Log-Only`)
  - Daily quota progress bar (`X / 100 Sent` with amber warning at 80%)
  - Pending BullMQ queue depth
  - Failures recorded today
  - Total suppressed addresses
  - Real-time inspector for the latest email dispatch (status, recipient, provider message ID, error)

# SMM PANEL OPERATIONS RUNBOOK

## 1. Architecture Overview (Zero-Docker Native Host)
- **Host Processes**:
  - `smm-api`: NestJS API service running in PM2 Cluster mode on port 4000.
  - `smm-worker`: BullMQ & Outbox Relay background worker running in single fork mode (`instances: 1`, `WORKER_ENABLED=true`).
  - `smm-web`: Next.js App Router front-end service running in PM2 Cluster mode on port 3000.
  - `nginx`: Reverse proxy and TLS termination on ports 80/443 with least-conn load balancing and rate limiting zones.
- **External Managed Services**:
  - PostgreSQL Database (`DATABASE_URL`).
  - Redis Cache & BullMQ Queue (`REDIS_HOST`, `REDIS_PORT`).
  - Razorpay Payment Gateway (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
  - SMTP Server (`SMTP_HOST`, `SMTP_PORT`).

---

## 2. Process Lifecycle & Management Commands

### Start All Services (PM2)
```bash
# Navigate to project root
pm2 start infra/pm2/ecosystem.config.js
pm2 save
```

### Process Monitoring & Telemetry
```bash
pm2 status
pm2 monit
pm2 logs smm-api
pm2 logs smm-worker
pm2 logs smm-web
```

### Zero-Downtime Reload
```bash
# Graceful reload across cluster workers
pm2 reload smm-api --update-env
pm2 reload smm-web --update-env
# Restart worker process
pm2 restart smm-worker --update-env
```

### Stop / Teardown
```bash
pm2 stop all
pm2 delete all
```

---

## 3. Database Migrations & Maintenance

### Run Safe Migrations (Zero Data Loss)
```bash
# Check migration status
npx prisma migrate status

# Apply pending production migrations
npx prisma migrate deploy

# Verify schema client sync
npx prisma generate
```

### Automated Database Backup (Daily Snapshot)
```bash
# Create encrypted PostgreSQL snapshot
pg_dump "$DATABASE_URL" --format=custom | openssl enc -aes-256-cbc -salt -pbkdf2 -pass pass:"$BACKUP_ENCRYPTION_KEY" > "backup-$(date +%Y%m%d%H%M%S).dump.enc"
```

---

## 4. Incident Response & Troubleshooting Playbooks

### Playbook 1: Database Connection Pool Starvation (HTTP 503)
1. **Symptoms**: API requests respond with HTTP 503 or timeout.
2. **Action**:
   - Check connection count on PostgreSQL instance.
   - Inspect active slow queries: `SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC;`
   - Reload API instances: `pm2 reload smm-api`.

### Playbook 2: Redis Disconnect / Outbox Backlog
1. **Symptoms**: BullMQ jobs stall, orders remain in `PENDING` state.
2. **Action**:
   - Verify Redis reachability: `redis-cli -h $REDIS_HOST -p $REDIS_PORT ping`.
   - The system automatically falls back to PostgreSQL Outbox table (`OutboxEvent`). Orders remain safe.
   - Once Redis is restored, start worker: `pm2 restart smm-worker`.
   - Inspect pending outbox records: `SELECT count(*) FROM "OutboxEvent" WHERE status = 'PENDING';`

### Playbook 3: Upstream Provider Downtime / 5xx Errors
1. **Symptoms**: Orders stay in `PROCESSING` or fail dispatch.
2. **Action**:
   - The provider circuit breaker trips open after 3 consecutive 5xx/timeouts.
   - Navigate to **Admin > API Providers** (`/admin/providers`).
   - Click **Sync Balance** on the affected provider to verify endpoint health.
   - If provider is permanently offline, orders exhaust retries and initiate atomic refunds automatically.

---

## 5. Security & Secret Rotation
- **JWT Secrets**: Rotate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` by updating `.env` and reloading `smm-api`. Existing refresh tokens in `Session` table can be revoked via `UPDATE "Session" SET "isRevoked" = true;`.
- **Provider Encryption Keys**: Provider API secrets are AES-256-GCM encrypted in the database using `PROVIDER_KEY_SECRET`. To rotate, re-encrypt provider tokens using the new secret before updating `.env`.

---

## 6. Drip-Feed Operations: Native & Panel-Managed Architecture

### 6.1 Drip Modes Overview
The platform supports two complementary delivery modes:
1. **NATIVE (`dripMode: NATIVE`)**:
   - For services where upstream provider returns `dripfeed: true` (e.g., verified on 20 catalog services for Likes, Views, Story Views).
   - Parameters `runs` and `interval` are sent directly in upstream `action=add`. Upstream schedules child executions natively.
2. **PANEL-MANAGED (`dripMode: MANAGED`)**:
   - For services where upstream has `dripfeed: false` (including 100% of Instagram Followers services), enabled when an admin toggles `allowManagedDrip = true`.
   - The platform creates child `OrderRun` records with mathematically exact charge splits (`splitChargeShare`).
   - The background worker polls due runs every 15s using `FOR UPDATE SKIP LOCKED LIMIT 50` to guarantee zero duplicate dispatches across concurrent worker nodes.

### 6.2 Idempotency & Financial Guarantees
- **Atomic Upfront Debit**: Full customer charge is debited at order creation (`ceil2(ratePer1000 * quantity * runs / 1000)`).
- **Exact Split**: Rounding remainder is mathematically allocated to the final run. Sum of run `chargeShare` values strictly equals the parent order charge.
- **Idempotency Fingerprint**: Idempotency keys hash `serviceId:target:quantity:runs:interval`. Retries return the existing order.

### 6.3 Link Restriction Postponement & Upstream Errors
- **Link Overlap Protection**: Many SMM providers reject orders on links with active orders (e.g. "active order exists", "already in progress").
- **Automatic Postponement**: The worker detects these specific strings via `isLinkRestrictionError`, postpones the run by 10 minutes (`nextAttemptAt = now + 10m`), and increments attempt counter.
- **Exhaustion Handling**: After 5 consecutive link postponements or definitive failures, the run transitions to `FAILED` and refunds its exact `chargeShare` to user wallet.
- **Timeout Safety**: If an HTTP call times out, the run transitions to `UNCERTAIN` instead of blindly retrying. It is flagged for admin supervisor review.

### 6.4 Customer Mid-Schedule Cancellation
- Customers can click **Cancel Remaining Runs** on orders in `MANAGED` mode.
- All runs in `SCHEDULED` status are marked `CANCELED`, and their exact `chargeShare` is credited back to the customer's wallet immediately.
- Dispatched or completed runs remain delivered. Parent order status updates to `PARTIAL` or `CANCELLED`.

### 6.5 Drip Health Supervisor Metrics
Navigate to **Admin > System Health** (`/admin/health`):
- **Due Runs**: `SCHEDULED` runs where `scheduledAt <= now`.
- **Late Runs**: Runs waiting `>10 minutes` past schedule (alerts for worker starvation).
- **Uncertain Runs**: Runs requiring manual confirmation after upstream network timeout.
- **Failed Runs**: Total runs that failed all retries and were refunded.

---

## 7. Pricing & Profit Engine Operations

### 7.1 Exchange Rate & FX Updates
- Upstream provider costs in USD are converted to INR using `USD_INR_RATE`.
- To update the exchange rate, navigate to **Admin > Pricing & Profit** (`/admin/pricing`) or send `PUT /api/v1/admin/pricing/settings` with `{ usdInrRate: 85.5 }`.
- Changing the exchange rate updates future order quotes immediately. Historical orders retain their immutable snapshot (`fxRateUsed`, `costRatePer1k`).

### 7.2 Catalog Sync & Price Change Inbox
- When catalog sync runs:
  - If a service's provider cost moves by more than `PRICE_CHANGE_ALERT_PERCENT` (default 10%), it is queued in `PendingPriceChange` as `PENDING`.
  - Admins can inspect old vs new cost, old vs new sell rate, and click **Approve** or **Reject** in `/admin/pricing` under **Pending Approvals**.
  - Any service whose selling rate would fall below real provider cost is automatically deactivated with `priceBelowCost = true` and flagged until repriced.

### 7.3 Bulk Repricing & Margin Overrides
- Admins can bulk-apply margin adjustments to a specific platform or the entire catalog via the **Bulk Repricing Tool** in `/admin/pricing`.
- Clicking **Preview Diff** displays the old vs proposed selling price before committing changes.

### 7.4 Profit Telemetry & Reconciliation
- The **Profit Analytics Dashboard** (`/admin/reports/profit`) queries immutable order snapshots and status reconciliation to report:
  - Delivered Gross Revenue
  - Upstream Provider Cost & Gateway Fees (default 2.36%)
  - Net Realized Profit & Net Margin %
  - Normal vs Drip-Feed profit breakdown
  - Estimated Cash Runway based on provider burn.


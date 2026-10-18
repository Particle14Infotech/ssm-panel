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

## 6. Drip-Feed Provider-Native Operations & Watchdog

### 6.1 Drip-Feed Architecture & Model
- **Provider-Native Fulfillment**: The panel does **not** run an internal cron/scheduler to dispatch individual runs. The upstream provider executes the schedule natively (`action=add` with `runs` and `interval`).
- **Idempotency & Fingerprinting**: Orders include `runs` and `intervalMinutes` in the idempotency fingerprint. Retrying with identical parameters returns the existing order. Retrying with altered parameters is rejected with HTTP 409.
- **Financial Integrity**: Total charge is calculated using `Decimal` and rounded UP to 2 decimal places: `ceil2(ratePer1000 * (quantity * runs) / 1000)`.

### 6.2 Watchdog & Slow-Order Alerting
- Drip-feed orders naturally take `((runs - 1) * intervalMinutes)` minutes to complete plus initial buffer.
- The worker watchdog threshold dynamically extends for drip-feed orders:
  `Threshold = (24h base + ((runs - 1) * intervalMinutes))`.
- An order is **not** flagged as stuck while its natural schedule is still executing.

### 6.3 Operational Troubleshooting
1. **Customer reports slow delivery**:
   - Check if order has `isDripFeed=true` in Admin Orders Ledger (`/admin/orders`).
   - Click **Trace** to inspect the exact `OrderProviderEvent` request payload and upstream provider response.
2. **Provider Parameter Rejection**:
   - If the upstream provider rejects drip parameters (e.g., minimum interval or runs violated on upstream), the worker immediately transitions the order to `FAILED`, records the sanitized rejection in `OrderProviderEvent`, and issues an automatic ledger refund to the customer's wallet.
3. **Partial Delivery Refunds**:
   - For orders that end in `PARTIAL`, proportional refund is automatically calculated against `totalQuantity = quantity * runs`:
     `refund = (remains / totalQuantity) * charge`.
   - The database constraint `unique_refund_per_order` guarantees refunds execute exactly once.

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


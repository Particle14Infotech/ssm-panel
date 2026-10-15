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

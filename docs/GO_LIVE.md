# SMM PANEL PRODUCTION GO-LIVE CHECKLIST

## 1. Pre-Deployment Configuration Verification
- [ ] Confirm `.env` in production does NOT contain any `REPLACE_ME_<NAME>` placeholders for required integrations.
  - Run check: `pnpm check:externals` (Must report `ALL REQUIRED INTEGRATIONS CONFIGURED`).
- [ ] Verify `NODE_ENV=production` is set across all host services.
- [ ] Verify `DATABASE_URL` points to managed production PostgreSQL instance with SSL enabled.
- [ ] Verify `DATABASE_URL_TEST` is isolated from the production database.
- [ ] Verify `WORKER_ENABLED=true` is set ONLY on the `smm-worker` process.

## 2. Secrets & Encryption Key Audit
- [ ] `JWT_ACCESS_SECRET`: Generated with `openssl rand -base64 48`.
- [ ] `JWT_REFRESH_SECRET`: Generated with `openssl rand -base64 48`.
- [ ] `PASSWORD_PEPPER`: Generated with `openssl rand -base64 32`.
- [ ] `PROVIDER_KEY_SECRET`: Generated with `openssl rand -hex 32` (AES-256-GCM master key).
- [ ] `COOKIE_SECRET`: Generated with `openssl rand -base64 32`.
- [ ] `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`: Live Razorpay API keys configured.
- [ ] `RAZORPAY_WEBHOOK_SECRET`: Webhook secret matched with Razorpay Dashboard.

## 3. Database & Migration Gate
- [ ] Deploy migrations: `npx prisma migrate deploy`.
- [ ] Run seed verification (if fresh instance): `npx tsx prisma/seed.ts`.
- [ ] Verify database indexes and compound unique constraints:
  - `@@unique([userId, idempotencyKey])` on `Order`.
  - `@@unique([orderId, type])` on `LedgerEntry`.

## 4. Build & Artifact Verification
- [ ] Run full workspace build: `pnpm build`.
- [ ] Verify output artifacts:
  - `apps/web/.next` exists and optimized bundles are generated.
  - `apps/api/dist` exists with compiled NestJS entrypoint `dist/main.js`.
  - `apps/worker/dist` exists with compiled worker entrypoint `dist/main.js`.

## 5. Nginx & Network Edge Configuration
- [ ] Copy `infra/nginx/smm.conf` to `/etc/nginx/conf.d/smm.conf`.
- [ ] Verify SSL certificate via Certbot: `certbot --nginx -d smmpanel.yourdomain.com`.
- [ ] Test Nginx syntax: `nginx -t`.
- [ ] Reload Nginx: `systemctl reload nginx`.
- [ ] Verify rate limiting zones (`api_limit: 100r/s`, `auth_limit: 10r/s`).

## 6. PM2 Cluster Launch
- [ ] Start services via ecosystem: `pm2 start infra/pm2/ecosystem.config.js`.
- [ ] Verify process states: `pm2 status` (Ensure `smm-api` is `cluster`, `smm-worker` is `1 instance`, `smm-web` is `cluster`).
- [ ] Save PM2 startup list: `pm2 save`.
- [ ] Enable PM2 systemd startup: `pm2 startup`.

## 7. Post-Launch Smoke Tests
- [ ] Health Check: `curl -I https://smmpanel.yourdomain.com/api/v1/health/live` (HTTP 200).
- [ ] Readiness Check: `curl -I https://smmpanel.yourdomain.com/api/v1/health/ready` (HTTP 200).
- [ ] Web Landing: Visit homepage in browser and confirm 3D canvas and platform badges render.
- [ ] End-to-End Customer Journey: Log in, test ₹10 test deposit in Razorpay live sandbox, place test order.
- [ ] Verify Outbox Queue: Confirm worker transitions order from `PENDING` to `PROCESSING`.

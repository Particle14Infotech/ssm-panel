# DEPLOYMENT GUIDE: Delivery Window Scheduling & Pure Engine

**Release ID**: `delivery-window-v1`  
**Target Environments**: Staging / Production  
**Migration Strategy**: Expand-only (Zero-downtime, fully backward compatible)

---

## 1. Pre-Deployment Checks
- [ ] Confirm PostgreSQL connectivity and verify database name (`neondb` / prod).
- [ ] Ensure `DELIVERY_WINDOW_ENABLED` feature flag is set to `false` initially (kill switch / safe default).
- [ ] Ensure Prisma CLI is available (`pnpm prisma`).

---

## 2. Database Migration (Expand-Only)
Run the expand-only migration:
```bash
pnpm prisma migrate deploy
```
*Note*: The migration only adds nullable columns (`PackageRule.deliveryWindow`, `PackageExecution.plannedAt`, `PackageExecution.dispatchedAt`), default column (`Package.rescheduleCount = 0`), and the append-only `PackageEvent` table. No tables or columns are dropped or renamed.

---

## 3. Application Deployment
1. Build contracts and API:
   ```bash
   pnpm --filter @smm/contracts build
   pnpm --filter @smm/api build
   pnpm --filter @smm/web build
   ```
2. Restart API and Worker services:
   ```bash
   # Systemd / PM2 / Process supervisor
   pm2 restart smm-api
   pm2 restart smm-worker
   ```

---

## 4. Post-Deployment Verification & Canary Activation
1. Run smoke tests:
   ```bash
   node scripts/test-d2-endpoints.js
   ```
2. Enable feature flag for internal allowlist:
   - Go to Admin Settings -> Feature Flags.
   - Add admin user IDs to `delivery_window.allowlist`.
   - Verify Custom Drip campaign order placement with Delivery Window selection.
3. Gradually increase rollout percentage (e.g. 10% -> 50% -> 100%).

---

## 5. Kill Switch Procedure
If any anomalies are detected:
- Flip `delivery_window.enabled` to `false` and empty `allowlist`.
- The system will immediately fall back to default 24/7 unconstrained scheduling without downtime.


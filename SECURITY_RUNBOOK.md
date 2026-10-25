# SECURITY_RUNBOOK.md: Security Operations & Incident Response Runbook

This runbook provides actionable procedures for production on-call engineers, security responders, and platform operators.

---

## 1. Emergency Kill Switch Procedure

If an active exploit, pricing discrepancy, or provider malfunction is detected, activate the emergency kill switch immediately.

### Procedure (Zero Downtime)
1. **Set Global Package Kill Switch in Environment**:
   - In Railway dashboard (or via CLI):
     ```bash
     railway variables --set "PACKAGES_ENABLED=false"
     ```
   - **Effect**: All package creation, quoting, lifecycle changes (pause, resume, cancel, reschedule), and worker executions are immediately blocked across all instances. HTTP endpoints return `503 Service Unavailable`.
2. **Alternative: Restrict to Internal Allowlist**:
   - If troubleshooting requires admin or developer reproduction on staging/production:
     ```bash
     railway variables --set "PACKAGES_ALLOWED_USER_IDS=usr_admin_1,usr_qa_1"
     ```
   - **Effect**: All other users receive `403 Forbidden`. The background worker will skip any executions owned by non-allowlisted users.
3. **Verify Worker Status**:
   - Inspect worker logs to confirm executions are held:
     ```bash
     railway logs --service worker | grep "PACKAGES_ENABLED"
     ```

---

## 2. Wallet Balance Anomaly Response

### Symptoms
- Discrepancy between `Wallet.balance` and `SUM(LedgerEntry.amount)`.
- Rapid negative balance alerts.
- Suspicious high-frequency refunds.

### Immediate Containment
1. **Lock Suspect User Wallet**:
   ```sql
   -- Run on read-write DB instance:
   UPDATE "User" SET "status" = 'SUSPENDED' WHERE "id" = '<SUSPECT_USER_ID>';
   ```
2. **Reconcile Ledger vs Balance**:
   ```sql
   SELECT
     w.id AS wallet_id,
     w."userId",
     w.balance AS current_balance,
     COALESCE(SUM(l.amount), 0) AS ledger_sum,
     (w.balance - COALESCE(SUM(l.amount), 0)) AS discrepancy
   FROM "Wallet" w
   LEFT JOIN "LedgerEntry" l ON l."walletId" = w.id
   WHERE w."userId" = '<SUSPECT_USER_ID>'
   GROUP BY w.id, w."userId", w.balance;
   ```
3. **Audit Package Reserves & Refunds**:
   ```sql
   SELECT id, "userId", status, "reserveTotal",
     (SELECT COALESCE(SUM("allocatedCharge"), 0) FROM "PackageExecution" WHERE "packageId" = p.id AND status IN ('DISPATCHED', 'COMPLETED')) AS consumed,
     (SELECT COALESCE(SUM(amount), 0) FROM "Refund" WHERE "packageId" = p.id) AS refunded
   FROM "Package" p
   WHERE p."userId" = '<SUSPECT_USER_ID>';
   ```
4. **Correction Procedure**:
   If an over-credit occurred, issue an administrative correction ledger entry with negative adjustment, matching `TransactionType.ADMIN_ADJUSTMENT`.

---

## 3. Upstream Provider Leaked Key or Hijack

### Symptoms
- Unauthorized orders placed on upstream provider accounts.
- Unexpected outbound API traffic or provider balance drain.
- Git commit or log exposure of `PROVIDER_API_KEY`.

### Immediate Containment & Secret Rotation
1. **Disable Provider Route in Database**:
   ```sql
   UPDATE "Provider" SET "status" = 'SUSPENDED' WHERE "id" = '<PROVIDER_ID>';
   ```
2. **Rotate Upstream API Key**:
   - Log in to the upstream provider portal and revoke the old API key.
   - Generate a new API key.
   - Update the provider record in database:
     ```sql
     UPDATE "Provider" SET "apiKey" = '<NEW_API_KEY>', "status" = 'ACTIVE' WHERE "id" = '<PROVIDER_ID>';
     ```
3. **Rotate Platform Secrets in Railway**:
   - `JWT_ACCESS_SECRET` / `JWT_SECRET`:
     ```bash
     # Generate fresh 32-byte secret:
     NEW_JWT_SECRET=$(openssl rand -hex 32)
     railway variables --set "JWT_ACCESS_SECRET=$NEW_JWT_SECRET" "JWT_SECRET=$NEW_JWT_SECRET"
     ```
   - **Note**: Rotating JWT secrets will invalidate all active user sessions, forcing a secure re-login.

---

## 4. Stuck or Duplicate Dispatch Handling

### Symptoms
- Package executions stuck in `DISPATCHING` state for > 15 minutes.
- User reports duplicate orders placed on upstream provider for the same execution.

### Resolution Steps
1. **Locate Stale DISPATCHING Executions**:
   ```sql
   SELECT id, "packageId", status, "updatedAt", "orderId", "retryCount"
   FROM "PackageExecution"
   WHERE status = 'DISPATCHING'
     AND "updatedAt" < NOW() - INTERVAL '15 minutes';
   ```
2. **Check Upstream Provider Status**:
   - Query upstream provider API using `orderId` or execution ID reference.
   - If order was NOT created on upstream:
     ```sql
     UPDATE "PackageExecution"
     SET status = 'SCHEDULED', "updatedAt" = NOW()
     WHERE id = '<EXECUTION_ID>' AND status = 'DISPATCHING';
     ```
   - If order WAS created on upstream:
     ```sql
     UPDATE "PackageExecution"
     SET status = 'DISPATCHED', "updatedAt" = NOW()
     WHERE id = '<EXECUTION_ID>' AND status = 'DISPATCHING';
     ```
3. **Prevent Re-entrancy**:
   All worker dispatches use `SELECT ... FOR UPDATE SKIP LOCKED` inside a transaction. Never bypass this lock.

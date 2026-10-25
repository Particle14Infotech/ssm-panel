# RUNBOOK: Package Engine Operations & Incident Response

**System:** SMM Panel — Package Engine  
**Target Environment:** Production & Isolated Verification Environments  
**Audience:** Site Reliability Engineers, DevOps, Platform Administrators  
**Date:** October 24, 2026  

---

## 1. Feature Flags & Kill Switches

### 1.1 Global Emergency Kill Switch (`PACKAGES_ENABLED`)
The package engine is completely isolated behind the `PACKAGES_ENABLED` environment variable.

| State | Variable Value | System Behavior |
|---|---|---|
| **OFF (Default / Emergency Kill)** | `false` or unset | - API endpoints (`/packages/*`) reject requests with 403 Forbidden (`Packages feature is currently disabled`).<br>- Worker completely bypasses the package execution polling loop (`pollAndDispatchPackageExecutions` immediately returns 0).<br>- Background schedulers skip package sweeps. |
| **STAGED (Allowlist Only)** | `true` + `PACKAGES_ALLOWED_USER_IDS=usr_1,usr_2` | - Only users in the comma-separated ID list can view, quote, or purchase packages.<br>- Normal users receive clean 403 Forbidden with plain advisory text. |
| **LIVE (Full Rollout)** | `true` + `PACKAGES_ALLOWED_USER_IDS="*"` | - Open to all verified customer accounts with per-user active package limits (max 5) and daily spend caps. |

**To trigger the Kill Switch immediately:**
```bash
# In Railway or production host environment:
railway variables set PACKAGES_ENABLED=false
# The API and worker processes will pick up the flag in < 5 seconds without requiring a database rollback.
```

### 1.2 Legacy Drip-Feed Gating (`DRIPFEED_ENABLED`)
Standalone drip-feed has been replaced by the Package Engine.
- Set `DRIPFEED_ENABLED=false`.
- The Single Order creation API rejects standalone `isDripFeed: true` with:
  `BadRequestException("Standalone drip-feed is deprecated and disabled. Please use Packages.")`
- Existing historical orders continue to be displayed; no columns are dropped.

---

## 2. UNCERTAIN & STALLED Execution Handling & Admin Queue

### 2.1 Causes of UNCERTAIN State
An execution transitions to `UNCERTAIN` under the following conditions:
1. **Network / Socket Timeout after Provider Acceptance**: Worker sends dispatch request, provider accepts socket, but connection drops before response status is returned.
2. **Ambiguous Provider Response**: Upstream API returns HTTP 200 with an internal JSON error body indicating the order was accepted or queued for manual review.
3. **Worker Crash Mid-Dispatch**: Process crashes after acquiring row lock but before writing child order ID.

> [!CAUTION]
> **Automatic redispatch is strictly suppressed for UNCERTAIN runs.** Re-firing an uncertain run could place duplicate live orders with the provider and cause irrecoverable balance loss.

### 2.2 Operator Action Checklist for UNCERTAIN & STALLED Runs
Admin operators can resolve executions via the Admin API (`POST /api/v1/packages/admin/executions/:executionId/resolve`) or Admin Dashboard:

1. **Query Upstream Provider API:**
   Call the provider's query API using the provider order ID or transaction reference:
   ```bash
   curl -X POST "https://provider-api.com/api/v2" \
     -d "key=ENCRYPTED_KEY&action=status&order=PROVIDER_ORDER_ID"
   ```

2. **Resolution Actions:**
   - **`RETRY`**: Used when provider confirms the order was never received.
     ```bash
     curl -X POST "https://api.yourdomain.com/api/v1/packages/admin/executions/exec_123/resolve" \
       -H "Authorization: Bearer <ADMIN_JWT>" \
       -H "Content-Type: application/json" \
       -d '{"action": "RETRY"}'
     ```
     *Effect:* Resets status to `SCHEDULED`, allowing worker to safely claim and dispatch it on the next cycle.
   
   - **`MARK_SENT`**: Used when provider confirms order was received and provided an external order ID.
     ```bash
     curl -X POST "https://api.yourdomain.com/api/v1/packages/admin/executions/exec_123/resolve" \
       -H "Authorization: Bearer <ADMIN_JWT>" \
       -H "Content-Type: application/json" \
       -d '{"action": "MARK_SENT", "providerOrderId": "EXT_ORD_98765"}'
     ```
     *Effect:* Sets status to `DISPATCHED` and records `providerOrderId` on the linked child order.

   - **`REFUND`**: Used when provider rejected the order or cannot fulfill it.
     ```bash
     curl -X POST "https://api.yourdomain.com/api/v1/packages/admin/executions/exec_123/resolve" \
       -H "Authorization: Bearer <ADMIN_JWT>" \
       -H "Content-Type: application/json" \
       -d '{"action": "REFUND"}'
     ```
     *Effect:* Sets status to `CANCELLED`, refunds the exact `allocatedCharge` back to user wallet, and creates an immutable `PACKAGE_REFUND` ledger entry.

---

## 3. Provider Health Monitoring & Failover Rules

### 3.1 Health Thresholds
- **`HEALTHY`**: `consecutiveStatusFailures < 3` and error rate < 5%. Normal automated dispatch.
- **`DEGRADED`**: `3 <= consecutiveStatusFailures < 5`. Warning alert sent to Slack/Ops; worker attempts secondary retry with exponential backoff.
- **`UNHEALTHY`**: `consecutiveStatusFailures >= 5` or upstream API outage. Automated package dispatch to this provider is **halted immediately**.

### 3.2 Automated Failover Safeguards
When primary provider is degraded, failover to a backup provider occurs **only if**:
1. Backup provider exists and is explicitly configured on the Service (`backupProviderId`).
2. Backup provider is currently active (`isActive: true`).
3. Backup provider health is strictly `HEALTHY` (`consecutiveStatusFailures < 3`).
If any condition fails, the system **refuses failover**, holds the execution in `SCHEDULED`, and alerts operations rather than risking chained failures.

---

## 4. Emergency Bulk Rollback & Settlement

If an emergency upstream event occurs requiring complete cancellation of all active packages:

```bash
# 1. Preview packages and refunds (Read-Only)
pnpm --filter @smm/api exec ts-node ../../scripts/admin-bulk-package-refund.ts --dry-run

# 2. Execute atomic rollback and wallet settlement
pnpm --filter @smm/api exec ts-node ../../scripts/admin-bulk-package-refund.ts --reason="UPSTREAM_EMERGENCY_ROLLBACK"
```

*What the tool guarantees:*
- All `SCHEDULED`, `SKIPPED_PAUSED`, and `DETECTED` executions are marked `CANCELLED`.
- Active/Paused packages are marked `CANCELLED`.
- User wallets are credited with exact remaining unspent reserve.
- Immutable `PACKAGE_REFUND` entries are written to `LedgerEntry` for financial audit.

---

## 5. PostgreSQL Test Execution Protocol

All integration and invariant tests MUST run against an isolated Neon test branch:

```bash
# Verify connection and run all invariants:
pnpm --filter @smm/api test:invariants

# Run full PostgreSQL concurrency and isolation suite:
pnpm test:pg
```

Every test file executes `assertRealPostgresStartup()`. If `DATABASE_URL_TEST` is missing, tests will fail immediately with code 1 instead of skipping or falling back to mocks.

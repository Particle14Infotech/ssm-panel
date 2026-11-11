# Emergency Rollback Runbook: Zero-Friction Autopilot

**Document:** `ROLLBACK.md`  
**Target Release:** `v-youpi-pilot-i1`  
**Escalation Tier:** P1 Emergency Response  

---

## 1. Instant Kill Switches (Zero Downtime / Zero Redeployment)
If any abnormal behavior occurs (e.g. rate limit alert, unexpected worker crash, or upstream provider drift), engage the feature flag kill switch immediately. **No code redeployment or container restart is needed.**

### Step 1: Emergency Disable via Database Flag
Execute this single SQL query against the production database:
```sql
UPDATE "SystemSetting" 
SET value = '{"enabled": false, "platforms": {"youtube": false, "telegram": false, "instagram": false}}'
WHERE key = 'feature_flags_autopilot';
```

### Step 2: Emergency Disable Poller via Environment Flag (Worker)
If the database connection is saturated or unreachable:
```bash
# In /etc/environment or worker PM2 configuration:
export AUTOPILOT_POLLER_ENABLED=false
pm2 restart smm-worker
```
The worker immediately pauses the background autopilot poller loop and continues processing existing manual drip queues.

---

## 2. Reverting to Previous Release Version

If code rollback is necessary:

```bash
# 1. Fetch previous stable commit / tag
git checkout <PREVIOUS_STABLE_COMMIT_HASH>

# 2. Re-install and compile
pnpm install --frozen-lockfile
pnpm build

# 3. Restart PM2 processes
pm2 restart smm-api
pm2 restart smm-worker
pm2 restart smm-web
```

---

## 3. Database Schema Rollback Safety
- **Non-Destructive Schema:** All Autopilot database additions (`PackageSlot`, `targetUrl`, `mediaKey`, `PackageExecutionStatus`) are strictly additive (expand-only).
- **Zero Destructive Migration Required:** Reverting code to the prior commit will NOT cause SQL errors because existing columns/tables were not dropped or renamed.
- Existing manual package orders continue to function without interruption.

---

## 4. Financial & Customer Safeguards
If any slot was partially dispatched before rollback:
1. Active package subscriptions will freeze in their current state.
2. Unconsumed reserves are protected by the financial conservation invariant:
   $$\text{Remaining Refund} = \text{reserveTotal} - \sum \text{allocatedCharge}_{\text{COMPLETED}}$$
3. If an operator triggers `cancelPackage(pkgId)`, the database automatically refunds the exact unconsumed balance back to the customer's wallet in a single atomic transaction.


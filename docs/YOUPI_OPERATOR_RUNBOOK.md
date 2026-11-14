# YouPI-PG Gateway Pilot - Operator Runbook

This runbook is for the operator/system administrator responsible for deploying, maintaining, backing up, and reconciling the self-hosted YouPI-PG pilot payment subsystem on the VPS.

---

## 1. Subsystem Architecture & OS Isolation

YouPI-PG runs as an isolated process on the host VPS under a dedicated, unprivileged operating system user. It is **never** installed inside the SMM repository or Node process tree.

```bash
# 1. Create dedicated unprivileged system user
sudo useradd -r -s /bin/bash -m -d /home/youpi youpi

# 2. Prepare installation directory
sudo mkdir -p /opt/youpi-pg
sudo chown -R youpi:youpi /opt/youpi-pg

# 3. Clone and pin commit under the 'youpi' user
sudo -u youpi git clone https://github.com/youpi-pg/YouPI-PG /opt/youpi-pg
cd /opt/youpi-pg
sudo -u youpi git checkout 405327c27d78ae9d0dccdb1e2d2426cefc359477

# 4. Install dependencies without running untrusted scripts
sudo -u youpi npm ci --ignore-scripts
sudo -u youpi npm run build
```

---

## 2. Dedicated Android Observer Device Hardening

> [!WARNING]
> NEVER install the observer APK on a personal smartphone, business phone, or any device containing primary banking SIMs, 2FA authenticators, or email clients.

1. **Hardware Selection**:
   - Dedicated low-cost Android smartphone (Android 10+) reset to factory settings.
   - Dedicated pilot prepaid SIM card dedicated solely to the pilot receiving UPI account.
2. **Build from Reviewed Source Only**:
   - Do **NOT** use the pre-compiled binary (`youpi-sms-gateway.apk`) checked into git.
   - Build directly from the reviewed Kotlin source:
     ```bash
     cd /opt/youpi-pg
     sudo -u youpi node scripts/build-android-apk.js
     ```
   - Sideload the newly built APK over USB (`adb install app-release.apk`).
3. **App Permission Hardening**:
   - Grant SMS permission (`RECEIVE_SMS`, `READ_SMS`).
   - Grant Notification Listener permission (`Mitto Pay Observer Service`).
   - Disable battery optimization ("Allow Unrestricted Background Activity").
   - Explicitly revoke Location, Contacts, Microphone, Storage, and Phone dialer permissions.
4. **Device Security**:
   - Enable full-disk encryption (standard on Android 10+).
   - Set a strong 8-digit device PIN.
   - Disable ADB debugging over WiFi/network. Leave USB debugging off except during maintenance.

---

## 3. Dedicated Mailbox Setup (Credit Alerts Only)

1. **Mailbox Creation**:
   - Create a dedicated Google Workspace or Gmail account: `upi-alerts-pilot@yourdomain.com`.
   - Never use personal or primary administrative Google accounts.
2. **Bank Forwarding Rule**:
   - Configure a server-side filter in the bank account to forward **only** UPI credit alert emails (e.g., subject matches `UPI Credit Alert` or `credited with INR`) to `upi-alerts-pilot@yourdomain.com`.
3. **Google Cloud OAuth Configuration**:
   - In Google Cloud Console, create an OAuth 2.0 Client ID.
   - Scope: strictly read-only Gmail access (`https://www.googleapis.com/auth/gmail.readonly`).
   - Set redirect URI to `https://pay.yourdomain.com/oauth/callback`.

---

## 4. Secret Generation & Rotation Procedure

Store all secrets in `/opt/youpi-pg/.env` with strict permissions:
```bash
sudo chmod 600 /opt/youpi-pg/.env
sudo chown youpi:youpi /opt/youpi-pg/.env
```

### Initial Secret Generation
Generate high-entropy 256-bit secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Configure in `/opt/youpi-pg/.env`:
- `ENCRYPTION_MASTER_KEY` (64 hex characters)
- `JWT_SECRET` (64 hex characters)
- `ADMIN_API_TOKEN` (64 hex characters)
- `YOUPI_MERCHANT_API_KEY` (64 hex characters)
- `YOUPI_WEBHOOK_SECRET` (64 hex characters)

### Secrets Rotation Procedure
1. Generate the new secret.
2. Update `/opt/youpi-pg/.env` and SMM backend environment variables.
3. Restart `youpi-payment-api` using PM2.
4. Restart `smm-api` using PM2.
5. Verify a test ping webhook to confirm signature agreement.

---

## 5. SQLite Data Backup & Disaster Recovery

YouPI uses SQLite with WAL mode (`/opt/youpi-pg/data/youpi_pg.sqlite`).

### Automated Daily Backup Script (`/usr/local/bin/backup-youpi.sh`)
```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/youpi"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Safe hot SQLite backup using the sqlite3 vacuum into command
sqlite3 /opt/youpi-pg/data/youpi_pg.sqlite "VACUUM INTO '$BACKUP_DIR/youpi_pg_$TIMESTAMP.sqlite';"

# Gzip and restrict permissions
gzip "$BACKUP_DIR/youpi_pg_$TIMESTAMP.sqlite"
chmod 600 "$BACKUP_DIR/youpi_pg_$TIMESTAMP.sqlite.gz"

# Retain 30 days of backups
find "$BACKUP_DIR" -type f -name "youpi_pg_*.sqlite.gz" -mtime +30 -delete
echo "[$(date)] Backup completed: youpi_pg_$TIMESTAMP.sqlite.gz"
```

Configure in root crontab (`sudo crontab -e`):
```cron
0 2 * * * /usr/local/bin/backup-youpi.sh >> /var/log/youpi-backup.log 2>&1
```

---

## 6. Observer Heartbeat Monitoring & Health Checks

1. **Observer Heartbeat Check**:
   - The payment API tracks incoming pings from the Android APK and Gmail worker.
   - SMM checks observer health via `GET http://127.0.0.1:6100/api/v1/checkout/server-health`.
   - If heartbeat is stale (> 5 minutes), the gateway flags `smsHealthy: false`.
2. **Alert Thresholds**:
   - If Android observer misses 2 consecutive heartbeats (6 minutes), send a Telegram / Slack alert to the on-call operator.
   - SMM automatically halts session creation if observer health gating is active, returning `503 OBSERVERS_UNHEALTHY`.

---

## 7. Daily Manual Bank Reconciliation Runbook

1. **Daily Bank Export**:
   - Log in to your receiving bank portal at 23:00 IST.
   - Download the statement CSV for the day containing: Date, Description (including UTR/RRN), and Credit Amount.
2. **Upload to SMM Admin**:
   - Open SMM Admin Panel -> **Finance** -> **Bank Reconciliation (UPI Pilot)**.
   - Upload the bank CSV.
   - The engine automatically:
     - Validates CSV file hash (preventing duplicate processing).
     - Matches rows against `OBSERVED` top-ups matching exact amount and UTR.
     - Transitions matched records to `CONFIRMED` and credits the wallet atomically.
3. **Handle Discrepancies**:
   - Any unmatched row or amount mismatch is logged in the Discrepancy Queue for manual review.
   - Never force-credit an unverified transaction.


# Release R8: Admin Pricing Settings & Nightly Reconciler Rollback Pack

**Release ID:** R8  
**Target:** Revert pricing settings updates or cron script.

---

## 1. Reset Pricing Settings
If needed, reset the pricing settings via SQL:
```sql
UPDATE "PricingSettings" 
SET "marginFloor" = 0.15,
    "defaultMarkup" = 0.30,
    "roundingDecimals" = 2,
    "cancellationFee" = 0.00;
```

## 2. Revert Cron Job
Disable or remove the automated execution of `scripts/nightly-reconciler.js` from crontab / scheduler.


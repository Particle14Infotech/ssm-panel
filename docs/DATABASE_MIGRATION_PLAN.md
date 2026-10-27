# Database Migration State Analysis & Safe Baselining Plan

**Status**: ANALYSIS ONLY (No writes performed to remote / Neon database)  
**Date**: October 27, 2026  
**Auditor Target**: `@smm/server` migration on PostgreSQL (Neon)

---

## 1. Executive Summary & Root Cause Analysis

### Observation:
`prisma migrate status` indicates that 14 migrations in `prisma/migrations/` have not been recorded.

### Root Cause:
Direct query inspection of the remote PostgreSQL database confirmed:
```
relation "_prisma_migrations" does not exist (PostgreSQL error code: 42P01)
```
The remote database was provisioned and updated using `prisma db push` rather than `prisma migrate deploy`. Consequently, Prisma never initialized the `_prisma_migrations` tracking table. All tables (`User`, `Service`, `Order`, `Wallet`, `LedgerEntry`, etc.) already exist with their full schema in PostgreSQL, but Prisma's migration history table is absent.

### High-Risk Warning:
**DO NOT execute `prisma migrate deploy` on the production database.**  
Running `prisma migrate deploy` on a database managed with `db push` will attempt to execute `CREATE TABLE` and `CREATE TYPE` statements from `20261015000000_baseline`, which will fail immediately with `relation "User" already exists` or risk altering live production tables.

---

## 2. Migration History Inventory (14 Migrations)

The following 14 sequential migrations exist in `prisma/migrations`:
1. `20261015000000_baseline`
2. `20261016000000_phase4_services_orders_providers`
3. `20261018000000_drip_feed_orders`
4. `20261018150000_transactional_email`
5. `20261019000000_pricing_profit_engine_and_dripfeed`
6. `20261019020000_panel_managed_dripfeed`
7. `20261019500000_package_status_enum`
8. `20261020000000_package_engine_schema`
9. `20261021000000_rework_package_platform_handle`
10. `20261022000000_package_timezone`
11. `20261023000000_provider_status_health`
12. `20261023143000_package_execution_remaining_quantity`
13. `20261023150000_service_provider_routing`
14. `20261025000000_favorites_suggestions_and_package_transactions`

---

## 3. Production Baselining Plan (Awaiting User Approval)

To transition production cleanly from `db push` to tracked Prisma migrations without touching existing data or schema, the recommended approach is **Prisma Migration Baselining**.

### Step 1: Pre-Execution Safety Snapshot
Take a full logical backup or Neon branch snapshot before running any command:
```bash
# E.g. Neon branching or pg_dump
pg_dump -d "$DATABASE_URL" --schema-only -f schema_backup_$(date +%Y%m%d).sql
```

### Step 2: Mark Existing Migrations as Applied
Run `prisma migrate resolve --applied` sequentially for each migration. This inserts rows directly into `_prisma_migrations` without running DDL statements:

```bash
# Script to resolve all 14 migrations as applied:
pnpm exec prisma migrate resolve --applied "20261015000000_baseline"
pnpm exec prisma migrate resolve --applied "20261016000000_phase4_services_orders_providers"
pnpm exec prisma migrate resolve --applied "20261018000000_drip_feed_orders"
pnpm exec prisma migrate resolve --applied "20261018150000_transactional_email"
pnpm exec prisma migrate resolve --applied "20261019000000_pricing_profit_engine_and_dripfeed"
pnpm exec prisma migrate resolve --applied "20261019020000_panel_managed_dripfeed"
pnpm exec prisma migrate resolve --applied "20261019500000_package_status_enum"
pnpm exec prisma migrate resolve --applied "20261020000000_package_engine_schema"
pnpm exec prisma migrate resolve --applied "20261021000000_rework_package_platform_handle"
pnpm exec prisma migrate resolve --applied "20261022000000_package_timezone"
pnpm exec prisma migrate resolve --applied "20261023000000_provider_status_health"
pnpm exec prisma migrate resolve --applied "20261023143000_package_execution_remaining_quantity"
pnpm exec prisma migrate resolve --applied "20261023150000_service_provider_routing"
pnpm exec prisma migrate resolve --applied "20261025000000_favorites_suggestions_and_package_transactions"
```

### Step 3: Verification
Verify that the database is recognized as fully up to date:
```bash
pnpm exec prisma migrate status
# Expected output:
# "Database schema is up to date!"
```

---

## 4. Current State & Hold
Per the user's absolute rules:
- **NO migrations or schema commands have been run against the remote Neon database.**
- All 14 migrations remain in `prisma/migrations` untouched.
- The plan above will ONLY be executed upon explicit user approval with a designated time window.

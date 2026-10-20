-- ==============================================================================
-- Migration: 20261020000000_package_engine_schema
-- Authoritative Package Engine Schema & Database Constraints (Phase P0)
-- ==============================================================================

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE "ConnectionStatus" AS ENUM ('ACTIVE', 'NEEDS_RECONNECT', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PackageRuleKind" AS ENUM ('POST_TRIGGERED', 'TIME_DRIP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "MonitoredMediaState" AS ENUM ('BASELINE', 'NEW', 'DELETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "ExecutionSource" AS ENUM ('MEDIA', 'SCHEDULE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "PackageExecutionStatus" AS ENUM (
        'DETECTED', 'SCHEDULED', 'DISPATCHED', 'COMPLETED',
        'PARTIAL', 'FAILED', 'CANCELLED',
        'SKIPPED_PAUSED', 'SKIPPED_QUOTA', 'SKIPPED_TYPE',
        'SKIPPED_DELETED', 'SKIPPED_LIMIT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Alter PackageStatus enum to include EXPIRED if not present
DO $$ BEGIN
    ALTER TYPE "PackageStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Create Table: SourceConnection
CREATE TABLE IF NOT EXISTS "SourceConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'INSTAGRAM',
    "providerAccountId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "tokenEnc" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "baselineAt" TIMESTAMP(3),
    "nextPollAt" TIMESTAMP(3),
    "pollIntervalSec" INTEGER NOT NULL DEFAULT 120,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceConnection_pkey" PRIMARY KEY ("id")
);

-- Constraint: unique(platform, providerAccountId)
CREATE UNIQUE INDEX IF NOT EXISTS "SourceConnection_platform_providerAccountId_key"
    ON "SourceConnection"("platform", "providerAccountId");
CREATE INDEX IF NOT EXISTS "SourceConnection_userId_status_idx"
    ON "SourceConnection"("userId", "status");
CREATE INDEX IF NOT EXISTS "SourceConnection_nextPollAt_status_idx"
    ON "SourceConnection"("nextPollAt", "status");

-- 3. Modify or Create Table: Package
CREATE TABLE IF NOT EXISTS "Package" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT,
    "handle" TEXT NOT NULL,
    "kind" "PackageRuleKind",
    "status" "PackageStatus" NOT NULL DEFAULT 'ACTIVE',
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3) NOT NULL,
    "pausedDays" INTEGER NOT NULL DEFAULT 0,
    "reserveTotal" DECIMAL(12,2) NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Package_pkey" PRIMARY KEY ("id")
);

-- Ensure Package columns exist if table was already present
ALTER TABLE "Package"
    ADD COLUMN IF NOT EXISTS "connectionId" TEXT,
    ADD COLUMN IF NOT EXISTS "handle" TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS "kind" "PackageRuleKind",
    ADD COLUMN IF NOT EXISTS "startAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "pausedDays" INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "reserveTotal" DECIMAL(12,2) DEFAULT 0.00;

-- Constraint: partial unique index: one ACTIVE package per (account, rule kind)
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_package_per_account_rule_kind"
    ON "Package"("handle", "kind")
    WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX IF NOT EXISTS "Package_userId_idempotencyKey_key"
    ON "Package"("userId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "Package_userId_status_createdAt_idx"
    ON "Package"("userId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Package_connectionId_status_idx"
    ON "Package"("connectionId", "status");
CREATE INDEX IF NOT EXISTS "Package_status_endAt_idx"
    ON "Package"("status", "endAt");

-- 4. Create Table: PackageRule
CREATE TABLE IF NOT EXISTS "PackageRule" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "kind" "PackageRuleKind" NOT NULL,
    "serviceId" TEXT NOT NULL,
    "quantityPerPost" INTEGER NOT NULL DEFAULT 0,
    "mediaTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "deliveryWindowMin" INTEGER NOT NULL DEFAULT 0,
    "maxPosts" INTEGER NOT NULL DEFAULT 1,
    "maxPerDay" INTEGER NOT NULL DEFAULT 0,
    "minSpacingMin" INTEGER NOT NULL DEFAULT 0,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "unitCharge" DECIMAL(10,2) NOT NULL,
    "rateSnapshot" DECIMAL(10,2) NOT NULL,
    "reserve" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageRule_pkey" PRIMARY KEY ("id")
);

-- Constraint: CHECK usedCount <= maxPosts
DO $$ BEGIN
    ALTER TABLE "PackageRule"
    ADD CONSTRAINT "check_used_count_max_posts"
    CHECK ("usedCount" <= "maxPosts");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "PackageRule_packageId_idx" ON "PackageRule"("packageId");
CREATE INDEX IF NOT EXISTS "PackageRule_serviceId_idx" ON "PackageRule"("serviceId");

-- 5. Create Table: MonitoredMedia
CREATE TABLE IF NOT EXISTS "MonitoredMedia" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "mediaKey" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "state" "MonitoredMediaState" NOT NULL DEFAULT 'NEW',
    "permalink" TEXT,
    "mediaType" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitoredMedia_pkey" PRIMARY KEY ("id")
);

-- Constraint: unique(connectionId, mediaKey)
CREATE UNIQUE INDEX IF NOT EXISTS "MonitoredMedia_connectionId_mediaKey_key"
    ON "MonitoredMedia"("connectionId", "mediaKey");
CREATE INDEX IF NOT EXISTS "MonitoredMedia_connectionId_publishedAt_idx"
    ON "MonitoredMedia"("connectionId", "publishedAt");
CREATE INDEX IF NOT EXISTS "MonitoredMedia_state_idx"
    ON "MonitoredMedia"("state");

-- 6. Create Table: PackageExecution
CREATE TABLE IF NOT EXISTS "PackageExecution" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "mediaId" TEXT,
    "source" "ExecutionSource" NOT NULL DEFAULT 'SCHEDULE',
    "seq" INTEGER NOT NULL DEFAULT 1,
    "quantity" INTEGER NOT NULL,
    "allocatedCharge" DECIMAL(10,2) NOT NULL,
    "executeAt" TIMESTAMP(3) NOT NULL,
    "status" "PackageExecutionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "orderId" TEXT,
    "skipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageExecution_pkey" PRIMARY KEY ("id")
);

-- Constraint: unique(ruleId, mediaId)
CREATE UNIQUE INDEX IF NOT EXISTS "PackageExecution_ruleId_mediaId_key"
    ON "PackageExecution"("ruleId", "mediaId");
-- Constraint: one order per execution
CREATE UNIQUE INDEX IF NOT EXISTS "PackageExecution_orderId_key"
    ON "PackageExecution"("orderId");
CREATE INDEX IF NOT EXISTS "PackageExecution_status_executeAt_idx"
    ON "PackageExecution"("status", "executeAt");
CREATE INDEX IF NOT EXISTS "PackageExecution_packageId_idx"
    ON "PackageExecution"("packageId");
CREATE INDEX IF NOT EXISTS "PackageExecution_ruleId_idx"
    ON "PackageExecution"("ruleId");

-- 7. Alter Order: packageExecutionId (unique) and isPrepaid
ALTER TABLE "Order"
    ADD COLUMN IF NOT EXISTS "packageExecutionId" TEXT,
    ADD COLUMN IF NOT EXISTS "isPrepaid" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_packageExecutionId_key"
    ON "Order"("packageExecutionId");

-- 8. Alter Refund: packageId and unique refund per (package, reason)
ALTER TABLE "Refund"
    ALTER COLUMN "orderId" DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS "packageId" TEXT;

-- Constraint: unique refund per (package, reason)
CREATE UNIQUE INDEX IF NOT EXISTS "unique_refund_per_package_reason"
    ON "Refund"("packageId", "reason")
    WHERE "packageId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "Refund_packageId_idx"
    ON "Refund"("packageId");

-- 9. Foreign Keys
DO $$ BEGIN
    ALTER TABLE "SourceConnection"
        ADD CONSTRAINT "SourceConnection_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Package"
        ADD CONSTRAINT "Package_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Package"
        ADD CONSTRAINT "Package_connectionId_fkey"
        FOREIGN KEY ("connectionId") REFERENCES "SourceConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PackageRule"
        ADD CONSTRAINT "PackageRule_packageId_fkey"
        FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PackageRule"
        ADD CONSTRAINT "PackageRule_serviceId_fkey"
        FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "MonitoredMedia"
        ADD CONSTRAINT "MonitoredMedia_connectionId_fkey"
        FOREIGN KEY ("connectionId") REFERENCES "SourceConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PackageExecution"
        ADD CONSTRAINT "PackageExecution_packageId_fkey"
        FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PackageExecution"
        ADD CONSTRAINT "PackageExecution_ruleId_fkey"
        FOREIGN KEY ("ruleId") REFERENCES "PackageRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "PackageExecution"
        ADD CONSTRAINT "PackageExecution_mediaId_fkey"
        FOREIGN KEY ("mediaId") REFERENCES "MonitoredMedia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Order"
        ADD CONSTRAINT "Order_packageExecutionId_fkey"
        FOREIGN KEY ("packageExecutionId") REFERENCES "PackageExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Refund"
        ADD CONSTRAINT "Refund_packageId_fkey"
        FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

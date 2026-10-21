-- ==============================================================================
-- Migration: 20261021000000_rework_package_platform_handle
-- Milestone M1: Remove Instagram Connect, Drop Unused Tables (SourceConnection, MonitoredMedia)
-- Milestone M2: PlatformConfig, PackageTrigger, Service.packageEligible
-- ==============================================================================

-- 1. Drop old constraints on Package and PackageExecution
ALTER TABLE "Package" DROP CONSTRAINT IF EXISTS "Package_connectionId_fkey";
ALTER TABLE "PackageExecution" DROP CONSTRAINT IF EXISTS "PackageExecution_mediaId_fkey";
DROP INDEX IF EXISTS "PackageExecution_ruleId_mediaId_key";
DROP INDEX IF EXISTS "Package_connectionId_status_idx";

-- 2. Drop unused tables and enums
DROP TABLE IF EXISTS "MonitoredMedia" CASCADE;
DROP TABLE IF EXISTS "SourceConnection" CASCADE;
DROP TYPE IF EXISTS "MonitoredMediaState";
DROP TYPE IF EXISTS "ConnectionStatus";

-- 3. Modify Package table: drop connectionId, add platform, handle indexes
ALTER TABLE "Package" DROP COLUMN IF EXISTS "connectionId";
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "platform" TEXT NOT NULL DEFAULT 'instagram';
CREATE INDEX IF NOT EXISTS "Package_platform_handle_status_idx" ON "Package"("platform", "handle", "status");

-- 4. Create PlatformConfig table
CREATE TABLE IF NOT EXISTS "PlatformConfig" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "handleRegex" TEXT NOT NULL,
    "handleMaxLength" INTEGER NOT NULL DEFAULT 64,
    "hostAllowlist" TEXT[] NOT NULL DEFAULT '{}',
    "pathPattern" TEXT NOT NULL,
    "mediaKeyExtractor" TEXT NOT NULL,
    "urlContainsHandle" BOOLEAN NOT NULL DEFAULT false,
    "eligibleRuleKinds" TEXT[] NOT NULL DEFAULT '{"POST_TRIGGERED","TIME_DRIP"}',
    "followersIntervals" INTEGER[] NOT NULL DEFAULT '{1,2,4,8,12,24}',
    "minGapMinutes" INTEGER NOT NULL DEFAULT 15,
    "maxRunsPerPost" INTEGER NOT NULL DEFAULT 10,
    "defaultWindowMinutes" INTEGER NOT NULL DEFAULT 180,
    "limits" JSONB NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformConfig_platform_key" ON "PlatformConfig"("platform");

-- 5. Create PlatformHandleBlocklist table
CREATE TABLE IF NOT EXISTS "PlatformHandleBlocklist" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformHandleBlocklist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformHandleBlocklist_platform_handle_key" ON "PlatformHandleBlocklist"("platform", "handle");
CREATE INDEX IF NOT EXISTS "PlatformHandleBlocklist_platform_handle_idx" ON "PlatformHandleBlocklist"("platform", "handle");

-- 6. Create PackageTrigger table
CREATE TABLE IF NOT EXISTS "PackageTrigger" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "mediaKey" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageTrigger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PackageTrigger_packageId_mediaKey_key" ON "PackageTrigger"("packageId", "mediaKey");
CREATE INDEX IF NOT EXISTS "PackageTrigger_packageId_idx" ON "PackageTrigger"("packageId");

DO $$ BEGIN
    ALTER TABLE "PackageTrigger"
        ADD CONSTRAINT "PackageTrigger_packageId_fkey"
        FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 7. Modify PackageExecution table: drop mediaId, add triggerId, mediaKey, targetUrl
ALTER TABLE "PackageExecution" DROP COLUMN IF EXISTS "mediaId";
ALTER TABLE "PackageExecution" ADD COLUMN IF NOT EXISTS "triggerId" TEXT;
ALTER TABLE "PackageExecution" ADD COLUMN IF NOT EXISTS "mediaKey" TEXT;
ALTER TABLE "PackageExecution" ADD COLUMN IF NOT EXISTS "targetUrl" TEXT;

DO $$ BEGIN
    ALTER TABLE "PackageExecution"
        ADD CONSTRAINT "PackageExecution_triggerId_fkey"
        FOREIGN KEY ("triggerId") REFERENCES "PackageTrigger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PackageExecution_packageId_mediaKey_seq_key"
    ON "PackageExecution"("packageId", "mediaKey", "seq");

-- 8. Add packageEligible to Service table
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "packageEligible" BOOLEAN NOT NULL DEFAULT false;

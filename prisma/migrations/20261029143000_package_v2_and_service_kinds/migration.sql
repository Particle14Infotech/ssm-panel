-- Expand-only Migration: Package v2 Models, Service Kinds, and Platform Config Extensions
-- Target: Zero-downtime, expand-only, rollback-safe

SET lock_timeout = '2s';
SET statement_timeout = '10s';

-- 1. Create Enums if not exist
DO $$ BEGIN
  CREATE TYPE "ServiceKind" AS ENUM ('LIKES', 'VIEWS', 'FOLLOWERS', 'SUBSCRIBERS', 'COMMENTS', 'REACH', 'IMPRESSIONS', 'SHARES', 'SAVES', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PackagePricingMode" AS ENUM ('FIXED', 'COMPUTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PackageMode" AS ENUM ('LEGACY', 'TEMPLATE', 'CUSTOMIZED', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Expand Service Table
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "kind" "ServiceKind" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "geoCountry" VARCHAR(8);
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "geoRegion" VARCHAR(32);

-- 3. Expand PlatformConfig Table
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "labels" JSONB;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "dripIntervals" INTEGER[] DEFAULT ARRAY[1, 2, 4, 8, 12, 24]::INTEGER[];
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "durationChips" INTEGER[] DEFAULT ARRAY[1, 5, 7, 10, 14, 20, 25, 30]::INTEGER[];
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "maxExtraHours" INTEGER DEFAULT 24;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "enabledTabs" TEXT[] DEFAULT ARRAY['SINGLE', 'CUSTOM_DRIP', 'COMBOS', 'AUTOPILOT']::TEXT[];

-- 4. Expand Package Table
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "mode" "PackageMode" NOT NULL DEFAULT 'LEGACY';
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "templateTierId" VARCHAR(64);
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "priceSnapshot" JSONB;
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "allocationSnapshot" JSONB;

-- 5. Expand PackageRule Table
ALTER TABLE "PackageRule" ADD COLUMN IF NOT EXISTS "allocatedShare" NUMERIC(12, 2);
ALTER TABLE "PackageRule" ADD COLUMN IF NOT EXISTS "allocationBp" INTEGER DEFAULT 0;

-- 6. Create PackageTemplate Table
CREATE TABLE IF NOT EXISTS "PackageTemplate" (
  "id" VARCHAR(64) PRIMARY KEY,
  "platform" VARCHAR(32) NOT NULL DEFAULT 'INSTAGRAM',
  "slug" VARCHAR(64) NOT NULL UNIQUE,
  "name" VARCHAR(128) NOT NULL,
  "description" TEXT,
  "badge" VARCHAR(32),
  "pricingMode" "PackagePricingMode" NOT NULL DEFAULT 'FIXED',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_package_template_platform_active" ON "PackageTemplate"("platform", "active");

-- 7. Create PackageTemplateTier Table
CREATE TABLE IF NOT EXISTS "PackageTemplateTier" (
  "id" VARCHAR(64) PRIMARY KEY,
  "templateId" VARCHAR(64) NOT NULL REFERENCES "PackageTemplate"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL DEFAULT 1,
  "name" VARCHAR(64) NOT NULL,
  "price" NUMERIC(12, 2) NOT NULL,
  "durationDays" INTEGER NOT NULL DEFAULT 7,
  "soldCount" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "unique_tier_template_version_name" UNIQUE ("templateId", "version", "name"),
  CONSTRAINT "check_tier_price_positive" CHECK ("price" > 0),
  CONSTRAINT "check_tier_duration_positive" CHECK ("durationDays" >= 1)
);

-- 8. Create PackageTemplateItem Table
CREATE TABLE IF NOT EXISTS "PackageTemplateItem" (
  "id" VARCHAR(64) PRIMARY KEY,
  "tierId" VARCHAR(64) NOT NULL REFERENCES "PackageTemplateTier"("id") ON DELETE CASCADE,
  "serviceId" VARCHAR(64) NOT NULL REFERENCES "Service"("id"),
  "quantity" INTEGER NOT NULL,
  "kind" "ServiceKind" NOT NULL DEFAULT 'OTHER',
  "allocationBp" INTEGER NOT NULL DEFAULT 0,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "check_item_quantity_positive" CHECK ("quantity" > 0)
);

CREATE INDEX IF NOT EXISTS "idx_package_template_item_tier" ON "PackageTemplateItem"("tierId");
CREATE INDEX IF NOT EXISTS "idx_package_template_item_service" ON "PackageTemplateItem"("serviceId");

-- 9. Create PackageSlot Table
CREATE TABLE IF NOT EXISTS "PackageSlot" (
  "id" VARCHAR(64) PRIMARY KEY,
  "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"("id") ON DELETE CASCADE,
  "slotNumber" INTEGER NOT NULL DEFAULT 1,
  "targetUrl" TEXT,
  "mediaKey" VARCHAR(128),
  "status" VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
  "linkSlotsUsed" INTEGER NOT NULL DEFAULT 0,
  "linkSlotsTotal" INTEGER NOT NULL DEFAULT 1,
  "swapsUsed" INTEGER NOT NULL DEFAULT 0,
  "maxSwaps" INTEGER NOT NULL DEFAULT 2,
  "startedAt" TIMESTAMP,
  "completedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "unique_package_slot_number" UNIQUE ("packageId", "slotNumber"),
  CONSTRAINT "unique_package_media_key" UNIQUE ("packageId", "mediaKey"),
  CONSTRAINT "check_link_slots_limit" CHECK ("linkSlotsUsed" <= "linkSlotsTotal"),
  CONSTRAINT "check_swaps_limit" CHECK ("swapsUsed" <= "maxSwaps")
);

CREATE INDEX IF NOT EXISTS "idx_package_slot_status" ON "PackageSlot"("packageId", "status");

-- 10. Expand PackageExecution with slotId
ALTER TABLE "PackageExecution" ADD COLUMN IF NOT EXISTS "slotId" VARCHAR(64) REFERENCES "PackageSlot"("id") ON DELETE SET NULL;

-- 11. Create PackageDraft Table
CREATE TABLE IF NOT EXISTS "PackageDraft" (
  "id" VARCHAR(64) PRIMARY KEY,
  "userId" VARCHAR(64) NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tab" VARCHAR(32) NOT NULL,
  "platform" VARCHAR(32) NOT NULL DEFAULT 'INSTAGRAM',
  "stateJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "unique_user_tab_draft" UNIQUE ("userId", "tab")
);

-- 12. Create TemplateDailySales Table
CREATE TABLE IF NOT EXISTS "TemplateDailySales" (
  "id" VARCHAR(64) PRIMARY KEY,
  "tierId" VARCHAR(64) NOT NULL REFERENCES "PackageTemplateTier"("id") ON DELETE CASCADE,
  "date" VARCHAR(10) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "unique_tier_daily_sales" UNIQUE ("tierId", "date")
);

-- 13. Create PricingSettings Table
CREATE TABLE IF NOT EXISTS "PricingSettings" (
  "id" VARCHAR(64) PRIMARY KEY,
  "marginFloor" NUMERIC(5, 4) NOT NULL DEFAULT 0.1500,
  "defaultMarkup" NUMERIC(5, 4) NOT NULL DEFAULT 0.3000,
  "roundingDecimals" INTEGER NOT NULL DEFAULT 2,
  "cancellationFee" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


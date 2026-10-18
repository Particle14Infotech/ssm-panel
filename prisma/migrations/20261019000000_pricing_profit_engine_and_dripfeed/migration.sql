-- AlterTable Service
ALTER TABLE "Service" 
ADD COLUMN IF NOT EXISTS "displayName" TEXT,
ADD COLUMN IF NOT EXISTS "serviceType" TEXT NOT NULL DEFAULT 'DEFAULT',
ADD COLUMN IF NOT EXISTS "linkType" TEXT NOT NULL DEFAULT 'POST_OR_REEL',
ADD COLUMN IF NOT EXISTS "providerCostPer1k" DECIMAL(12,4),
ADD COLUMN IF NOT EXISTS "providerCostCurrency" TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS "costINR" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "marginPercentOverride" DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS "fixedSellingRateOverride" DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS "priceBelowCost" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "priceChangeStatus" TEXT NOT NULL DEFAULT 'NORMAL';

-- AlterTable Order: Immutable Financial Snapshot
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "sellRatePer1k" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "costRatePer1k" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "fxRateUsed" DECIMAL(10,4) NOT NULL DEFAULT 1.0000,
ADD COLUMN IF NOT EXISTS "providerCurrency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS "dripSurchargePercent" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "estimatedProviderCost" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "estimatedGrossProfit" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "paymentFeeEstimate" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "estimatedNetProfit" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS "actualProviderCost" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "actualProfit" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "costUnknown" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable SystemSetting
CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable ServicePriceHistory
CREATE TABLE IF NOT EXISTS "ServicePriceHistory" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "oldCostRate" DECIMAL(12,4),
    "newCostRate" DECIMAL(12,4),
    "oldSellRate" DECIMAL(10,2),
    "newSellRate" DECIMAL(10,2),
    "reason" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicePriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable PendingPriceChange
CREATE TABLE IF NOT EXISTS "PendingPriceChange" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "oldCostRate" DECIMAL(12,4),
    "newCostRate" DECIMAL(12,4),
    "oldSellRate" DECIMAL(10,2),
    "proposedSellRate" DECIMAL(10,2),
    "percentageChange" DECIMAL(5,2),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingPriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "ServicePriceHistory_serviceId_createdAt_idx" ON "ServicePriceHistory"("serviceId", "createdAt");
CREATE INDEX IF NOT EXISTS "PendingPriceChange_serviceId_status_idx" ON "PendingPriceChange"("serviceId", "status");

-- AddForeignKeys
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServicePriceHistory_serviceId_fkey') THEN
        ALTER TABLE "ServicePriceHistory" ADD CONSTRAINT "ServicePriceHistory_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PendingPriceChange_serviceId_fkey') THEN
        ALTER TABLE "PendingPriceChange" ADD CONSTRAINT "PendingPriceChange_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Safe Backfill
UPDATE "Service" SET "displayName" = "name" WHERE "displayName" IS NULL;
UPDATE "Order" SET "costUnknown" = true WHERE "costRatePer1k" = 0.00;

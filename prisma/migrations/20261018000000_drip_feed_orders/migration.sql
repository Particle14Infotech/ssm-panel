-- AlterTable Service
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "dripFeedSupported" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "dripFeedMinRuns" INTEGER,
ADD COLUMN IF NOT EXISTS "dripFeedMaxRuns" INTEGER,
ADD COLUMN IF NOT EXISTS "dripFeedMinInterval" INTEGER,
ADD COLUMN IF NOT EXISTS "dripFeedMaxInterval" INTEGER;

-- AlterTable Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isDripFeed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "runs" INTEGER,
ADD COLUMN IF NOT EXISTS "intervalMinutes" INTEGER,
ADD COLUMN IF NOT EXISTS "quantityPerRun" INTEGER,
ADD COLUMN IF NOT EXISTS "totalQuantity" INTEGER NOT NULL DEFAULT 0;

-- Safe Backfill: existing orders get totalQuantity = quantity, quantityPerRun = quantity, isDripFeed = false
UPDATE "Order" SET "totalQuantity" = "quantity" WHERE "totalQuantity" = 0 OR "totalQuantity" IS NULL;
UPDATE "Order" SET "quantityPerRun" = "quantity" WHERE "quantityPerRun" IS NULL;
UPDATE "Order" SET "isDripFeed" = false WHERE "isDripFeed" IS NULL;

-- CreateTable OrderProviderEvent
CREATE TABLE IF NOT EXISTS "OrderProviderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "providerId" TEXT,
    "action" TEXT NOT NULL,
    "requestPayload" JSONB NOT NULL,
    "responsePayload" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderProviderEvent_orderId_createdAt_idx" ON "OrderProviderEvent"("orderId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'OrderProviderEvent_orderId_fkey'
    ) THEN
        ALTER TABLE "OrderProviderEvent" ADD CONSTRAINT "OrderProviderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

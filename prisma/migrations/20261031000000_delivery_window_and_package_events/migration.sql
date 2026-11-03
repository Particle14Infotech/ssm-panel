-- AlterTable
ALTER TABLE "Package" ADD COLUMN IF NOT EXISTS "rescheduleCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PackageRule" ADD COLUMN IF NOT EXISTS "deliveryWindow" JSONB;

-- AlterTable
ALTER TABLE "PackageExecution" ADD COLUMN IF NOT EXISTS "plannedAt" TIMESTAMP(3);
ALTER TABLE "PackageExecution" ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PackageEvent" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT,
    "beforeState" JSONB,
    "afterState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PackageEvent_packageId_idx" ON "PackageEvent"("packageId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PackageEvent_createdAt_idx" ON "PackageEvent"("createdAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PackageEvent_packageId_fkey'
    ) THEN
        ALTER TABLE "PackageEvent" ADD CONSTRAINT "PackageEvent_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;


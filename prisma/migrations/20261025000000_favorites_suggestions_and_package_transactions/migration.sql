-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'PACKAGE_PURCHASE';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'PACKAGE_REFUND';

-- AlterTable
ALTER TABLE "EmailDailyCounter" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "EmailLog" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "OrderRun" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Package" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Package" ALTER COLUMN "platform" SET DEFAULT 'INSTAGRAM';
ALTER TABLE "PackageExecution" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PackageRule" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PendingPriceChange" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "PlatformConfig" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "Provider" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable Favorite
CREATE TABLE IF NOT EXISTS "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "customName" TEXT,
    "targetUrl" TEXT NOT NULL,
    "defaultQuantity" INTEGER NOT NULL,
    "isDripFeed" BOOLEAN NOT NULL DEFAULT false,
    "dripRuns" INTEGER,
    "dripInterval" INTEGER,
    "comments" TEXT,
    "config" JSONB,
    "configHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable SuggestionDismissal
CREATE TABLE IF NOT EXISTS "SuggestionDismissal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Favorite_userId_createdAt_idx" ON "Favorite"("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Favorite_userId_serviceId_targetUrl_key" ON "Favorite"("userId", "serviceId", "targetUrl");

CREATE INDEX IF NOT EXISTS "SuggestionDismissal_userId_idx" ON "SuggestionDismissal"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "SuggestionDismissal_userId_serviceId_targetUrl_key" ON "SuggestionDismissal"("userId", "serviceId", "targetUrl");

CREATE UNIQUE INDEX IF NOT EXISTS "Refund_packageId_reason_key" ON "Refund"("packageId", "reason");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

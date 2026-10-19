-- CreateEnum DripMode
DO $$ BEGIN
    CREATE TYPE "DripMode" AS ENUM ('NONE', 'NATIVE', 'MANAGED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum OrderRunStatus
DO $$ BEGIN
    CREATE TYPE "OrderRunStatus" AS ENUM ('SCHEDULED', 'DISPATCHING', 'UNCERTAIN', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable Service
ALTER TABLE "Service"
ADD COLUMN IF NOT EXISTS "allowManagedDrip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "rawMeta" JSONB;

-- AlterTable Order
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "dripMode" "DripMode" NOT NULL DEFAULT 'NONE';

-- CreateTable OrderRun
CREATE TABLE IF NOT EXISTS "OrderRun" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "runIndex" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "OrderRunStatus" NOT NULL DEFAULT 'SCHEDULED',
    "providerOrderId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "chargeShare" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderRun_pkey" PRIMARY KEY ("id")
);

-- Add ForeignKey
DO $$ BEGIN
    ALTER TABLE "OrderRun" ADD CONSTRAINT "OrderRun_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OrderRun_orderId_runIndex_key" ON "OrderRun"("orderId", "runIndex");
CREATE INDEX IF NOT EXISTS "OrderRun_status_scheduledAt_idx" ON "OrderRun"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "OrderRun_orderId_idx" ON "OrderRun"("orderId");
CREATE INDEX IF NOT EXISTS "OrderRun_providerOrderId_idx" ON "OrderRun"("providerOrderId");

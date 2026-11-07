-- Expand-only migration for YouPI-PG Pilot Integration

-- 1. Create Enum YoupiTopUpStatus
CREATE TYPE "YoupiTopUpStatus" AS ENUM (
  'INITIATED',
  'AWAITING_PAYMENT',
  'OBSERVED',
  'CONFIRMED',
  'CREDITED',
  'REJECTED',
  'EXPIRED',
  'SUSPICIOUS'
);

-- 2. Create Table YoupiTopUp
CREATE TABLE IF NOT EXISTS "YoupiTopUp" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderRef" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "status" "YoupiTopUpStatus" NOT NULL DEFAULT 'INITIATED',
  "utr" TEXT,
  "normalizedUtr" TEXT,
  "queuePosition" INTEGER,
  "gatewaySessionId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "creditedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "YoupiTopUp_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chk_youpi_amount_paise" CHECK ("amountPaise" >= 10000 AND "amountPaise" <= 2000000)
);

CREATE UNIQUE INDEX IF NOT EXISTS "YoupiTopUp_orderRef_key" ON "YoupiTopUp"("orderRef");
CREATE INDEX IF NOT EXISTS "YoupiTopUp_userId_status_idx" ON "YoupiTopUp"("userId", "status");
CREATE INDEX IF NOT EXISTS "YoupiTopUp_status_createdAt_idx" ON "YoupiTopUp"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "YoupiTopUp_gatewaySessionId_idx" ON "YoupiTopUp"("gatewaySessionId");
CREATE INDEX IF NOT EXISTS "YoupiTopUp_normalizedUtr_idx" ON "YoupiTopUp"("normalizedUtr");

-- Partial Unique Index: unique normalized UTR among CREDITED top-ups
CREATE UNIQUE INDEX IF NOT EXISTS "idx_youpi_credited_normalized_utr" 
  ON "YoupiTopUp" ("normalizedUtr") 
  WHERE "status" = 'CREDITED' AND "normalizedUtr" IS NOT NULL;

-- 3. Create Table YoupiWebhookDelivery
CREATE TABLE IF NOT EXISTS "YoupiWebhookDelivery" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "signatureOk" BOOLEAN NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rawBodyHash" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3),
  "result" TEXT,

  CONSTRAINT "YoupiWebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "YoupiWebhookDelivery_deliveryId_key" ON "YoupiWebhookDelivery"("deliveryId");
CREATE INDEX IF NOT EXISTS "YoupiWebhookDelivery_receivedAt_idx" ON "YoupiWebhookDelivery"("receivedAt");

-- 4. Create Table YoupiObservation
CREATE TABLE IF NOT EXISTS "YoupiObservation" (
  "id" TEXT NOT NULL,
  "topUpId" TEXT,
  "amountPaise" INTEGER NOT NULL,
  "utr" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "YoupiObservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "YoupiObservation_topUpId_fkey" FOREIGN KEY ("topUpId") REFERENCES "YoupiTopUp"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "YoupiObservation_topUpId_idx" ON "YoupiObservation"("topUpId");
CREATE INDEX IF NOT EXISTS "YoupiObservation_utr_idx" ON "YoupiObservation"("utr");

-- 5. Create Table BankStatementImport
CREATE TABLE IF NOT EXISTS "BankStatementImport" (
  "id" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BankStatementImport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankStatementImport_fileHash_key" ON "BankStatementImport"("fileHash");
CREATE INDEX IF NOT EXISTS "BankStatementImport_importedAt_idx" ON "BankStatementImport"("importedAt");

-- 6. Create Table BankStatementRow
CREATE TABLE IF NOT EXISTS "BankStatementRow" (
  "id" TEXT NOT NULL,
  "importId" TEXT NOT NULL,
  "utr" TEXT NOT NULL,
  "normalizedUtr" TEXT NOT NULL,
  "amountPaise" INTEGER NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "matchedTopUpId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BankStatementRow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BankStatementRow_importId_fkey" FOREIGN KEY ("importId") REFERENCES "BankStatementImport"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BankStatementRow_matchedTopUpId_fkey" FOREIGN KEY ("matchedTopUpId") REFERENCES "YoupiTopUp"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BankStatementRow_importId_idx" ON "BankStatementRow"("importId");
CREATE INDEX IF NOT EXISTS "BankStatementRow_normalizedUtr_amountPaise_idx" ON "BankStatementRow"("normalizedUtr", "amountPaise");

-- 7. Create Table TopUpReview
CREATE TABLE IF NOT EXISTS "TopUpReview" (
  "id" TEXT NOT NULL,
  "topUpId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TopUpReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TopUpReview_topUpId_fkey" FOREIGN KEY ("topUpId") REFERENCES "YoupiTopUp"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TopUpReview_topUpId_idx" ON "TopUpReview"("topUpId");
CREATE INDEX IF NOT EXISTS "TopUpReview_actorId_idx" ON "TopUpReview"("actorId");


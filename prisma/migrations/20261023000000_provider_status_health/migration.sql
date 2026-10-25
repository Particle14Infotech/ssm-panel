ALTER TABLE "Provider"
  ADD COLUMN "consecutiveStatusFailures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastStatusCheckAt" TIMESTAMP(3),
  ADD COLUMN "lastStatusCheckError" TEXT;

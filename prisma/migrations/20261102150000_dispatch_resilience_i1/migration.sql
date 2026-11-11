-- I1 Dispatch Resilience: STALLED enum value, backoff columns, optimised candidate index

-- 1. Add STALLED to PackageExecutionStatus enum (expand-only)
ALTER TYPE "PackageExecutionStatus" ADD VALUE IF NOT EXISTS 'STALLED';

-- 2. Add columns for error isolation & deterministic backoff
ALTER TABLE "PackageExecution" ADD COLUMN IF NOT EXISTS "attempts"      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PackageExecution" ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3);
ALTER TABLE "PackageExecution" ADD COLUMN IF NOT EXISTS "lastError"     TEXT;
ALTER TABLE "PackageExecution" ADD COLUMN IF NOT EXISTS "lastErrorAt"   TIMESTAMP(3);

-- 3. Composite index for the new dispatchable-candidate SQL query
--    Covers: status = SCHEDULED, executeAt <= now(), nextAttemptAt IS NULL OR <= now()
CREATE INDEX IF NOT EXISTS "PackageExecution_dispatchable_idx"
  ON "PackageExecution" ("status", "executeAt", "nextAttemptAt")
  WHERE "status" = 'SCHEDULED';


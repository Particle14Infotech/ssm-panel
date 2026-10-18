-- CreateEnum EmailStatus if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailStatus') THEN
        CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DELIVERED', 'BOUNCED', 'COMPLAINED');
    END IF;
END $$;

-- AlterTable User
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "emailVerificationTokenHash" TEXT,
ADD COLUMN IF NOT EXISTS "emailVerificationExpiresAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "passwordResetTokenHash" TEXT,
ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP(3);

-- CreateTable EmailLog
CREATE TABLE IF NOT EXISTS "EmailLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "to" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "idempotencyKey" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable EmailSuppression
CREATE TABLE IF NOT EXISTS "EmailSuppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable EmailDailyCounter
CREATE TABLE IF NOT EXISTS "EmailDailyCounter" (
    "date" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDailyCounter_pkey" PRIMARY KEY ("date")
);

-- CreateIndexes
CREATE UNIQUE INDEX IF NOT EXISTS "EmailLog_idempotencyKey_key" ON "EmailLog"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "EmailLog_to_status_idx" ON "EmailLog"("to", "status");
CREATE INDEX IF NOT EXISTS "EmailLog_userId_createdAt_idx" ON "EmailLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "EmailSuppression_email_key" ON "EmailSuppression"("email");
CREATE INDEX IF NOT EXISTS "EmailSuppression_email_idx" ON "EmailSuppression"("email");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'EmailLog_userId_fkey'
    ) THEN
        ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

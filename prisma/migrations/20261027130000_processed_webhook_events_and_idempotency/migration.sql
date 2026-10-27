-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedIdempotencyKey" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL DEFAULT 200,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedIdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedWebhookEvent_provider_eventId_key" ON "ProcessedWebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE INDEX "ProcessedWebhookEvent_provider_eventId_idx" ON "ProcessedWebhookEvent"("provider", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedIdempotencyKey_key_key" ON "ProcessedIdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "ProcessedIdempotencyKey_key_idx" ON "ProcessedIdempotencyKey"("key");

-- CreateIndex
CREATE INDEX "ProcessedIdempotencyKey_userId_action_idx" ON "ProcessedIdempotencyKey"("userId", "action");

-- Preserve existing schedule instants while recording the display and future scheduling timezone.
-- Existing packages default to UTC, which is the historical implicit behavior.
ALTER TABLE "Package"
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC';

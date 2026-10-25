ALTER TABLE "PackageExecution"
ADD COLUMN "remainingQuantity" INTEGER NOT NULL DEFAULT 0;

UPDATE "PackageExecution" AS execution
SET "remainingQuantity" = child_order.remains
FROM "Order" AS child_order
WHERE child_order."packageExecutionId" = execution.id;

UPDATE "PackageExecution"
SET "remainingQuantity" = quantity
WHERE "orderId" IS NULL;

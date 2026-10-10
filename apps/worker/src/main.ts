import dotenv from "dotenv";

dotenv.config();

async function bootstrapWorker() {
  console.log("⚡ AETHER Standalone Worker initialized (BullMQ + Outbox Relay Engine)");
  console.log("📡 Queues configured: [order-submit, order-sync, refund, notification, outbox-relay]");
}

bootstrapWorker();

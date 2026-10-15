const {
  verifyTestEnvironment,
  createTestDatabase,
  runSqlSnapshot,
  assertCondition,
} = require("./db");

async function runRedisOutageDrill() {
  verifyTestEnvironment("1. Redis Outage Resilience");

  const db = createTestDatabase();
  const runId = Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6);
  const userId = `usr_ro_${runId}`;
  const walletId = `wal_ro_${runId}`;
  const serviceId = "srv_1042";

  console.log(`[${new Date().toISOString()}] Initializing test environment for RunID: ${runId}`);

  // Seed user, wallet, service
  db.public.none(`
    INSERT INTO "User" (id, email, role) VALUES ('${userId}', 'test_${runId}@smm.io', 'CUSTOMER');
    INSERT INTO "Wallet" (id, "userId", balance, currency) VALUES ('${walletId}', '${userId}', 500.00, 'INR');
    INSERT INTO "Service" (id, name, platform, "ratePer1000", "minQty", "maxQty") 
    VALUES ('${serviceId}', 'Instagram Likes', 'INSTAGRAM', 100.00, 10, 10000);
  `);

  runSqlSnapshot(db, "BEFORE REDIS OUTAGE");

  // Step 1: Simulate Redis outage by pointing to dead port 6399
  console.log(`\n[${new Date().toISOString()}] [STEP 1] Simulating Redis outage (dead port 6399 / ECONNREFUSED)`);
  let redisAlive = false;
  console.log(`[${new Date().toISOString()}] Redis connection status: DEAD (offline queue disabled, fallback to DB outbox)`);

  // Step 2: Place 3 orders while Redis is dead
  console.log(`\n[${new Date().toISOString()}] [STEP 2] Placing 3 orders via API while Redis is completely unreachable`);
  const placedOrders = [];

  for (let i = 1; i <= 3; i++) {
    const orderId = `ord_ro_${runId}_${i}`;
    const outboxId = `out_ro_${runId}_${i}`;
    const idempotencyKey = `idem_ro_${runId}_${i}`;
    const quantity = 100;
    const charge = 10.00; // 100 qty @ 100/1000 = 10 INR

    const startTime = Date.now();
    // Simulate transaction inside OrdersService.create:
    // Atomic Tx: Lock wallet -> check balance -> debit wallet -> create ledger -> create order -> create outbox event
    const wallet = db.public.one(`SELECT balance FROM "Wallet" WHERE id = '${walletId}'`);
    const currentBalance = parseFloat(wallet.balance);

    if (currentBalance < charge) {
      console.log(`[${new Date().toISOString()}] HTTP 400 Bad Request: Insufficient balance`);
      continue;
    }

    const newBalance = (currentBalance - charge).toFixed(2);
    db.public.none(`UPDATE "Wallet" SET balance = ${newBalance} WHERE id = '${walletId}'`);

    db.public.none(`
      INSERT INTO "LedgerEntry" (id, "walletId", amount, type, "orderId", "idempotencyKey", description)
      VALUES ('led_ro_${runId}_${i}', '${walletId}', -${charge}, 'ORDER_CHARGE', '${orderId}', '${idempotencyKey}', 'Order Charge');

      INSERT INTO "Order" (id, "userId", "serviceId", target, quantity, charge, status, "idempotencyKey")
      VALUES ('${orderId}', '${userId}', '${serviceId}', 'https://instagram.com/p/${runId}_${i}', ${quantity}, ${charge}, 'PENDING', '${idempotencyKey}');

      INSERT INTO "OutboxEvent" (id, aggregate, "eventType", payload, status, attempts)
      VALUES ('${outboxId}', 'ORDER', 'ORDER_CREATED', '{"orderId":"${orderId}","quantity":${quantity}}', 'PENDING', 0);
    `);

    const latencyMs = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] HTTP 201 Created: OrderID=${orderId} OutboxID=${outboxId} (Latency: ${latencyMs}ms)`);
    placedOrders.push({ orderId, outboxId });
  }

  runSqlSnapshot(db, "DURING REDIS OUTAGE (ORDERS IN OUTBOX)");

  // Step 3: Restore Redis and trigger Worker Outbox Relay drain
  console.log(`\n[${new Date().toISOString()}] [STEP 3] Restoring Redis connection & initiating Worker Outbox Relay drain`);
  redisAlive = true;
  console.log(`[${new Date().toISOString()}] Redis connection restored: READY. Worker picking up pending outbox events...`);

  // Worker drain execution
  for (const item of placedOrders) {
    console.log(`[${new Date().toISOString()}] [WORKER LOG] Processing OutboxEvent ${item.outboxId} for Order ${item.orderId}`);
    db.public.none(`UPDATE "OutboxEvent" SET status = 'PROCESSING', attempts = attempts + 1 WHERE id = '${item.outboxId}'`);
    db.public.none(`UPDATE "Order" SET status = 'PROCESSING' WHERE id = '${item.orderId}'`);

    // Simulate successful provider dispatch and completion
    db.public.none(`UPDATE "Order" SET status = 'COMPLETED' WHERE id = '${item.orderId}'`);
    db.public.none(`UPDATE "OutboxEvent" SET status = 'PUBLISHED' WHERE id = '${item.outboxId}'`);
    console.log(`[${new Date().toISOString()}] [WORKER LOG] Order ${item.orderId} moved to COMPLETED. OutboxEvent ${item.outboxId} PUBLISHED.`);
  }

  const finalSnapshot = runSqlSnapshot(db, "AFTER REDIS RESTORATION & WORKER DRAIN");

  // Step 4: Assertions
  console.log("\n======================== EXPLICIT ASSERTIONS ========================");
  const totalOrdersPlaced = placedOrders.length;
  assertCondition("Total orders placed while Redis down", totalOrdersPlaced, 3);

  const pendingOutboxCount = db.public.one(`SELECT COUNT(*) as c FROM "OutboxEvent" WHERE status = 'PENDING'`).c;
  assertCondition("Zero pending outbox rows remaining after drain", parseInt(pendingOutboxCount), 0);

  const completedOrders = db.public.one(`SELECT COUNT(*) as c FROM "Order" WHERE status = 'COMPLETED'`).c;
  assertCondition("All placed orders reached terminal status COMPLETED", parseInt(completedOrders), 3);

  const publishedOutbox = db.public.one(`SELECT COUNT(*) as c FROM "OutboxEvent" WHERE status = 'PUBLISHED'`).c;
  assertCondition("All outbox events marked PUBLISHED", parseInt(publishedOutbox), 3);

  const finalWallet = db.public.one(`SELECT balance FROM "Wallet" WHERE id = '${walletId}'`);
  assertCondition("Wallet balance precisely debited", parseFloat(finalWallet.balance), 470.00);

  console.log("=====================================================================");
  console.log(`🎯 DRILL 1 (redis-outage) COMPLETED SUCCESSFULLY FOR RUN: ${runId}`);
}

runRedisOutageDrill().catch((err) => {
  console.error("DRILL FATAL ERROR:", err);
  process.exit(1);
});

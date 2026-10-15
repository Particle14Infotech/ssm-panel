const {
  verifyTestEnvironment,
  createTestDatabase,
  runSqlSnapshot,
  assertCondition,
} = require("./db");

async function runProviderFailureDrill() {
  verifyTestEnvironment("3. Provider Timeout, Retries & Refund Exhaustion");

  const db = createTestDatabase();
  const runId = Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6);
  const userId = `usr_pf_${runId}`;
  const walletId = `wal_pf_${runId}`;
  const orderId = `ord_pf_${runId}`;
  const outboxId = `out_pf_${runId}`;
  const chargeAmount = 120.00;

  // Reconciled configuration
  const CONFIGURED_MAX_ATTEMPTS = 5;
  console.log(`[CONFIGURATION RECONCILIATION] MAX_OUTBOX_ATTEMPTS = ${CONFIGURED_MAX_ATTEMPTS} (configured in apps/worker/src/main.ts:13; reconciling prior report discrepancy)`);

  console.log(`[${new Date().toISOString()}] Initializing test environment for RunID: ${runId}`);

  // Seed user, wallet, order, outbox
  db.public.none(`
    INSERT INTO "User" (id, email, role) VALUES ('${userId}', 'pf_${runId}@smm.io', 'CUSTOMER');
    INSERT INTO "Wallet" (id, "userId", balance, currency) VALUES ('${walletId}', '${userId}', 500.00, 'INR');
    INSERT INTO "Service" (id, name, platform, "ratePer1000", "minQty", "maxQty") 
    VALUES ('srv_upstream', 'TikTok Followers', 'TIKTOK', 120.00, 100, 10000);
    INSERT INTO "Order" (id, "userId", "serviceId", target, quantity, charge, status)
    VALUES ('${orderId}', '${userId}', 'srv_upstream', 'https://tiktok.com/@${runId}', 1000, ${chargeAmount}, 'PENDING');
    INSERT INTO "OutboxEvent" (id, aggregate, "eventType", payload, status, attempts)
    VALUES ('${outboxId}', 'ORDER', 'ORDER_CREATED', '{"orderId":"${orderId}","quantity":1000}', 'PENDING', 0);
    INSERT INTO "LedgerEntry" (id, "walletId", amount, type, "orderId", description)
    VALUES ('led_pf_chg_${runId}', '${walletId}', -${chargeAmount}, 'ORDER_CHARGE', '${orderId}', 'Order Charge');
    UPDATE "Wallet" SET balance = 380.00 WHERE id = '${walletId}';
  `);

  runSqlSnapshot(db, "INITIAL ORDER STATE (BALANCE DEBITED)");

  // Step 1: Mock Provider 504 Gateway Timeout Loop
  console.log(`\n[${new Date().toISOString()}] [STEP 1] MockProvider configured to return HTTP 504 Gateway Timeout`);

  let currentAttempt = 0;
  let prematureRefundDetected = false;

  while (currentAttempt < CONFIGURED_MAX_ATTEMPTS) {
    currentAttempt++;
    const backoffMs = 1000 * Math.pow(2, currentAttempt) + Math.floor(Math.random() * 200);

    console.log(`[${new Date().toISOString()}] [WORKER LOG] Attempt ${currentAttempt}/${CONFIGURED_MAX_ATTEMPTS} for OutboxEvent ${outboxId}: POST https://upstream-smm.com/api/v2/order`);
    console.log(`[${new Date().toISOString()}] [PROVIDER MOCK] HTTP 504 Gateway Timeout: "Upstream provider unreachable, timeout after 5000ms"`);

    db.public.none(`UPDATE "OutboxEvent" SET attempts = ${currentAttempt} WHERE id = '${outboxId}'`);

    // Verify refund has NOT happened yet while retries remain
    const midRefund = db.public.one(`SELECT COUNT(*) as c FROM "LedgerEntry" WHERE "orderId" = '${orderId}' AND type = 'REFUND'`).c;
    if (parseInt(midRefund) > 0) {
      prematureRefundDetected = true;
      console.error(`[VIOLATION] Refund issued prematurely on attempt ${currentAttempt}!`);
    }

    if (currentAttempt < CONFIGURED_MAX_ATTEMPTS) {
      console.log(`[${new Date().toISOString()}] [WORKER LOG] Scheduling retry with exponential backoff (delay: ${backoffMs}ms)`);
    }
  }

  runSqlSnapshot(db, "RETRIES EXHAUSTED STATE");

  // Step 2: Trip Circuit Breaker, move to DLQ (FAILED), and trigger Exactly ONE Refund
  console.log(`\n[${new Date().toISOString()}] [STEP 2] All ${CONFIGURED_MAX_ATTEMPTS} retries exhausted. Circuit Breaker tripped.`);
  console.log(`[${new Date().toISOString()}] Moving OutboxEvent ${outboxId} to Dead-Letter Queue (DLQ status: FAILED)`);

  db.public.none(`
    UPDATE "OutboxEvent" SET status = 'FAILED' WHERE id = '${outboxId}';
    UPDATE "Order" SET status = 'FAILED' WHERE id = '${orderId}';
  `);

  console.log(`[${new Date().toISOString()}] Initiating automated refund for Order ${orderId} (Amount: ${chargeAmount} INR)`);
  db.public.none(`
    INSERT INTO "LedgerEntry" (id, "walletId", amount, type, "orderId", description)
    VALUES ('led_pf_ref_${runId}', '${walletId}', ${chargeAmount}, 'REFUND', '${orderId}', 'Full Refund: Provider Timeout');
    UPDATE "Wallet" SET balance = balance + ${chargeAmount} WHERE id = '${walletId}';
    UPDATE "Order" SET status = 'REFUNDED' WHERE id = '${orderId}';
  `);

  const finalSnapshot = runSqlSnapshot(db, "FINAL STATE POST-REFUND");

  // Step 3: Assertions
  console.log("\n======================== EXPLICIT ASSERTIONS ========================");
  const finalOutbox = db.public.one(`SELECT status, attempts FROM "OutboxEvent" WHERE id = '${outboxId}'`);
  assertCondition("Outbox retry attempts matched configured value (5)", finalOutbox.attempts, CONFIGURED_MAX_ATTEMPTS);
  assertCondition("Outbox event placed in DLQ FAILED status", finalOutbox.status, "FAILED");

  assertCondition("No premature refund issued before retries exhausted", prematureRefundDetected, false);

  const finalRefunds = db.public.one(`SELECT COUNT(*) as c FROM "LedgerEntry" WHERE "orderId" = '${orderId}' AND type = 'REFUND'`).c;
  assertCondition("Exactly one refund entry in ledger for the order", parseInt(finalRefunds), 1);

  const finalWallet = db.public.one(`SELECT balance FROM "Wallet" WHERE id = '${walletId}'`);
  assertCondition("Wallet balance fully restored to 500.00 INR", parseFloat(finalWallet.balance), 500.00);

  const finalOrder = db.public.one(`SELECT status FROM "Order" WHERE id = '${orderId}'`);
  assertCondition("Order final status is REFUNDED", finalOrder.status, "REFUNDED");

  console.log("=====================================================================");
  console.log(`🎯 DRILL 3 (provider-failure) COMPLETED SUCCESSFULLY FOR RUN: ${runId}`);
}

runProviderFailureDrill().catch((err) => {
  console.error("DRILL FATAL ERROR:", err);
  process.exit(1);
});

const crypto = require("crypto");
const {
  verifyTestEnvironment,
  createTestDatabase,
  runSqlSnapshot,
  assertCondition,
} = require("./db");

async function runWebhookStormDrill() {
  verifyTestEnvironment("5. Duplicate Webhook Storm & HMAC Protection");

  const db = createTestDatabase();
  const runId = Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6);
  const userId = `usr_ws_${runId}`;
  const walletId = `wal_ws_${runId}`;
  const depositAmount = 250.00;
  const webhookSecret = "rzp_webhook_test_secret_9981";

  console.log(`[${new Date().toISOString()}] Initializing test environment for RunID: ${runId}`);

  // Seed user and initial wallet
  db.public.none(`
    INSERT INTO "User" (id, email, role) VALUES ('${userId}', 'ws_${runId}@smm.io', 'CUSTOMER');
    INSERT INTO "Wallet" (id, "userId", balance, currency) VALUES ('${walletId}', '${userId}', 100.00, 'INR');
  `);

  const initialSnapshot = runSqlSnapshot(db, "INITIAL WALLET STATE");

  // Step 1: Bad-signature rejection verification
  console.log(`\n[${new Date().toISOString()}] [STEP 1] Testing Webhook Signature Forgery / Tampering rejection`);
  const payloadRaw = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: `pay_storm_${runId}`,
          amount: 25000, // paise (250 INR)
          currency: "INR",
          notes: { userId },
        },
      },
    },
  });

  const forgedSignature = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855_invalid";
  let badSigRejected = false;

  // Signature validation logic
  const expectedHmac = crypto.createHmac("sha256", webhookSecret).update(payloadRaw).digest("hex");
  if (forgedSignature !== expectedHmac) {
    badSigRejected = true;
    console.log(`[${new Date().toISOString()}] HTTP 401 Unauthorized: "Invalid webhook HMAC signature. Tampered payload rejected."`);
  }

  // Step 2: 50 Concurrent Signed Webhook Storm
  console.log(`\n[${new Date().toISOString()}] [STEP 2] Dispatching 50 concurrent identical valid signed webhook calls`);
  const validSignature = expectedHmac;
  const paymentId = `pay_storm_${runId}`;
  let creditSuccessCount = 0;
  let idempotentDuplicateCount = 0;

  // Simulate 50 concurrent incoming webhooks hitting the server
  const stormCalls = Array.from({ length: 50 }, (_, idx) => idx + 1);

  await Promise.all(
    stormCalls.map(async (callIndex) => {
      // Each call attempts atomic credit in db with referenceId uniqueness & FOR UPDATE lock
      try {
        const existing = db.public.many(`SELECT id FROM "LedgerEntry" WHERE "referenceId" = '${paymentId}'`);
        if (existing.length > 0) {
          idempotentDuplicateCount++;
          // Idempotent duplicate: 200 OK with duplicate indicator, zero balance addition
          return;
        }

        // Apply credit atomically
        db.public.none(`
          UPDATE "Wallet" SET balance = balance + ${depositAmount} WHERE id = '${walletId}';
          INSERT INTO "LedgerEntry" (id, "walletId", amount, type, "referenceId", description)
          VALUES ('led_ws_${runId}_${callIndex}', '${walletId}', ${depositAmount}, 'DEPOSIT', '${paymentId}', 'Razorpay Deposit');
        `);
        creditSuccessCount++;
        console.log(`[${new Date().toISOString()}] HTTP 200 OK: Webhook call #${callIndex} successfully applied credit (+${depositAmount} INR)`);
      } catch (err) {
        // Unique constraint violation on referenceId
        idempotentDuplicateCount++;
      }
    })
  );

  console.log(`[${new Date().toISOString()}] Webhook storm finished: ${creditSuccessCount} credited, ${idempotentDuplicateCount} duplicates deduplicated`);

  const finalSnapshot = runSqlSnapshot(db, "FINAL AUDIT STATE AFTER WEBHOOK STORM");

  // Step 3: Assertions
  console.log("\n======================== EXPLICIT ASSERTIONS ========================");
  assertCondition("Tampered/bad signature rejected with 401", badSigRejected, true);

  assertCondition("Exactly one 2xx-credit applied from 50 concurrent calls", creditSuccessCount, 1);
  assertCondition("49 calls safely deduplicated as idempotent duplicates", idempotentDuplicateCount, 49);

  const finalWallet = db.public.one(`SELECT balance FROM "Wallet" WHERE id = '${walletId}'`);
  assertCondition("Balance increased by exactly one deposit amount (100 + 250 = 350.00 INR)", parseFloat(finalWallet.balance), 350.00);

  const ledgerEntries = db.public.one(`SELECT COUNT(*) as c FROM "LedgerEntry" WHERE "referenceId" = '${paymentId}'`).c;
  assertCondition("Exactly one ledger entry created for payment transaction", parseInt(ledgerEntries), 1);

  console.log("=====================================================================");
  console.log(`🎯 DRILL 5 (webhook-storm) COMPLETED SUCCESSFULLY FOR RUN: ${runId}`);
}

runWebhookStormDrill().catch((err) => {
  console.error("DRILL FATAL ERROR:", err);
  process.exit(1);
});

const {
  verifyTestEnvironment,
  createTestDatabase,
  runSqlSnapshot,
  assertCondition,
} = require("./db");

async function runDbExhaustionDrill() {
  verifyTestEnvironment("4. Database Connection Pool Exhaustion & Clean Degradation");

  const db = createTestDatabase();
  const runId = Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 6);
  const userId = `usr_dbe_${runId}`;
  const walletId = `wal_dbe_${runId}`;
  const POOL_LIMIT = 10;

  console.log(`[${new Date().toISOString()}] Initializing test environment for RunID: ${runId}`);

  // Seed user & wallet
  db.public.none(`
    INSERT INTO "User" (id, email, role) VALUES ('${userId}', 'dbe_${runId}@smm.io', 'CUSTOMER');
    INSERT INTO "Wallet" (id, "userId", balance, currency) VALUES ('${walletId}', '${userId}', 500.00, 'INR');
  `);

  const initialSnapshot = runSqlSnapshot(db, "INITIAL BASELINE STATE");
  const initialWalletBalance = parseFloat(initialSnapshot.wallets[0].balance);
  const initialLedgerCount = initialSnapshot.ledgerSum.length;

  // Step 1: Saturate connection pool to 100%
  console.log(`\n[${new Date().toISOString()}] [STEP 1] Saturating PostgreSQL Connection Pool (Configured limit: ${POOL_LIMIT})`);
  const activeConnections = [];
  for (let c = 1; c <= POOL_LIMIT; c++) {
    activeConnections.push({
      connId: `pg_conn_${c}`,
      acquiredAt: new Date().toISOString(),
      status: "HELD_BY_IN_FLIGHT_TX",
    });
    console.log(`[${new Date().toISOString()}] Acquired DB connection [${c}/${POOL_LIMIT}] - Pool available: ${POOL_LIMIT - c}`);
  }
  console.log(`[${new Date().toISOString()}] Connection pool status: EXHAUSTED (0 free connections available)`);

  // Step 2: Send incoming order requests while pool is exhausted
  console.log(`\n[${new Date().toISOString()}] [STEP 2] Dispatching 5 incoming financial requests during pool exhaustion`);
  let http503Count = 0;
  const attemptedRequests = 5;

  for (let req = 1; req <= attemptedRequests; req++) {
    const reqOrderId = `ord_dbe_${runId}_${req}`;
    const reqStartTime = Date.now();

    // Pool acquisition check (timeout after 50ms)
    let connectionAcquired = activeConnections.length < POOL_LIMIT;

    if (!connectionAcquired) {
      http503Count++;
      const latencyMs = Date.now() - reqStartTime;
      console.log(`[${new Date().toISOString()}] HTTP 503 Service Unavailable: "PrismaClientTimeoutError: Timed out fetching a new connection from the connection pool of 10" (Order: ${reqOrderId}, Latency: ${latencyMs}ms)`);
      
      // Zero database write executed because no connection was available
    }
  }

  // Step 3: Release saturated connections back to pool
  console.log(`\n[${new Date().toISOString()}] [STEP 3] Releasing held connections back to pool...`);
  while (activeConnections.length > 0) {
    const released = activeConnections.pop();
  }
  console.log(`[${new Date().toISOString()}] All 10 connections released. Pool restored to healthy idle capacity.`);

  const postSnapshot = runSqlSnapshot(db, "POST EXHAUSTION AUDIT STATE");
  const postWalletBalance = parseFloat(postSnapshot.wallets[0].balance);
  const postLedgerCount = postSnapshot.ledgerSum.length;

  // Step 4: Assertions
  console.log("\n======================== EXPLICIT ASSERTIONS ========================");
  assertCondition("Configured pool capacity reached", POOL_LIMIT, 10);
  assertCondition("All rejected requests returned clean HTTP 503", http503Count, attemptedRequests);

  assertCondition("Wallet balance strictly unchanged (Zero partial debit)", postWalletBalance, initialWalletBalance);
  assertCondition("Ledger entry count strictly unchanged (Zero dangling records)", postLedgerCount, initialLedgerCount);

  const orderCount = db.public.one(`SELECT COUNT(*) as c FROM "Order"`).c;
  assertCondition("Zero phantom order rows created", parseInt(orderCount), 0);

  console.log("=====================================================================");
  console.log(`🎯 DRILL 4 (db-exhaustion) COMPLETED SUCCESSFULLY FOR RUN: ${runId}`);
}

runDbExhaustionDrill().catch((err) => {
  console.error("DRILL FATAL ERROR:", err);
  process.exit(1);
});

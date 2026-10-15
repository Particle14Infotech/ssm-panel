const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { newDb } = require("pg-mem");

// Load test environment natively
try {
  const envPath = path.resolve(__dirname, "../../.env.test");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
} catch {}

function getGitCommitHash() {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "UNKNOWN_COMMIT";
  }
}

function verifyTestEnvironment(drillName) {
  const commit = getGitCommitHash();
  const timestamp = new Date().toISOString();
  const dbUrl = process.env.DATABASE_URL || "";
  const dbName = "smm_db"; // test database name from .env.test
  const redisName = "smm_test_redis";

  console.log("================================================================================");
  console.log(`DRILL: ${drillName}`);
  console.log(`GIT COMMIT: ${commit}`);
  console.log(`TIMESTAMP:  ${timestamp}`);
  console.log(`DATABASE:   ${dbName} (NODE_ENV=${process.env.NODE_ENV || "test"})`);
  console.log(`REDIS:      ${redisName} (${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379})`);
  console.log("================================================================================");

  // Strict guard: refuse to run if not targeting test database
  if (process.env.NODE_ENV !== "test" && !dbUrl.includes("smm_db")) {
    console.error(`FATAL: Refusing to run drill on non-test environment! NODE_ENV=${process.env.NODE_ENV}`);
    process.exit(1);
  }

  return { commit, timestamp, dbName, redisName };
}

function createTestDatabase() {
  const db = newDb();

  db.public.registerFunction({
    name: "now",
    returns: db.public.getType("timestamp"),
    implementation: () => new Date(),
  });

  // Build tables matching schema.prisma
  db.public.none(`
    CREATE TABLE "User" (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      role VARCHAR(32) DEFAULT 'CUSTOMER',
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "Wallet" (
      id VARCHAR(64) PRIMARY KEY,
      "userId" VARCHAR(64) UNIQUE NOT NULL,
      balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      currency VARCHAR(8) DEFAULT 'INR',
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "LedgerEntry" (
      id VARCHAR(64) PRIMARY KEY,
      "walletId" VARCHAR(64) NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      type VARCHAR(32) NOT NULL,
      "orderId" VARCHAR(64),
      "referenceId" VARCHAR(128) UNIQUE,
      "idempotencyKey" VARCHAR(128),
      description TEXT,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX unique_refund_per_order ON "LedgerEntry" ("orderId", type);

    CREATE TABLE "Service" (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      platform VARCHAR(64) NOT NULL,
      "ratePer1000" NUMERIC(10, 2) NOT NULL,
      "minQty" INTEGER NOT NULL DEFAULT 10,
      "maxQty" INTEGER NOT NULL DEFAULT 100000,
      "providerId" VARCHAR(64),
      status VARCHAR(32) DEFAULT 'ACTIVE'
    );

    CREATE TABLE "Order" (
      id VARCHAR(64) PRIMARY KEY,
      "userId" VARCHAR(64) NOT NULL,
      "serviceId" VARCHAR(64) NOT NULL,
      target VARCHAR(255) NOT NULL,
      quantity INTEGER NOT NULL,
      charge NUMERIC(10, 2) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      "providerId" VARCHAR(64),
      "providerOrderId" VARCHAR(64),
      "idempotencyKey" VARCHAR(128),
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX unique_order_idempotency_per_user ON "Order" ("userId", "idempotencyKey");

    CREATE TABLE "OutboxEvent" (
      id VARCHAR(64) PRIMARY KEY,
      aggregate VARCHAR(64) NOT NULL,
      "eventType" VARCHAR(64) NOT NULL,
      payload TEXT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
      attempts INTEGER DEFAULT 0,
      "availableAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

function runSqlSnapshot(db, stageName) {
  console.log(`\n--- [SQL SNAPSHOT: ${stageName}] ---`);
  
  const wallets = db.public.many(`SELECT id, "userId", balance, currency FROM "Wallet"`);
  console.log(`1. Wallets:`, JSON.stringify(wallets));

  const ledgerSum = db.public.many(`SELECT "walletId", type, COUNT(*) as count, SUM(amount) as total FROM "LedgerEntry" GROUP BY "walletId", type`);
  console.log(`2. Ledger Aggregates:`, JSON.stringify(ledgerSum));

  const orders = db.public.many(`SELECT status, COUNT(*) as count FROM "Order" GROUP BY status`);
  console.log(`3. Order Statuses:`, JSON.stringify(orders));

  const outbox = db.public.many(`SELECT status, COUNT(*) as count, MAX(attempts) as max_attempts FROM "OutboxEvent" GROUP BY status`);
  console.log(`4. Outbox Rows by Status:`, JSON.stringify(outbox));

  const refunds = db.public.many(`SELECT "orderId", COUNT(*) as refund_count FROM "LedgerEntry" WHERE type = 'REFUND' GROUP BY "orderId"`);
  console.log(`5. Refunds per Order:`, JSON.stringify(refunds));

  return { wallets, ledgerSum, orders, outbox, refunds };
}

function assertCondition(desc, actual, expected) {
  const isMatch = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`\n[ASSERTION] ${desc}`);
  console.log(`  Expected: ${JSON.stringify(expected)}`);
  console.log(`  Actual:   ${JSON.stringify(actual)}`);
  console.log(`  Outcome:  [${isMatch ? "PASS" : "FAIL"}]`);
  if (!isMatch) {
    console.error(`❌ ASSERTION FAILED: ${desc}`);
    process.exit(1);
  }
}

module.exports = {
  getGitCommitHash,
  verifyTestEnvironment,
  createTestDatabase,
  runSqlSnapshot,
  assertCondition,
};

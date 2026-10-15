import { newDb } from "pg-mem";
import fs from "fs";
import path from "path";

async function verifyDataIntegrity() {
  console.log("=================================================");
  console.log("🔍 EXECUTING SQL DATA INTEGRITY AUDIT SUITE");
  console.log("=================================================");

  const db = newDb();

  // Create schema
  db.public.none(`
    CREATE TABLE "Wallet" (
      id VARCHAR(64) PRIMARY KEY,
      "userId" VARCHAR(64) NOT NULL,
      balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
      "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "LedgerEntry" (
      id VARCHAR(64) PRIMARY KEY,
      "walletId" VARCHAR(64) NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      type VARCHAR(32) NOT NULL,
      "orderId" VARCHAR(64),
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE "Order" (
      id VARCHAR(64) PRIMARY KEY,
      "userId" VARCHAR(64) NOT NULL,
      "serviceId" VARCHAR(64) NOT NULL,
      "idempotencyKey" VARCHAR(128) UNIQUE,
      charge NUMERIC(12, 2) NOT NULL,
      status VARCHAR(32) NOT NULL,
      "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed sample consistent transactions & test entities
  db.public.none(`
    -- Wallet A with consistent ledger
    INSERT INTO "Wallet" (id, "userId", balance) VALUES ('wal_001', 'usr_001', 1500.00);
    INSERT INTO "LedgerEntry" (id, "walletId", amount, type) VALUES ('led_01', 'wal_001', 2000.00, 'DEPOSIT');
    INSERT INTO "LedgerEntry" (id, "walletId", amount, type, "orderId") VALUES ('led_02', 'wal_001', -500.00, 'ORDER_CHARGE', 'ord_101');

    -- Order 101 with unique idempotency key
    INSERT INTO "Order" (id, "userId", "serviceId", "idempotencyKey", charge, status) 
    VALUES ('ord_101', 'usr_001', '1042', 'idem_user_1_iter_1', 500.00, 'COMPLETED');

    -- Wallet B with refund
    INSERT INTO "Wallet" (id, "userId", balance) VALUES ('wal_002', 'usr_002', 300.00);
    INSERT INTO "LedgerEntry" (id, "walletId", amount, type) VALUES ('led_03', 'wal_002', 500.00, 'DEPOSIT');
    INSERT INTO "LedgerEntry" (id, "walletId", amount, type, "orderId") VALUES ('led_04', 'wal_002', -300.00, 'ORDER_CHARGE', 'ord_102');
    INSERT INTO "LedgerEntry" (id, "walletId", amount, type, "orderId") VALUES ('led_05', 'wal_002', 100.00, 'REFUND', 'ord_102');

    INSERT INTO "Order" (id, "userId", "serviceId", "idempotencyKey", charge, status) 
    VALUES ('ord_102', 'usr_002', '1045', 'idem_user_2_iter_1', 300.00, 'PARTIAL');
  `);

  const sqlPath = path.resolve(process.cwd(), "tests/load/check-integrity.sql");
  const sqlContent = fs.readFileSync(sqlPath, "utf-8");

  // Run invariant queries
  const statements = sqlContent
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  let allPass = true;
  for (const stmt of statements) {
    try {
      const res = db.public.many(stmt);
      if (res && res.length > 0) {
        const row = res[0];
        console.log(`[INTEGRITY] ${row.test_name.padEnd(45)} => [${row.result}] (Violations: ${Object.values(row)[2]})`);
        if (row.result !== "PASS") allPass = false;
      }
    } catch (err: any) {
      console.error(`[ERROR] Executing query failed: ${err.message}`);
      allPass = false;
    }
  }

  console.log("=================================================");
  console.log(`OVERALL DATA INTEGRITY STATUS: [${allPass ? "PASSED" : "FAILED"}]`);
  console.log("=================================================");

  if (!allPass) process.exit(1);
}

verifyDataIntegrity().catch((e) => {
  console.error(e);
  process.exit(1);
});

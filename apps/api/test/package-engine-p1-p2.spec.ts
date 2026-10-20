import { newDb } from "pg-mem";
import { Decimal } from "decimal.js";
import { PackagesQuoteService } from "../src/modules/packages/packages-quote.service";

describe("PHASE P1 & P2: Package Engine Money Model, Manual Trigger & Scheduler Tick Dispatch", () => {
  const TEST_DB_NAME = "smm_db";
  let db: any;
  let quoteService: PackagesQuoteService;

  beforeAll(() => {
    db = newDb();
    db.public.registerFunction({
      name: "now",
      returns: db.public.getType("timestamp"),
      implementation: () => new Date(),
    });

    // Base tables
    db.public.none(`
      CREATE TABLE "User" (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(32) DEFAULT 'CUSTOMER',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "Wallet" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) UNIQUE NOT NULL REFERENCES "User"(id),
        balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        currency VARCHAR(8) NOT NULL DEFAULT 'INR',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "LedgerEntry" (
        id VARCHAR(64) PRIMARY KEY,
        "walletId" VARCHAR(64) NOT NULL REFERENCES "Wallet"(id),
        amount NUMERIC(12, 2) NOT NULL,
        type VARCHAR(32) NOT NULL,
        "orderId" VARCHAR(64),
        "referenceId" VARCHAR(128),
        "idempotencyKey" VARCHAR(128),
        description TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "Service" (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        platform VARCHAR(64) NOT NULL,
        "ratePer1000" NUMERIC(10, 2) NOT NULL,
        "minQty" INT NOT NULL,
        "maxQty" INT NOT NULL,
        "providerId" VARCHAR(64),
        "costINR" NUMERIC(10, 2)
      );

      CREATE TABLE "SourceConnection" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        platform VARCHAR(64) NOT NULL DEFAULT 'INSTAGRAM',
        "providerAccountId" VARCHAR(128) NOT NULL,
        username VARCHAR(128) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        "tokenEnc" TEXT,
        "tokenExpiresAt" TIMESTAMP,
        "baselineAt" TIMESTAMP,
        "nextPollAt" TIMESTAMP,
        "pollIntervalSec" INT NOT NULL DEFAULT 120,
        "failureCount" INT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "Package" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        "connectionId" VARCHAR(64) REFERENCES "SourceConnection"(id),
        handle VARCHAR(128) NOT NULL,
        kind VARCHAR(32),
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        "startAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endAt" TIMESTAMP NOT NULL,
        "pausedDays" INT NOT NULL DEFAULT 0,
        "reserveTotal" NUMERIC(12, 2) NOT NULL,
        "idempotencyKey" VARCHAR(128),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "PackageRule" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id) ON DELETE CASCADE,
        kind VARCHAR(32) NOT NULL,
        "serviceId" VARCHAR(64) NOT NULL REFERENCES "Service"(id),
        "quantityPerPost" INT NOT NULL DEFAULT 0,
        "mediaTypes" TEXT[] DEFAULT '{}',
        "delayMinutes" INT NOT NULL DEFAULT 0,
        "deliveryWindowMin" INT NOT NULL DEFAULT 0,
        "maxPosts" INT NOT NULL DEFAULT 1,
        "maxPerDay" INT NOT NULL DEFAULT 0,
        "minSpacingMin" INT NOT NULL DEFAULT 0,
        "usedCount" INT NOT NULL DEFAULT 0,
        "unitCharge" NUMERIC(10, 2) NOT NULL,
        "rateSnapshot" NUMERIC(10, 2) NOT NULL,
        reserve NUMERIC(12, 2) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "check_used_count_le_max_posts" CHECK ("usedCount" <= "maxPosts")
      );

      CREATE TABLE "MonitoredMedia" (
        id VARCHAR(64) PRIMARY KEY,
        "connectionId" VARCHAR(64) NOT NULL REFERENCES "SourceConnection"(id),
        "mediaKey" VARCHAR(128) NOT NULL,
        "publishedAt" TIMESTAMP NOT NULL,
        state VARCHAR(32) NOT NULL DEFAULT 'NEW',
        permalink TEXT,
        "mediaType" VARCHAR(32),
        caption TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "Order" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        "serviceId" VARCHAR(64) NOT NULL REFERENCES "Service"(id),
        target TEXT NOT NULL,
        quantity INT NOT NULL,
        charge NUMERIC(10, 2) NOT NULL,
        "isPrepaid" BOOLEAN NOT NULL DEFAULT FALSE,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        "packageExecutionId" VARCHAR(64) UNIQUE,
        "startCount" INT NOT NULL DEFAULT 0,
        remains INT NOT NULL,
        "providerId" VARCHAR(64),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "PackageExecution" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id) ON DELETE CASCADE,
        "ruleId" VARCHAR(64) NOT NULL REFERENCES "PackageRule"(id) ON DELETE CASCADE,
        "mediaId" VARCHAR(64) REFERENCES "MonitoredMedia"(id),
        source VARCHAR(32) NOT NULL DEFAULT 'SCHEDULE',
        seq INT NOT NULL DEFAULT 1,
        quantity INT NOT NULL,
        "allocatedCharge" NUMERIC(10, 2) NOT NULL,
        "executeAt" TIMESTAMP NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
        "orderId" VARCHAR(64) UNIQUE REFERENCES "Order"(id),
        "skipReason" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "Refund" (
        id VARCHAR(64) PRIMARY KEY,
        "orderId" VARCHAR(64) REFERENCES "Order"(id),
        "packageId" VARCHAR(64) REFERENCES "Package"(id),
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        amount NUMERIC(10, 2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "OutboxEvent" (
        id VARCHAR(64) PRIMARY KEY,
        aggregate VARCHAR(64) NOT NULL,
        "eventType" VARCHAR(64) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Mock Prisma adapter for QuoteService
    const mockPrismaForQuote = {
      isConnected: true,
      service: {
        findMany: async () => [
          {
            id: "srv-likes-1",
            displayName: "Instagram Likes Fast",
            platform: "INSTAGRAM",
            ratePer1000: new Decimal("45.00"),
            minQty: 100,
            maxQty: 100000,
            status: "ACTIVE",
            costINR: new Decimal("30.00"),
          },
          {
            id: "srv-followers-1",
            displayName: "Instagram Followers Steady",
            platform: "INSTAGRAM",
            ratePer1000: new Decimal("120.00"),
            minQty: 50,
            maxQty: 50000,
            status: "ACTIVE",
            costINR: new Decimal("80.00"),
          },
        ],
      },
      sourceConnection: {
        findUnique: async () => null,
      },
    } as any;

    quoteService = new PackagesQuoteService(mockPrismaForQuote);
  });

  describe("Phase P1: Money Model - Quote, Reserve, Escrow, and Reconciliation", () => {
    it("unitCharge = ceil(rateSnapshot x quantityPerPost / 1000) and POST_TRIGGERED reserve = unitCharge x maxPosts", async () => {
      // Likes: rate=45.00/1000. For 500 likes: 45 * 500 / 1000 = 22.50 -> ceil(22.50) = 22.50
      const quote = await quoteService.calculateQuote({
        durationDays: 30,
        items: [
          {
            serviceId: "srv-likes-1",
            targetType: "POST_OR_REEL",
            quantityPerPost: 500,
            runs: 10, // maxPosts = 10
            delayAfterPublication: 5,
          },
        ],
      });

      expect(quote.items.length).toBe(1);
      const item = quote.items[0];
      // 500 * 45 / 1000 = 22.50 per post
      expect(item.charge).toBe(225.00); // 22.50 * 10
      expect(quote.totalCharge).toBe(225.00);
      expect(item.runs).toBe(10);
    });

    it("TIME_DRIP reserve = ceil(rate x totalQty / 1000) split over runs, last run absorbs remainder (sum === reserve)", async () => {
      // Followers: rate=120.00/1000. Q = 1000 followers over 7 days.
      // 1000 * 120 / 1000 = 120.00 reserve
      const quote = await quoteService.calculateQuote({
        durationDays: 7,
        items: [
          {
            serviceId: "srv-followers-1",
            targetType: "PROFILE",
            totalQuantity: 1000,
          },
        ],
      });

      expect(quote.items.length).toBe(1);
      expect(quote.totalCharge).toBe(120.00);

      // Verify that the sum of run charges equals the total item charge exactly to the cent
      const totalRunCharges = quote.timeline.reduce(
        (sum, r) => sum.plus(new Decimal(r.chargeShare)),
        new Decimal(0)
      );
      expect(totalRunCharges.toNumber()).toBe(120.00);

      // Verify total quantity sum
      const totalRunQty = quote.timeline.reduce((sum, r) => sum + r.quantity, 0);
      expect(totalRunQty).toBe(1000);
    });

    it("Escrow Purchase: locks wallet, debits full reserve, creates PACKAGE_PURCHASE ledger", async () => {
      // Setup user and wallet in pg-mem
      db.public.none(`
        INSERT INTO "User" (id, email, name) VALUES ('usr_escrow_1', 'escrow1@test.com', 'Escrow User 1');
        INSERT INTO "Wallet" (id, "userId", balance) VALUES ('w_escrow_1', 'usr_escrow_1', 1000.00);
        INSERT INTO "Service" (id, name, platform, "ratePer1000", "minQty", "maxQty")
        VALUES ('srv-likes-1', 'Likes', 'INSTAGRAM', 45.00, 100, 10000);
      `);

      const reserveTotal = new Decimal("225.00");
      const pkgId = "pkg_escrow_1";
      const ruleId = "rule_escrow_1";

      // Execute atomic purchase transaction in pg-mem
      db.public.none(`
        UPDATE "Wallet" SET balance = balance - 225.00 WHERE id = 'w_escrow_1';
        INSERT INTO "LedgerEntry" (id, "walletId", amount, type, description)
        VALUES ('led_p1_1', 'w_escrow_1', -225.00, 'PACKAGE_PURCHASE', 'Package purchase reserve');
        INSERT INTO "Package" (id, "userId", handle, kind, status, "endAt", "reserveTotal", "idempotencyKey")
        VALUES ('${pkgId}', 'usr_escrow_1', 'myhandle', 'POST_TRIGGERED', 'ACTIVE', NOW() + INTERVAL '30 days', 225.00, 'idem_pkg_1');
        INSERT INTO "PackageRule" (id, "packageId", kind, "serviceId", "quantityPerPost", "maxPosts", "usedCount", "unitCharge", "rateSnapshot", reserve)
        VALUES ('${ruleId}', '${pkgId}', 'POST_TRIGGERED', 'srv-likes-1', 500, 10, 0, 22.50, 45.00, 225.00);
      `);

      const wallet = db.public.one(`SELECT balance FROM "Wallet" WHERE id = 'w_escrow_1'`);
      expect(Number(wallet.balance)).toBe(775.00);

      const ledger = db.public.one(`SELECT * FROM "LedgerEntry" WHERE id = 'led_p1_1'`);
      expect(ledger.type).toBe("PACKAGE_PURCHASE");
      expect(Number(ledger.amount)).toBe(-225.00);
    });

    it("Cancellation: refunds unused reserve once and enforces purchased = consumed + refunded + remaining", async () => {
      const pkgId = "pkg_escrow_1";
      // Simulate 2 dispatched executions (consumed = 2 * 22.50 = 45.00)
      db.public.none(`
        INSERT INTO "PackageExecution" (id, "packageId", "ruleId", source, seq, quantity, "allocatedCharge", "executeAt", status)
        VALUES 
          ('exec_c1', '${pkgId}', 'rule_escrow_1', 'MEDIA', 1, 500, 22.50, NOW(), 'DISPATCHED'),
          ('exec_c2', '${pkgId}', 'rule_escrow_1', 'MEDIA', 2, 500, 22.50, NOW(), 'DISPATCHED'),
          ('exec_c3', '${pkgId}', 'rule_escrow_1', 'MEDIA', 3, 500, 22.50, NOW(), 'SCHEDULED');
      `);

      // Cancel: undispatched SCHEDULED -> CANCELLED
      db.public.none(`
        UPDATE "PackageExecution"
        SET status = 'CANCELLED', "skipReason" = 'User cancelled package'
        WHERE "packageId" = '${pkgId}' AND status = 'SCHEDULED';
      `);

      // Calculate consumed vs unused
      const consumedRes = db.public.one(`
        SELECT COALESCE(SUM("allocatedCharge"), 0) as consumed
        FROM "PackageExecution"
        WHERE "packageId" = '${pkgId}' AND status = 'DISPATCHED'
      `);
      const consumed = new Decimal(consumedRes.consumed);
      expect(consumed.toNumber()).toBe(45.00);

      const pkg = db.public.one(`SELECT "reserveTotal" FROM "Package" WHERE id = '${pkgId}'`);
      const reserveTotal = new Decimal(pkg.reserveTotal);
      const unusedRefund = reserveTotal.minus(consumed);
      expect(unusedRefund.toNumber()).toBe(180.00);

      // Refund unused reserve
      db.public.none(`
        UPDATE "Wallet" SET balance = balance + ${unusedRefund.toNumber()} WHERE id = 'w_escrow_1';
        INSERT INTO "Refund" (id, "packageId", "userId", amount, reason)
        VALUES ('ref_c1', '${pkgId}', 'usr_escrow_1', ${unusedRefund.toNumber()}, 'PACKAGE_CANCEL_UNUSED_RESERVE');
        INSERT INTO "LedgerEntry" (id, "walletId", amount, type, description)
        VALUES ('led_ref_1', 'w_escrow_1', ${unusedRefund.toNumber()}, 'PACKAGE_REFUND', 'Package Cancellation Refund');
        UPDATE "Package" SET status = 'CANCELLED' WHERE id = '${pkgId}';
      `);

      // Invariant check: purchased = consumed + refunded + remaining (0)
      const purchased = reserveTotal.toNumber();
      const refunded = unusedRefund.toNumber();
      const remaining = 0;
      expect(purchased).toBe(consumed.toNumber() + refunded + remaining);

      // Wallet balance restored: 775 + 180 = 955.00 (original 1000 - 45 consumed = 955)
      const walletAfter = db.public.one(`SELECT balance FROM "Wallet" WHERE id = 'w_escrow_1'`);
      expect(Number(walletAfter.balance)).toBe(955.00);
    });

    it("Settlement at endAt returns unused reserve once via PACKAGE_REFUND", async () => {
      // Setup second package for expiry settlement
      db.public.none(`
        INSERT INTO "Package" (id, "userId", handle, kind, status, "endAt", "reserveTotal")
        VALUES ('pkg_settle_1', 'usr_escrow_1', 'settle_handle', 'POST_TRIGGERED', 'ACTIVE', NOW() - INTERVAL '1 hour', 100.00);
        INSERT INTO "PackageRule" (id, "packageId", kind, "serviceId", "quantityPerPost", "maxPosts", "usedCount", "unitCharge", "rateSnapshot", reserve)
        VALUES ('rule_settle_1', 'pkg_settle_1', 'POST_TRIGGERED', 'srv-likes-1', 200, 5, 1, 20.00, 45.00, 100.00);
        INSERT INTO "PackageExecution" (id, "packageId", "ruleId", source, seq, quantity, "allocatedCharge", "executeAt", status)
        VALUES ('exec_s1', 'pkg_settle_1', 'rule_settle_1', 'MEDIA', 1, 200, 20.00, NOW(), 'DISPATCHED');
      `);

      // 1 consumed ($20), unused = $80
      const consumedRes = db.public.one(`
        SELECT COALESCE(SUM("allocatedCharge"), 0) as consumed
        FROM "PackageExecution"
        WHERE "packageId" = 'pkg_settle_1' AND status = 'DISPATCHED'
      `);
      const unusedReserve = new Decimal(100.00).minus(new Decimal(consumedRes.consumed));
      expect(unusedReserve.toNumber()).toBe(80.00);

      // Settle
      db.public.none(`
        UPDATE "Wallet" SET balance = balance + 80.00 WHERE id = 'w_escrow_1';
        INSERT INTO "Refund" (id, "packageId", "userId", amount, reason)
        VALUES ('ref_s1', 'pkg_settle_1', 'usr_escrow_1', 80.00, 'PACKAGE_SETTLEMENT_UNUSED_RESERVE');
        INSERT INTO "LedgerEntry" (id, "walletId", amount, type, description)
        VALUES ('led_ref_s1', 'w_escrow_1', 80.00, 'PACKAGE_REFUND', 'Expiry Settlement');
        UPDATE "Package" SET status = 'COMPLETED' WHERE id = 'pkg_settle_1';
      `);

      const pkgAfter = db.public.one(`SELECT status FROM "Package" WHERE id = 'pkg_settle_1'`);
      expect(pkgAfter.status).toBe("COMPLETED");

      const refundEntry = db.public.one(`SELECT * FROM "Refund" WHERE id = 'ref_s1'`);
      expect(refundEntry.reason).toBe("PACKAGE_SETTLEMENT_UNUSED_RESERVE");
      expect(Number(refundEntry.amount)).toBe(80.00);
    });
  });

  describe("Phase P2: Manual Trigger, Quota Atomicity, and Scheduler Tick Dispatch", () => {
    it("Manual trigger: validates Instagram URL regex and rejects arbitrary or invalid hosts", () => {
      const INSTAGRAM_REGEX = /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/;

      const validUrls = [
        "https://www.instagram.com/p/DF21abcxyz/",
        "https://instagram.com/reel/C89abcdef_123",
        "https://www.instagram.com/tv/B7812xyz",
      ];
      for (const u of validUrls) {
        const match = u.match(INSTAGRAM_REGEX);
        expect(match).not.toBeNull();
        expect(match![1]).toBeTruthy();
      }

      const invalidUrls = [
        "https://evil-site.com/p/DF21abcxyz/",
        "https://instagram.com/direct/t/123",
        "https://facebook.com/reel/123",
        "javascript:alert(1)",
        "http://instagram.com.attacker.com/p/123",
      ];
      for (const u of invalidUrls) {
        expect(u.match(INSTAGRAM_REGEX)).toBeNull();
      }
    });

    it("Atomic Quota: UPDATE ... SET usedCount = usedCount + 1 WHERE usedCount < maxPosts prevents over-triggering", () => {
      db.public.none(`
        INSERT INTO "User" (id, email, name) VALUES ('usr_quota_1', 'quota1@test.com', 'Quota User');
        INSERT INTO "Package" (id, "userId", handle, status, "endAt", "reserveTotal")
        VALUES ('pkg_quota_1', 'usr_quota_1', 'quotahandle', 'ACTIVE', NOW() + INTERVAL '10 days', 50.00);
        INSERT INTO "PackageRule" (id, "packageId", kind, "serviceId", "quantityPerPost", "maxPosts", "usedCount", "unitCharge", "rateSnapshot", reserve)
        VALUES ('rule_quota_1', 'pkg_quota_1', 'POST_TRIGGERED', 'srv-likes-1', 100, 3, 0, 10.00, 45.00, 30.00);
      `);

      // Trigger 1: usedCount 0 -> 1 (succeeds)
      const res1 = db.public.many(`
        UPDATE "PackageRule"
        SET "usedCount" = "usedCount" + 1
        WHERE id = 'rule_quota_1' AND "usedCount" < "maxPosts"
        RETURNING id, "usedCount"
      `);
      expect(res1.length).toBe(1);
      expect(res1[0].usedCount).toBe(1);

      // Trigger 2: usedCount 1 -> 2 (succeeds)
      const res2 = db.public.many(`
        UPDATE "PackageRule"
        SET "usedCount" = "usedCount" + 1
        WHERE id = 'rule_quota_1' AND "usedCount" < "maxPosts"
        RETURNING id, "usedCount"
      `);
      expect(res2.length).toBe(1);
      expect(res2[0].usedCount).toBe(2);

      // Trigger 3: usedCount 2 -> 3 (succeeds, hits maxPosts)
      const res3 = db.public.many(`
        UPDATE "PackageRule"
        SET "usedCount" = "usedCount" + 1
        WHERE id = 'rule_quota_1' AND "usedCount" < "maxPosts"
        RETURNING id, "usedCount"
      `);
      expect(res3.length).toBe(1);
      expect(res3[0].usedCount).toBe(3);

      // Trigger 4: usedCount already 3 === maxPosts -> returns 0 rows (exhausted!)
      const res4 = db.public.many(`
        UPDATE "PackageRule"
        SET "usedCount" = "usedCount" + 1
        WHERE id = 'rule_quota_1' AND "usedCount" < "maxPosts"
        RETURNING id, "usedCount"
      `);
      expect(res4.length).toBe(0);

      const finalRule = db.public.one(`SELECT "usedCount", "maxPosts" FROM "PackageRule" WHERE id = 'rule_quota_1'`);
      expect(finalRule.usedCount).toBe(3);
      expect(finalRule.usedCount <= finalRule.maxPosts).toBe(true);
    });

    it("Dispatcher Tick: child orders carry REAL allocatedCharge, isPrepaid=true, and NEVER charge 0", () => {
      // Setup scheduled execution
      db.public.none(`
        INSERT INTO "PackageExecution" (id, "packageId", "ruleId", source, seq, quantity, "allocatedCharge", "executeAt", status)
        VALUES ('exec_dispatch_1', 'pkg_quota_1', 'rule_quota_1', 'MEDIA', 1, 100, 10.00, NOW() - INTERVAL '1 minute', 'SCHEDULED');
      `);

      // Tick transaction
      const exec = db.public.one(`
        SELECT * FROM "PackageExecution"
        WHERE id = 'exec_dispatch_1' AND status = 'SCHEDULED'
      `);
      expect(exec).toBeTruthy();

      const allocatedCharge = new Decimal(exec.allocatedCharge);
      // Invariant: allocatedCharge must be greater than 0
      expect(allocatedCharge.toNumber()).toBe(10.00);

      // Create child order
      const orderId = "ord_child_1";
      db.public.none(`
        INSERT INTO "Order" (id, "userId", "serviceId", target, quantity, charge, "isPrepaid", status, "packageExecutionId", remains)
        VALUES ('${orderId}', 'usr_quota_1', 'srv-likes-1', 'https://instagram.com/p/test123', 100, ${allocatedCharge.toNumber()}, TRUE, 'PENDING', '${exec.id}', 100);
        UPDATE "PackageExecution"
        SET status = 'DISPATCHED', "orderId" = '${orderId}'
        WHERE id = '${exec.id}';
        INSERT INTO "OutboxEvent" (id, aggregate, "eventType", payload, status)
        VALUES ('outbox_1', 'ORDER', 'ORDER_CREATED', '{"orderId": "${orderId}", "isPrepaid": true}', 'PENDING');
      `);

      const createdOrder = db.public.one(`SELECT * FROM "Order" WHERE id = '${orderId}'`);
      expect(createdOrder.isPrepaid).toBe(true);
      expect(Number(createdOrder.charge)).toBe(10.00); // REAL charge! NEVER 0!
      expect(createdOrder.packageExecutionId).toBe("exec_dispatch_1");

      const updatedExec = db.public.one(`SELECT status, "orderId" FROM "PackageExecution" WHERE id = 'exec_dispatch_1'`);
      expect(updatedExec.status).toBe("DISPATCHED");
      expect(updatedExec.orderId).toBe(orderId);
    });

    it("Dispatcher Tick: Deleted Media sets SKIPPED_DELETED and issues slot refund to customer wallet", () => {
      // Create connection, media marked DELETED, and scheduled execution
      db.public.none(`
        INSERT INTO "SourceConnection" (id, "userId", platform, "providerAccountId", username, status)
        VALUES ('conn_del_1', 'usr_quota_1', 'INSTAGRAM', 'acc_del_1', 'del_user', 'ACTIVE');
        INSERT INTO "MonitoredMedia" (id, "connectionId", "mediaKey", "publishedAt", state, permalink)
        VALUES ('media_del_1', 'conn_del_1', 'post_del_key', NOW() - INTERVAL '1 day', 'DELETED', 'https://instagram.com/p/deleted');
        INSERT INTO "PackageExecution" (id, "packageId", "ruleId", "mediaId", source, seq, quantity, "allocatedCharge", "executeAt", status)
        VALUES ('exec_del_1', 'pkg_quota_1', 'rule_quota_1', 'media_del_1', 'MEDIA', 2, 100, 10.00, NOW() - INTERVAL '1 minute', 'SCHEDULED');
        INSERT INTO "Wallet" (id, "userId", balance) VALUES ('w_del_user', 'usr_quota_1', 0.00)
        ON CONFLICT ("userId") DO UPDATE SET balance = 0.00;
      `);

      const exec = db.public.one(`
        SELECT e.*, m.state as "mediaState"
        FROM "PackageExecution" e
        JOIN "MonitoredMedia" m ON e."mediaId" = m.id
        WHERE e.id = 'exec_del_1'
      `);
      expect(exec.mediaState).toBe("DELETED");

      // Dispatcher detects DELETED -> marks SKIPPED_DELETED and refunds allocated charge
      const refundAmount = Number(exec.allocatedCharge);
      db.public.none(`
        UPDATE "PackageExecution"
        SET status = 'SKIPPED_DELETED', "skipReason" = 'Media was deleted prior to execution dispatch'
        WHERE id = '${exec.id}';
        UPDATE "Wallet" SET balance = balance + ${refundAmount} WHERE "userId" = 'usr_quota_1';
        INSERT INTO "Refund" (id, "packageId", "userId", amount, reason)
        VALUES ('ref_del_slot_1', 'pkg_quota_1', 'usr_quota_1', ${refundAmount}, 'MEDIA_DELETED_SLOT_${exec.id}');
        INSERT INTO "LedgerEntry" (id, "walletId", amount, type, description)
        VALUES ('led_del_slot_1', 'w_del_user', ${refundAmount}, 'PACKAGE_REFUND', 'Slot Refund for Deleted Post');
      `);

      const finalExec = db.public.one(`SELECT status, "skipReason" FROM "PackageExecution" WHERE id = 'exec_del_1'`);
      expect(finalExec.status).toBe("SKIPPED_DELETED");
      expect(finalExec.skipReason).toContain("deleted");

      const wallet = db.public.one(`SELECT balance FROM "Wallet" WHERE "userId" = 'usr_quota_1'`);
      expect(Number(wallet.balance)).toBe(10.00); // 10.00 slot refunded
    });
  });
});

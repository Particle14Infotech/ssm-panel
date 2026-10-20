import { newDb } from "pg-mem";

describe("PHASE P0: Package Engine Database Schema & Constraints Invariants", () => {
  const TEST_DB_NAME = "smm_db";
  let db: any;

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

      CREATE TABLE "Service" (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        platform VARCHAR(64) NOT NULL,
        "ratePer1000" NUMERIC(10, 2) NOT NULL,
        "minQty" INT NOT NULL,
        "maxQty" INT NOT NULL
      );

      -- 1. SourceConnection
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

      -- DB Constraint 1: unique(platform, providerAccountId)
      CREATE UNIQUE INDEX "SourceConnection_platform_providerAccountId_key"
        ON "SourceConnection"(platform, "providerAccountId");

      -- 2. Package
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

      CREATE UNIQUE INDEX "Package_userId_idempotencyKey_key"
        ON "Package"("userId", "idempotencyKey");

      -- DB Constraint 6: partial unique index: one ACTIVE package per (account, rule kind)
      CREATE UNIQUE INDEX "unique_active_package_per_account_rule_kind"
        ON "Package"(handle, kind)
        WHERE status = 'ACTIVE';

      -- 3. PackageRule
      CREATE TABLE "PackageRule" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
        kind VARCHAR(32) NOT NULL,
        "serviceId" VARCHAR(64) NOT NULL REFERENCES "Service"(id),
        "quantityPerPost" INT NOT NULL DEFAULT 0,
        "mediaTypes" TEXT DEFAULT '[]',
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
        -- DB Constraint 5: CHECK usedCount <= maxPosts
        CONSTRAINT "check_used_count_max_posts" CHECK ("usedCount" <= "maxPosts")
      );

      -- 4. MonitoredMedia
      CREATE TABLE "MonitoredMedia" (
        id VARCHAR(64) PRIMARY KEY,
        "connectionId" VARCHAR(64) NOT NULL REFERENCES "SourceConnection"(id),
        "mediaKey" VARCHAR(128) NOT NULL,
        "publishedAt" TIMESTAMP NOT NULL,
        state VARCHAR(32) NOT NULL DEFAULT 'NEW',
        permalink TEXT,
        "mediaType" VARCHAR(64),
        caption TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- DB Constraint 2: unique(connectionId, mediaKey)
      CREATE UNIQUE INDEX "MonitoredMedia_connectionId_mediaKey_key"
        ON "MonitoredMedia"("connectionId", "mediaKey");

      -- 5. PackageExecution
      CREATE TABLE "PackageExecution" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
        "ruleId" VARCHAR(64) NOT NULL REFERENCES "PackageRule"(id),
        "mediaId" VARCHAR(64) REFERENCES "MonitoredMedia"(id),
        source VARCHAR(32) NOT NULL DEFAULT 'SCHEDULE',
        seq INT NOT NULL DEFAULT 1,
        quantity INT NOT NULL,
        "allocatedCharge" NUMERIC(10, 2) NOT NULL,
        "executeAt" TIMESTAMP NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
        "orderId" VARCHAR(64) UNIQUE,
        "skipReason" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- DB Constraint 3: unique(ruleId, mediaId)
      CREATE UNIQUE INDEX "PackageExecution_ruleId_mediaId_key"
        ON "PackageExecution"("ruleId", "mediaId");

      -- 6. Order
      CREATE TABLE "Order" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        "serviceId" VARCHAR(64) NOT NULL REFERENCES "Service"(id),
        target TEXT NOT NULL,
        quantity INT NOT NULL,
        charge NUMERIC(10, 2) NOT NULL,
        status VARCHAR(32) DEFAULT 'PENDING',
        "packageExecutionId" VARCHAR(64) UNIQUE,
        "isPrepaid" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- 7. Refund
      CREATE TABLE "Refund" (
        id VARCHAR(64) PRIMARY KEY,
        "orderId" VARCHAR(64) REFERENCES "Order"(id),
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        amount NUMERIC(12, 2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        "packageId" VARCHAR(64) REFERENCES "Package"(id),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- DB Constraint 7: unique refund per (package, reason)
      CREATE UNIQUE INDEX "unique_refund_per_package_reason"
        ON "Refund"("packageId", reason);
    `);

    // Seed test user and service
    db.public.none(`
      INSERT INTO "User" (id, email, name) VALUES ('usr_alice', 'alice@test.local', 'Alice');
      INSERT INTO "User" (id, email, name) VALUES ('usr_bob', 'bob@test.local', 'Bob');
      INSERT INTO "Service" (id, name, platform, "ratePer1000", "minQty", "maxQty")
        VALUES ('srv_ig_likes', 'Instagram Likes', 'INSTAGRAM', 50.00, 100, 50000);
    `);
  });

  describe("Constraint 1: unique(platform, providerAccountId) on SourceConnection", () => {
    it("allows different providerAccountIds on same platform", () => {
      db.public.none(`
        INSERT INTO "SourceConnection" (id, "userId", platform, "providerAccountId", username)
        VALUES ('conn_1', 'usr_alice', 'INSTAGRAM', 'ig_acc_1001', 'alice_gram');
      `);

      expect(() => {
        db.public.none(`
          INSERT INTO "SourceConnection" (id, "userId", platform, "providerAccountId", username)
          VALUES ('conn_2', 'usr_bob', 'INSTAGRAM', 'ig_acc_1002', 'bob_gram');
        `);
      }).not.toThrow();
    });

    it("rejects duplicate (platform, providerAccountId)", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "SourceConnection" (id, "userId", platform, "providerAccountId", username)
          VALUES ('conn_dup', 'usr_bob', 'INSTAGRAM', 'ig_acc_1001', 'alice_imposter');
        `);
      }).toThrow(/unique|duplicate/i);
    });
  });

  describe("Constraint 2: unique(connectionId, mediaKey) on MonitoredMedia", () => {
    it("allows distinct mediaKeys on same connection", () => {
      db.public.none(`
        INSERT INTO "MonitoredMedia" (id, "connectionId", "mediaKey", "publishedAt")
        VALUES ('med_1', 'conn_1', 'post_abc_1', now());
      `);

      expect(() => {
        db.public.none(`
          INSERT INTO "MonitoredMedia" (id, "connectionId", "mediaKey", "publishedAt")
          VALUES ('med_2', 'conn_1', 'post_abc_2', now());
        `);
      }).not.toThrow();
    });

    it("rejects duplicate (connectionId, mediaKey)", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "MonitoredMedia" (id, "connectionId", "mediaKey", "publishedAt")
          VALUES ('med_dup', 'conn_1', 'post_abc_1', now());
        `);
      }).toThrow(/unique|duplicate/i);
    });
  });

  describe("Constraint 3: unique(ruleId, mediaId) on PackageExecution", () => {
    beforeAll(() => {
      db.public.none(`
        INSERT INTO "Package" (id, "userId", handle, kind, status, "startAt", "endAt", "reserveTotal")
        VALUES ('pkg_1', 'usr_alice', 'alice_gram', 'POST_TRIGGERED', 'ACTIVE', now(), now(), 500.00);

        INSERT INTO "PackageRule" (id, "packageId", kind, "serviceId", "quantityPerPost", "maxPosts", "usedCount", "unitCharge", "rateSnapshot", reserve)
        VALUES ('rule_1', 'pkg_1', 'POST_TRIGGERED', 'srv_ig_likes', 1000, 10, 0, 50.00, 50.00, 500.00);
      `);
    });

    it("allows execution for distinct media on same rule", () => {
      db.public.none(`
        INSERT INTO "PackageExecution" (id, "packageId", "ruleId", "mediaId", source, seq, quantity, "allocatedCharge", "executeAt")
        VALUES ('exec_1', 'pkg_1', 'rule_1', 'med_1', 'MEDIA', 1, 1000, 50.00, now());
      `);

      expect(() => {
        db.public.none(`
          INSERT INTO "PackageExecution" (id, "packageId", "ruleId", "mediaId", source, seq, quantity, "allocatedCharge", "executeAt")
          VALUES ('exec_2', 'pkg_1', 'rule_1', 'med_2', 'MEDIA', 2, 1000, 50.00, now());
        `);
      }).not.toThrow();
    });

    it("rejects duplicate (ruleId, mediaId)", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "PackageExecution" (id, "packageId", "ruleId", "mediaId", source, seq, quantity, "allocatedCharge", "executeAt")
          VALUES ('exec_dup', 'pkg_1', 'rule_1', 'med_1', 'MEDIA', 3, 1000, 50.00, now());
        `);
      }).toThrow(/unique|duplicate/i);
    });
  });

  describe("Constraint 4: one order per execution", () => {
    it("allows linking order to execution", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "Order" (id, "userId", "serviceId", target, quantity, charge, "packageExecutionId", "isPrepaid")
          VALUES ('ord_1', 'usr_alice', 'srv_ig_likes', 'https://instagram.com/p/1', 1000, 50.00, 'exec_1', true);
        `);
      }).not.toThrow();
    });

    it("rejects second order referencing same packageExecutionId", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "Order" (id, "userId", "serviceId", target, quantity, charge, "packageExecutionId", "isPrepaid")
          VALUES ('ord_dup', 'usr_alice', 'srv_ig_likes', 'https://instagram.com/p/1', 1000, 50.00, 'exec_1', true);
        `);
      }).toThrow(/unique|duplicate/i);
    });
  });

  describe("Constraint 5: CHECK usedCount <= maxPosts on PackageRule", () => {
    it("allows updating usedCount up to maxPosts", () => {
      expect(() => {
        db.public.none(`
          UPDATE "PackageRule" SET "usedCount" = 10 WHERE id = 'rule_1';
        `);
      }).not.toThrow();
    });

    it("rejects usedCount exceeding maxPosts", () => {
      expect(() => {
        db.public.none(`
          UPDATE "PackageRule" SET "usedCount" = 11 WHERE id = 'rule_1';
        `);
      }).toThrow(/check|constraint/i);
    });
  });

  describe("Constraint 6: partial unique index: one ACTIVE package per (account, rule kind)", () => {
    it("rejects a second ACTIVE package with the same handle and kind", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "Package" (id, "userId", handle, kind, status, "startAt", "endAt", "reserveTotal")
          VALUES ('pkg_dup_active', 'usr_alice', 'alice_gram', 'POST_TRIGGERED', 'ACTIVE', now(), now(), 500.00);
        `);
      }).toThrow(/unique|duplicate/i);
    });

    it("allows a second package with the same handle if the kind differs (TIME_DRIP vs POST_TRIGGERED)", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "Package" (id, "userId", handle, kind, status, "startAt", "endAt", "reserveTotal")
          VALUES ('pkg_time_drip', 'usr_alice', 'alice_gram', 'TIME_DRIP', 'ACTIVE', now(), now(), 1000.00);
        `);
      }).not.toThrow();
    });

    it("allows a second package with the same handle and kind if status is NOT ACTIVE (e.g. CANCELLED or COMPLETED)", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "Package" (id, "userId", handle, kind, status, "startAt", "endAt", "reserveTotal")
          VALUES ('pkg_old_cancelled', 'usr_alice', 'alice_gram', 'POST_TRIGGERED', 'CANCELLED', now(), now(), 500.00);

          INSERT INTO "Package" (id, "userId", handle, kind, status, "startAt", "endAt", "reserveTotal")
          VALUES ('pkg_old_completed', 'usr_alice', 'alice_gram', 'POST_TRIGGERED', 'COMPLETED', now(), now(), 500.00);
        `);
      }).not.toThrow();
    });
  });

  describe("Constraint 7: unique refund per (package, reason)", () => {
    it("allows initial refund for a package with a specific reason", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "Refund" (id, "userId", amount, reason, "packageId")
          VALUES ('ref_1', 'usr_alice', 250.00, 'PACKAGE_SETTLEMENT_UNUSED_RESERVE', 'pkg_1');
        `);
      }).not.toThrow();
    });

    it("rejects second refund for the same package with the identical reason", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "Refund" (id, "userId", amount, reason, "packageId")
          VALUES ('ref_dup', 'usr_alice', 250.00, 'PACKAGE_SETTLEMENT_UNUSED_RESERVE', 'pkg_1');
        `);
      }).toThrow(/unique|duplicate/i);
    });

    it("allows refund for the same package with a different reason or for a different package", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "Refund" (id, "userId", amount, reason, "packageId")
          VALUES ('ref_diff_reason', 'usr_alice', 50.00, 'PACKAGE_ADMIN_GESTURE', 'pkg_1');

          INSERT INTO "Refund" (id, "userId", amount, reason, "packageId")
          VALUES ('ref_diff_pkg', 'usr_alice', 500.00, 'PACKAGE_SETTLEMENT_UNUSED_RESERVE', 'pkg_time_drip');
        `);
      }).not.toThrow();
    });
  });
});

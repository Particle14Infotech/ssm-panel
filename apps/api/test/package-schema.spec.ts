import { newDb } from "pg-mem";

describe("PHASE P0: Package Engine Database Schema & Constraints Invariants (Reworked Platform + Handle)", () => {
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
        "maxQty" INT NOT NULL,
        "packageEligible" BOOLEAN NOT NULL DEFAULT false
      );

      -- 1. PlatformConfig
      CREATE TABLE "PlatformConfig" (
        id VARCHAR(64) PRIMARY KEY,
        platform VARCHAR(32) NOT NULL,
        "displayName" VARCHAR(64) NOT NULL,
        "handleRegex" TEXT NOT NULL,
        "handleMaxLength" INT NOT NULL DEFAULT 64,
        "pathPattern" TEXT NOT NULL,
        "mediaKeyExtractor" TEXT NOT NULL,
        "urlContainsHandle" BOOLEAN NOT NULL DEFAULT false,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- DB Constraint 1: unique(platform) on PlatformConfig
      CREATE UNIQUE INDEX "PlatformConfig_platform_key" ON "PlatformConfig"(platform);

      -- 2. PlatformHandleBlocklist
      CREATE TABLE "PlatformHandleBlocklist" (
        id VARCHAR(64) PRIMARY KEY,
        platform VARCHAR(32) NOT NULL,
        handle VARCHAR(128) NOT NULL,
        reason TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- DB Constraint 2: unique(platform, handle) on PlatformHandleBlocklist
      CREATE UNIQUE INDEX "PlatformHandleBlocklist_platform_handle_key" ON "PlatformHandleBlocklist"(platform, handle);

      -- 3. Package (Platform + Handle)
      CREATE TABLE "Package" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        platform VARCHAR(32) NOT NULL DEFAULT 'instagram',
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

      -- DB Constraint: one ACTIVE package per (platform, handle)
      CREATE UNIQUE INDEX "unique_active_package_per_platform_handle"
        ON "Package"(platform, handle)
        WHERE status = 'ACTIVE';

      -- 4. PackageRule
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
        -- DB Constraint: CHECK usedCount <= maxPosts
        CONSTRAINT "check_used_count_max_posts" CHECK ("usedCount" <= "maxPosts")
      );

      -- 5. PackageTrigger
      CREATE TABLE "PackageTrigger" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
        "mediaKey" VARCHAR(128) NOT NULL,
        "targetUrl" TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- DB Constraint 3: unique(packageId, mediaKey) on PackageTrigger
      CREATE UNIQUE INDEX "PackageTrigger_packageId_mediaKey_key"
        ON "PackageTrigger"("packageId", "mediaKey");

      -- 6. PackageExecution
      CREATE TABLE "PackageExecution" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
        "ruleId" VARCHAR(64) NOT NULL REFERENCES "PackageRule"(id),
        "triggerId" VARCHAR(64) REFERENCES "PackageTrigger"(id),
        "mediaKey" VARCHAR(128),
        "targetUrl" TEXT,
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

      -- DB Constraint: unique(packageId, mediaKey, seq)
      CREATE UNIQUE INDEX "PackageExecution_packageId_mediaKey_seq_key"
        ON "PackageExecution"("packageId", "mediaKey", seq);

      -- 7. Order
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

      -- 8. Refund
      CREATE TABLE "Refund" (
        id VARCHAR(64) PRIMARY KEY,
        "orderId" VARCHAR(64) REFERENCES "Order"(id),
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        amount NUMERIC(12, 2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        "packageId" VARCHAR(64) REFERENCES "Package"(id),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- DB Constraint: unique refund per (package, reason)
      CREATE UNIQUE INDEX "unique_refund_per_package_reason"
        ON "Refund"("packageId", reason);
    `);

    // Seed test user and service
    db.public.none(`
      INSERT INTO "User" (id, email, name) VALUES ('usr_alice', 'alice@test.local', 'Alice');
      INSERT INTO "User" (id, email, name) VALUES ('usr_bob', 'bob@test.local', 'Bob');
      INSERT INTO "Service" (id, name, platform, "ratePer1000", "minQty", "maxQty", "packageEligible")
        VALUES ('srv_ig_likes', 'Instagram Likes', 'instagram', 50.00, 100, 50000, true);
    `);
  });

  describe("Constraint 1: unique(platform) on PlatformConfig", () => {
    it("allows distinct platforms", () => {
      db.public.none(`
        INSERT INTO "PlatformConfig" (id, platform, "displayName", "handleRegex", "pathPattern", "mediaKeyExtractor")
        VALUES ('cfg_ig', 'instagram', 'Instagram', '^[a-zA-Z0-9._]+$', '^https?:\\/\\/(?:www\\.)?instagram\\.com\\/(?:p|reel|tv)\\/([a-zA-Z0-9_-]+)', '$1');
      `);

      expect(() => {
        db.public.none(`
          INSERT INTO "PlatformConfig" (id, platform, "displayName", "handleRegex", "pathPattern", "mediaKeyExtractor")
          VALUES ('cfg_tt', 'tiktok', 'TikTok', '^[a-zA-Z0-9._]+$', '^https?:\\/\\/(?:www\\.)?tiktok\\.com\\/@([a-zA-Z0-9_.-]+)\\/video\\/([0-9]+)', '$2');
        `);
      }).not.toThrow();
    });

    it("rejects duplicate platform", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "PlatformConfig" (id, platform, "displayName", "handleRegex", "pathPattern", "mediaKeyExtractor")
          VALUES ('cfg_ig_dup', 'instagram', 'Instagram Clone', '^[a-zA-Z0-9._]+$', 'pattern', '$1');
        `);
      }).toThrow(/unique|duplicate/i);
    });
  });

  describe("Constraint 2: unique(platform, handle) on PlatformHandleBlocklist", () => {
    it("allows distinct handles on same platform", () => {
      db.public.none(`
        INSERT INTO "PlatformHandleBlocklist" (id, platform, handle, reason)
        VALUES ('blk_1', 'instagram', 'banned_user_1', 'Platform TOS violation');
      `);

      expect(() => {
        db.public.none(`
          INSERT INTO "PlatformHandleBlocklist" (id, platform, handle, reason)
          VALUES ('blk_2', 'instagram', 'banned_user_2', 'Spam report');
        `);
      }).not.toThrow();
    });

    it("rejects duplicate (platform, handle)", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "PlatformHandleBlocklist" (id, platform, handle, reason)
          VALUES ('blk_dup', 'instagram', 'banned_user_1', 'Duplicate block attempt');
        `);
      }).toThrow(/unique|duplicate/i);
    });

    it("allows same handle on different platform", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "PlatformHandleBlocklist" (id, platform, handle, reason)
          VALUES ('blk_tt_1', 'tiktok', 'banned_user_1', 'Different platform');
        `);
      }).not.toThrow();
    });
  });

  describe("Constraint 3: unique(packageId, mediaKey) on PackageTrigger", () => {
    beforeAll(() => {
      db.public.none(`
        INSERT INTO "Package" (id, "userId", platform, handle, kind, status, "startAt", "endAt", "reserveTotal")
        VALUES ('pkg_1', 'usr_alice', 'instagram', 'alice_creator', 'POST_TRIGGERED', 'ACTIVE', now(), now(), 500.00);

        INSERT INTO "PackageRule" (id, "packageId", kind, "serviceId", "quantityPerPost", "maxPosts", "usedCount", "unitCharge", "rateSnapshot", reserve)
        VALUES ('rule_1', 'pkg_1', 'POST_TRIGGERED', 'srv_ig_likes', 1000, 10, 0, 50.00, 50.00, 500.00);
      `);
    });

    it("allows trigger for distinct mediaKey on same package", () => {
      db.public.none(`
        INSERT INTO "PackageTrigger" (id, "packageId", "mediaKey", "targetUrl")
        VALUES ('trig_1', 'pkg_1', 'post_abc_1', 'https://instagram.com/p/post_abc_1');
      `);

      expect(() => {
        db.public.none(`
          INSERT INTO "PackageTrigger" (id, "packageId", "mediaKey", "targetUrl")
          VALUES ('trig_2', 'pkg_1', 'post_abc_2', 'https://instagram.com/p/post_abc_2');
        `);
      }).not.toThrow();
    });

    it("rejects duplicate (packageId, mediaKey) on same package (prevents duplicate start runs)", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "PackageTrigger" (id, "packageId", "mediaKey", "targetUrl")
          VALUES ('trig_dup', 'pkg_1', 'post_abc_1', 'https://instagram.com/p/post_abc_1');
        `);
      }).toThrow(/unique|duplicate/i);
    });
  });

  describe("Constraint 4: unique(packageId, mediaKey, seq) on PackageExecution", () => {
    it("allows distinct seq for the same media trigger", () => {
      db.public.none(`
        INSERT INTO "PackageExecution" (id, "packageId", "ruleId", "triggerId", "mediaKey", seq, quantity, "allocatedCharge", "executeAt")
        VALUES ('exec_1', 'pkg_1', 'rule_1', 'trig_1', 'post_abc_1', 1, 500, 25.00, now());
      `);

      expect(() => {
        db.public.none(`
          INSERT INTO "PackageExecution" (id, "packageId", "ruleId", "triggerId", "mediaKey", seq, quantity, "allocatedCharge", "executeAt")
          VALUES ('exec_2', 'pkg_1', 'rule_1', 'trig_1', 'post_abc_1', 2, 500, 25.00, now());
        `);
      }).not.toThrow();
    });

    it("rejects duplicate (packageId, mediaKey, seq)", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "PackageExecution" (id, "packageId", "ruleId", "triggerId", "mediaKey", seq, quantity, "allocatedCharge", "executeAt")
          VALUES ('exec_dup', 'pkg_1', 'rule_1', 'trig_1', 'post_abc_1', 1, 500, 25.00, now());
        `);
      }).toThrow(/unique|duplicate/i);
    });
  });

  describe("Constraint 5: one order per execution", () => {
    it("allows linking order to execution", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "Order" (id, "userId", "serviceId", target, quantity, charge, "packageExecutionId", "isPrepaid")
          VALUES ('ord_1', 'usr_alice', 'srv_ig_likes', 'https://instagram.com/p/post_abc_1', 500, 25.00, 'exec_1', true);
        `);
      }).not.toThrow();
    });

    it("rejects second order referencing same packageExecutionId", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "Order" (id, "userId", "serviceId", target, quantity, charge, "packageExecutionId", "isPrepaid")
          VALUES ('ord_dup', 'usr_alice', 'srv_ig_likes', 'https://instagram.com/p/post_abc_1', 500, 25.00, 'exec_1', true);
        `);
      }).toThrow(/unique|duplicate/i);
    });
  });

  describe("Constraint 6: CHECK usedCount <= maxPosts on PackageRule", () => {
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

  describe("Constraint 7: partial unique index: one ACTIVE package per (platform, handle)", () => {
    it("rejects a second ACTIVE package with the same platform and handle", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "Package" (id, "userId", platform, handle, kind, status, "startAt", "endAt", "reserveTotal")
          VALUES ('pkg_dup_active', 'usr_alice', 'instagram', 'alice_creator', 'POST_TRIGGERED', 'ACTIVE', now(), now(), 500.00);
        `);
      }).toThrow(/unique|duplicate/i);
    });

    it("allows a second package with the same handle if the platform differs (e.g. tiktok vs instagram)", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "Package" (id, "userId", platform, handle, kind, status, "startAt", "endAt", "reserveTotal")
          VALUES ('pkg_tt_active', 'usr_alice', 'tiktok', 'alice_creator', 'POST_TRIGGERED', 'ACTIVE', now(), now(), 500.00);
        `);
      }).not.toThrow();
    });

    it("allows a second package with the same platform and handle if status is NOT ACTIVE (e.g. CANCELLED or COMPLETED)", () => {
      expect(() => {
        db.public.none(`
          INSERT INTO "Package" (id, "userId", platform, handle, kind, status, "startAt", "endAt", "reserveTotal")
          VALUES ('pkg_old_cancelled', 'usr_alice', 'instagram', 'alice_creator', 'POST_TRIGGERED', 'CANCELLED', now(), now(), 500.00);

          INSERT INTO "Package" (id, "userId", platform, handle, kind, status, "startAt", "endAt", "reserveTotal")
          VALUES ('pkg_old_completed', 'usr_alice', 'instagram', 'alice_creator', 'POST_TRIGGERED', 'COMPLETED', now(), now(), 500.00);
        `);
      }).not.toThrow();
    });
  });

  describe("Constraint 8: unique refund per (package, reason)", () => {
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
          VALUES ('ref_diff_pkg', 'usr_alice', 500.00, 'PACKAGE_SETTLEMENT_UNUSED_RESERVE', 'pkg_tt_active');
        `);
      }).not.toThrow();
    });
  });
});

import { newDb } from "pg-mem";
import { Decimal } from "decimal.js";
import { PackagesQuoteService } from "../src/modules/packages/packages-quote.service";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PlatformsService } from "../src/modules/platforms/platforms.service";
import {
  generateQuoteHash,
  verifyQuoteHash,
} from "../src/modules/packages/package-quote-hash.util";
import {
  PackageStatus,
  PackageRuleKind,
  PackageExecutionStatus,
  OrderStatus,
  TransactionType,
} from "@prisma/client";

describe("S0 Security Findings Reproduction Suite (Demonstrating Gaps Before Fix)", () => {
  let db: any;
  let mockPrisma: any;
  let quoteService: PackagesQuoteService;
  let packagesService: PackagesService;
  let platformsService: PlatformsService;

  beforeAll(() => {
    db = newDb();
    db.public.registerFunction({
      name: "now",
      returns: db.public.getType("timestamp"),
      implementation: () => new Date(),
    });

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
        "displayName" VARCHAR(255),
        platform VARCHAR(64) NOT NULL,
        "ratePer1000" NUMERIC(10, 2) NOT NULL,
        "minQty" INT NOT NULL,
        "maxQty" INT NOT NULL,
        "packageEligible" BOOLEAN NOT NULL DEFAULT true,
        "costINR" NUMERIC(10, 2),
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        "isDeleted" BOOLEAN NOT NULL DEFAULT false
      );

      CREATE TABLE "PlatformConfig" (
        id VARCHAR(64) PRIMARY KEY,
        platform VARCHAR(32) NOT NULL UNIQUE,
        "displayName" VARCHAR(64) NOT NULL,
        "handleRegex" VARCHAR(255) NOT NULL,
        "handleMaxLength" INT NOT NULL DEFAULT 64,
        "hostAllowlist" TEXT[] DEFAULT '{}',
        "pathPattern" TEXT NOT NULL,
        "mediaKeyExtractor" TEXT NOT NULL,
        "urlContainsHandle" BOOLEAN DEFAULT false,
        "eligibleRuleKinds" TEXT[] DEFAULT '{"POST_TRIGGERED","TIME_DRIP"}',
        "followersIntervals" INT[] DEFAULT '{1,2,4,8,12,24}',
        "minGapMinutes" INT DEFAULT 15,
        "maxRunsPerPost" INT DEFAULT 10,
        "defaultWindowMinutes" INT DEFAULT 180,
        limits JSONB DEFAULT '{}',
        active BOOLEAN DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

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
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "PackageExecution" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id) ON DELETE CASCADE,
        "ruleId" VARCHAR(64) NOT NULL REFERENCES "PackageRule"(id) ON DELETE CASCADE,
        "triggerId" VARCHAR(64),
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

      CREATE TABLE "Order" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL,
        "serviceId" VARCHAR(64) NOT NULL,
        target TEXT NOT NULL,
        quantity INT NOT NULL,
        charge NUMERIC(10, 2) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        remains INT NOT NULL DEFAULT 0,
        "startCount" INT DEFAULT 0,
        "providerOrderId" VARCHAR(128),
        "packageExecutionId" VARCHAR(64)
      );

      CREATE TABLE "Refund" (
        id VARCHAR(64) PRIMARY KEY,
        "orderId" VARCHAR(64),
        "packageId" VARCHAR(64) REFERENCES "Package"(id),
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        amount NUMERIC(10, 2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.public.none(`
      INSERT INTO "User" (id, email, name) VALUES ('u_sec_test', 'sectest@test.local', 'Security Test User');
      INSERT INTO "Wallet" (id, "userId", balance) VALUES ('w_sec_test', 'u_sec_test', 50000.00);

      INSERT INTO "Service" (id, name, "displayName", platform, "ratePer1000", "minQty", "maxQty", "packageEligible", "costINR")
      VALUES
        ('srv_sec_followers', 'Instagram Followers', 'Instagram Followers', 'INSTAGRAM', 100.00, 50, 50000, true, 50.00),
        ('srv_sec_likes', 'Instagram Likes', 'Instagram Likes', 'INSTAGRAM', 50.00, 100, 100000, true, 20.00);
    `);

    mockPrisma = {
      isConnected: true,
      platformConfig: {
        findMany: async () => [],
        findUnique: async () => null,
      },
      platformHandleBlocklist: {
        findFirst: async () => null,
      },
      service: {
        findMany: async ({ where }: any) => {
          const ids = where.id.in;
          const quoted = ids.map((id: string) => `'${id}'`).join(",");
          return db.public.many(`SELECT * FROM "Service" WHERE id IN (${quoted})`);
        },
      },
      package: {
        findFirst: async ({ where }: any) => {
          const rows = db.public.many(
            `SELECT * FROM "Package" WHERE platform = '${where.platform}' AND handle = '${where.handle}' AND status = '${where.status}'`
          );
          return rows.length > 0 ? rows[0] : null;
        },
        findMany: async ({ where }: any) => {
          return db.public.many(
            `SELECT * FROM "Package" WHERE "userId" = '${where.userId}' AND status = '${where.status}'`
          );
        },
        findUnique: async ({ where }: any) => {
          if (where.id) {
            const rows = db.public.many(`SELECT * FROM "Package" WHERE id = '${where.id}'`);
            return rows.length > 0 ? rows[0] : null;
          }
          return null;
        },
        create: async ({ data }: any) => {
          const id = `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.public.none(`
            INSERT INTO "Package" (id, "userId", platform, handle, kind, status, "startAt", "endAt", "reserveTotal", "idempotencyKey")
            VALUES ('${id}', '${data.userId}', '${data.platform}', '${data.handle}', '${data.kind}', 'ACTIVE', now(), now() + INTERVAL '30 days', ${data.reserveTotal}, '${data.idempotencyKey || ""}')
          `);
          return { id, ...data };
        },
      },
      packageRule: {
        create: async ({ data }: any) => {
          const id = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.public.none(`
            INSERT INTO "PackageRule" (id, "packageId", kind, "serviceId", "quantityPerPost", "maxPosts", "usedCount", "unitCharge", "rateSnapshot", reserve)
            VALUES ('${id}', '${data.packageId}', '${data.kind}', '${data.serviceId}', ${data.quantityPerPost || 0}, ${data.maxPosts || 1}, 0, ${data.unitCharge}, ${data.rateSnapshot}, ${data.reserve})
          `);
          return { id, ...data };
        },
      },
      packageExecution: {
        create: async ({ data }: any) => {
          const id = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.public.none(`
            INSERT INTO "PackageExecution" (id, "packageId", "ruleId", source, seq, quantity, "allocatedCharge", "executeAt", status)
            VALUES ('${id}', '${data.packageId}', '${data.ruleId}', '${data.source}', ${data.seq}, ${data.quantity}, ${data.allocatedCharge}, now(), '${data.status || "SCHEDULED"}')
          `);
          return { id, ...data };
        },
        update: async ({ where, data }: any) => {
          db.public.none(`
            UPDATE "PackageExecution"
            SET status = '${data.status}', "skipReason" = '${data.skipReason || ""}'
            WHERE id = '${where.id}'
          `);
          return { id: where.id, ...data };
        },
        findUnique: async ({ where }: any) => {
          const rows = db.public.many(`SELECT * FROM "PackageExecution" WHERE id = '${where.id}'`);
          if (rows.length === 0) return null;
          const exec = rows[0];
          const pkgs = db.public.many(`SELECT * FROM "Package" WHERE id = '${exec.packageId}'`);
          exec.package = pkgs[0] || null;
          return exec;
        },
        findMany: async () => [],
      },
      order: {
        update: async ({ where, data }: any) => {
          db.public.none(`
            UPDATE "Order" SET status = '${data.status}' WHERE id = '${where.id}'
          `);
          return { id: where.id, ...data };
        },
      },
      wallet: {
        update: async ({ where, data }: any) => {
          db.public.none(`
            UPDATE "Wallet" SET balance = ${data.balance} WHERE id = '${where.id}'
          `);
          return { id: where.id, ...data };
        },
        findUnique: async ({ where }: any) => {
          const rows = db.public.many(`SELECT * FROM "Wallet" WHERE "userId" = '${where.userId}'`);
          return rows.length > 0 ? rows[0] : null;
        },
      },
      ledgerEntry: {
        create: async ({ data }: any) => {
          const id = `led_${Date.now()}`;
          db.public.none(`
            INSERT INTO "LedgerEntry" (id, "walletId", amount, type, description)
            VALUES ('${id}', '${data.walletId}', ${data.amount}, '${data.type}', '${data.description}')
          `);
          return { id, ...data };
        },
      },
      refund: {
        findMany: async ({ where }: any) => {
          return db.public.many(`SELECT * FROM "Refund" WHERE "packageId" = '${where.packageId}'`);
        },
        create: async ({ data }: any) => {
          const id = `ref_${Date.now()}`;
          db.public.none(`
            INSERT INTO "Refund" (id, "packageId", "userId", amount, reason)
            VALUES ('${id}', '${data.packageId}', '${data.userId}', ${data.amount}, '${data.reason}')
          `);
          return { id, ...data };
        },
      },
      $queryRawUnsafe: async (sql: string, ...args: any[]) => {
        let formatted = sql;
        for (let i = 0; i < args.length; i++) {
          formatted = formatted.replace(`$${i + 1}`, `'${args[i]}'`);
        }
        return db.public.many(formatted);
      },
      $transaction: async (fn: any) => fn(mockPrisma),
    };

    platformsService = new PlatformsService(mockPrisma);
    quoteService = new PackagesQuoteService(mockPrisma, platformsService);
    packagesService = new PackagesService(mockPrisma, quoteService, platformsService);
  });

  describe("First Answer: Does purchase recompute price server-side and ignore client total?", () => {
    it("proves server-side price recomputation completely ignores client-supplied fraudulent price", async () => {
      // Service srv_sec_followers rate is 100 per 1000.
      // 1000 quantity = 100.00 INR.
      // Attacker attempts to pass fraudulent client totals: totalCharge = 1.00 INR
      const maliciousPayload: any = {
        platform: "instagram",
        handle: "truth_check_handle",
        followersDrip: {
          serviceId: "srv_sec_followers",
          quantity: 1000,
          days: 5,
          intervalHours: 24,
        },
        totalCharge: 1.00, // Client tries to pay only ₹1.00
        price: 0.50,
        consentRulesUnderstood: true,
        idempotencyKey: "idem_fraud_price_check",
      };

      const initialWallet = db.public.one(`SELECT balance FROM "Wallet" WHERE "userId" = 'u_sec_test'`);
      const initialBalance = Number(initialWallet.balance);

      const res = await packagesService.purchasePackage("u_sec_test", maliciousPayload);

      // Verify server charged the authoritative recomputed price (100.00), NOT client's 1.00
      expect(res.success).toBe(true);
      expect(Number(res.package.reserveTotal)).toBe(100.00);

      const postWallet = db.public.one(`SELECT balance FROM "Wallet" WHERE "userId" = 'u_sec_test'`);
      const postBalance = Number(postWallet.balance);

      expect(initialBalance - postBalance).toBe(100.00);
    });
  });

  describe("GAP-1: quoteHash is optional (PACKAGES_REQUIRE_QUOTE_HASH=false by default)", () => {
    it("reproduces GAP-1: purchase succeeds without providing any quoteHash when PACKAGES_REQUIRE_QUOTE_HASH is unset/false", async () => {
      const origEnv = process.env.PACKAGES_REQUIRE_QUOTE_HASH;
      delete process.env.PACKAGES_REQUIRE_QUOTE_HASH;

      const payloadWithoutHash: any = {
        platform: "instagram",
        handle: "gap1_no_hash_user",
        followersDrip: {
          serviceId: "srv_sec_followers",
          quantity: 1000,
          days: 5,
          intervalHours: 24,
        },
        consentRulesUnderstood: true,
        idempotencyKey: "idem_gap1_no_hash",
        // quoteHash is omitted entirely!
      };

      // In the unfixed code, this does NOT reject with 400. It succeeds!
      const res = await packagesService.purchasePackage("u_sec_test", payloadWithoutHash);
      expect(res.success).toBe(true);

      process.env.PACKAGES_REQUIRE_QUOTE_HASH = origEnv;
    });
  });

  describe("GAP-2: Public POST /packages/quote with days=365, intervalHours=1 makes ~8,760 iterations (DoS vector)", () => {
    it("reproduces GAP-2: calculateQuote executes 8,760 iterations for days=365 and intervalHours=1", async () => {
      const heavyQuoteInput = {
        platform: "instagram" as const,
        handle: "dos_target_user",
        followersDrip: {
          serviceId: "srv_sec_followers",
          quantity: 50000,
          days: 365,
          intervalHours: 1, // 365 * 24 = 8,760 runs!
        },
      };

      const start = Date.now();
      const quote = await quoteService.calculateQuote(heavyQuoteInput);
      const elapsed = Date.now() - start;

      // Demonstrates 8,760 runs were generated and sorted in memory without any cap
      expect(quote.totalRuns).toBe(8760);
      expect(quote.timeline.length).toBe(8760);
    });
  });

  describe("GAP-3: adminResolveExecution REFUND refunds 100% of allocatedCharge ignoring delivered work & prior refunds", () => {
    it("reproduces GAP-3: admin refund causes total refunds to exceed allocatedCharge (double-refund)", async () => {
      const pkgId = "pkg_gap3_test";
      const execId = "exec_gap3_test";
      const ruleId = "rule_gap3_test";

      // 1. Create package with reserve = 100.00
      db.public.none(`
        INSERT INTO "Package" (id, "userId", platform, handle, status, "startAt", "endAt", "reserveTotal")
        VALUES ('${pkgId}', 'u_sec_test', 'instagram', 'gap3_handle', 'ACTIVE', now(), now() + INTERVAL '30 days', 100.00);

        INSERT INTO "PackageRule" (id, "packageId", kind, "serviceId", "quantityPerPost", "maxPosts", "usedCount", "unitCharge", "rateSnapshot", reserve)
        VALUES ('${ruleId}', '${pkgId}', 'TIME_DRIP', 'srv_sec_followers', 1000, 1, 1, 100.00, 100.00, 100.00);

        INSERT INTO "PackageExecution" (id, "packageId", "ruleId", source, seq, quantity, "allocatedCharge", "executeAt", status)
        VALUES ('${execId}', '${pkgId}', '${ruleId}', 'SCHEDULE', 1, 1000, 100.00, now(), 'DISPATCHED');

        -- Prior refund of 40.00 already issued by worker/reconciliation
        INSERT INTO "Refund" (id, "packageId", "userId", amount, reason)
        VALUES ('ref_prior_40', '${pkgId}', 'u_sec_test', 40.00, 'PARTIAL_REFUND_DUE');
      `);

      const walletBefore = db.public.one(`SELECT balance FROM "Wallet" WHERE "userId" = 'u_sec_test'`);
      const balBefore = Number(walletBefore.balance);

      // 2. Admin calls adminResolveExecution with REFUND
      const adminRes = await packagesService.adminResolveExecution(execId, "REFUND", {
        reason: "Admin manual intervention",
      });

      expect(adminRes.success).toBe(true);
      // Notice: adminRes refunded the FULL 100.00 allocatedCharge blindly!
      expect(adminRes.refundAmount).toBe(100.00);

      const walletAfter = db.public.one(`SELECT balance FROM "Wallet" WHERE "userId" = 'u_sec_test'`);
      const balAfter = Number(walletAfter.balance);

      // User received 100.00 from admin + 40.00 from prior refund = 140.00 total refund on a 100.00 charge!
      const totalRefunded = 40.00 + (balAfter - balBefore);
      expect(totalRefunded).toBe(140.00); // Proves double-refund flaw in adminResolveExecution!
    });
  });

  describe("GAP-4: Hardcoded fallback secret ('smm-package-quote-integrity-salt') when secrets are unset", () => {
    it("reproduces GAP-4: generateQuoteHash and verifyQuoteHash use hardcoded default when env secrets are unset", () => {
      const origQuoteSecret = process.env.QUOTE_SECRET;
      const origJwtSecret = process.env.JWT_SECRET;
      delete process.env.QUOTE_SECRET;
      delete process.env.JWT_SECRET;

      const dummyQuote = {
        platform: "instagram",
        handle: "fallback_user",
        timezone: "UTC",
        days: 10,
        totalCharge: 50.00,
        totalRuns: 10,
        items: [],
      };

      // Fails open to hardcoded salt instead of throwing InternalServerError
      const { quoteHash } = generateQuoteHash(dummyQuote);
      expect(quoteHash.startsWith("qh_v1_")).toBe(true);

      const verification = verifyQuoteHash(quoteHash, dummyQuote);
      expect(verification.valid).toBe(true);

      process.env.QUOTE_SECRET = origQuoteSecret;
      process.env.JWT_SECRET = origJwtSecret;
    });
  });

  describe("GAP-5: Fail-open sandbox fallback when prisma is not connected", () => {
    it("reproduces GAP-5: purchasePackage returns success from in-memory map without persistent storage when DB disconnected", async () => {
      mockPrisma.isConnected = false;

      const payload: any = {
        platform: "instagram",
        handle: "sandbox_victim_handle",
        followersDrip: {
          serviceId: "srv_sec_followers",
          quantity: 1000,
          days: 5,
          intervalHours: 24,
        },
        consentRulesUnderstood: true,
        idempotencyKey: "idem_sandbox_check",
      };

      const res = await packagesService.purchasePackage("u_sec_test", payload);

      // Returns success: true with in-memory pkg_sbx_ ID
      expect(res.success).toBe(true);
      expect(res.package.id.startsWith("pkg_sbx_")).toBe(true);

      // Prove nothing was written to the database:
      const dbPackages = db.public.many(`SELECT * FROM "Package" WHERE handle = 'sandbox_victim_handle'`);
      expect(dbPackages.length).toBe(0);

      mockPrisma.isConnected = true;
    });
  });
});

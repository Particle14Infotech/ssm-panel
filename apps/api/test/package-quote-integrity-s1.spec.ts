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
  OrderStatus,
  TransactionType,
} from "@prisma/client";
import { BadRequestException, ConflictException } from "@nestjs/common";

describe("S1 Quote Integrity Regression Suite (@security)", () => {
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
        platform VARCHAR(32) NOT NULL,
        handle VARCHAR(64) NOT NULL,
        timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        "startAt" TIMESTAMP NOT NULL,
        "endAt" TIMESTAMP NOT NULL,
        "pausedDays" INT NOT NULL DEFAULT 0,
        "reserveTotal" NUMERIC(10, 2) NOT NULL,
        "idempotencyKey" VARCHAR(128) UNIQUE,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "PackageRule" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
        "serviceId" VARCHAR(64) NOT NULL REFERENCES "Service"(id),
        target TEXT,
        "targetType" VARCHAR(32) NOT NULL,
        kind VARCHAR(32) NOT NULL,
        "totalQuantity" INT NOT NULL,
        "quantityPerPost" INT,
        "rateSnapshot" NUMERIC(10, 2) NOT NULL,
        "unitCharge" NUMERIC(10, 2) NOT NULL,
        "reserveTotal" NUMERIC(10, 2) NOT NULL,
        "runsCount" INT NOT NULL,
        "intervalHours" INT,
        "delayMinutes" INT NOT NULL DEFAULT 0,
        "maxPosts" INT NOT NULL DEFAULT 1,
        "usedCount" INT NOT NULL DEFAULT 0,
        "deliveryWindowMin" INT NOT NULL DEFAULT 180,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "PackageExecution" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
        "ruleId" VARCHAR(64) NOT NULL REFERENCES "PackageRule"(id),
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
      INSERT INTO "User" (id, email, name) VALUES
        ('u_alice', 'alice@test.local', 'Alice User'),
        ('u_bob', 'bob@test.local', 'Bob User');

      INSERT INTO "Wallet" (id, "userId", balance) VALUES
        ('w_alice', 'u_alice', 10000.00),
        ('w_bob', 'u_bob', 10000.00);

      INSERT INTO "Service" (id, name, "displayName", platform, "ratePer1000", "minQty", "maxQty", "packageEligible", "costINR")
      VALUES
        ('srv_fol', 'Instagram Followers', 'Instagram Followers', 'INSTAGRAM', 100.00, 50, 50000, true, 50.00),
        ('srv_lik', 'Instagram Likes', 'Instagram Likes', 'INSTAGRAM', 50.00, 100, 100000, true, 20.00);

      INSERT INTO "PlatformConfig" (id, platform, "displayName", "handleRegex", "handleMaxLength", "hostAllowlist", "pathPattern", "mediaKeyExtractor", "urlContainsHandle", "defaultWindowMinutes")
      VALUES
        ('pc_ig', 'instagram', 'Instagram', '^[a-zA-Z0-9._]{1,30}$', 30, ARRAY['instagram.com','www.instagram.com'], '^/(p|reel)/([A-Za-z0-9_-]+)', '{{2}}', false, 180);
    `);

    mockPrisma = {
      isConnected: true,
      platformConfig: {
        findMany: async () => db.public.many(`SELECT * FROM "PlatformConfig"`),
        findUnique: async ({ where }: any) => {
          const rows = db.public.many(`SELECT * FROM "PlatformConfig" WHERE platform = '${where.platform}'`);
          return rows[0] || null;
        },
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
        findUnique: async () => null,
        findMany: async () => [],
        findFirst: async ({ where }: any) => {
          let sql = `SELECT * FROM "Package" WHERE 1=1`;
          if (where.platform) sql += ` AND platform = '${where.platform}'`;
          if (where.handle) sql += ` AND handle = '${where.handle}'`;
          if (where.status) sql += ` AND status = '${where.status}'`;
          if (where.userId) sql += ` AND "userId" = '${where.userId}'`;
          if (where.idempotencyKey) sql += ` AND "idempotencyKey" = '${where.idempotencyKey}'`;
          const rows = db.public.many(sql);
          return rows.length > 0 ? rows[0] : null;
        },
        create: async ({ data }: any) => {
          const id = `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.public.none(`
            INSERT INTO "Package" (id, "userId", platform, handle, timezone, status, "startAt", "endAt", "pausedDays", "reserveTotal", "idempotencyKey")
            VALUES ('${id}', '${data.userId}', '${data.platform}', '${data.handle}', '${data.timezone}', '${data.status}', '${data.startAt.toISOString()}', '${data.endAt.toISOString()}', 0, ${data.reserveTotal}, '${data.idempotencyKey}')
          `);
          return { id, ...data };
        },
      },
      packageRule: {
        create: async ({ data }: any) => {
          const id = `pkr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.public.none(`
            INSERT INTO "PackageRule" (id, "packageId", "serviceId", target, "targetType", kind, "totalQuantity", "quantityPerPost", "rateSnapshot", "unitCharge", "reserveTotal", "runsCount", "intervalHours", "delayMinutes", "maxPosts", "usedCount", "deliveryWindowMin")
            VALUES ('${id}', '${data.packageId}', '${data.serviceId}', ${data.target ? `'${data.target}'` : 'NULL'}, '${data.targetType}', '${data.kind}', ${data.totalQuantity}, ${data.quantityPerPost ?? 'NULL'}, ${data.rateSnapshot}, ${data.unitCharge}, ${data.reserveTotal}, ${data.runsCount}, ${data.intervalHours ?? 'NULL'}, ${data.delayMinutes}, ${data.maxPosts}, ${data.usedCount}, ${data.deliveryWindowMin})
          `);
          return { id, ...data };
        },
        createMany: async ({ data }: any) => {
          for (const r of data) {
            const id = `pkr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            db.public.none(`
              INSERT INTO "PackageRule" (id, "packageId", "serviceId", target, "targetType", kind, "totalQuantity", "quantityPerPost", "rateSnapshot", "unitCharge", "reserveTotal", "runsCount", "intervalHours", "delayMinutes", "maxPosts", "usedCount", "deliveryWindowMin")
              VALUES ('${id}', '${r.packageId}', '${r.serviceId}', ${r.target ? `'${r.target}'` : 'NULL'}, '${r.targetType}', '${r.kind}', ${r.totalQuantity}, ${r.quantityPerPost ?? 'NULL'}, ${r.rateSnapshot}, ${r.unitCharge}, ${r.reserveTotal}, ${r.runsCount}, ${r.intervalHours ?? 'NULL'}, ${r.delayMinutes}, ${r.maxPosts}, ${r.usedCount}, ${r.deliveryWindowMin})
            `);
          }
          return { count: data.length };
        },
      },
      packageExecution: {
        createMany: async ({ data }: any) => {
          for (const e of data) {
            const id = `pke_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            db.public.none(`
              INSERT INTO "PackageExecution" (id, "packageId", "ruleId", "targetUrl", source, seq, quantity, "allocatedCharge", "executeAt", status)
              VALUES ('${id}', '${e.packageId}', '${e.ruleId}', ${e.targetUrl ? `'${e.targetUrl}'` : 'NULL'}, '${e.source}', ${e.seq}, ${e.quantity}, ${e.allocatedCharge}, '${e.executeAt.toISOString()}', '${e.status}')
            `);
          }
          return { count: data.length };
        },
      },
      wallet: {
        findUnique: async ({ where }: any) => {
          const rows = db.public.many(`SELECT * FROM "Wallet" WHERE "userId" = '${where.userId}'`);
          return rows[0] || null;
        },
        update: async ({ where, data }: any) => {
          if (data.balance?.decrement) {
            db.public.none(`UPDATE "Wallet" SET balance = balance - ${data.balance.decrement} WHERE "userId" = '${where.userId}'`);
          }
          return (await mockPrisma.wallet.findUnique({ where }));
        },
      },
      ledgerEntry: {
        create: async ({ data }: any) => {
          const id = `led_${Date.now()}`;
          db.public.none(`
            INSERT INTO "LedgerEntry" (id, "walletId", amount, type, "referenceId", "idempotencyKey", description)
            VALUES ('${id}', '${data.walletId}', ${data.amount}, '${data.type}', '${data.referenceId}', '${data.idempotencyKey}', '${data.description}')
          `);
          return { id, ...data };
        },
      },
      $transaction: async (cb: any) => {
        return cb(mockPrisma);
      },
      $queryRawUnsafe: async (sql: string, ...args: any[]) => {
        let interpolated = sql;
        args.forEach((arg, i) => {
          interpolated = interpolated.replace(`$${i + 1}`, `'${arg}'`);
        });
        return db.public.many(interpolated);
      },
    };

    platformsService = new PlatformsService(mockPrisma as any);
    quoteService = new PackagesQuoteService(mockPrisma as any, platformsService);
    packagesService = new PackagesService(
      mockPrisma as any,
      quoteService,
      platformsService,
      null as any,
      null as any,
      null as any
    );
  });

  beforeEach(() => {
    db.public.none(`
      DELETE FROM "PackageExecution";
      DELETE FROM "PackageRule";
      DELETE FROM "Package";
    `);
  });

  describe("S1 Quote Integrity Rules", () => {
    const validQuoteInput = {
      platform: "instagram" as const,
      handle: "alice_travels",
      followersDrip: {
        serviceId: "srv_fol",
        quantity: 500,
        days: 5,
        intervalHours: 24,
      },
    };

    it("rule 1: missing quoteHash must be rejected with 400 Bad Request", async () => {
      // Unfixed code allows purchase without quoteHash when PACKAGES_REQUIRE_QUOTE_HASH is unset/false
      delete process.env.PACKAGES_REQUIRE_QUOTE_HASH;

      const purchaseWithoutHash = {
        ...validQuoteInput,
        consentRulesUnderstood: true,
        idempotencyKey: "idem_no_hash_test_1",
      };

      await expect(
        packagesService.purchasePackage("u_alice", purchaseWithoutHash)
      ).rejects.toThrow(BadRequestException);
    });

    it("rule 2: tampered field in quote payload must be rejected with 409 QUOTE_CHANGED", async () => {
      const quote = await quoteService.calculateQuote(validQuoteInput);

      // Tamper: change days from 5 to 10 with the original hash
      const tamperedPurchase = {
        ...validQuoteInput,
        followersDrip: {
          ...validQuoteInput.followersDrip,
          days: 10, // tampered!
        },
        quoteHash: quote.quoteHash,
        consentRulesUnderstood: true,
        idempotencyKey: "idem_tampered_test_1",
      };

      let thrownErr: any;
      try {
        await packagesService.purchasePackage("u_alice", tamperedPurchase);
      } catch (err) {
        thrownErr = err;
      }

      expect(thrownErr).toBeInstanceOf(ConflictException);
      const resp = thrownErr.getResponse();
      // Must contain code: QUOTE_CHANGED and fresh quote in body
      expect(resp).toMatchObject({
        code: "QUOTE_CHANGED",
      });
      expect(resp.freshQuote).toBeDefined();
    });

    it("rule 3: quote generated for another user must be rejected with 409 QUOTE_CHANGED", async () => {
      // Alice generates a quote (quote binds to u_alice)
      const aliceQuote = await quoteService.calculateQuote({
        ...validQuoteInput,
        userId: "u_alice",
      } as any);

      // Bob attempts to purchase with Alice's quoteHash
      const bobPurchase = {
        ...validQuoteInput,
        quoteHash: aliceQuote.quoteHash,
        consentRulesUnderstood: true,
        idempotencyKey: "idem_bob_stolen_quote",
      };

      let thrownErr: any;
      try {
        await packagesService.purchasePackage("u_bob", bobPurchase);
      } catch (err) {
        thrownErr = err;
      }

      expect(thrownErr).toBeInstanceOf(ConflictException);
      const resp = thrownErr.getResponse();
      expect(resp).toMatchObject({
        code: "QUOTE_CHANGED",
      });
    });

    it("rule 4: expired quote hash (>10 minutes) must be rejected with 409 QUOTE_CHANGED", async () => {
      // Generate a quote that expired 1 second ago
      const expiredAtMs = Date.now() - 1000;
      const { quoteHash } = generateQuoteHash(
        {
          userId: "u_alice",
          platform: "instagram",
          handle: "alice_travels",
          timezone: "UTC",
          days: 5,
          totalCharge: 50.00,
          totalRuns: 5,
          items: [],
        } as any,
        expiredAtMs
      );

      const expiredPurchase = {
        ...validQuoteInput,
        quoteHash,
        consentRulesUnderstood: true,
        idempotencyKey: "idem_expired_quote",
      };

      let thrownErr: any;
      try {
        await packagesService.purchasePackage("u_alice", expiredPurchase);
      } catch (err) {
        thrownErr = err;
      }

      expect(thrownErr).toBeInstanceOf(ConflictException);
      const resp = thrownErr.getResponse();
      expect(resp).toMatchObject({
        code: "QUOTE_CHANGED",
      });
    });

    it("rule 5: rate change between quote and purchase must be rejected with 409 QUOTE_CHANGED", async () => {
      // Alice gets quote when rate is 100.00
      const quote = await quoteService.calculateQuote({
        ...validQuoteInput,
        userId: "u_alice",
      } as any);

      // Admin updates rate in database from 100.00 to 150.00
      db.public.none(`UPDATE "Service" SET "ratePer1000" = 150.00 WHERE id = 'srv_fol'`);

      const purchaseAfterRateChange = {
        ...validQuoteInput,
        quoteHash: quote.quoteHash,
        consentRulesUnderstood: true,
        idempotencyKey: "idem_rate_change",
      };

      let thrownErr: any;
      try {
        await packagesService.purchasePackage("u_alice", purchaseAfterRateChange);
      } catch (err) {
        thrownErr = err;
      } finally {
        // Reset rate back to 100.00
        db.public.none(`UPDATE "Service" SET "ratePer1000" = 100.00 WHERE id = 'srv_fol'`);
      }

      expect(thrownErr).toBeInstanceOf(ConflictException);
      const resp = thrownErr.getResponse();
      expect(resp).toMatchObject({
        code: "QUOTE_CHANGED",
      });
      expect(resp.freshQuote).toBeDefined();
      expect(resp.freshQuote.totalCharge).toBe(75.00); // 500 * 150 / 1000 = 75
    });

    it("rule 6: stale or unrecognized kid must be rejected", async () => {
      const forgedHashWithStaleKid = "qh_v2_stale-kid-2025_1999999999000_abcdef123456";

      const purchaseWithStaleKid = {
        ...validQuoteInput,
        quoteHash: forgedHashWithStaleKid,
        consentRulesUnderstood: true,
        idempotencyKey: "idem_stale_kid",
      };

      await expect(
        packagesService.purchasePackage("u_alice", purchaseWithStaleKid)
      ).rejects.toThrow();
    });
  });
});

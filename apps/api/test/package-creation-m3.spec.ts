import { newDb } from "pg-mem";
import { Decimal } from "decimal.js";
import { PackagesQuoteService } from "../src/modules/packages/packages-quote.service";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PlatformsService } from "../src/modules/platforms/platforms.service";
import { BadRequestException } from "@nestjs/common";

describe("Milestone M3: Package Creation Flow, Honest Quote, Guardrails & Blocklist", () => {
  const TEST_DB_NAME = "smm_db";
  let db: any;
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
        "handleRegex" TEXT NOT NULL,
        "handleMaxLength" INT NOT NULL DEFAULT 64,
        "pathPattern" TEXT NOT NULL,
        "mediaKeyExtractor" TEXT NOT NULL,
        "urlContainsHandle" BOOLEAN NOT NULL DEFAULT false,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "PlatformHandleBlocklist" (
        id VARCHAR(64) PRIMARY KEY,
        platform VARCHAR(32) NOT NULL,
        handle VARCHAR(128) NOT NULL,
        reason TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX "PlatformHandleBlocklist_platform_handle_key" ON "PlatformHandleBlocklist"(platform, handle);

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
      CREATE UNIQUE INDEX "unique_active_package_per_platform_handle"
        ON "Package"(platform, handle) WHERE status = 'ACTIVE';

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

      CREATE TABLE "Refund" (
        id VARCHAR(64) PRIMARY KEY,
        "orderId" VARCHAR(64),
        "packageId" VARCHAR(64) REFERENCES "Package"(id),
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        amount NUMERIC(10, 2) NOT NULL,
        reason VARCHAR(255) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX "unique_refund_per_package_reason" ON "Refund"("packageId", reason);
    `);

    // Seed test users, wallet, and services
    db.public.none(`
      INSERT INTO "User" (id, email, name) VALUES ('usr_buyer', 'buyer@test.local', 'Package Buyer');
      INSERT INTO "Wallet" (id, "userId", balance) VALUES ('w_buyer', 'usr_buyer', 50000.00);

      INSERT INTO "Service" (id, name, "displayName", platform, "ratePer1000", "minQty", "maxQty", "packageEligible", "costINR")
      VALUES
        ('srv_ig_followers', 'Instagram Followers Steady', 'Instagram Followers', 'INSTAGRAM', 120.00, 50, 50000, true, 80.00),
        ('srv_ig_likes', 'Instagram Likes Fast', 'Instagram Likes', 'INSTAGRAM', 45.00, 100, 100000, true, 30.00),
        ('srv_tt_likes', 'TikTok Video Likes', 'TikTok Likes', 'TIKTOK', 60.00, 100, 100000, true, 40.00);
    `);

    // Mock Prisma for PlatformsService and QuoteService
    const mockPrisma = {
      isConnected: true,
      platformConfig: {
        findMany: async () => [],
        findUnique: async () => null,
      },
      platformHandleBlocklist: {
        findFirst: async ({ where }: any) => {
          const rows = db.public.many(
            `SELECT * FROM "PlatformHandleBlocklist" WHERE platform = '${where.platform}' AND LOWER(handle) = LOWER('${where.handle.equals}')`
          );
          return rows.length > 0 ? rows[0] : null;
        },
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
        findUnique: async () => null,
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
            VALUES ('${id}', '${data.packageId}', '${data.kind}', '${data.serviceId}', ${data.quantityPerPost}, ${data.maxPosts}, 0, ${data.unitCharge}, ${data.rateSnapshot}, ${data.reserve})
          `);
          return { id, ...data };
        },
      },
      packageExecution: {
        create: async ({ data }: any) => {
          const id = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.public.none(`
            INSERT INTO "PackageExecution" (id, "packageId", "ruleId", source, seq, quantity, "allocatedCharge", "executeAt")
            VALUES ('${id}', '${data.packageId}', '${data.ruleId}', '${data.source}', ${data.seq}, ${data.quantity}, ${data.allocatedCharge}, now())
          `);
          return { id, ...data };
        },
      },
      wallet: {
        update: async ({ where, data }: any) => {
          db.public.none(`UPDATE "Wallet" SET balance = ${data.balance} WHERE id = '${where.id}'`);
          return { id: where.id, balance: data.balance };
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
      $queryRawUnsafe: async (sql: string, ...args: any[]) => {
        let formatted = sql;
        for (let i = 0; i < args.length; i++) {
          formatted = formatted.replace(`$${i + 1}`, `'${args[i]}'`);
        }
        return db.public.many(formatted);
      },
      $transaction: async (fn: any) => {
        return fn(mockPrisma);
      },
    } as any;

    platformsService = new PlatformsService(mockPrisma);
    quoteService = new PackagesQuoteService(mockPrisma, platformsService);
    packagesService = new PackagesService(mockPrisma, quoteService, platformsService);
  });

  describe("1. Honest Quote Calculation (Zero Side Effects & Exact Price Match)", () => {
    it("computes exact quote showing rate per 1,000, quantity, maxPosts, total charge, and disclaimer", async () => {
      const quote = await quoteService.calculateQuote({
        platform: "instagram",
        handle: "@fashion_creator",
        followersDrip: {
          serviceId: "srv_ig_followers",
          quantity: 1000, // 1000 * 120 / 1000 = 120.00
          days: 10,
          intervalHours: 24,
        },
        postRules: [
          {
            serviceId: "srv_ig_likes",
            maxPosts: 10,
            maxQtyPerPost: 500, // 500 * 45 / 1000 = 22.50 per post * 10 = 225.00
            defaultWindowMin: 180,
          },
        ],
        consentRulesUnderstood: true,
      });

      expect(quote.valid).toBe(true);
      expect(quote.totalCharge).toBe(345.00); // 120 + 225 = 345.00
      expect(quote.disclaimer).toBe("Maximum total; unused is refunded at the end");
      expect(quote.items.length).toBe(2);

      // Verify followers line
      const followersLine = quote.items.find((i) => i.serviceId === "srv_ig_followers");
      expect(followersLine?.ratePer1000).toBe(120.00);
      expect(followersLine?.totalQuantity).toBe(1000);
      expect(followersLine?.charge).toBe(120.00);

      // Verify likes line
      const likesLine = quote.items.find((i) => i.serviceId === "srv_ig_likes");
      expect(likesLine?.ratePer1000).toBe(45.00);
      expect(likesLine?.quantityPerPost).toBe(500);
      expect(likesLine?.maxPosts).toBe(10);
      expect(likesLine?.charge).toBe(225.00);

      // Prove quote calculation had ZERO DB side effects: no package was inserted
      const packagesInDb = db.public.many(`SELECT * FROM "Package" WHERE handle = 'fashion_creator'`);
      expect(packagesInDb.length).toBe(0);
    });

    it("purchase price equals exactly the quote total charge", async () => {
      const quoteInput = {
        platform: "instagram" as const,
        handle: "@travel_creator",
        followersDrip: {
          serviceId: "srv_ig_followers",
          quantity: 500, // 500 * 120 / 1000 = 60.00
          days: 5,
          intervalHours: 24,
        },
        postRules: [
          {
            serviceId: "srv_ig_likes",
            maxPosts: 5,
            maxQtyPerPost: 200, // 200 * 45 / 1000 = 9.00 * 5 = 45.00
            defaultWindowMin: 180,
          },
        ],
        consentRulesUnderstood: true,
      };

      const quote = await quoteService.calculateQuote(quoteInput);
      const expectedPrice = 105.00; // 60 + 45
      expect(quote.totalCharge).toBe(expectedPrice);

      const initialWallet = db.public.one(`SELECT balance FROM "Wallet" WHERE "userId" = 'usr_buyer'`);

      const purchaseRes = await packagesService.purchasePackage("usr_buyer", {
        ...quoteInput,
        idempotencyKey: "idem_quote_match_1",
      });

      expect(purchaseRes.success).toBe(true);
      expect(Number(purchaseRes.package.reserveTotal)).toBe(expectedPrice);

      const afterWallet = db.public.one(`SELECT balance FROM "Wallet" WHERE "userId" = 'usr_buyer'`);
      expect(Number(initialWallet.balance) - Number(afterWallet.balance)).toBe(expectedPrice);
    });
  });

  describe("2. Safety Guardrails: Consent, Blocklist, Limit & Uniqueness", () => {
    it("rejects package purchase if consent checkbox is not checked", async () => {
      await expect(
        packagesService.purchasePackage("usr_buyer", {
          platform: "instagram",
          handle: "@fitness_star",
          postRules: [{ serviceId: "srv_ig_likes", maxPosts: 5, maxQtyPerPost: 100, defaultWindowMin: 180 }],
          idempotencyKey: "idem_no_consent",
          consentRulesUnderstood: false,
        })
      ).rejects.toThrow(/acknowledge and agree/i);
    });

    it("rejects quote and purchase if handle is on the admin blocklist", async () => {
      // Put handle on blocklist
      db.public.none(`
        INSERT INTO "PlatformHandleBlocklist" (id, platform, handle, reason)
        VALUES ('blk_1', 'instagram', 'banned_spammer', 'Spam report')
      `);

      // Quote rejected
      await expect(
        quoteService.calculateQuote({
          platform: "instagram",
          handle: "@banned_spammer",
          postRules: [{ serviceId: "srv_ig_likes", maxPosts: 5, maxQtyPerPost: 100, defaultWindowMin: 180 }],
        })
      ).rejects.toThrow(/blocked from creating packages/i);

      // Purchase rejected
      await expect(
        packagesService.purchasePackage("usr_buyer", {
          platform: "instagram",
          handle: "@banned_spammer",
          postRules: [{ serviceId: "srv_ig_likes", maxPosts: 5, maxQtyPerPost: 100, defaultWindowMin: 180 }],
          idempotencyKey: "idem_blocked_handle",
          consentRulesUnderstood: true,
        })
      ).rejects.toThrow(/blocked from purchasing packages/i);
    });

    it("rejects a second ACTIVE package for the same (platform, handle)", async () => {
      // First purchase succeeds
      const first = await packagesService.purchasePackage("usr_buyer", {
        platform: "instagram",
        handle: "@unique_handle_star",
        postRules: [{ serviceId: "srv_ig_likes", maxPosts: 5, maxQtyPerPost: 100, defaultWindowMin: 180 }],
        idempotencyKey: "idem_unique_1",
        consentRulesUnderstood: true,
      });
      expect(first.success).toBe(true);

      // Second purchase on same platform and handle rejected
      await expect(
        packagesService.purchasePackage("usr_buyer", {
          platform: "instagram",
          handle: "@unique_handle_star",
          postRules: [{ serviceId: "srv_ig_likes", maxPosts: 5, maxQtyPerPost: 100, defaultWindowMin: 180 }],
          idempotencyKey: "idem_unique_2",
          consentRulesUnderstood: true,
        })
      ).rejects.toThrow(/ACTIVE package already exists/i);
    });

    it("allows package on different platform for the same handle name", async () => {
      // TikTok with same handle name succeeds
      const ttRes = await packagesService.purchasePackage("usr_buyer", {
        platform: "tiktok",
        handle: "@unique_handle_star",
        postRules: [{ serviceId: "srv_tt_likes", maxPosts: 5, maxQtyPerPost: 100, defaultWindowMin: 180 }],
        idempotencyKey: "idem_diff_platform_1",
        consentRulesUnderstood: true,
      });
      expect(ttRes.success).toBe(true);
    });

    it("enforces maximum N active handles per user", async () => {
      // User currently has @travel_creator (IG), @unique_handle_star (IG), @unique_handle_star (TT) -> 3 handles
      // Add handle 4 and handle 5
      await packagesService.purchasePackage("usr_buyer", {
        platform: "instagram",
        handle: "@handle_four",
        postRules: [{ serviceId: "srv_ig_likes", maxPosts: 1, maxQtyPerPost: 100, defaultWindowMin: 180 }],
        idempotencyKey: "idem_h4",
        consentRulesUnderstood: true,
      });

      await packagesService.purchasePackage("usr_buyer", {
        platform: "instagram",
        handle: "@handle_five",
        postRules: [{ serviceId: "srv_ig_likes", maxPosts: 1, maxQtyPerPost: 100, defaultWindowMin: 180 }],
        idempotencyKey: "idem_h5",
        consentRulesUnderstood: true,
      });

      // 6th handle for the same user is rejected under max handles limit
      await expect(
        packagesService.purchasePackage("usr_buyer", {
          platform: "instagram",
          handle: "@handle_six_rejected",
          postRules: [{ serviceId: "srv_ig_likes", maxPosts: 1, maxQtyPerPost: 100, defaultWindowMin: 180 }],
          idempotencyKey: "idem_h6",
          consentRulesUnderstood: true,
        })
      ).rejects.toThrow(/Account handle limit reached: you may manage at most 5 active handles/i);
    });
  });
});

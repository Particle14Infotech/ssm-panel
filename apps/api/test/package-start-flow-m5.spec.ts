import { newDb } from "pg-mem";
import { Decimal } from "decimal.js";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PackagesQuoteService } from "../src/modules/packages/packages-quote.service";
import { PlatformsService } from "../src/modules/platforms/platforms.service";
import { DEFAULT_PLATFORM_CONFIGS } from "../src/modules/platforms/platform-rules.util";
import { BadRequestException, ConflictException } from "@nestjs/common";

describe("Milestone M5: Start Flow, Link Normalization, Atomic Quota & Parallel Idempotency", () => {
  const TEST_DB_NAME = "smm_db";
  let db: any;
  let packagesService: PackagesService;
  let quoteService: PackagesQuoteService;
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

      CREATE TABLE "PlatformConfig" (
        id VARCHAR(64) PRIMARY KEY,
        platform VARCHAR(32) UNIQUE NOT NULL,
        "displayName" VARCHAR(128) NOT NULL,
        "handleRegex" VARCHAR(255) NOT NULL,
        "handleMaxLength" INT NOT NULL DEFAULT 64,
        "hostAllowlist" TEXT[] NOT NULL DEFAULT '{}',
        "pathPattern" VARCHAR(255) NOT NULL,
        "mediaKeyExtractor" VARCHAR(255) NOT NULL,
        "urlContainsHandle" BOOLEAN NOT NULL DEFAULT false,
        "eligibleRuleKinds" TEXT[] NOT NULL DEFAULT '{"POST_TRIGGERED", "TIME_DRIP"}',
        "followersIntervals" INT[] NOT NULL DEFAULT '{1, 2, 4, 8, 12, 24}',
        "minGapMinutes" INT NOT NULL DEFAULT 15,
        "maxRunsPerPost" INT NOT NULL DEFAULT 10,
        "defaultWindowMinutes" INT NOT NULL DEFAULT 180,
        limits JSONB NOT NULL DEFAULT '{}',
        active BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "PlatformHandleBlocklist" (
        id VARCHAR(64) PRIMARY KEY,
        platform VARCHAR(32) NOT NULL,
        handle VARCHAR(128) NOT NULL,
        reason TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (platform, handle)
      );

      CREATE TABLE "Service" (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        "displayName" VARCHAR(255),
        platform VARCHAR(64) NOT NULL,
        "ratePer1000" NUMERIC(10, 2) NOT NULL,
        "minQty" INT NOT NULL DEFAULT 10,
        "maxQty" INT NOT NULL DEFAULT 100000,
        "packageEligible" BOOLEAN NOT NULL DEFAULT true,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        "providerId" VARCHAR(64),
        "providerServiceId" VARCHAR(64),
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
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "PackageRule" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
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
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "PackageTrigger" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
        "mediaKey" VARCHAR(128) NOT NULL,
        "targetUrl" TEXT NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("packageId", "mediaKey")
      );

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
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default platform configs
    for (const def of DEFAULT_PLATFORM_CONFIGS) {
      db.public.none(`
        INSERT INTO "PlatformConfig" (id, platform, "displayName", "handleRegex", "handleMaxLength", "hostAllowlist", "pathPattern", "mediaKeyExtractor", "urlContainsHandle", "defaultWindowMinutes")
        VALUES ('pc_${def.platform}', '${def.platform}', '${def.displayName}', '${def.handleRegex}', ${def.handleMaxLength}, ARRAY['${def.hostAllowlist.join("','")}'], '${def.pathPattern}', '${def.mediaKeyExtractor}', ${def.urlContainsHandle}, ${def.defaultWindowMinutes});
      `);
    }

    const mockPrisma: any = {
      isConnected: true,
      $queryRawUnsafe: async (query: string, ...params: any[]) => {
        let sql = query;
        params.forEach((param, idx) => {
          const val = param instanceof Date
            ? `'${param.toISOString()}'`
            : typeof param === "string"
              ? `'${param.replace(/'/g, "''")}'`
              : param;
          sql = sql.replace(new RegExp(`\\$${idx + 1}`, "g"), val);
        });
        sql = sql.replace(/FOR UPDATE.*?SKIP LOCKED/gi, "");
        sql = sql.replace(/FOR UPDATE/gi, "");
        return db.public.many(sql);
      },
      $transaction: async (fn: any) => {
        const txMock: any = {
          $queryRawUnsafe: async (q: string, ...p: any[]) => mockPrisma.$queryRawUnsafe(q, ...p),
          package: {
            findFirst: async ({ where }: any) => {
              const rows = db.public.many(
                `SELECT * FROM "Package" WHERE id = '${where.id}' AND "userId" = '${where.userId}'`
              );
              return rows[0] || null;
            },
          },
          packageTrigger: {
            findUnique: async ({ where }: any) => {
              const rows = db.public.many(
                `SELECT * FROM "PackageTrigger" WHERE "packageId" = '${where.packageId_mediaKey.packageId}' AND "mediaKey" = '${where.packageId_mediaKey.mediaKey}'`
              );
              return rows[0] || null;
            },
            create: async ({ data }: any) => {
              const id = `trig_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              // Simulate DB UNIQUE constraint
              const existing = db.public.many(
                `SELECT id FROM "PackageTrigger" WHERE "packageId" = '${data.packageId}' AND "mediaKey" = '${data.mediaKey}'`
              );
              if (existing.length > 0) {
                throw new ConflictException(`This link has already been started for package #${data.packageId}.`);
              }
              db.public.none(
                `INSERT INTO "PackageTrigger" (id, "packageId", "mediaKey", "targetUrl")
                 VALUES ('${id}', '${data.packageId}', '${data.mediaKey}', '${data.targetUrl}')`
              );
              return { id, ...data };
            },
          },
          packageRule: {
            findMany: async ({ where }: any) => {
              const rows = db.public.many(
                `SELECT * FROM "PackageRule" WHERE "packageId" = '${where.packageId}' AND kind = '${where.kind}'`
              );
              return rows.map((r: any) => {
                const [svc] = db.public.many(`SELECT * FROM "Service" WHERE id = '${r.serviceId}'`);
                return { ...r, service: svc };
              });
            },
            findFirst: async ({ where }: any) => {
              const rows = db.public.many(
                `SELECT * FROM "PackageRule" WHERE id = '${where.id}' AND "packageId" = '${where.packageId}'`
              );
              if (rows.length === 0) return null;
              const [svc] = db.public.many(`SELECT * FROM "Service" WHERE id = '${rows[0].serviceId}'`);
              return { ...rows[0], service: svc };
            },
          },
          packageExecution: {
            create: async ({ data }: any) => {
              const id = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              db.public.none(
                `INSERT INTO "PackageExecution" (id, "packageId", "ruleId", "triggerId", "mediaKey", "targetUrl", source, seq, quantity, "allocatedCharge", "executeAt", status)
                 VALUES ('${id}', '${data.packageId}', '${data.ruleId}', '${data.triggerId}', '${data.mediaKey}', '${data.targetUrl}', '${data.source}', ${data.seq}, ${data.quantity}, ${data.allocatedCharge}, '${data.executeAt.toISOString()}', '${data.status}')`
              );
              return { id, ...data };
            },
          },
        };
        return fn(txMock);
      },
      package: {
        findFirst: async ({ where }: any) => {
          const rows = db.public.many(
            `SELECT * FROM "Package" WHERE id = '${where.id}' AND "userId" = '${where.userId}'`
          );
          if (rows.length === 0) return null;
          const pkg = rows[0];
          const rules = db.public.many(
            `SELECT * FROM "PackageRule" WHERE "packageId" = '${pkg.id}'`
          );
          const rulesWithService = rules.map((r: any) => {
            const [svc] = db.public.many(`SELECT * FROM "Service" WHERE id = '${r.serviceId}'`);
            return { ...r, service: svc };
          });
          return { ...pkg, rules: rulesWithService };
        },
      },
      packageTrigger: {
        findUnique: async ({ where }: any) => {
          const rows = db.public.many(
            `SELECT * FROM "PackageTrigger" WHERE "packageId" = '${where.packageId_mediaKey.packageId}' AND "mediaKey" = '${where.packageId_mediaKey.mediaKey}'`
          );
          return rows[0] || null;
        },
      },
      platformConfig: {
        findUnique: async ({ where }: any) => {
          const rows = db.public.many(
            `SELECT * FROM "PlatformConfig" WHERE platform = '${where.platform}'`
          );
          return rows[0] || null;
        },
      },
    };

    platformsService = new PlatformsService(mockPrisma);
    quoteService = new PackagesQuoteService(mockPrisma, platformsService);
    packagesService = new PackagesService(mockPrisma, quoteService, platformsService);
  });

  describe("1. Link Normalization and MediaKey Extraction", () => {
    const userId = "usr_m5_test";
    const pkgId = "pkg_m5_ig";

    beforeAll(() => {
      db.public.none(`
        INSERT INTO "User" (id, email, name) VALUES ('${userId}', 'm5@test.com', 'M5 Tester');

        INSERT INTO "Service" (id, name, "displayName", platform, "ratePer1000", "minQty", "maxQty", "packageEligible")
        VALUES ('svc_likes', 'Instagram Likes', 'HQ Likes', 'instagram', 30.00, 50, 50000, true);

        INSERT INTO "Package" (id, "userId", platform, handle, status, "startAt", "endAt", "reserveTotal")
        VALUES ('${pkgId}', '${userId}', 'instagram', 'creator_daily', 'ACTIVE', '2026-10-01 00:00:00', '2026-12-01 00:00:00', 300.00);

        INSERT INTO "PackageRule" (id, "packageId", kind, "serviceId", "quantityPerPost", "maxPosts", "unitCharge", "rateSnapshot", reserve)
        VALUES ('rule_likes', '${pkgId}', 'POST_TRIGGERED', 'svc_likes', 500, 10, 15.00, 30.00, 150.00);
      `);
    });

    it("rejects short links with clear user-friendly error message", async () => {
      await expect(
        packagesService.triggerPreview(userId, pkgId, {
          url: "https://bit.ly/3xyz123",
        })
      ).rejects.toThrow("Shortened URLs are not permitted. Please provide the direct platform link.");

      await expect(
        packagesService.triggerPreview(userId, pkgId, {
          url: "https://tinyurl.com/abc999",
        })
      ).rejects.toThrow("Shortened URLs are not permitted. Please provide the direct platform link.");
    });

    it("rejects wrong host or non-platform links", async () => {
      await expect(
        packagesService.triggerPreview(userId, pkgId, {
          url: "https://random-site.com/p/C0XYZ123",
        })
      ).rejects.toThrow("Invalid host");
    });

    it("normalizes direct link and extracts mediaKey with zero side effects", async () => {
      const preview = await packagesService.triggerPreview(userId, pkgId, {
        url: "https://www.instagram.com/reel/C0XYZ_abc123/?utm_source=ig_web_copy_link",
      });

      expect(preview.mediaKey).toBe("C0XYZ_abc123");
      expect(preview.alreadyTriggered).toBe(false);
      expect(preview.rules.length).toBe(1);
      expect(preview.rules[0].defaultQuantity).toBe(500);
      expect(preview.rules[0].remainingPosts).toBe(10);
      expect(preview.rules[0].runsCount).toBeGreaterThan(0);

      // Verify ZERO triggers or executions were written to the database
      const triggersCount = db.public.many(`SELECT count(*) FROM "PackageTrigger"`);
      expect(Number(triggersCount[0].count)).toBe(0);
    });

    it("enforces handle match when urlContainsHandle is true (e.g. TikTok)", async () => {
      const ttPkgId = "pkg_m5_tt";
      db.public.none(`
        INSERT INTO "Package" (id, "userId", platform, handle, status, "startAt", "endAt", "reserveTotal")
        VALUES ('${ttPkgId}', '${userId}', 'tiktok', 'dance_star', 'ACTIVE', '2026-10-01 00:00:00', '2026-12-01 00:00:00', 300.00);
        INSERT INTO "PackageRule" (id, "packageId", kind, "serviceId", "quantityPerPost", "maxPosts", "unitCharge", "rateSnapshot", reserve)
        VALUES ('rule_tt', '${ttPkgId}', 'POST_TRIGGERED', 'svc_likes', 500, 10, 15.00, 30.00, 150.00);
      `);

      // Mismatched handle in TikTok URL
      await expect(
        packagesService.triggerPreview(userId, ttPkgId, {
          url: "https://www.tiktok.com/@other_user/video/7123456789012345678",
        })
      ).rejects.toThrow("does not match the package handle (@dance_star)");

      // Matching handle in TikTok URL
      const preview = await packagesService.triggerPreview(userId, ttPkgId, {
        url: "https://www.tiktok.com/@dance_star/video/7123456789012345678",
      });
      expect(preview.mediaKey).toBe("7123456789012345678");
    });
  });

  describe("2. Start Flow: 50 Parallel Calls & Atomic Quota", () => {
    const userId = "usr_m5_parallel";
    const pkgId = "pkg_m5_parallel";
    const ruleId = "rule_m5_parallel";

    beforeAll(() => {
      db.public.none(`
        INSERT INTO "User" (id, email, name) VALUES ('${userId}', 'parallel@test.com', 'Parallel Tester');
        INSERT INTO "Package" (id, "userId", platform, handle, status, "startAt", "endAt", "reserveTotal")
        VALUES ('${pkgId}', '${userId}', 'instagram', 'parallel_handle', 'ACTIVE', '2026-10-01 00:00:00', '2026-12-01 00:00:00', 500.00);

        INSERT INTO "PackageRule" (id, "packageId", kind, "serviceId", "quantityPerPost", "maxPosts", "usedCount", "unitCharge", "rateSnapshot", reserve)
        VALUES ('${ruleId}', '${pkgId}', 'POST_TRIGGERED', 'svc_likes', 500, 3, 0, 15.00, 30.00, 45.00);
      `);
    });

    it("50 parallel Start calls on one link create exactly ONE trigger and one set of executions", async () => {
      const url = "https://www.instagram.com/p/CONCURRENCY_TEST_123/";

      // Dispatch 50 concurrent calls to triggerStart
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          packagesService
            .triggerStart(
              userId,
              pkgId,
              {
                url,
                rules: [{ ruleId, quantity: 500 }],
              },
              `idemp_concurrency_${i}`
            )
            .catch((err) => ({ error: err }))
        );
      }

      const results = await Promise.all(promises);
      const successes = results.filter((r) => r.success === true);
      const failures = results.filter((r) => r.error !== undefined);

      // Exactly ONE call succeeds; 49 calls fail due to unique(packageId, mediaKey)
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(49);

      // Verify in DB that only 1 trigger exists
      const triggers = db.public.many(
        `SELECT * FROM "PackageTrigger" WHERE "packageId" = '${pkgId}' AND "mediaKey" = 'CONCURRENCY_TEST_123'`
      );
      expect(triggers.length).toBe(1);

      // Verify quota usedCount incremented exactly once (from 0 to 1)
      const [rule] = db.public.many(`SELECT "usedCount", "maxPosts" FROM "PackageRule" WHERE id = '${ruleId}'`);
      expect(rule.usedCount).toBe(1);
    });

    it("rejects chosen quantity exceeding maxQtyPerPost", async () => {
      const url = "https://www.instagram.com/p/OVER_QTY_TEST/";
      await expect(
        packagesService.triggerStart(
          userId,
          pkgId,
          {
            url,
            rules: [{ ruleId, quantity: 600 }], // maxQtyPerPost is 500
          },
          "idemp_over_qty"
        )
      ).rejects.toThrow("exceeds maximum allowed quantity per post (500)");
    });

    it("enforces quota limit: fails when usedCount reaches maxPosts", async () => {
      // Rule has maxPosts = 3, usedCount is currently 1
      // Trigger post 2
      await packagesService.triggerStart(
        userId,
        pkgId,
        { url: "https://www.instagram.com/p/POST_TWO/", rules: [{ ruleId, quantity: 500 }] },
        "idemp_post_2"
      );

      // Trigger post 3 (quota reaches 3/3)
      await packagesService.triggerStart(
        userId,
        pkgId,
        { url: "https://www.instagram.com/p/POST_THREE/", rules: [{ ruleId, quantity: 500 }] },
        "idemp_post_3"
      );

      // Attempt post 4: should be rejected
      await expect(
        packagesService.triggerStart(
          userId,
          pkgId,
          { url: "https://www.instagram.com/p/POST_FOUR/", rules: [{ ruleId, quantity: 500 }] },
          "idemp_post_4"
        )
      ).rejects.toThrow("Quota exhausted");

      // Verify quota never exceeded 3
      const [rule] = db.public.many(`SELECT "usedCount", "maxPosts" FROM "PackageRule" WHERE id = '${ruleId}'`);
      expect(rule.usedCount).toBe(3);
    });
  });
});

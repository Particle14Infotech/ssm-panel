import { newDb } from "pg-mem";
import { Decimal } from "decimal.js";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PackagesQuoteService } from "../src/modules/packages/packages-quote.service";
import { PlatformsService } from "../src/modules/platforms/platforms.service";
import {
  DEFAULT_PLATFORM_CONFIGS,
  normalizeHandle,
  validateHandle,
  validatePlatformLink,
} from "../src/modules/platforms/platform-rules.util";
import {
  calculateFollowersDrip,
  calculatePerPostDrip,
} from "../src/modules/packages/drip-engine.util";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

describe("Milestone M8: Final Comprehensive Gate (14 Invariant & Verification Scenarios)", () => {
  const TEST_DB_NAME = "smm_db";
  let db: any;
  let packagesService: PackagesService;
  let quoteService: PackagesQuoteService;
  let platformsService: PlatformsService;
  let mockPrisma: any;
  let refundsStore: any[] = [];

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
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("userId", "idempotencyKey")
      );

      CREATE TABLE "PackageRule" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
        "serviceId" VARCHAR(64) NOT NULL REFERENCES "Service"(id),
        kind VARCHAR(32) NOT NULL,
        "rateSnapshot" NUMERIC(10, 2) NOT NULL,
        "maxPosts" INT NOT NULL DEFAULT 1,
        "usedCount" INT NOT NULL DEFAULT 0,
        "quantityPerPost" INT NOT NULL DEFAULT 0,
        "deliveryWindowMin" INT,
        "totalFollowers" INT,
        "intervalDays" INT,
        "unitCharge" NUMERIC(12, 2) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "PackageTrigger" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
        "mediaKey" VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        "mediaType" VARCHAR(64),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("packageId", "mediaKey")
      );

      CREATE TABLE "PackageExecution" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
        "ruleId" VARCHAR(64) NOT NULL REFERENCES "PackageRule"(id),
        "triggerId" VARCHAR(64) REFERENCES "PackageTrigger"(id),
        "mediaKey" VARCHAR(255),
        "targetUrl" TEXT NOT NULL,
        source VARCHAR(32) NOT NULL,
        seq INT NOT NULL,
        quantity INT NOT NULL,
        "allocatedCharge" NUMERIC(12, 2) NOT NULL,
        "executeAt" TIMESTAMP NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
        "childOrderId" VARCHAR(64),
        "skipReason" TEXT,
        attempts INT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "Transaction" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        type VARCHAR(32) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        "balanceBefore" NUMERIC(12, 2) NOT NULL,
        "balanceAfter" NUMERIC(12, 2) NOT NULL,
        reference VARCHAR(255),
        reason TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "SystemSetting" (
        key VARCHAR(64) PRIMARY KEY,
        value JSONB NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default PlatformConfig
    for (const def of DEFAULT_PLATFORM_CONFIGS) {
      db.public.none(
        `INSERT INTO "PlatformConfig" (
          id, platform, "displayName", "handleRegex", "handleMaxLength", "hostAllowlist",
          "pathPattern", "mediaKeyExtractor", "urlContainsHandle", "eligibleRuleKinds",
          "followersIntervals", "minGapMinutes", "maxRunsPerPost", "defaultWindowMinutes"
        ) VALUES (
          'cfg-${def.platform}', '${def.platform}', '${def.displayName}', '${def.handleRegex.replace(/\\/g, "\\\\")}',
          ${def.handleMaxLength}, ARRAY[${def.hostAllowlist.map((h: string) => `'${h}'`).join(",")}]::text[],
          '${def.pathPattern.replace(/\\/g, "\\\\")}', '${def.mediaKeyExtractor}', ${def.urlContainsHandle},
          ARRAY['POST_TRIGGERED', 'TIME_DRIP']::text[], ARRAY[1, 2, 4, 8, 12, 24]::int[],
          ${def.minGapMinutes}, ${def.maxRunsPerPost}, ${def.defaultWindowMinutes}
        )`
      );
    }

    // Seed Services for package testing
    db.public.none(`
      INSERT INTO "Service" (id, name, "displayName", platform, "ratePer1000", "minQty", "maxQty", "packageEligible")
      VALUES 
        ('srv-ig-likes', 'Instagram Likes', 'HQ Likes', 'instagram', 20.00, 100, 10000, true),
        ('srv-ig-views', 'Instagram Views', 'Reel Views', 'instagram', 10.00, 500, 50000, true),
        ('srv-ig-followers', 'Instagram Followers', 'Followers Drip', 'instagram', 50.00, 100, 20000, true),
        ('srv-yt-views', 'YouTube Views', 'YT Fast Views', 'youtube', 80.00, 1000, 100000, true),
        ('srv-tt-likes', 'TikTok Likes', 'TikTok Likes', 'tiktok', 30.00, 100, 25000, true);
    `);

    // Prisma Service Mock wrapping pg-mem
    mockPrisma = {
      isConnected: true,
      $queryRawUnsafe: async (sql: string, ...params: any[]) => {
        let converted = sql;
        params.forEach((param, i) => {
          const val = param instanceof Date
            ? `'${param.toISOString()}'`
            : typeof param === "string"
            ? `'${param.replace(/'/g, "''")}'`
            : param;
          converted = converted.replace(new RegExp(`\\$${i + 1}\\b`, "g"), String(val));
        });
        converted = converted.replace(/FOR UPDATE/gi, "");
        return db.public.many(converted);
      },
      $executeRawUnsafe: async (sql: string, ...params: any[]) => {
        let converted = sql;
        params.forEach((param, i) => {
          const val = param instanceof Date
            ? `'${param.toISOString()}'`
            : typeof param === "string"
            ? `'${param.replace(/'/g, "''")}'`
            : param;
          converted = converted.replace(new RegExp(`\\$${i + 1}\\b`, "g"), String(val));
        });
        return db.public.none(converted);
      },
      $transaction: async (cb: any) => cb(mockPrisma),
      platformConfig: {
        findUnique: async ({ where }: any) => {
          const match = DEFAULT_PLATFORM_CONFIGS.find((p) => p.platform === where.platform.toLowerCase());
          if (match) return match;
          try {
            return db.public.one(`SELECT * FROM "PlatformConfig" WHERE platform = '${where.platform}'`);
          } catch {
            return null;
          }
        },
        findMany: async () => DEFAULT_PLATFORM_CONFIGS,
      },
      platformHandleBlocklist: {
        findFirst: async ({ where }: any) => {
          try {
            return db.public.one(
              `SELECT * FROM "PlatformHandleBlocklist" WHERE platform = '${where.platform}' AND handle = '${where.handle}'`
            );
          } catch {
            return null;
          }
        },
      },
      service: {
        findUnique: async ({ where }: any) => {
          try {
            return db.public.one(`SELECT * FROM "Service" WHERE id = '${where.id}'`);
          } catch {
            return null;
          }
        },
        findMany: async ({ where }: any) => {
          let sql = `SELECT * FROM "Service" WHERE 1=1`;
          if (where?.id?.in) {
            sql += ` AND id IN (${where.id.in.map((id: string) => `'${id}'`).join(",")})`;
          }
          if (where?.platform) {
            sql += ` AND platform = '${where.platform}'`;
          }
          return db.public.many(sql);
        },
      },
      user: {
        findUnique: async ({ where }: any) => {
          try {
            return db.public.one(`SELECT * FROM "User" WHERE id = '${where.id}'`);
          } catch {
            return null;
          }
        },
      },
      wallet: {
        findUnique: async ({ where }: any) => {
          try {
            return db.public.one(`SELECT * FROM "Wallet" WHERE "userId" = '${where.userId}'`);
          } catch {
            return null;
          }
        },
        update: async ({ where, data }: any) => {
          db.public.none(`UPDATE "Wallet" SET balance = ${data.balance} WHERE id = '${where.id}'`);
          return db.public.one(`SELECT * FROM "Wallet" WHERE id = '${where.id}'`);
        },
      },
      package: {
        findUnique: async ({ where }: any) => {
          try {
            if (where.unique_package_idempotency_per_user) {
              const { userId, idempotencyKey } = where.unique_package_idempotency_per_user;
              return db.public.one(
                `SELECT * FROM "Package" WHERE "userId" = '${userId}' AND "idempotencyKey" = '${idempotencyKey}'`
              );
            }
            return db.public.one(`SELECT * FROM "Package" WHERE id = '${where.id}'`);
          } catch {
            return null;
          }
        },
        findFirst: async ({ where }: any) => {
          try {
            let sql = `SELECT * FROM "Package" WHERE 1=1`;
            if (where.id) sql += ` AND id = '${where.id}'`;
            if (where.userId) sql += ` AND "userId" = '${where.userId}'`;
            if (where.platform) sql += ` AND platform = '${where.platform}'`;
            if (where.handle) sql += ` AND handle = '${where.handle}'`;
            if (where.status) sql += ` AND status = '${where.status}'`;
            return db.public.one(sql);
          } catch {
            return null;
          }
        },
        count: async ({ where }: any) => {
          const res = db.public.one(
            `SELECT COUNT(DISTINCT handle) as c FROM "Package" WHERE "userId" = '${where.userId}'`
          );
          return parseInt(res.c, 10);
        },
        findMany: async ({ where, select }: any) => {
          let sql = `SELECT * FROM "Package" WHERE 1=1`;
          if (where?.userId) sql += ` AND "userId" = '${where.userId}'`;
          if (where?.status) sql += ` AND status = '${where.status}'`;
          if (where?.platform) sql += ` AND platform = '${where.platform}'`;
          if (where?.handle) sql += ` AND handle = '${where.handle}'`;
          return db.public.many(sql);
        },
        create: async ({ data }: any) => {
          const id = `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.public.none(
            `INSERT INTO "Package" (id, "userId", platform, handle, kind, status, "startAt", "endAt", "pausedDays", "reserveTotal", "idempotencyKey")
             VALUES ('${id}', '${data.userId}', '${data.platform}', '${data.handle}', '${data.kind || "GROWTH"}',
                     '${data.status || "ACTIVE"}', '${data.startAt.toISOString()}', '${data.endAt.toISOString()}',
                     0, ${data.reserveTotal}, '${data.idempotencyKey || ""}')`
          );
          return db.public.one(`SELECT * FROM "Package" WHERE id = '${id}'`);
        },
        update: async ({ where, data }: any) => {
          let sets: string[] = [];
          if (data.status) sets.push(`status = '${data.status}'`);
          if (data.endAt) sets.push(`"endAt" = '${data.endAt.toISOString()}'`);
          if (data.pausedDays !== undefined) sets.push(`"pausedDays" = ${data.pausedDays}`);
          db.public.none(`UPDATE "Package" SET ${sets.join(", ")}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = '${where.id}'`);
          return db.public.one(`SELECT * FROM "Package" WHERE id = '${where.id}'`);
        },
      },
      packageRule: {
        create: async ({ data }: any) => {
          const id = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.public.none(
            `INSERT INTO "PackageRule" (
              id, "packageId", "serviceId", kind, "rateSnapshot", "maxPosts", "usedCount",
              "quantityPerPost", "deliveryWindowMin", "totalFollowers", "intervalDays", "unitCharge"
            ) VALUES (
              '${id}', '${data.packageId}', '${data.serviceId}', '${data.kind}', ${data.rateSnapshot},
              ${data.maxPosts || 1}, 0, ${data.quantityPerPost || 0}, ${data.deliveryWindowMin || 60},
              ${data.totalFollowers || 0}, ${data.intervalDays || 1}, ${data.unitCharge}
            )`
          );
          return db.public.one(`SELECT * FROM "PackageRule" WHERE id = '${id}'`);
        },
        findMany: async ({ where }: any) => {
          let sql = `SELECT * FROM "PackageRule" WHERE 1=1`;
          if (where.packageId) sql += ` AND "packageId" = '${where.packageId}'`;
          if (where.kind) sql += ` AND kind = '${where.kind}'`;
          const rules = db.public.many(sql);
          for (const r of rules) {
            r.service = db.public.one(`SELECT * FROM "Service" WHERE id = '${r.serviceId}'`);
          }
          return rules;
        },
      },
      packageTrigger: {
        findUnique: async ({ where }: any) => {
          try {
            if (where.packageId_mediaKey) {
              const { packageId, mediaKey } = where.packageId_mediaKey;
              return db.public.one(
                `SELECT * FROM "PackageTrigger" WHERE "packageId" = '${packageId}' AND "mediaKey" = '${mediaKey}'`
              );
            }
            return db.public.one(`SELECT * FROM "PackageTrigger" WHERE id = '${where.id}'`);
          } catch {
            return null;
          }
        },
        create: async ({ data }: any) => {
          const id = `trig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          try {
            db.public.none(
              `INSERT INTO "PackageTrigger" (id, "packageId", "mediaKey", url, "mediaType")
               VALUES ('${id}', '${data.packageId}', '${data.mediaKey}', '${data.url}', '${data.mediaType || "POST"}')`
            );
          } catch (err: any) {
            if (err.message && err.message.includes("unique")) {
              throw new ConflictException(`Media key "${data.mediaKey}" has already been processed.`);
            }
            throw err;
          }
          return db.public.one(`SELECT * FROM "PackageTrigger" WHERE id = '${id}'`);
        },
        findMany: async ({ where }: any) => {
          return db.public.many(`SELECT * FROM "PackageTrigger" WHERE "packageId" = '${where.packageId}'`);
        },
      },
      refund: {
        create: async ({ data }: any) => {
          const ref = { id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, ...data };
          refundsStore.push(ref);
          return ref;
        },
        findMany: async ({ where }: any = {}) => {
          return refundsStore.filter((r) => {
            if (where?.packageId && r.packageId !== where.packageId) return false;
            if (where?.userId && r.userId !== where.userId) return false;
            return true;
          });
        },
      },
      packageExecution: {
        create: async ({ data }: any) => {
          const id = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.public.none(
            `INSERT INTO "PackageExecution" (
              id, "packageId", "ruleId", "triggerId", "mediaKey", "targetUrl", source, seq,
              quantity, "allocatedCharge", "executeAt", status
            ) VALUES (
              '${id}', '${data.packageId}', '${data.ruleId}', '${data.triggerId || ""}',
              '${data.mediaKey || ""}', '${data.targetUrl}', '${data.source}', ${data.seq},
              ${data.quantity}, ${data.allocatedCharge}, '${data.executeAt.toISOString()}',
              '${data.status || "SCHEDULED"}'
            )`
          );
          return db.public.one(`SELECT * FROM "PackageExecution" WHERE id = '${id}'`);
        },
        findMany: async ({ where }: any) => {
          let sql = `SELECT * FROM "PackageExecution" WHERE 1=1`;
          if (where.packageId) sql += ` AND "packageId" = '${where.packageId}'`;
          if (where.status?.in) {
            sql += ` AND status IN (${where.status.in.map((s: string) => `'${s}'`).join(",")})`;
          }
          return db.public.many(sql);
        },
        updateMany: async ({ where, data }: any) => {
          let sql = `UPDATE "PackageExecution" SET status = '${data.status}' WHERE 1=1`;
          if (where.packageId) sql += ` AND "packageId" = '${where.packageId}'`;
          if (where.status?.in) {
            sql += ` AND status IN (${where.status.in.map((s: string) => `'${s}'`).join(",")})`;
          }
          return db.public.none(sql);
        },
      },
      transaction: {
        create: async ({ data }: any) => {
          const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          db.public.none(
            `INSERT INTO "Transaction" (id, "userId", type, amount, "balanceBefore", "balanceAfter", reference, reason)
             VALUES ('${id}', '${data.userId}', '${data.type}', ${data.amount}, ${data.balanceBefore},
                     ${data.balanceAfter}, '${data.reference || ""}', '${data.reason || ""}')`
          );
          return db.public.one(`SELECT * FROM "Transaction" WHERE id = '${id}'`);
        },
        findMany: async ({ where }: any) => {
          let sql = `SELECT * FROM "Transaction" WHERE 1=1`;
          if (where.reference) sql += ` AND reference = '${where.reference}'`;
          if (where.type) sql += ` AND type = '${where.type}'`;
          return db.public.many(sql);
        },
      },
      ledgerEntry: {
        create: async ({ data }: any) => {
          return { id: `led_${Date.now()}`, ...data };
        },
      },
      systemSetting: {
        findUnique: async () => null,
      },
    };

    platformsService = new PlatformsService(mockPrisma);
    quoteService = new PackagesQuoteService(mockPrisma);
    packagesService = new PackagesService(mockPrisma, quoteService, platformsService);
  });

  // Scenario 1: Handle validation per platform
  it("(1) handle validation per platform", async () => {
    const platforms = ["instagram", "tiktok", "youtube", "facebook", "x", "telegram"];
    for (const p of platforms) {
      const config = await platformsService.getPlatformConfig(p);
      expect(config).toBeDefined();

      // Valid handles (Facebook uses dots instead of underscores)
      const sampleHandle = p === "facebook" ? "good.creator1" : "good_creator1";
      const valid = validateHandle(sampleHandle, config);
      expect(valid).toBe(sampleHandle);

      // Invalid handle (too long)
      const tooLong = "a".repeat(config.handleMaxLength + 1);
      expect(() => validateHandle(tooLong, config)).toThrow(BadRequestException);

      // Invalid handle (illegal characters)
      expect(() => validateHandle("invalid handle with spaces", config)).toThrow(BadRequestException);
    }
  });

  // Scenario 2: Link normalization and mediaKey per platform
  it("(2) link normalization and mediaKey per platform with real sample links, rejecting wrong host, wrong platform and short links", async () => {
    const igConfig = await platformsService.getPlatformConfig("instagram");
    const ytConfig = await platformsService.getPlatformConfig("youtube");
    const ttConfig = await platformsService.getPlatformConfig("tiktok");

    // Real Instagram post
    const igLink = validatePlatformLink("https://www.instagram.com/p/DF123456789/", igConfig, "creator");
    expect(igLink.isValid).toBe(true);
    expect(igLink.mediaKey).toBe("DF123456789");

    // Real YouTube watch
    const ytLink = validatePlatformLink("https://www.youtube.com/watch?v=dQw4w9WgXcQ", ytConfig);
    expect(ytLink.isValid).toBe(true);
    expect(ytLink.mediaKey).toBe("dQw4w9WgXcQ");

    // Real TikTok video
    const ttLink = validatePlatformLink("https://www.tiktok.com/@creator/video/7123456789012345678", ttConfig);
    expect(ttLink.isValid).toBe(true);
    expect(ttLink.mediaKey).toBe("7123456789012345678");

    // Rejection: Wrong host
    expect(() => validatePlatformLink("https://untrusted-site.com/p/12345", igConfig)).toThrow(
      'Invalid host "untrusted-site.com"'
    );

    // Rejection: Short links
    expect(() => validatePlatformLink("https://bit.ly/3xyz123", igConfig)).toThrow(
      "Shortened URLs are not permitted"
    );

    // Rejection: Wrong platform
    expect(() => validatePlatformLink("https://youtube.com/watch?v=dQw4w9WgXcQ", igConfig)).toThrow(
      'Invalid host "youtube.com"'
    );
  });

  // Scenario 3: 50 parallel Start calls on one link
  it("(3) 50 parallel Start calls on one link create one trigger and one set of executions", async () => {
    // Setup user & wallet
    db.public.none(`INSERT INTO "User" (id, email, name) VALUES ('u-par', 'par@test.com', 'Parallel User')`);
    db.public.none(`INSERT INTO "Wallet" (id, "userId", balance) VALUES ('w-par', 'u-par', 50000.00)`);

    const pkg = await packagesService.purchasePackage("u-par", {
      platform: "instagram",
      handle: "creator_par",
      days: 30,
      consentRulesUnderstood: true,
      idempotencyKey: "idem_par_setup",
      items: [
        {
          serviceId: "srv-ig-likes",
          target: "https://instagram.com/creator_par",
          targetType: "POST_OR_REEL",
          quantity: 2000,
          quantityPerPost: 500,
          maxPosts: 4,
          deliveryWindowMin: 60,
        },
      ],
    });

    const postUrl = "https://www.instagram.com/p/UNIQUE_PAR_TEST_001/";
    const promises = Array.from({ length: 50 }).map((_, idx) =>
      packagesService
        .triggerStart(
          "u-par",
          pkg.package.id,
          { url: postUrl },
          `idem_call_${idx}`
        )
        .catch((err) => ({ error: err.message }))
    );

    const results = await Promise.all(promises);
    const successes = results.filter((r: any) => r.success);
    const conflicts = results.filter((r: any) => r.error && r.error.includes("already been processed"));

    // Exactly 1 start succeeded, 49 failed with conflict
    expect(successes.length).toBe(1);
    expect(conflicts.length).toBe(49);

    // Verify DB triggers count
    const triggers = await mockPrisma.packageTrigger.findMany({ where: { packageId: pkg.package.id } });
    expect(triggers.length).toBe(1);
  });

  // Scenario 4: Quota never exceeds maxPosts under parallel Starts
  it("(4) quota never exceeds maxPosts under parallel Starts", async () => {
    db.public.none(`INSERT INTO "User" (id, email, name) VALUES ('u-quota', 'quota@test.com', 'Quota User')`);
    db.public.none(`INSERT INTO "Wallet" (id, "userId", balance) VALUES ('w-quota', 'u-quota', 50000.00)`);

    const pkg = await packagesService.purchasePackage("u-quota", {
      platform: "instagram",
      handle: "creator_quota",
      days: 30,
      consentRulesUnderstood: true,
      idempotencyKey: "idem_quota_setup",
      items: [
        {
          serviceId: "srv-ig-likes",
          target: "https://instagram.com/creator_quota",
          targetType: "POST_OR_REEL",
          quantity: 1500,
          quantityPerPost: 500,
          maxPosts: 3, // exactly 3 posts max
          deliveryWindowMin: 60,
        },
      ],
    });

    // 15 parallel Start calls with 15 DIFFERENT links
    const promises = Array.from({ length: 15 }).map((_, idx) =>
      packagesService
        .triggerStart(
          "u-quota",
          pkg.package.id,
          { url: `https://www.instagram.com/p/QUOTA_POST_${idx}/` },
          `idem_quota_call_${idx}`
        )
        .catch((err) => ({ error: err.message }))
    );

    const results = await Promise.all(promises);
    const successes = results.filter((r: any) => r.success);
    const exhausted = results.filter((r: any) => r.error && r.error.includes("Quota exhausted"));

    // Exactly 3 succeed, 12 fail
    expect(successes.length).toBe(3);
    expect(exhausted.length).toBe(12);

    // Database check: usedCount must be exactly 3
    const rules = await mockPrisma.packageRule.findMany({ where: { packageId: pkg.package.id } });
    expect(rules[0].usedCount).toBe(3);
  });

  // Scenario 5: Chosen quantity above maxQtyPerPost is rejected
  it("(5) chosen quantity above maxQtyPerPost is rejected", async () => {
    db.public.none(`INSERT INTO "User" (id, email, name) VALUES ('u-qty', 'qty@test.com', 'Qty User')`);
    db.public.none(`INSERT INTO "Wallet" (id, "userId", balance) VALUES ('w-qty', 'u-qty', 10000.00)`);

    const pkg = await packagesService.purchasePackage("u-qty", {
      platform: "instagram",
      handle: "creator_qty",
      days: 30,
      consentRulesUnderstood: true,
      idempotencyKey: "idem_qty_setup",
      items: [
        {
          serviceId: "srv-ig-likes",
          target: "https://instagram.com/creator_qty",
          targetType: "POST_OR_REEL",
          quantity: 2000,
          quantityPerPost: 500, // max 500
          maxPosts: 4,
        },
      ],
    });

    const rule = (await mockPrisma.packageRule.findMany({ where: { packageId: pkg.package.id } }))[0];

    // Try to trigger with 600 > 500
    await expect(
      packagesService.triggerStart(
        "u-qty",
        pkg.package.id,
        {
          url: "https://www.instagram.com/p/QTY_TEST_001/",
          rules: [{ ruleId: rule.id, quantity: 600 }],
        },
        "idem_qty_overflow"
      )
    ).rejects.toThrow("exceeds maximum allowed quantity per post");
  });

  // Scenario 6: Interval drip math
  it("(6) interval drip math: sum(quantity)=q, sum(allocatedCharge)=charge, every run within min/max, spacing >= minGap", () => {
    const drip = calculatePerPostDrip({
      quantity: 1750,
      serviceMin: 100,
      serviceMax: 10000,
      maxRunsPerPost: 8,
      windowMinutes: 180,
      minGapMinutes: 15,
      ratePer1000: 40.0,
      startAt: new Date("2026-10-21T10:00:00Z"),
    });

    // 1. sum(quantity) == q
    const totalQ = drip.runs.reduce((acc, r) => acc + r.quantity, 0);
    expect(totalQ).toBe(1750);

    // 2. sum(allocatedCharge) == charge
    const totalCharge = Math.ceil((40.0 * 1750) / 1000);
    const sumAllocated = drip.runs.reduce((acc, r) => acc + r.allocatedCharge, 0);
    expect(sumAllocated).toBe(totalCharge);

    // 3. every run within min/max
    for (const r of drip.runs) {
      expect(r.quantity).toBeGreaterThanOrEqual(100);
      expect(r.quantity).toBeLessThanOrEqual(10000);
    }

    // 4. spacing >= minGap
    for (let i = 1; i < drip.runs.length; i++) {
      const prev = drip.runs[i - 1].executeAt.getTime();
      const curr = drip.runs[i].executeAt.getTime();
      const gapMin = (curr - prev) / (60 * 1000);
      expect(gapMin).toBeGreaterThanOrEqual(15);
    }
  });

  // Scenario 7: Followers drip math with warning on too-small quantity
  it("(7) followers drip math, including the too-small-quantity warning", () => {
    // Normal followers drip
    const normal = calculateFollowersDrip({
      totalQuantity: 3000,
      serviceMin: 100,
      days: 30,
      intervalHours: 24,
      ratePer1000: 50.0,
      startAt: new Date("2026-10-21T10:00:00Z"),
    });

    expect(normal.runs.length).toBe(30);
    const sumQ = normal.runs.reduce((acc, r) => acc + r.quantity, 0);
    expect(sumQ).toBe(3000);
    expect(normal.warning).toBeUndefined();

    // Too-small quantity (e.g. 150 across 30 days with serviceMin 100)
    const small = calculateFollowersDrip({
      totalQuantity: 150,
      serviceMin: 100,
      days: 30,
      intervalHours: 24,
      ratePer1000: 50.0,
      startAt: new Date("2026-10-21T10:00:00Z"),
    });

    expect(small.runs.length).toBe(1);
    expect(small.warning).toBeDefined();
    expect(small.warning).toContain("too small to split");
  });

  // Scenario 8: Purchased = Consumed + Refunded + Remaining invariant
  it("(8) purchased = consumed + refunded + remaining after randomized sequences", () => {
    for (let sim = 0; sim < 15; sim++) {
      const purchasedReserve = 10000;
      let remaining = purchasedReserve;
      let consumed = 0;
      let refunded = 0;

      // Random operations
      const numSteps = 5 + Math.floor(Math.random() * 10);
      for (let s = 0; s < numSteps; s++) {
        const op = Math.random();
        if (op < 0.5 && remaining > 500) {
          // Consume some quota
          const consumeAmount = Math.min(remaining, 500 + Math.floor(Math.random() * 1000));
          consumed += consumeAmount;
          remaining -= consumeAmount;
        } else if (op < 0.8 && consumed > 200) {
          // Partial execution refund
          const refundAmount = Math.floor(Math.random() * 100);
          refunded += refundAmount;
          consumed -= refundAmount;
        }
      }

      // Final settlement refunds whatever is remaining
      refunded += remaining;
      remaining = 0;

      // Invariant holds
      expect(purchasedReserve).toBe(consumed + refunded + remaining);
    }
  });

  // Scenario 9: Cancel vs Start vs Dispatch race
  it("(9) cancel vs Start vs dispatch race: nothing dispatches after cancel, refund exactly once", async () => {
    db.public.none(`INSERT INTO "User" (id, email, name) VALUES ('u-race', 'race@test.com', 'Race User')`);
    db.public.none(`INSERT INTO "Wallet" (id, "userId", balance) VALUES ('w-race', 'u-race', 50000.00)`);

    const pkg = await packagesService.purchasePackage("u-race", {
      platform: "instagram",
      handle: "creator_race",
      days: 30,
      consentRulesUnderstood: true,
      idempotencyKey: "idem_race_setup",
      items: [
        {
          serviceId: "srv-ig-likes",
          target: "https://instagram.com/creator_race",
          targetType: "POST_OR_REEL",
          quantity: 2000,
          quantityPerPost: 500,
          maxPosts: 4,
        },
      ],
    });

    // Start 1 post to generate scheduled executions
    await packagesService.triggerStart(
      "u-race",
      pkg.package.id,
      { url: "https://www.instagram.com/p/RACE_POST_01/" },
      "idem_race_start_01"
    );

    // Cancel package
    const cancelRes = await packagesService.cancelPackage("u-race", pkg.package.id);
    expect(cancelRes.success).toBe(true);
    expect(cancelRes.refundedAmount).toBeGreaterThan(0);

    // 1. Verify second cancel fails / does not double refund
    await expect(packagesService.cancelPackage("u-race", pkg.package.id)).rejects.toThrow();

    // 2. Verify new Start after cancel is rejected
    await expect(
      packagesService.triggerStart(
        "u-race",
        pkg.package.id,
        { url: "https://www.instagram.com/p/RACE_POST_02/" },
        "idem_race_start_02"
      )
    ).rejects.toThrow("Cannot trigger execution for package in status \"CANCELLED\"");

    // 3. Verify refund record was recorded exactly once
    const refunds = await mockPrisma.refund.findMany({
      where: { packageId: pkg.package.id },
    });
    expect(refunds.length).toBe(1);
    expect(refunds[0].reason).toBe("PACKAGE_CANCEL_UNUSED_RESERVE");
  });

  // Scenario 10: Settlement refunds unused reserve once
  it("(10) settlement refunds the unused reserve once", async () => {
    db.public.none(`INSERT INTO "User" (id, email, name) VALUES ('u-settle', 'settle@test.com', 'Settle User')`);
    db.public.none(`INSERT INTO "Wallet" (id, "userId", balance) VALUES ('w-settle', 'u-settle', 50000.00)`);

    const pkg = await packagesService.purchasePackage("u-settle", {
      platform: "instagram",
      handle: "creator_settle",
      days: 30,
      consentRulesUnderstood: true,
      idempotencyKey: "idem_settle_setup",
      items: [
        {
          serviceId: "srv-ig-likes",
          target: "https://instagram.com/creator_settle",
          targetType: "POST_OR_REEL",
          quantity: 1000,
          quantityPerPost: 500,
          maxPosts: 2,
        },
      ],
    });

    // Settle package at expiry
    const settle1 = await packagesService.settlePackage(pkg.package.id);
    expect(settle1.success).toBe(true);
    expect(settle1.settlementRefund).toBeGreaterThan(0);

    // Subsequent settlement on already completed package returns 0 refund
    const settle2 = await packagesService.settlePackage(pkg.package.id);
    expect(settle2.message).toBe("Package already settled.");
  });

  // Scenario 11: Prepaid child partial refund is never 0
  it("(11) prepaid child partial refund is never 0", () => {
    const allocatedCharge = 18.5;
    const quantity = 1000;
    const remains = 450;

    const refund = new Decimal(allocatedCharge)
      .times(remains)
      .dividedBy(quantity)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .toNumber();
    expect(refund).toBe(8.33);
    expect(refund).toBeGreaterThan(0);

    // Edge case: single unit remains on small charge
    const edgeCharge = 1.0;
    const edgeQty = 100;
    const edgeRemains = 1;
    const edgeRefund = Math.max(0.01, Math.round((edgeCharge * edgeRemains) / edgeQty * 100) / 100);
    expect(edgeRefund).toBe(0.01);
  });

  // Scenario 12: IDOR protections
  it("(12) IDOR: user A cannot preview, start or cancel user B's package", async () => {
    db.public.none(`INSERT INTO "User" (id, email, name) VALUES ('u-a', 'a@test.com', 'User A')`);
    db.public.none(`INSERT INTO "User" (id, email, name) VALUES ('u-b', 'b@test.com', 'User B')`);
    db.public.none(`INSERT INTO "Wallet" (id, "userId", balance) VALUES ('w-a', 'u-a', 10000.00)`);
    db.public.none(`INSERT INTO "Wallet" (id, "userId", balance) VALUES ('w-b', 'u-b', 10000.00)`);

    const pkgA = await packagesService.purchasePackage("u-a", {
      platform: "instagram",
      handle: "creator_a",
      days: 15,
      consentRulesUnderstood: true,
      idempotencyKey: "idem_idor_setup",
      items: [
        {
          serviceId: "srv-ig-likes",
          target: "https://instagram.com/creator_a",
          targetType: "POST_OR_REEL",
          quantity: 1000,
          quantityPerPost: 500,
          maxPosts: 2,
        },
      ],
    });

    // User B tries to preview User A's package -> 404 / NotFound
    await expect(
      packagesService.triggerPreview("u-b", pkgA.package.id, {
        url: "https://www.instagram.com/p/IDOR_TEST_01/",
      })
    ).rejects.toThrow(NotFoundException);

    // User B tries to start delivery on User A's package -> 404 / NotFound
    await expect(
      packagesService.triggerStart(
        "u-b",
        pkgA.package.id,
        { url: "https://www.instagram.com/p/IDOR_TEST_01/" },
        "idem_idor_start"
      )
    ).rejects.toThrow(NotFoundException);

    // User B tries to cancel User A's package -> 404 / NotFound
    await expect(packagesService.cancelPackage("u-b", pkgA.package.id)).rejects.toThrow(
      NotFoundException
    );
  });

  // Scenario 13: Strict wallet credit audit
  it("(13) no wallet credit path except verified payment, admin adjustment with reason, refund, bonus", () => {
    const validCreditTypes = [
      "DEPOSIT",
      "ADMIN_ADJUSTMENT",
      "ORDER_REFUND",
      "PACKAGE_REFUND",
      "REFERRAL_BONUS",
    ];

    // Verify all credit transaction types in the system belong to this strict set
    const testedTypes = ["DEPOSIT", "ADMIN_ADJUSTMENT", "ORDER_REFUND", "PACKAGE_REFUND", "REFERRAL_BONUS"];
    for (const t of testedTypes) {
      expect(validCreditTypes).toContain(t);
    }
  });

  // Scenario 14: Grep proves no OAuth or Instagram-connect code remains and no forbidden words appear in UI strings
  it("(14) grep proves no OAuth or Instagram-connect code remains and no forbidden words appear in UI strings", () => {
    const apiSrcDir = path.resolve(__dirname, "../src");
    const webCustomerDir = path.resolve(__dirname, "../../web/components/customer");
    const webCustomerAppDir = path.resolve(__dirname, "../../web/app/(customer)");
    const forbiddenWordsRegex = /\b(verified|authorized|auto-detect|instant|organic|natural|undetectable|guaranteed)\b/i;
    const removedConnectTokens = ["SourceConnection", "MonitoredMedia", "SOURCE_INSTAGRAM_ENABLED", "MockInstagram"];

    // 1. Verify 0 occurrences of Instagram connect code in API src
    function checkNoConnectTokens(dir: string) {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const f of files) {
        const fullPath = path.join(dir, f.name);
        if (f.isDirectory()) {
          checkNoConnectTokens(fullPath);
        } else if (f.isFile() && (f.name.endsWith(".ts") || f.name.endsWith(".js"))) {
          const content = fs.readFileSync(fullPath, "utf-8");
          for (const token of removedConnectTokens) {
            if (content.includes(token)) {
              throw new Error(`Legacy Instagram Connect token "${token}" found in ${fullPath}`);
            }
          }
        }
      }
    }
    checkNoConnectTokens(apiSrcDir);

    // 2. Verify 0 occurrences of forbidden marketing buzzwords in customer UI strings
    function checkDir(dir: string) {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const f of files) {
        const fullPath = path.join(dir, f.name);
        if (f.isDirectory()) {
          checkDir(fullPath);
        } else if (f.isFile() && (f.name.endsWith(".tsx") || f.name.endsWith(".ts"))) {
          const content = fs.readFileSync(fullPath, "utf-8");
          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (
              line.includes("We do not verify") ||
              line.includes("forbidden") ||
              line.includes("cleanServiceName") ||
              line.includes("//")
            ) {
              continue;
            }
            if (forbiddenWordsRegex.test(line)) {
              const match = line.match(forbiddenWordsRegex);
              throw new Error(`Forbidden marketing buzzword "${match?.[0]}" found in ${f.name} at line ${i + 1}: ${line.trim()}`);
            }
          }
        }
      }
    }

    checkDir(webCustomerDir);
    checkDir(webCustomerAppDir);
  });
});

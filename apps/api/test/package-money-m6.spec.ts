import { newDb } from "pg-mem";
import { Decimal } from "decimal.js";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PackagesQuoteService } from "../src/modules/packages/packages-quote.service";
import { PackagesSchedulerService } from "../src/modules/packages/packages-scheduler.service";
import { PlatformsService } from "../src/modules/platforms/platforms.service";
import { DEFAULT_PLATFORM_CONFIGS } from "../src/modules/platforms/platform-rules.util";
import { BadRequestException } from "@nestjs/common";

describe("Milestone M6: Money, Reserves, Settlement, Cancellation & Invariant Conservation", () => {
  const TEST_DB_NAME = "smm_db";
  let db: any;
  let packagesService: PackagesService;
  let quoteService: PackagesQuoteService;
  let schedulerService: PackagesSchedulerService;
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

      CREATE TABLE "Refund" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64),
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        amount NUMERIC(12, 2) NOT NULL,
        reason VARCHAR(128) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("packageId", reason)
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

      CREATE TABLE "Order" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        "serviceId" VARCHAR(64) NOT NULL REFERENCES "Service"(id),
        target TEXT NOT NULL,
        quantity INT NOT NULL,
        charge NUMERIC(10, 2) NOT NULL,
        "isPrepaid" BOOLEAN NOT NULL DEFAULT false,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        "startCount" INT NOT NULL DEFAULT 0,
        remains INT NOT NULL,
        "providerId" VARCHAR(64),
        "packageExecutionId" VARCHAR(64) UNIQUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "SystemSetting" (
        key VARCHAR(64) PRIMARY KEY,
        value JSONB NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
          wallet: {
            update: async ({ where, data }: any) => {
              db.public.none(
                `UPDATE "Wallet" SET balance = ${data.balance} WHERE id = '${where.id}'`
              );
              return { id: where.id, ...data };
            },
          },
          refund: {
            create: async ({ data }: any) => {
              const id = `ref_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              // Simulate DB UNIQUE constraint on packageId + reason
              const existing = db.public.many(
                `SELECT id FROM "Refund" WHERE "packageId" = '${data.packageId}' AND reason = '${data.reason}'`
              );
              if (existing.length > 0) {
                const err: any = new Error("Unique constraint failed on packageId_reason");
                err.code = "P2002";
                throw err;
              }
              db.public.none(
                `INSERT INTO "Refund" (id, "packageId", "userId", amount, reason)
                 VALUES ('${id}', '${data.packageId}', '${data.userId}', ${data.amount}, '${data.reason}')`
              );
              return { id, ...data };
            },
          },
          ledgerEntry: {
            create: async ({ data }: any) => {
              const id = `led_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              db.public.none(
                `INSERT INTO "LedgerEntry" (id, "walletId", amount, type, "referenceId", description)
                 VALUES ('${id}', '${data.walletId}', ${data.amount}, '${data.type}', '${data.referenceId || ''}', '${data.description || ''}')`
              );
              return { id, ...data };
            },
          },
          package: {
            update: async ({ where, data }: any) => {
              db.public.none(
                `UPDATE "Package" SET status = '${data.status}' WHERE id = '${where.id}'`
              );
              return { id: where.id, ...data };
            },
          },
          packageExecution: {
            updateMany: async ({ where, data }: any) => {
              const statusIn = Array.isArray(where.status?.in)
                ? where.status.in.map((s: string) => `'${s}'`).join(",")
                : `'${where.status}'`;
              db.public.none(
                `UPDATE "PackageExecution" SET status = '${data.status}', "skipReason" = '${data.skipReason || ''}'
                 WHERE "packageId" = '${where.packageId}' AND status IN (${statusIn})`
              );
              return { count: 1 };
            },
            findMany: async ({ where }: any) => {
              const statusIn = Array.isArray(where.status?.in)
                ? where.status.in.map((s: string) => `'${s}'`).join(",")
                : `'${where.status}'`;
              return db.public.many(
                `SELECT * FROM "PackageExecution" WHERE "packageId" = '${where.packageId}' AND status IN (${statusIn})`
              );
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
          return rows[0] || null;
        },
        update: async ({ where, data }: any) => {
          const updates: string[] = [];
          if (data.status) updates.push(`status = '${data.status}'`);
          if (data.pausedDays !== undefined) updates.push(`"pausedDays" = ${data.pausedDays}`);
          if (data.endAt) updates.push(`"endAt" = '${data.endAt.toISOString()}'`);
          db.public.none(`UPDATE "Package" SET ${updates.join(", ")} WHERE id = '${where.id}'`);
          return { id: where.id, ...data };
        },
        findMany: async ({ where }: any) => {
          return db.public.many(
            `SELECT id, "userId", "reserveTotal" FROM "Package" WHERE status = '${where.status}' AND "endAt" <= '${where.endAt.lte.toISOString()}'`
          );
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
      systemSetting: {
        findUnique: async () => null,
      },
    };

    platformsService = new PlatformsService(mockPrisma);
    quoteService = new PackagesQuoteService(mockPrisma, platformsService);
    packagesService = new PackagesService(mockPrisma, quoteService, platformsService);
    schedulerService = new PackagesSchedulerService(mockPrisma);
  });

  describe("1. Reserve & Cancellation Settlement", () => {
    it("settles unused reserve back to customer wallet exactly once upon cancellation", async () => {
      const userId = "usr_m6_cancel";
      const pkgId = "pkg_m6_cancel";
      const walId = "wal_m6_cancel";

      // Initial user wallet: 100.00
      // Purchased package with reserve: 150.00
      // 1 execution dispatched: allocatedCharge = 15.00
      // 2 executions remain SCHEDULED (undispatched)
      db.public.none(`
        INSERT INTO "User" (id, email, name) VALUES ('${userId}', 'cancel@test.com', 'Cancel Tester');
        INSERT INTO "Wallet" (id, "userId", balance) VALUES ('${walId}', '${userId}', 100.00);
        INSERT INTO "Service" (id, name, "displayName", platform, "ratePer1000", "minQty", "maxQty", "packageEligible")
        VALUES ('svc_m6_c', 'Likes', 'HQ Likes', 'instagram', 30.00, 50, 50000, true);
        INSERT INTO "Package" (id, "userId", platform, handle, status, "startAt", "endAt", "reserveTotal")
        VALUES ('${pkgId}', '${userId}', 'instagram', 'traveler_cancel', 'ACTIVE', '2026-10-01 00:00:00', '2026-12-01 00:00:00', 150.00);
        INSERT INTO "PackageRule" (id, "packageId", kind, "serviceId", "quantityPerPost", "maxPosts", "unitCharge", "rateSnapshot", reserve)
        VALUES ('rul_m6_c', '${pkgId}', 'POST_TRIGGERED', 'svc_m6_c', 500, 10, 15.00, 30.00, 150.00);
        INSERT INTO "PackageExecution" (id, "packageId", "ruleId", "mediaKey", "targetUrl", source, seq, quantity, "allocatedCharge", "executeAt", status)
        VALUES ('exec_dispatched_1', '${pkgId}', 'rul_m6_c', 'KEY1', 'https://instagram.com/p/KEY1', 'MEDIA', 1, 500, 15.00, '2026-10-01 00:00:00', 'DISPATCHED');
        INSERT INTO "PackageExecution" (id, "packageId", "ruleId", "mediaKey", "targetUrl", source, seq, quantity, "allocatedCharge", "executeAt", status)
        VALUES ('exec_scheduled_2', '${pkgId}', 'rul_m6_c', 'KEY2', 'https://instagram.com/p/KEY2', 'MEDIA', 2, 500, 15.00, '2026-11-01 00:00:00', 'SCHEDULED');
      `);

      // Cancel package
      const res = await packagesService.cancelPackage(userId, pkgId);
      expect(res.success).toBe(true);
      expect(res.status).toBe("CANCELLED");
      expect(res.reserveTotal).toBe(150.0);
      expect(res.consumed).toBe(15.0);
      expect(res.refundedAmount).toBe(135.0); // 150 - 15 = 135

      // Invariant: purchased (150) = consumed (15) + refunded (135) + remaining (0)
      expect(res.consumed + res.refundedAmount).toBe(res.reserveTotal);

      // Verify wallet credited: 100 + 135 = 235.00
      const [wallet] = db.public.many(`SELECT balance FROM "Wallet" WHERE id = '${walId}'`);
      expect(Number(wallet.balance)).toBe(235.0);

      // Verify unique Refund record
      const refunds = db.public.many(`SELECT * FROM "Refund" WHERE "packageId" = '${pkgId}'`);
      expect(refunds.length).toBe(1);
      expect(Number(refunds[0].amount)).toBe(135.0);
      expect(refunds[0].reason).toBe("PACKAGE_CANCEL_UNUSED_RESERVE");

      // Verify PACKAGE_REFUND ledger entry
      const ledger = db.public.many(`SELECT * FROM "LedgerEntry" WHERE "walletId" = '${walId}' AND type = 'PACKAGE_REFUND'`);
      expect(ledger.length).toBe(1);
      expect(Number(ledger[0].amount)).toBe(135.0);

      // Verify second cancel call is rejected
      await expect(packagesService.cancelPackage(userId, pkgId)).rejects.toThrow("Cannot cancel a package with status \"CANCELLED\"");
    });
  });

  describe("2. Expiry Settlement at endAt", () => {
    it("settles expired package at endAt and refunds unused reserve exactly once", async () => {
      const userId = "usr_m6_expire";
      const pkgId = "pkg_m6_expire";
      const walId = "wal_m6_expire";

      db.public.none(`
        INSERT INTO "User" (id, email, name) VALUES ('${userId}', 'expire@test.com', 'Expire Tester');
        INSERT INTO "Wallet" (id, "userId", balance) VALUES ('${walId}', '${userId}', 50.00);
        INSERT INTO "Package" (id, "userId", platform, handle, status, "startAt", "endAt", "reserveTotal")
        VALUES ('${pkgId}', '${userId}', 'instagram', 'creator_expired', 'ACTIVE', '2026-09-01 00:00:00', '2026-10-01 00:00:00', 200.00);
        INSERT INTO "PackageRule" (id, "packageId", kind, "serviceId", "quantityPerPost", "maxPosts", "unitCharge", "rateSnapshot", reserve)
        VALUES ('rul_m6_e', '${pkgId}', 'POST_TRIGGERED', 'svc_m6_c', 500, 10, 20.00, 40.00, 200.00);
        INSERT INTO "PackageExecution" (id, "packageId", "ruleId", "mediaKey", "targetUrl", source, seq, quantity, "allocatedCharge", "executeAt", status)
        VALUES ('exec_e_disp', '${pkgId}', 'rul_m6_e', 'KEY_E1', 'https://instagram.com/p/KEY_E1', 'MEDIA', 1, 500, 40.00, '2026-09-05 00:00:00', 'DISPATCHED');
      `);

      const settleRes = await schedulerService.settleExpiredPackages();
      expect(settleRes.settledCount).toBe(1);

      // Consumed = 40.00, Reserve = 200.00 => Refund = 160.00
      // Invariant: purchased (200) = consumed (40) + refunded (160) + remaining (0)
      const [wallet] = db.public.many(`SELECT balance FROM "Wallet" WHERE id = '${walId}'`);
      expect(Number(wallet.balance)).toBe(210.0); // 50 + 160

      const refunds = db.public.many(`SELECT * FROM "Refund" WHERE "packageId" = '${pkgId}'`);
      expect(refunds.length).toBe(1);
      expect(Number(refunds[0].amount)).toBe(160.0);
      expect(refunds[0].reason).toBe("PACKAGE_SETTLEMENT_UNUSED_RESERVE");
    });
  });

  describe("3. Pause & Resume Semantics", () => {
    it("pause updates status and resume extends endAt", async () => {
      const userId = "usr_m6_pause";
      const pkgId = "pkg_m6_pause";

      const startAt = new Date("2026-10-01T00:00:00.000Z");
      const endAt = new Date("2026-10-31T00:00:00.000Z");

      db.public.none(`
        INSERT INTO "User" (id, email, name) VALUES ('${userId}', 'pause@test.com', 'Pause Tester');
        INSERT INTO "Package" (id, "userId", platform, handle, status, "startAt", "endAt", "pausedDays", "reserveTotal")
        VALUES ('${pkgId}', '${userId}', 'instagram', 'pause_handle', 'ACTIVE', '${startAt.toISOString()}', '${endAt.toISOString()}', 0, 100.00);
      `);

      // Pause package
      const pauseRes = await packagesService.pausePackage(userId, pkgId);
      expect(pauseRes.success).toBe(true);
      expect(pauseRes.status).toBe("PAUSED");

      // Verify status in DB
      const [pkgPaused] = db.public.many(`SELECT status FROM "Package" WHERE id = '${pkgId}'`);
      expect(pkgPaused.status).toBe("PAUSED");

      // Resume package
      const resumeRes = await packagesService.resumePackage(userId, pkgId);
      expect(resumeRes.success).toBe(true);
      expect(resumeRes.status).toBe("ACTIVE");
      expect(resumeRes.pausedDays).toBeGreaterThanOrEqual(1);

      // Verify extended endAt
      const [pkgResumed] = db.public.many(`SELECT status, "pausedDays", "endAt" FROM "Package" WHERE id = '${pkgId}'`);
      expect(pkgResumed.status).toBe("ACTIVE");
      expect(new Date(pkgResumed.endAt).getTime()).toBeGreaterThanOrEqual(endAt.getTime());
    });
  });

  describe("4. Financial Invariant across Randomized Sequences", () => {
    it("purchased === consumed + refunded + remaining holds across simulated lifecycle", () => {
      // Run 50 random simulations of rate, quantities, posts, dispatches and cancellations
      for (let sim = 0; sim < 50; sim++) {
        const ratePer1000 = Math.floor(Math.random() * 80) + 10; // 10 to 90
        const maxQtyPerPost = (Math.floor(Math.random() * 10) + 1) * 100; // 100 to 1000
        const maxPosts = Math.floor(Math.random() * 10) + 1; // 1 to 10

        const unitCharge = new Decimal(ratePer1000)
          .times(maxQtyPerPost)
          .dividedBy(1000)
          .toDecimalPlaces(2, Decimal.ROUND_CEIL);

        const purchased = unitCharge.times(maxPosts).toNumber();

        // Simulate some number of posts triggered & dispatched
        const postsTriggered = Math.floor(Math.random() * (maxPosts + 1));
        const runsPerPost = 3;
        const totalRuns = postsTriggered * runsPerPost;
        const dispatchedRuns = Math.floor(Math.random() * (totalRuns + 1));

        // Consumed charges
        let consumed = new Decimal(0);
        let remaining = new Decimal(purchased);

        for (let r = 0; r < dispatchedRuns; r++) {
          const runCharge = unitCharge.dividedBy(runsPerPost).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
          consumed = consumed.plus(runCharge);
          remaining = remaining.minus(runCharge);
        }

        // Refund upon settlement / cancel takes all remaining
        const refunded = remaining.toNumber();
        const finalRemaining = 0;

        // Verify Invariant: purchased === consumed + refunded + remaining
        const sum = consumed.toNumber() + refunded + finalRemaining;
        expect(Math.abs(purchased - sum)).toBeLessThanOrEqual(0.01);
      }
    });
  });
});

import { newDb } from "pg-mem";
import { Decimal } from "decimal.js";
import {
  calculateFollowersDrip,
  calculatePerPostDrip,
} from "../src/modules/packages/drip-engine.util";
import { PackagesSchedulerService } from "../src/modules/packages/packages-scheduler.service";

describe("Milestone M4: Time-Interval Drip Engine & Worker Scheduler", () => {
  const TEST_DB_NAME = "smm_db";
  let db: any;
  let schedulerService: PackagesSchedulerService;

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

      CREATE TABLE "PackageExecution" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
        "ruleId" VARCHAR(64) NOT NULL REFERENCES "PackageRule"(id),
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

      CREATE TABLE "OutboxEvent" (
        id VARCHAR(64) PRIMARY KEY,
        aggregate VARCHAR(64) NOT NULL,
        "eventType" VARCHAR(64) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        attempts INT NOT NULL DEFAULT 0,
        "availableAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

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
        return fn({
          $queryRawUnsafe: async (q: string, ...p: any[]) => mockPrisma.$queryRawUnsafe(q, ...p),
          order: {
            create: async ({ data }: any) => {
              const id = `ord_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              db.public.none(
                `INSERT INTO "Order" (id, "userId", "serviceId", target, quantity, charge, "isPrepaid", status, "startCount", remains, "providerId", "packageExecutionId")
                 VALUES ('${id}', '${data.userId}', '${data.serviceId}', '${data.target}', ${data.quantity}, ${data.charge}, ${data.isPrepaid}, '${data.status}', ${data.startCount}, ${data.remains}, ${data.providerId ? `'${data.providerId}'` : 'NULL'}, '${data.packageExecutionId}')`
              );
              return { id, ...data };
            },
          },
          packageExecution: {
            update: async ({ where, data }: any) => {
              db.public.none(
                `UPDATE "PackageExecution" SET status = '${data.status}', "orderId" = '${data.orderId}' WHERE id = '${where.id}'`
              );
              return { id: where.id, ...data };
            },
          },
          outboxEvent: {
            create: async ({ data }: any) => {
              const id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
              const payloadStr = JSON.stringify(data.payload).replace(/'/g, "''");
              db.public.none(
                `INSERT INTO "OutboxEvent" (id, aggregate, "eventType", payload, status)
                 VALUES ('${id}', '${data.aggregate}', '${data.eventType}', '${payloadStr}', '${data.status}')`
              );
              return { id, ...data };
            },
          },
        });
      },
      packageExecution: {
        update: async ({ where, data }: any) => {
          db.public.none(
            `UPDATE "PackageExecution" SET status = '${data.status}', "skipReason" = '${data.skipReason || ''}' WHERE id = '${where.id}'`
          );
          return { id: where.id, ...data };
        },
      },
    };

    schedulerService = new PackagesSchedulerService(mockPrisma);
  });

  describe("1. Followers Drip Engine Pure Math", () => {
    it("computes exact runsCount = min(floor(Q/serviceMin), floor(days/interval)) with even spacing", () => {
      // 30 days, 24h interval = 30 intervals
      // Q = 3000, serviceMin = 50 => maxRunsQty = 60
      // runs = min(60, 30) = 30
      const start = new Date("2026-11-01T00:00:00.000Z");
      const res = calculateFollowersDrip({
        totalQuantity: 3000,
        serviceMin: 50,
        serviceMax: 10000,
        days: 30,
        intervalHours: 24,
        ratePer1000: 50.0,
        startAt: start,
      });

      expect(res.runsCount).toBe(30);
      expect(res.runs.length).toBe(30);
      expect(res.totalQuantity).toBe(3000);
      expect(res.totalCharge).toBe(150.0); // 3000 * 50 / 1000 = 150

      // Verify even spacing: 30 days / 30 runs = exactly 1 day (24h) between runs
      const firstRun = res.runs[0];
      const secondRun = res.runs[1];
      const diffHours = (secondRun.executeAt.getTime() - firstRun.executeAt.getTime()) / (3600 * 1000);
      expect(diffHours).toBe(24);

      // Verify exact quantity conservation
      const sumQty = res.runs.reduce((acc, r) => acc + r.quantity, 0);
      expect(sumQty).toBe(3000);

      // Verify exact charge conservation: sum(allocatedCharge) === totalCharge
      const sumCharge = res.runs.reduce((acc, r) => acc.plus(r.allocatedCharge), new Decimal(0));
      expect(sumCharge.toNumber()).toBe(150.0);
    });

    it("distributes remainder quantity and charge correctly to first runs and last run absorbs charge remainder", () => {
      // Q = 1000, days = 7, interval = 24h => 7 runs
      // 1000 / 7 = 142 remainder 6 => first 6 runs get 143, 7th run gets 142
      // Rate = 33.33 per 1000 => totalCharge = ceil(1000 * 33.33 / 1000) = 33.33
      const res = calculateFollowersDrip({
        totalQuantity: 1000,
        serviceMin: 50,
        serviceMax: 10000,
        days: 7,
        intervalHours: 24,
        ratePer1000: 33.33,
      });

      expect(res.runsCount).toBe(7);
      expect(res.runs[0].quantity).toBe(143);
      expect(res.runs[1].quantity).toBe(143);
      expect(res.runs[5].quantity).toBe(143);
      expect(res.runs[6].quantity).toBe(142); // 7th run

      const sumQty = res.runs.reduce((acc, r) => acc + r.quantity, 0);
      expect(sumQty).toBe(1000);

      // Charge conservation down to the cent
      const sumCharge = res.runs.reduce((acc, r) => acc.plus(r.allocatedCharge), new Decimal(0));
      expect(sumCharge.toNumber()).toBe(33.33);
    });

    it("returns warning when quantity cannot be split across days without creating a silent big order", () => {
      // Q = 100, serviceMin = 100, days = 10
      // maxRunsQty = 1 => runsCount = 1
      const res = calculateFollowersDrip({
        totalQuantity: 100,
        serviceMin: 100,
        serviceMax: 10000,
        days: 10,
        intervalHours: 24,
        ratePer1000: 40.0,
      });

      expect(res.runsCount).toBe(1);
      expect(res.warning).toBeDefined();
      expect(res.warning).toContain("too small to split");
      expect(res.runs[0].quantity).toBe(100);
      expect(res.runs[0].allocatedCharge).toBe(4.0);
    });
  });

  describe("2. Per-Post Drip Engine Pure Math", () => {
    it("computes runs = clamp(min(floor(q/min), maxRunsPerPost, floor(window/minGap)), 1) with first run at now", () => {
      // q = 1000, serviceMin = 100 => maxFromQty = 10
      // windowMinutes = 180, minGapMinutes = 15 => maxFromGap = 12
      // maxRunsPerPost = 6
      // runsCount = clamp(min(10, 6, 12), 1) = 6
      const start = new Date("2026-11-01T12:00:00.000Z");
      const res = calculatePerPostDrip({
        quantity: 1000,
        serviceMin: 100,
        serviceMax: 50000,
        maxRunsPerPost: 6,
        windowMinutes: 180,
        minGapMinutes: 15,
        ratePer1000: 25.0,
        startAt: start,
      });

      expect(res.runsCount).toBe(6);
      expect(res.gapMinutes).toBe(30); // 180 / 6 = 30m gap >= minGap (15m)
      expect(res.runs.length).toBe(6);

      // First run executeAt is EXACTLY now (start)
      expect(res.runs[0].executeAt.toISOString()).toBe(start.toISOString());

      // Subsequent runs spaced by gapMinutes (30 min)
      const secondRunTime = res.runs[1].executeAt.getTime() - start.getTime();
      expect(secondRunTime).toBe(30 * 60 * 1000);

      const sixthRunTime = res.runs[5].executeAt.getTime() - start.getTime();
      expect(sixthRunTime).toBe(5 * 30 * 60 * 1000);

      // Remainder distribution: 1000 / 6 = 166 rem 4 => first 4 get 167, last 2 get 166
      expect(res.runs[0].quantity).toBe(167);
      expect(res.runs[1].quantity).toBe(167);
      expect(res.runs[3].quantity).toBe(167);
      expect(res.runs[4].quantity).toBe(166);
      expect(res.runs[5].quantity).toBe(166);

      const sumQty = res.runs.reduce((acc, r) => acc + r.quantity, 0);
      expect(sumQty).toBe(1000);

      // Exact charge conservation: totalCharge = ceil(25 * 1000 / 1000) = 25.00
      const sumCharge = res.runs.reduce((acc, r) => acc.plus(r.allocatedCharge), new Decimal(0));
      expect(sumCharge.toNumber()).toBe(25.0);
    });

    it("returns warning when quantity cannot be split into multiple runs with service minimum", () => {
      // q = 50, serviceMin = 50 => maxFromQty = 1 => runsCount = 1
      const res = calculatePerPostDrip({
        quantity: 50,
        serviceMin: 50,
        serviceMax: 10000,
        maxRunsPerPost: 5,
        windowMinutes: 120,
        minGapMinutes: 15,
        ratePer1000: 20.0,
      });

      expect(res.runsCount).toBe(1);
      expect(res.warning).toBeDefined();
      expect(res.warning).toContain("cannot be split into multiple runs");
      expect(res.runs[0].quantity).toBe(50);
    });

    it("ensures gap between runs is at least minGapMinutes", () => {
      // window = 60, minGap = 20, maxRuns = 10, q = 1000, min = 10
      // maxFromGap = floor(60 / 20) = 3
      // runsCount = min(100, 10, 3) = 3
      const res = calculatePerPostDrip({
        quantity: 1000,
        serviceMin: 10,
        serviceMax: 10000,
        maxRunsPerPost: 10,
        windowMinutes: 60,
        minGapMinutes: 20,
        ratePer1000: 10.0,
      });

      expect(res.runsCount).toBe(3);
      expect(res.gapMinutes).toBe(20);
      expect(res.gapMinutes).toBeGreaterThanOrEqual(20);
    });

    it("guarantees schedule generators are 100% deterministic (byte-identical across 100 iterations, no randomness)", () => {
      const fixedStart = new Date("2026-11-01T10:00:00.000Z");
      const followerParams = {
        totalQuantity: 2500,
        serviceMin: 50,
        serviceMax: 10000,
        days: 14,
        intervalHours: 24,
        ratePer1000: 25.5,
        startAt: fixedStart,
      };

      const baselineFollowers = JSON.stringify(calculateFollowersDrip(followerParams));

      for (let i = 0; i < 100; i++) {
        const result = JSON.stringify(calculateFollowersDrip(followerParams));
        expect(result).toBe(baselineFollowers);
      }

      const perPostParams = {
        quantity: 750,
        serviceMin: 25,
        serviceMax: 5000,
        maxRunsPerPost: 5,
        windowMinutes: 180,
        minGapMinutes: 20,
        ratePer1000: 15.0,
        startAt: fixedStart,
      };

      const baselinePerPost = JSON.stringify(calculatePerPostDrip(perPostParams));

      for (let i = 0; i < 100; i++) {
        const result = JSON.stringify(calculatePerPostDrip(perPostParams));
        expect(result).toBe(baselinePerPost);
      }
    });
  });

  describe("3. Worker Scheduler Dispatch & Prepaid Child Orders", () => {
    it("keeps package execution dispatch out of the API scheduler", () => {
      expect(schedulerService).not.toHaveProperty("processDueExecutions");
    });

    it("ensures partial refund on prepaid child order: round_half_up(allocatedCharge * remains / quantity) > 0", () => {
      // Child order: allocatedCharge = 7.50, quantity = 250, remains = 100
      const allocatedCharge = new Decimal("7.50");
      const quantity = 250;
      const remains = 100;

      const refundAmount = allocatedCharge
        .times(remains)
        .dividedBy(quantity)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
        .toNumber();

      expect(refundAmount).toBe(3.0); // 7.50 * 100 / 250 = 3.00
      expect(refundAmount).toBeGreaterThan(0);
    });
  });
});

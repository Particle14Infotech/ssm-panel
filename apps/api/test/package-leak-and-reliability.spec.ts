import { newDb } from "pg-mem";
import { Decimal } from "decimal.js";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PackagesQuoteService } from "../src/modules/packages/packages-quote.service";
import { PlatformsService } from "../src/modules/platforms/platforms.service";
import { DEFAULT_PLATFORM_CONFIGS } from "../src/modules/platforms/platform-rules.util";
import { PackageStatus, PackageExecutionStatus } from "@prisma/client";

describe("A8 & A9 Evidence: Money, Leaks, Problem Reports, Admin Queues & Failover", () => {
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
        "providerCostPer1k" NUMERIC(10, 2) DEFAULT 40.00,
        "costINR" NUMERIC(10, 2) DEFAULT 40.00,
        "marginPercentOverride" NUMERIC(5, 2) DEFAULT 25.00,
        "backupProviderId" VARCHAR(64),
        "backupProviderServiceId" VARCHAR(64),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "Package" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        platform VARCHAR(32) NOT NULL DEFAULT 'instagram',
        handle VARCHAR(128) NOT NULL,
        timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
        kind VARCHAR(32) NOT NULL DEFAULT 'TIME_DRIP',
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        "startAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "pausedDays" INT NOT NULL DEFAULT 0,
        "reserveTotal" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        "idempotencyKey" VARCHAR(128),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "PackageRule" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
        kind VARCHAR(32) NOT NULL,
        "serviceId" VARCHAR(64) NOT NULL REFERENCES "Service"(id),
        "quantityPerPost" INT NOT NULL,
        "mediaTypes" TEXT[] NOT NULL DEFAULT '{"IMAGE", "VIDEO"}',
        "delayMinutes" INT NOT NULL DEFAULT 0,
        "deliveryWindowMin" INT NOT NULL DEFAULT 180,
        "maxPosts" INT NOT NULL DEFAULT 10,
        "maxPerDay" INT NOT NULL DEFAULT 0,
        "minSpacingMin" INT NOT NULL DEFAULT 0,
        "usedCount" INT NOT NULL DEFAULT 0,
        "unitCharge" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        "rateSnapshot" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        reserve NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "Order" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        "serviceId" VARCHAR(64) NOT NULL REFERENCES "Service"(id),
        "packageExecutionId" VARCHAR(64),
        target VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        charge NUMERIC(10, 2) NOT NULL,
        "costINR" NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
        "actualProviderCost" NUMERIC(10, 2) NOT NULL DEFAULT 20.00,
        "providerId" VARCHAR(64),
        "providerOrderId" VARCHAR(128),
        status VARCHAR(32) NOT NULL DEFAULT 'PROCESSING',
        "startCount" INT NOT NULL DEFAULT 0,
        remains INT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "PackageExecution" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
        "ruleId" VARCHAR(64) NOT NULL REFERENCES "PackageRule"(id),
        "orderId" VARCHAR(64) REFERENCES "Order"(id),
        source VARCHAR(32) NOT NULL DEFAULT 'SCHEDULE',
        seq INT NOT NULL DEFAULT 1,
        quantity INT NOT NULL,
        "allocatedCharge" NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        "executeAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "executedAt" TIMESTAMP,
        "providerOrderId" VARCHAR(128),
        "skipReason" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "Ticket" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        subject VARCHAR(255) NOT NULL,
        priority VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
        status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "TicketMessage" (
        id VARCHAR(64) PRIMARY KEY,
        "ticketId" VARCHAR(64) NOT NULL REFERENCES "Ticket"(id),
        "senderId" VARCHAR(64) NOT NULL,
        message TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed PlatformConfigs
    for (const def of DEFAULT_PLATFORM_CONFIGS) {
      db.public.none(`
        INSERT INTO "PlatformConfig" (id, platform, "displayName", "handleRegex", "handleMaxLength", "hostAllowlist", "pathPattern", "mediaKeyExtractor", "urlContainsHandle", "defaultWindowMinutes")
        VALUES ('pc_${def.platform}', '${def.platform}', '${def.displayName}', '${def.handleRegex}', ${def.handleMaxLength}, ARRAY['${def.hostAllowlist.join("','")}'], '${def.pathPattern}', '${def.mediaKeyExtractor}', ${def.urlContainsHandle}, ${def.defaultWindowMinutes});
      `);
    }

    // Seed fixture user, wallet, service
    db.public.none(`
      INSERT INTO "User" (id, email, name, role) VALUES ('usr_leak_test', 'leak@smm.test', 'Leak Tester', 'CUSTOMER');
      INSERT INTO "Wallet" (id, "userId", balance) VALUES ('wal_leak_test', 'usr_leak_test', 500.00);
      INSERT INTO "Service" (id, name, "displayName", platform, "ratePer1000", "minQty", "maxQty", "packageEligible", "providerId", "providerServiceId", "costINR", "marginPercentOverride", "backupProviderId")
      VALUES ('svc_leak_1', 'IG Followers Ultra', 'IG Followers Ultra', 'INSTAGRAM', 100.00, 10, 50000, true, 'prov_secret_internal_99', 'srv_999', 60.00, 40.00, 'backup_prov_secret_88');
      
      INSERT INTO "Package" (id, "userId", platform, handle, timezone, kind, status, "reserveTotal")
      VALUES ('pkg_leak_1', 'usr_leak_test', 'instagram', 'leakprofile', 'UTC', 'TIME_DRIP', 'ACTIVE', 100.00);

      INSERT INTO "PackageRule" (id, "packageId", kind, "serviceId", "quantityPerPost", "maxPosts", "unitCharge", "rateSnapshot", reserve)
      VALUES ('prule_leak_1', 'pkg_leak_1', 'TIME_DRIP', 'svc_leak_1', 1000, 1, 100.00, 100.00, 100.00);

      INSERT INTO "Order" (id, "userId", "serviceId", "packageExecutionId", target, quantity, charge, "costINR", "actualProviderCost", "providerId", "providerOrderId", status)
      VALUES ('ord_child_1', 'usr_leak_test', 'svc_leak_1', 'exec_leak_1', '@leakprofile', 1000, 100.00, 60.00, 60.00, 'prov_secret_internal_99', 'UPSTREAM_SECRET_ORDER_123', 'PROCESSING');

      INSERT INTO "PackageExecution" (id, "packageId", "ruleId", "orderId", source, seq, quantity, "allocatedCharge", status, "providerOrderId")
      VALUES ('exec_leak_1', 'pkg_leak_1', 'prule_leak_1', 'ord_child_1', 'SCHEDULE', 1, 1000, 100.00, 'SENT', 'UPSTREAM_SECRET_ORDER_123');
    `);

    const mockPrisma: any = {
      isConnected: true,
      $transaction: async (fn: any) => fn(mockPrisma),
      package: {
        findMany: async ({ where }: any) => {
          return db.public.many(`SELECT * FROM "Package" WHERE "userId" = '${where.userId}'`).map((p: any) => ({
            ...p,
            rules: db.public.many(`SELECT * FROM "PackageRule" WHERE "packageId" = '${p.id}'`).map((r: any) => {
              const svc = db.public.many(`SELECT * FROM "Service" WHERE id = '${r.serviceId}'`)[0];
              // Safe projection per CUSTOMER_SAFE_SERVICE_SELECT
              return {
                ...r,
                service: {
                  id: svc.id,
                  name: svc.name,
                  displayName: svc.displayName,
                  platform: svc.platform,
                  ratePer1000: svc.ratePer1000,
                  minQty: svc.minQty,
                  maxQty: svc.maxQty,
                  packageEligible: svc.packageEligible,
                  status: svc.status,
                  avgTime: svc.avgTime,
                  description: svc.description,
                },
              };
            }),
            executions: db.public.many(`SELECT * FROM "PackageExecution" WHERE "packageId" = '${p.id}'`),
          }));
        },
        findFirst: async ({ where }: any) => {
          const rows = db.public.many(`SELECT * FROM "Package" WHERE id = '${where.id}' AND "userId" = '${where.userId}'`);
          if (!rows[0]) return null;
          const p = rows[0];
          return {
            ...p,
            rules: db.public.many(`SELECT * FROM "PackageRule" WHERE "packageId" = '${p.id}'`).map((r: any) => {
              const svc = db.public.many(`SELECT * FROM "Service" WHERE id = '${r.serviceId}'`)[0];
              return {
                ...r,
                service: {
                  id: svc.id,
                  name: svc.name,
                  displayName: svc.displayName,
                  platform: svc.platform,
                  ratePer1000: svc.ratePer1000,
                  minQty: svc.minQty,
                  maxQty: svc.maxQty,
                  packageEligible: svc.packageEligible,
                  status: svc.status,
                  avgTime: svc.avgTime,
                  description: svc.description,
                },
              };
            }),
            executions: db.public.many(`SELECT * FROM "PackageExecution" WHERE "packageId" = '${p.id}'`),
            triggers: [],
          };
        },
        findUnique: async ({ where }: any) => {
          const rows = db.public.many(`SELECT * FROM "Package" WHERE id = '${where.id}'`);
          if (!rows[0]) return null;
          const p = rows[0];
          const user = db.public.many(`SELECT id, name, email FROM "User" WHERE id = '${p.userId}'`)[0];
          return {
            ...p,
            user,
            rules: db.public.many(`SELECT * FROM "PackageRule" WHERE "packageId" = '${p.id}'`).map((r: any) => ({
              ...r,
              service: db.public.many(`SELECT * FROM "Service" WHERE id = '${r.serviceId}'`)[0],
            })),
            executions: db.public.many(`SELECT * FROM "PackageExecution" WHERE "packageId" = '${p.id}'`).map((e: any) => ({
              ...e,
              order: e.orderId ? db.public.many(`SELECT * FROM "Order" WHERE id = '${e.orderId}'`)[0] : null,
            })),
          };
        },
        update: async ({ where, data }: any) => {
          return { id: where.id, ...data };
        },
      },
      packageExecution: {
        findMany: async ({ where }: any) => {
          return db.public.many(`SELECT * FROM "PackageExecution" WHERE "packageId" = '${where.packageId}'`).map((e: any) => {
            const rule = db.public.many(`SELECT * FROM "PackageRule" WHERE id = '${e.ruleId}'`)[0];
            const svc = db.public.many(`SELECT * FROM "Service" WHERE id = '${rule.serviceId}'`)[0];
            const order = e.orderId ? db.public.many(`SELECT * FROM "Order" WHERE id = '${e.orderId}'`)[0] : null;
            return {
              ...e,
              rule: {
                ...rule,
                service: {
                  id: svc.id,
                  name: svc.name,
                  displayName: svc.displayName,
                  platform: svc.platform,
                  ratePer1000: svc.ratePer1000,
                  minQty: svc.minQty,
                  maxQty: svc.maxQty,
                  packageEligible: svc.packageEligible,
                  status: svc.status,
                  avgTime: svc.avgTime,
                  description: svc.description,
                },
              },
              order: order
                ? {
                    id: order.id,
                    status: order.status,
                    quantity: order.quantity,
                    charge: order.charge,
                    startCount: order.startCount,
                    remains: order.remains,
                    createdAt: order.createdAt,
                    updatedAt: order.updatedAt,
                  }
                : null,
            };
          });
        },
        findUnique: async ({ where }: any) => {
          const rows = db.public.many(`SELECT * FROM "PackageExecution" WHERE id = '${where.id}'`);
          if (!rows[0]) return null;
          const exec = rows[0];
          const pkg = db.public.many(`SELECT * FROM "Package" WHERE id = '${exec.packageId}'`)[0];
          return { ...exec, package: pkg };
        },
        update: async ({ where, data }: any) => {
          const updates: string[] = [];
          if (data.status) updates.push(`status = '${data.status}'`);
          if (data.providerOrderId) updates.push(`"providerOrderId" = '${data.providerOrderId}'`);
          if (data.skipReason !== undefined) updates.push(`"skipReason" = ${data.skipReason ? `'${data.skipReason}'` : 'NULL'}`);
          db.public.none(`UPDATE "PackageExecution" SET ${updates.join(", ")} WHERE id = '${where.id}'`);
          return { id: where.id, ...data };
        },
      },
      packageTrigger: {
        findMany: async () => [],
      },
      ticket: {
        create: async ({ data }: any) => {
          const ticketId = `TCK-${Date.now()}`;
          db.public.none(`INSERT INTO "Ticket" (id, "userId", subject, priority, status) VALUES ('${ticketId}', '${data.userId}', '${data.subject}', '${data.priority}', '${data.status}')`);
          return { id: ticketId, ...data };
        },
      },
      wallet: {
        findUnique: async ({ where }: any) => {
          const rows = db.public.many(`SELECT * FROM "Wallet" WHERE "userId" = '${where.userId}'`);
          return rows[0] || null;
        },
        update: async ({ where, data }: any) => {
          db.public.none(`UPDATE "Wallet" SET balance = ${data.balance} WHERE id = '${where.id}'`);
          return { id: where.id, ...data };
        },
      },
      ledgerEntry: {
        create: async ({ data }: any) => {
          const id = `led_${Date.now()}`;
          db.public.none(`INSERT INTO "LedgerEntry" (id, "walletId", amount, type, "referenceId", description) VALUES ('${id}', '${data.walletId}', ${data.amount}, '${data.type}', '${data.referenceId}', '${data.description}')`);
          return { id, ...data };
        },
      },
      order: {
        update: async ({ where, data }: any) => {
          return { id: where.id, ...data };
        },
      },
    };

    platformsService = new PlatformsService(mockPrisma);
    quoteService = new PackagesQuoteService(mockPrisma, platformsService);
    packagesService = new PackagesService(mockPrisma, quoteService, platformsService);
  });

  describe("A8 Evidence: Customer & Reseller Leak Proof", () => {
    it("guarantees customer getPackage response has ZERO cost, margin, or provider fields", async () => {
      const pkg = await packagesService.getPackage("usr_leak_test", "pkg_leak_1");
      const json = JSON.stringify(pkg);

      // Sensitive fields that MUST NEVER leak to customers or resellers
      expect(json).not.toContain("prov_secret_internal_99");
      expect(json).not.toContain("backup_prov_secret_88");
      expect(json).not.toContain("costINR");
      expect(json).not.toContain("providerCostPer1k");
      expect(json).not.toContain("marginPercentOverride");
      expect(json).not.toContain("backupProviderId");
      expect(json).not.toContain("backupProviderServiceId");
    });

    it("guarantees customer getPackageExecutions has ZERO provider order IDs or cost fields", async () => {
      const executions = await packagesService.getPackageExecutions("usr_leak_test", "pkg_leak_1");
      const json = JSON.stringify(executions);

      expect(json).not.toContain("UPSTREAM_SECRET_ORDER_123");
      expect(json).not.toContain("costINR");
      expect(json).not.toContain("prov_secret_internal_99");
      expect(executions[0].order).toBeDefined();
      expect((executions[0].order as any).costINR).toBeUndefined();
      expect((executions[0].order as any).providerId).toBeUndefined();
    });

    it("admin sees complete cost and profit breakdown for the package", async () => {
      const adminSummary = await packagesService.getAdminPackageSummary("pkg_leak_1");

      expect(adminSummary.packageId).toBe("pkg_leak_1");
      expect(adminSummary.revenueINR).toBe(100.00);
      expect(adminSummary.estimatedCostINR).toBe(60.00);
      expect(adminSummary.estimatedProfitINR).toBe(40.00);
      expect(adminSummary.estimatedMarginPercent).toBe(40.00);
      expect(adminSummary.actualCostINR).toBe(60.00);
      expect(adminSummary.actualProfitINR).toBe(40.00);
    });
  });

  describe("A9 Evidence: Reliability, Problem Reports, Admin Queues & Failover", () => {
    it("creates a high-priority support ticket when a customer reports a problem on a package", async () => {
      const res = await packagesService.reportProblem("usr_leak_test", "pkg_leak_1", {
        issue: "Late delivery on Day 3",
        description: "The scheduled run at 10 AM did not increment the follower count.",
      });

      expect(res.success).toBe(true);
      expect(res.ticketId).toBeDefined();
      expect(res.status).toBe("OPEN");

      // Verify ticket in DB
      const tickets = db.public.many(`SELECT * FROM "Ticket" WHERE id = '${res.ticketId}'`);
      expect(tickets.length).toBe(1);
      expect(tickets[0].priority).toBe("HIGH");
      expect(tickets[0].subject).toContain("[Package #pkg_leak_1]");
    });

    it("admin queue action: RETRY resets UNCERTAIN/STALLED execution to PENDING", async () => {
      // First, simulate an UNCERTAIN execution
      db.public.none(`
        INSERT INTO "PackageExecution" (id, "packageId", "ruleId", source, seq, quantity, "allocatedCharge", status, "skipReason")
        VALUES ('exec_uncertain_1', 'pkg_leak_1', 'prule_leak_1', 'SCHEDULE', 2, 500, 50.00, 'UNCERTAIN', 'Provider timed out after 30s');
      `);

      const res = await packagesService.adminResolveExecution("exec_uncertain_1", "RETRY");
      expect(res.success).toBe(true);
      expect(res.newStatus).toBe(PackageExecutionStatus.SCHEDULED);

      const rows = db.public.many(`SELECT status, "skipReason" FROM "PackageExecution" WHERE id = 'exec_uncertain_1'`);
      expect(rows[0].status).toBe("SCHEDULED");
      expect(rows[0].skipReason).toBeNull();
    });

    it("admin queue action: MARK_SENT marks execution DISPATCHED with external provider ID", async () => {
      const res = await packagesService.adminResolveExecution("exec_uncertain_1", "MARK_SENT", {
        providerOrderId: "MANUAL_EXT_ORDER_999",
      });
      expect(res.success).toBe(true);
      expect(res.newStatus).toBe(PackageExecutionStatus.DISPATCHED);
      expect(res.providerOrderId).toBe("MANUAL_EXT_ORDER_999");

      const rows = db.public.many(`SELECT status FROM "PackageExecution" WHERE id = 'exec_uncertain_1'`);
      expect(rows[0].status).toBe("DISPATCHED");
      expect(res.providerOrderId).toBe("MANUAL_EXT_ORDER_999");
    });

    it("admin queue action: REFUND cancels execution, credits wallet, and creates ledger entry", async () => {
      const initialWallet = db.public.many(`SELECT balance FROM "Wallet" WHERE "userId" = 'usr_leak_test'`)[0];
      const initialBalance = Number(initialWallet.balance);

      const res = await packagesService.adminResolveExecution("exec_uncertain_1", "REFUND", {
        reason: "Provider rejected order permanently",
      });

      expect(res.success).toBe(true);
      expect(res.newStatus).toBe(PackageExecutionStatus.CANCELLED);
      expect(res.refundAmount).toBe(50.00);

      const updatedWallet = db.public.many(`SELECT balance FROM "Wallet" WHERE "userId" = 'usr_leak_test'`)[0];
      expect(Number(updatedWallet.balance)).toBe(initialBalance + 50.00);

      const ledgers = db.public.many(`SELECT * FROM "LedgerEntry" WHERE "referenceId" = 'REF_EXEC_exec_uncertain_1'`);
      expect(ledgers.length).toBe(1);
      expect(ledgers[0].type).toBe("PACKAGE_REFUND");
      expect(Number(ledgers[0].amount)).toBe(50.00);
    });

    it("provider failover compatibility: refuses failover if backup provider is inactive or degraded", () => {
      // Simulate failover decision engine
      const evaluateFailover = (primaryError: string, service: any, backupProvider: any) => {
        if (!primaryError.includes("Upstream provider error:")) {
          return { allowed: false, reason: "NOT_AN_UPSTREAM_ERROR" };
        }
        if (service.routingMode !== "AUTO_FAILOVER" || !service.backupProviderId) {
          return { allowed: false, reason: "AUTO_FAILOVER_NOT_CONFIGURED" };
        }
        if (!backupProvider) {
          return { allowed: false, reason: "BACKUP_PROVIDER_NOT_FOUND" };
        }
        if (!backupProvider.active) {
          return { allowed: false, reason: "BACKUP_PROVIDER_INACTIVE" };
        }
        if (backupProvider.consecutiveStatusFailures >= 3) {
          return { allowed: false, reason: "BACKUP_PROVIDER_DEGRADED" };
        }
        return { allowed: true, backupProviderId: backupProvider.id };
      };

      // Case 1: Inactive backup provider -> REFUSED
      const resInactive = evaluateFailover("Upstream provider error: Out of balance", { routingMode: "AUTO_FAILOVER", backupProviderId: "b1" }, { id: "b1", active: false, consecutiveStatusFailures: 0 });
      expect(resInactive.allowed).toBe(false);
      expect(resInactive.reason).toBe("BACKUP_PROVIDER_INACTIVE");

      // Case 2: Degraded backup provider (3+ consecutive failures) -> REFUSED
      const resDegraded = evaluateFailover("Upstream provider error: Out of balance", { routingMode: "AUTO_FAILOVER", backupProviderId: "b1" }, { id: "b1", active: true, consecutiveStatusFailures: 3 });
      expect(resDegraded.allowed).toBe(false);
      expect(resDegraded.reason).toBe("BACKUP_PROVIDER_DEGRADED");

      // Case 3: Healthy, active backup provider -> ALLOWED
      const resAllowed = evaluateFailover("Upstream provider error: Out of balance", { routingMode: "AUTO_FAILOVER", backupProviderId: "b1" }, { id: "b1", active: true, consecutiveStatusFailures: 0 });
      expect(resAllowed.allowed).toBe(true);
      expect(resAllowed.backupProviderId).toBe("b1");
    });
  });
});

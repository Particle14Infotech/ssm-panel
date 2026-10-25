import { Decimal } from "decimal.js";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  HttpStatus,
} from "@nestjs/common";
import { newDb } from "pg-mem";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PackagesQuoteService } from "../src/modules/packages/packages-quote.service";
import { PlatformsService } from "../src/modules/platforms/platforms.service";
import { PackageExecutionStatus, TransactionType } from "@prisma/client";

describe("S3: GAP-3 Refund Correctness Regression Suite", () => {
  let db: any;
  let mockPrisma: any;
  let packagesService: PackagesService;
  let quoteService: PackagesQuoteService;
  let platformsService: PlatformsService;

  beforeEach(() => {
    db = newDb();

    // Create in-memory database schema for financial correctness testing
    db.public.none(`
      CREATE TABLE "User" (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'CUSTOMER'
      );

      CREATE TABLE "Wallet" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL UNIQUE REFERENCES "User"(id),
        balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00
      );

      CREATE TABLE "LedgerEntry" (
        id VARCHAR(64) PRIMARY KEY,
        "walletId" VARCHAR(64) NOT NULL REFERENCES "Wallet"(id),
        amount NUMERIC(12, 2) NOT NULL,
        type VARCHAR(32) NOT NULL,
        "referenceId" VARCHAR(128),
        "idempotencyKey" VARCHAR(128),
        description TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "Package" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        platform VARCHAR(32) NOT NULL,
        handle VARCHAR(128) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        "reserveTotal" NUMERIC(12, 2) NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "Order" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
        charge NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        "providerOrderId" VARCHAR(128),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "PackageExecution" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64) NOT NULL REFERENCES "Package"(id),
        "orderId" VARCHAR(64),
        seq INT NOT NULL DEFAULT 1,
        quantity INT NOT NULL,
        "allocatedCharge" NUMERIC(10, 2) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED',
        "skipReason" TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "Refund" (
        id VARCHAR(64) PRIMARY KEY,
        "packageId" VARCHAR(64),
        "orderId" VARCHAR(64),
        "userId" VARCHAR(64) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        reason TEXT NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "AuditLog" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64),
        action VARCHAR(64) NOT NULL,
        resource VARCHAR(128) NOT NULL,
        payload JSONB,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO "User" (id, email, role) VALUES ('u_admin', 'admin@smm.test', 'ADMIN');
      INSERT INTO "User" (id, email, role) VALUES ('u_cust', 'cust@smm.test', 'CUSTOMER');
      INSERT INTO "Wallet" (id, "userId", balance) VALUES ('w_cust', 'u_cust', 100.00);
      INSERT INTO "Package" (id, "userId", platform, handle, "reserveTotal")
      VALUES ('pkg_s3_1', 'u_cust', 'instagram', 'refund_handle', 1000.00);
    `);

    mockPrisma = {
      isConnected: true,
      packageExecution: {
        findUnique: async ({ where, include }: any) => {
          const rows = db.public.many(`SELECT * FROM "PackageExecution" WHERE id = '${where.id}'`);
          if (rows.length === 0) return null;
          const exec = rows[0];
          const pkgs = db.public.many(`SELECT * FROM "Package" WHERE id = '${exec.packageId}'`);
          exec.package = pkgs[0] || null;
          if (exec.orderId) {
            const ords = db.public.many(`SELECT * FROM "Order" WHERE id = '${exec.orderId}'`);
            exec.order = ords[0] || null;
          }
          return exec;
        },
        update: async ({ where, data }: any) => {
          db.public.none(`
            UPDATE "PackageExecution"
            SET status = '${data.status}', "skipReason" = '${(data.skipReason || "").replace(/'/g, "''")}'
            WHERE id = '${where.id}'
          `);
          return { id: where.id, ...data };
        },
        updateMany: async ({ where, data }: any) => {
          let forbiddenClause = "";
          if (where.status?.notIn) {
            const forbidden = where.status.notIn.map((s: string) => `'${s}'`).join(", ");
            forbiddenClause = ` AND status NOT IN (${forbidden})`;
          }
          const matching = db.public.many(
            `SELECT id FROM "PackageExecution" WHERE id = '${where.id}'${forbiddenClause}`
          );
          if (matching.length === 0) {
            return { count: 0 };
          }
          db.public.none(`
            UPDATE "PackageExecution"
            SET status = '${data.status}', "skipReason" = '${(data.skipReason || "").replace(/'/g, "''")}'
            WHERE id = '${where.id}'${forbiddenClause}
          `);
          return { count: matching.length };
        },
      },
      package: {
        findUnique: async ({ where }: any) => {
          const rows = db.public.many(`SELECT * FROM "Package" WHERE id = '${where.id}'`);
          return rows[0] || null;
        },
      },
      order: {
        findUnique: async ({ where }: any) => {
          const rows = db.public.many(`SELECT * FROM "Order" WHERE id = '${where.id}'`);
          return rows[0] || null;
        },
      },
      wallet: {
        findUnique: async ({ where }: any) => {
          const rows = db.public.many(`SELECT * FROM "Wallet" WHERE "userId" = '${where.userId}'`);
          return rows[0] || null;
        },
        update: async ({ where, data }: any) => {
          db.public.none(`
            UPDATE "Wallet"
            SET balance = ${data.balance}
            WHERE id = '${where.id}'
          `);
          return { id: where.id, ...data };
        },
      },
      ledgerEntry: {
        findFirst: async ({ where }: any) => {
          let sql = `SELECT * FROM "LedgerEntry" WHERE 1=1`;
          if (where.idempotencyKey) sql += ` AND "idempotencyKey" = '${where.idempotencyKey}'`;
          if (where.referenceId) sql += ` AND "referenceId" = '${where.referenceId}'`;
          const rows = db.public.many(sql);
          return rows[0] || null;
        },
        create: async ({ data }: any) => {
          const id = `led_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          db.public.none(`
            INSERT INTO "LedgerEntry" (id, "walletId", amount, type, "referenceId", "idempotencyKey", description)
            VALUES ('${id}', '${data.walletId}', ${data.amount}, '${data.type}', '${data.referenceId || ""}', '${data.idempotencyKey || ""}', '${(data.description || "").replace(/'/g, "''")}')
          `);
          return { id, ...data };
        },
      },
      refund: {
        findMany: async ({ where }: any) => {
          const rows = db.public.many(`SELECT * FROM "Refund" WHERE "packageId" = '${where.packageId}'`);
          return rows;
        },
        create: async ({ data }: any) => {
          const id = `ref_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          db.public.none(`
            INSERT INTO "Refund" (id, "packageId", "orderId", "userId", amount, reason)
            VALUES ('${id}', '${data.packageId || ""}', '${data.orderId || ""}', '${data.userId}', ${data.amount}, '${(data.reason || "").replace(/'/g, "''")}')
          `);
          return { id, ...data };
        },
      },
      auditLog: {
        create: async ({ data }: any) => {
          const id = `aud_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          const payloadJson = JSON.stringify(data.payload || {}).replace(/'/g, "''");
          db.public.none(`
            INSERT INTO "AuditLog" (id, "userId", action, resource, payload)
            VALUES ('${id}', '${data.userId || ""}', '${data.action}', '${data.resource}', '${payloadJson}')
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

    platformsService = {
      getPlatformConfig: jest.fn().mockResolvedValue({ active: true, displayName: "Instagram" }),
      isHandleBlocked: jest.fn().mockResolvedValue(false),
    } as any;
    quoteService = new PackagesQuoteService(mockPrisma, platformsService);
    packagesService = new PackagesService(mockPrisma, quoteService, platformsService);
  });

  describe("1. Admin manual refund validations", () => {
    it("rejects refund reason shorter than 10 characters with BadRequestException", async () => {
      db.public.none(`
        INSERT INTO "PackageExecution" (id, "packageId", seq, quantity, "allocatedCharge", status)
        VALUES ('exec_short_reason', 'pkg_s3_1', 1, 50, 50.00, 'SCHEDULED');
      `);

      await expect(
        packagesService.adminResolveExecution("exec_short_reason", "REFUND", {
          actor: { userId: "u_admin", role: "ADMIN" },
          reason: "short", // Only 5 chars < 10
          idempotencyKey: "idem_short_reason",
        })
      ).rejects.toThrow("Refund reason must be at least 10 characters long");
    });

    it("rejects refund > ₹500 without second approval flag with 403 ForbiddenException (Two-Man Rule)", async () => {
      db.public.none(`
        INSERT INTO "PackageExecution" (id, "packageId", seq, quantity, "allocatedCharge", status)
        VALUES ('exec_high_val', 'pkg_s3_1', 1, 600, 600.00, 'SCHEDULED');
      `);

      await expect(
        packagesService.adminResolveExecution("exec_high_val", "REFUND", {
          actor: { userId: "u_admin", role: "ADMIN" },
          reason: "High value refund without second approval",
          idempotencyKey: "idem_high_val",
          // twoManRuleApproved omitted or false
        })
      ).rejects.toThrow("REFUND_REQUIRES_TWO_MAN_RULE");
    });

    it("allows refund > ₹500 when second approval flag and second approver are provided", async () => {
      db.public.none(`
        INSERT INTO "PackageExecution" (id, "packageId", seq, quantity, "allocatedCharge", status)
        VALUES ('exec_high_val_appr', 'pkg_s3_1', 1, 600, 600.00, 'SCHEDULED');
      `);

      const res = await packagesService.adminResolveExecution("exec_high_val_appr", "REFUND", {
        actor: { userId: "u_admin", role: "ADMIN" },
        reason: "Legitimate high value refund approved by finance lead",
        idempotencyKey: "idem_high_val_approved",
        twoManRuleApproved: true,
        secondApproverId: "u_admin_super",
      });

      expect(res.success).toBe(true);
      expect(res.refundAmount).toBe(600.00);

      // Verify AuditLog written
      const logs = db.public.many(`SELECT * FROM "AuditLog" WHERE action = 'PACKAGE_EXECUTION_REFUND'`);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].resource).toBe("exec_high_val_appr");
    });
  });

  describe("2. Provider cross-verification before refund", () => {
    it("rejects refund with 409 ConflictException if child order is already COMPLETED by provider", async () => {
      db.public.none(`
        INSERT INTO "Order" (id, "userId", status, charge, "providerOrderId")
        VALUES ('ord_completed_1', 'u_cust', 'COMPLETED', 50.00, 'prov_ext_999');

        INSERT INTO "PackageExecution" (id, "packageId", "orderId", seq, quantity, "allocatedCharge", status)
        VALUES ('exec_prov_completed', 'pkg_s3_1', 'ord_completed_1', 1, 50, 50.00, 'DISPATCHED');
      `);

      await expect(
        packagesService.adminResolveExecution("exec_prov_completed", "REFUND", {
          actor: { userId: "u_admin", role: "ADMIN" },
          reason: "Attempting to refund delivered order",
          idempotencyKey: "idem_completed_cross_check",
        })
      ).rejects.toThrow("Cannot refund an execution whose upstream provider order has already completed");
    });
  });

  describe("3. Concurrency & Double-Refund Mathematical Impossibility", () => {
    it("prevents double-refund: 10 concurrent refund calls on same execution result in exactly 1 debit/refund", async () => {
      db.public.none(`
        INSERT INTO "PackageExecution" (id, "packageId", seq, quantity, "allocatedCharge", status)
        VALUES ('exec_concurrent_race', 'pkg_s3_1', 1, 100, 100.00, 'SCHEDULED');
      `);

      const initialWallet = db.public.one(`SELECT balance FROM "Wallet" WHERE "userId" = 'u_cust'`);
      const initialBalance = Number(initialWallet.balance);

      const tasks = Array.from({ length: 10 }, (_, i) =>
        packagesService.adminResolveExecution("exec_concurrent_race", "REFUND", {
          actor: { userId: "u_admin", role: "ADMIN" },
          reason: `Concurrent refund test run #${i}`,
          idempotencyKey: `idem_concurrent_${i}`,
        }).catch((err) => ({ error: err }))
      );

      const results = await Promise.all(tasks);

      // Exactly 1 must succeed, others must be rejected with 409 Conflict
      const succeeded = results.filter((r: any) => r && r.success === true);
      const conflicts = results.filter((r: any) => r && (r.error?.status === 409 || r.error?.status === 400));

      expect(succeeded.length).toBe(1);
      expect(conflicts.length).toBe(9);

      // Final balance must increase by EXACTLY 100.00, never 200, 300, or 1000
      const finalWallet = db.public.one(`SELECT balance FROM "Wallet" WHERE "userId" = 'u_cust'`);
      const finalBalance = Number(finalWallet.balance);
      expect(finalBalance - initialBalance).toBe(100.00);
    });
  });
});

import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

dotenv.config();

const candidateEnvPaths = [
  path.resolve(process.cwd(), ".env.test"),
  path.resolve(process.cwd(), "../../.env.test"),
  path.resolve(process.cwd(), "../.env.test"),
];

for (const p of candidateEnvPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p, override: true });
    break;
  }
}

const dbUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
if (dbUrl) {
  process.env.DATABASE_URL = dbUrl;
}

import { PrismaClient, PackageStatus, PackageExecutionStatus, TransactionType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * Emergency Admin Rollback Tool: Bulk Package Refund
 * Cancels active/paused packages and refunds unspent reserves back to user wallets with atomic ledger entries.
 *
 * Usage:
 *   pnpm --filter @smm/api exec ts-node ../../scripts/admin-bulk-package-refund.ts --reason="UPSTREAM_EMERGENCY_ROLLBACK"
 * Optional flags:
 *   --dry-run : Previews the operations without mutating the database
 */

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const reasonArg = args.find((a) => a.startsWith("--reason="));
  const reason = reasonArg ? reasonArg.split("=")[1].replace(/^["']|["']$/g, "") : "ADMIN_EMERGENCY_ROLLBACK";

  console.log("=== EMERGENCY PACKAGE ROLLBACK TOOL ===");
  console.log(`Execution Mode: ${dryRun ? "DRY-RUN (Read-Only Preview)" : "LIVE EXECUTION"}`);
  console.log(`Cancellation Reason: ${reason}`);

  const prisma = new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
  });

  try {
    const packages = await prisma.package.findMany({
      where: {
        status: { in: [PackageStatus.ACTIVE, PackageStatus.PAUSED] },
      },
      include: {
        executions: true,
        user: { select: { id: true, email: true } },
      },
    });

    console.log(`\nFound ${packages.length} active or paused packages to process.\n`);

    let totalRefunded = new Decimal(0);
    let totalCancelledExecutions = 0;
    let packagesProcessed = 0;

    for (const pkg of packages) {
      // Find remaining executions that haven't been completed or cancelled
      const refundableExecutions = pkg.executions.filter((e) =>
        ([
          PackageExecutionStatus.SCHEDULED,
          PackageExecutionStatus.SKIPPED_PAUSED,
          PackageExecutionStatus.DETECTED,
        ] as PackageExecutionStatus[]).includes(e.status)
      );

      // Sum the allocated charges for refundable executions
      const refundAmount = refundableExecutions.reduce(
        (sum, e) => sum.add(new Decimal(e.allocatedCharge)),
        new Decimal(0)
      );

      console.log(
        `Package ${pkg.id} (User: ${pkg.user.id}): ${refundableExecutions.length} refundable runs, Total: ₹${refundAmount.toFixed(2)}`
      );

      if (!dryRun) {
        await prisma.$transaction(async (tx) => {
          // 1. Cancel remaining executions
          if (refundableExecutions.length > 0) {
            await tx.packageExecution.updateMany({
              where: {
                id: { in: refundableExecutions.map((e) => e.id) },
              },
              data: {
                status: PackageExecutionStatus.CANCELLED,
              },
            });
          }

          // 2. Mark package CANCELLED
          await tx.package.update({
            where: { id: pkg.id },
            data: { status: PackageStatus.CANCELLED },
          });

          // 3. Refund wallet and insert ledger entry if refund > 0
          if (refundAmount.gt(0)) {
            const wallet = await tx.wallet.findUnique({
              where: { userId: pkg.userId },
            });

            if (wallet) {
              await tx.wallet.update({
                where: { id: wallet.id },
                data: {
                  balance: { increment: refundAmount },
                },
              });

              await tx.ledgerEntry.create({
                data: {
                  walletId: wallet.id,
                  amount: refundAmount,
                  type: TransactionType.PACKAGE_REFUND,
                  description: `Emergency package rollback: ${reason} (Package ${pkg.id})`,
                },
              });
            }
          }
        });
      }

      totalRefunded = totalRefunded.add(refundAmount);
      totalCancelledExecutions += refundableExecutions.length;
      packagesProcessed++;
    }

    console.log("\n--- ROLLBACK SUMMARY ---");
    console.log(`Packages Processed: ${packagesProcessed}`);
    console.log(`Executions Cancelled: ${totalCancelledExecutions}`);
    console.log(`Total Unspent Reserve Refunded: ₹${totalRefunded.toFixed(2)}`);
    console.log(`Status: ${dryRun ? "DRY-RUN COMPLETE (No DB changes)" : "SUCCESSFULLY EXECUTED"}`);
  } catch (error) {
    console.error("Rollback failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

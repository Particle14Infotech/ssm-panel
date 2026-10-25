import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { Decimal } from "decimal.js";
import {
  PackageStatus,
  PackageExecutionStatus,
  TransactionType,
} from "@prisma/client";
import { calculatePackageAccounting } from "./package-accounting.util";

export interface TriggerPostPayload {
  mediaKey: string;
  permalink?: string;
  mediaType: string;
  publishedAt: Date;
}

@Injectable()
export class PackagesSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PackagesSchedulerService.name);
  private schedulerInterval: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.NODE_ENV !== "test") {
      this.schedulerInterval = setInterval(async () => {
        try {
          // Provider dispatch is owned by the worker process. Keeping this API-side
          // loop to settlement avoids two processes claiming due executions.
          await this.settleExpiredPackages();
        } catch (err: any) {
          this.logger.error(`Error in periodic package settlement loop: ${err.message}`);
        }
      }, 10000);
    }
  }

  onModuleDestroy() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Sweeps and settles packages whose endAt <= NOW()
   * Idempotent: refunds unused reserve exactly once via PACKAGE_REFUND and unique constraint.
   */
  async settleExpiredPackages(): Promise<{ settledCount: number }> {
    if (!this.prisma.isConnected) return { settledCount: 0 };

    const now = new Date();
    const expiredPackages = await this.prisma.package.findMany({
      where: {
        status: PackageStatus.ACTIVE,
        endAt: { lte: now },
      },
      select: { id: true, userId: true, reserveTotal: true },
    });

    let settledCount = 0;
    for (const pkg of expiredPackages) {
      try {
        await this.prisma.$transaction(async (tx) => {
          const [lockedPkg] = await tx.$queryRawUnsafe<any[]>(
            `SELECT * FROM "Package" WHERE id = $1 FOR UPDATE`,
            pkg.id
          );
          if (!lockedPkg || lockedPkg.status !== PackageStatus.ACTIVE) return;

          // Compute auditable package accounting across all executions and prior refunds
          const allExecutions = await tx.packageExecution.findMany({
            where: {
              packageId: pkg.id,
              status: {
                in: [
                  PackageExecutionStatus.COMPLETED,
                  PackageExecutionStatus.PARTIAL,
                  PackageExecutionStatus.DISPATCHED,
                  PackageExecutionStatus.SCHEDULED,
                  PackageExecutionStatus.CANCELLED,
                  PackageExecutionStatus.FAILED,
                  PackageExecutionStatus.SKIPPED_PAUSED,
                  PackageExecutionStatus.SKIPPED_QUOTA,
                  PackageExecutionStatus.SKIPPED_TYPE,
                  PackageExecutionStatus.SKIPPED_DELETED,
                  PackageExecutionStatus.SKIPPED_LIMIT,
                  PackageExecutionStatus.DETECTED,
                ],
              },
            },
          });

          const childOrderIds = allExecutions
            .map((e) => e.orderId)
            .filter(Boolean) as string[];

          const existingRefunds = typeof tx.refund?.findMany === "function"
            ? await tx.refund.findMany({
                where: {
                  OR: [
                    { packageId: pkg.id },
                    ...(childOrderIds.length > 0 ? [{ orderId: { in: childOrderIds } }] : []),
                  ],
                },
                select: { amount: true },
              })
            : [];

          const accounting = calculatePackageAccounting(
            lockedPkg.reserveTotal,
            allExecutions,
            existingRefunds
          );

          const unusedReserve = accounting.netRefundDue;

          if (unusedReserve.greaterThan(0)) {
            const [walletRow] = await tx.$queryRawUnsafe<any[]>(
              `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
              pkg.userId
            );

            if (walletRow) {
              const newBalance = new Decimal(walletRow.balance.toString()).plus(unusedReserve);
              await tx.wallet.update({
                where: { id: walletRow.id },
                data: { balance: newBalance },
              });

              await tx.refund.create({
                data: {
                  packageId: pkg.id,
                  userId: pkg.userId,
                  amount: unusedReserve,
                  reason: "PACKAGE_SETTLEMENT_UNUSED_RESERVE",
                },
              });

              await tx.ledgerEntry.create({
                data: {
                  walletId: walletRow.id,
                  amount: unusedReserve,
                  type: TransactionType.PACKAGE_REFUND,
                  referenceId: `REF_PKG_${pkg.id}_SETTLE`,
                  description: `Package Expiry Settlement Refund for #${pkg.id}`,
                },
              });
            }
          }

          // Cancel remaining scheduled executions
          await tx.packageExecution.updateMany({
            where: { packageId: pkg.id, status: PackageExecutionStatus.SCHEDULED },
            data: {
              status: PackageExecutionStatus.CANCELLED,
              skipReason: "Package duration expired",
            },
          });

          await tx.package.update({
            where: { id: pkg.id },
            data: { status: PackageStatus.COMPLETED },
          });

          settledCount++;
        });
      } catch (err: any) {
        this.logger.error(`Error settling expired package ${pkg.id}: ${err.message}`);
      }
    }

    return { settledCount };
  }
}

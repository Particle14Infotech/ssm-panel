import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { Decimal } from "decimal.js";
import {
  OrderStatus,
  OutboxStatus,
  PackageStatus,
  PackageExecutionStatus,
  TransactionType,
  MonitoredMediaState,
} from "@prisma/client";

export interface TriggerPostPayload {
  mediaKey: string;
  permalink?: string;
  mediaType: string;
  publishedAt: Date;
}

@Injectable()
export class PackagesSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PackagesSchedulerService.name);
  private isProcessingExecutions = false;
  private schedulerInterval: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.NODE_ENV !== "test") {
      this.schedulerInterval = setInterval(async () => {
        try {
          await this.processDueExecutions();
          await this.settleExpiredPackages();
        } catch (err: any) {
          this.logger.error(`Error in periodic package execution loop: ${err.message}`);
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
   * Evaluates due executions and dispatches them via child orders and outbox.
   * Concurrency safety guaranteed via FOR UPDATE SKIP LOCKED.
   */
  async processDueExecutions(): Promise<{ dispatchedCount: number; errorsCount: number }> {
    if (!this.prisma.isConnected || this.isProcessingExecutions) {
      return { dispatchedCount: 0, errorsCount: 0 };
    }

    this.isProcessingExecutions = true;
    let dispatchedCount = 0;
    let errorsCount = 0;

    try {
      const now = new Date();

      // Fetch batch of due executions with SKIP LOCKED
      const dueExecutions = await this.prisma.$queryRawUnsafe<
        Array<{
          id: string;
          packageId: string;
          ruleId: string;
          mediaId: string | null;
          source: string;
          seq: number;
          quantity: number;
          allocatedCharge: any;
          executeAt: Date;
          userId: string;
          handle: string;
          packageStatus: string;
          packageEndAt: Date;
          serviceId: string;
          mediaKey: string | null;
          permalink: string | null;
          mediaState: string | null;
          providerId: string | null;
          providerServiceId: string | null;
        }>
      >(`
        SELECT 
          e.id,
          e."packageId",
          e."ruleId",
          e."mediaId",
          e.source,
          e.seq,
          e.quantity,
          e."allocatedCharge",
          e."executeAt",
          p."userId",
          p.handle,
          p.status as "packageStatus",
          p."endAt" as "packageEndAt",
          r."serviceId",
          m."mediaKey",
          m.permalink,
          m.state as "mediaState",
          s."providerId",
          s."providerServiceId"
        FROM "PackageExecution" e
        JOIN "Package" p ON e."packageId" = p.id
        JOIN "PackageRule" r ON e."ruleId" = r.id
        JOIN "Service" s ON r."serviceId" = s.id
        LEFT JOIN "MonitoredMedia" m ON e."mediaId" = m.id
        WHERE e.status = 'SCHEDULED'
          AND e."executeAt" <= $1
        ORDER BY e."executeAt" ASC
        LIMIT 25
        FOR UPDATE OF e SKIP LOCKED
      `, now);

      if (!dueExecutions || dueExecutions.length === 0) {
        this.isProcessingExecutions = false;
        return { dispatchedCount: 0, errorsCount: 0 };
      }

      for (const exec of dueExecutions) {
        try {
          // 1. Check Package status
          if (exec.packageStatus === PackageStatus.CANCELLED) {
            await this.prisma.packageExecution.update({
              where: { id: exec.id },
              data: {
                status: PackageExecutionStatus.CANCELLED,
                skipReason: "Package cancelled",
              },
            });
            continue;
          }

          if (exec.packageStatus === PackageStatus.PAUSED) {
            await this.prisma.packageExecution.update({
              where: { id: exec.id },
              data: {
                status: PackageExecutionStatus.SKIPPED_PAUSED,
                skipReason: "Package is currently paused",
              },
            });
            continue;
          }

          if (now > new Date(exec.packageEndAt)) {
            await this.prisma.packageExecution.update({
              where: { id: exec.id },
              data: {
                status: PackageExecutionStatus.CANCELLED,
                skipReason: "Package duration expired",
              },
            });
            continue;
          }

          // 2. Re-verify media still exists if source is MEDIA
          if (exec.mediaId && exec.mediaState === MonitoredMediaState.DELETED) {
            // Media deleted! Set SKIPPED_DELETED and refund that slot
            await this.prisma.$transaction(async (tx) => {
              const allocated = new Decimal(exec.allocatedCharge.toString());

              await tx.packageExecution.update({
                where: { id: exec.id },
                data: {
                  status: PackageExecutionStatus.SKIPPED_DELETED,
                  skipReason: "Media was deleted prior to execution dispatch",
                },
              });

              if (allocated.greaterThan(0)) {
                const [wallet] = await tx.$queryRawUnsafe<any[]>(
                  `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
                  exec.userId
                );
                if (wallet) {
                  const newBal = new Decimal(wallet.balance.toString()).plus(allocated);
                  await tx.wallet.update({
                    where: { id: wallet.id },
                    data: { balance: newBal },
                  });

                  await tx.refund.create({
                    data: {
                      packageId: exec.packageId,
                      userId: exec.userId,
                      amount: allocated,
                      reason: `MEDIA_DELETED_SLOT_${exec.id}`,
                    },
                  });

                  await tx.ledgerEntry.create({
                    data: {
                      walletId: wallet.id,
                      amount: allocated,
                      type: TransactionType.PACKAGE_REFUND,
                      referenceId: `REF_SLOT_${exec.id}`,
                      description: `Slot Refund for Deleted Post in Package #${exec.packageId}`,
                    },
                  });
                }
              }
            });
            continue;
          }

          // 3. Determine target URL
          let target = exec.permalink;
          if (!target || target.trim() === "") {
            target = `https://www.instagram.com/${exec.handle.replace(/^@/, "")}`;
          }

          const allocatedCharge = new Decimal(exec.allocatedCharge.toString());

          // 4. Create child order and outbox event in single transaction
          await this.prisma.$transaction(async (tx) => {
            // Create PREPAID child order carrying the REAL allocated charge (NEVER 0)
            const childOrder = await tx.order.create({
              data: {
                userId: exec.userId,
                serviceId: exec.serviceId,
                target,
                quantity: exec.quantity,
                charge: allocatedCharge, // Real charge! Never 0 to preserve refund formulas
                isPrepaid: true,          // Flagged prepaid so wallet is not debited twice
                status: OrderStatus.PENDING,
                startCount: 0,
                remains: exec.quantity,
                providerId: exec.providerId || null,
                packageExecutionId: exec.id,
              },
            });

            // Mark execution as DISPATCHED
            await tx.packageExecution.update({
              where: { id: exec.id },
              data: {
                status: PackageExecutionStatus.DISPATCHED,
                orderId: childOrder.id,
              },
            });

            // Enqueue outbox event for provider dispatch queue
            await tx.outboxEvent.create({
              data: {
                aggregate: "ORDER",
                eventType: "ORDER_CREATED",
                payload: {
                  orderId: childOrder.id,
                  packageId: exec.packageId,
                  ruleId: exec.ruleId,
                  packageExecutionId: exec.id,
                  serviceId: exec.serviceId,
                  target,
                  quantity: exec.quantity,
                  isPrepaid: true,
                },
                status: OutboxStatus.PENDING,
              },
            });
          });

          dispatchedCount++;
        } catch (execErr: any) {
          errorsCount++;
          this.logger.error(`Error dispatching execution ${exec.id}: ${execErr.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error in processDueExecutions loop: ${err.message}`);
    } finally {
      this.isProcessingExecutions = false;
    }

    return { dispatchedCount, errorsCount };
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

          // Compute consumed reserve
          const dispatched = await tx.packageExecution.findMany({
            where: {
              packageId: pkg.id,
              status: { in: [PackageExecutionStatus.DISPATCHED, PackageExecutionStatus.COMPLETED] },
            },
            select: { allocatedCharge: true },
          });

          let consumed = new Decimal(0);
          for (const e of dispatched) {
            consumed = consumed.plus(new Decimal(e.allocatedCharge.toString()));
          }

          const reserveTotal = new Decimal(lockedPkg.reserveTotal.toString());
          const unusedReserve = Decimal.max(0, reserveTotal.minus(consumed));

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

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { Decimal } from "decimal.js";
import { OrderStatus, OutboxStatus, PackageRunStatus } from "@prisma/client";

@Injectable()
export class PackagesSchedulerService {
  private readonly logger = new Logger(PackagesSchedulerService.name);
  private isProcessing = false;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executes a scheduler tick to dispatch all due package runs.
   * Uses FOR UPDATE SKIP LOCKED to guarantee safe concurrent execution
   * across multiple worker instances.
   */
  async processDueRuns(): Promise<{ dispatchedCount: number; errorsCount: number }> {
    if (!this.prisma.isConnected) {
      return { dispatchedCount: 0, errorsCount: 0 };
    }

    if (this.isProcessing) {
      return { dispatchedCount: 0, errorsCount: 0 };
    }

    this.isProcessing = true;
    let dispatchedCount = 0;
    let errorsCount = 0;

    try {
      const now = new Date();

      // Fetch batch of due runs with SKIP LOCKED
      const dueRuns = await this.prisma.$queryRaw<
        Array<{
          id: string;
          packageId: string;
          packageItemId: string;
          runIndex: number;
          quantity: number;
          scheduledAt: Date;
          userId: string;
          serviceId: string;
          target: string;
          providerId: string | null;
          providerServiceId: string | null;
        }>
      >`
        SELECT 
          r.id, 
          r."packageId", 
          r."packageItemId", 
          r."runIndex", 
          r.quantity, 
          r."scheduledAt",
          p."userId",
          i."serviceId",
          i.target,
          s."providerId",
          s."providerServiceId"
        FROM "PackageRun" r
        JOIN "Package" p ON r."packageId" = p.id
        JOIN "PackageItem" i ON r."packageItemId" = i.id
        JOIN "Service" s ON i."serviceId" = s.id
        WHERE r.status = 'SCHEDULED'
          AND r."scheduledAt" <= ${now}
          AND p.status = 'ACTIVE'
        ORDER BY r."scheduledAt" ASC
        LIMIT 25
        FOR UPDATE SKIP LOCKED;
      `;

      if (!dueRuns || dueRuns.length === 0) {
        this.isProcessing = false;
        return { dispatchedCount: 0, errorsCount: 0 };
      }

      for (const run of dueRuns) {
        try {
          await this.prisma.$transaction(async (tx) => {
            // 1. Mark run as DISPATCHING
            await tx.packageRun.update({
              where: { id: run.id },
              data: { status: PackageRunStatus.DISPATCHING },
            });

            // 2. Create Prepaid Child Order
            // Unique constraint on packageRunId prevents any double-ordering
            const childOrder = await tx.order.create({
              data: {
                userId: run.userId,
                serviceId: run.serviceId,
                target: run.target,
                quantity: run.quantity,
                charge: new Decimal(0.0), // Prepaid by package upfront debit
                isPrepaid: true,
                packageRunId: run.id,
                status: OrderStatus.PENDING,
                startCount: 0,
                remains: run.quantity,
                providerId: run.providerId || null,
              },
            });

            // 3. Update run status to PROCESSING
            await tx.packageRun.update({
              where: { id: run.id },
              data: {
                status: PackageRunStatus.PROCESSING,
              },
            });

            // 4. Update parent Package completed runs count
            await tx.package.update({
              where: { id: run.packageId },
              data: {
                completedRuns: { increment: 1 },
              },
            });

            // 5. Enqueue OutboxEvent for provider dispatch
            await tx.outboxEvent.create({
              data: {
                aggregate: "ORDER",
                eventType: "ORDER_CREATED",
                payload: {
                  orderId: childOrder.id,
                  packageRunId: run.id,
                  packageId: run.packageId,
                  serviceId: run.serviceId,
                  target: run.target,
                  quantity: run.quantity,
                  providerId: run.providerId,
                  providerServiceId: run.providerServiceId,
                  isPrepaid: true,
                },
                status: OutboxStatus.PENDING,
              },
            });
          });

          dispatchedCount++;
        } catch (runErr: any) {
          errorsCount++;
          this.logger.error(`Error dispatching package run ${run.id}: ${runErr.message}`);

          // Record failure on run
          try {
            await this.prisma.packageRun.update({
              where: { id: run.id },
              data: {
                attempts: { increment: 1 },
                lastError: runErr.message?.slice(0, 500),
              },
            });
          } catch {}
        }
      }
    } catch (err: any) {
      this.logger.error(`Error in scheduler tick: ${err.message}`);
    } finally {
      this.isProcessing = false;
    }

    return { dispatchedCount, errorsCount };
  }
}

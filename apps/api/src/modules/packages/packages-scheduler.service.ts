import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { InstagramService } from "../instagram/instagram.service";
import { Decimal } from "decimal.js";
import { OrderStatus, OutboxStatus, PackageRunStatus } from "@prisma/client";

export interface TriggerPostPayload {
  mediaId: string;
  permalink?: string;
  mediaType: string;
  publishedAt: Date;
}

@Injectable()
export class PackagesSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PackagesSchedulerService.name);
  private isProcessingRuns = false;
  private isProcessingExecutions = false;
  private schedulerInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly instagramService: InstagramService
  ) {}

  onModuleInit() {
    // Background polling daemon for due runs & auto-post executions
    if (process.env.NODE_ENV !== "test") {
      this.schedulerInterval = setInterval(async () => {
        try {
          await this.processDueRuns();
          await this.processDueExecutions();
        } catch (err: any) {
          this.logger.error(`Error in periodic scheduler loop: ${err.message}`);
        }
      }, 15000);
    }
  }

  onModuleDestroy() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }
  }

  /**
   * Polls a specific Instagram connection for new media and triggers workflows for all active packages
   */
  async pollConnection(connectionId: string, simulatedItems?: any[]) {
    const result = await this.instagramService.detectNewMedia(
      connectionId,
      undefined,
      simulatedItems
    );

    let totalScheduled = 0;
    for (const item of result.newItems) {
      const scheduled = await this.triggerPostWorkflows(connectionId, {
        mediaId: item.mediaId,
        permalink: item.permalink,
        mediaType: item.mediaType,
        publishedAt: new Date(item.publishedAt),
      });
      totalScheduled += scheduled.scheduledCount;
    }

    return {
      detectedCount: result.detectedCount,
      totalScheduled,
      newItems: result.newItems,
    };
  }

  /**
   * Polls all connected accounts that currently have ACTIVE auto-post packages
   */
  async pollAllActiveConnections() {
    if (!this.prisma.isConnected) return { polledConnections: 0, newPosts: 0 };

    const activePackages = await this.prisma.package.findMany({
      where: {
        status: "ACTIVE",
        autoPostEnabled: true,
        connectionId: { not: null },
      },
      select: { connectionId: true },
      distinct: ["connectionId"],
    });

    let polledConnections = 0;
    let newPosts = 0;

    for (const pkg of activePackages) {
      if (pkg.connectionId) {
        try {
          const res = await this.pollConnection(pkg.connectionId);
          polledConnections++;
          newPosts += res.detectedCount;
        } catch (err: any) {
          this.logger.warn(`Failed to poll connection ${pkg.connectionId}: ${err.message}`);
        }
      }
    }

    return { polledConnections, newPosts };
  }

  /**
   * Evaluates a newly detected post/reel against all active packages for the connection,
   * creating scheduled AutomationExecution records.
   */
  async triggerPostWorkflows(
    connectionId: string,
    media: TriggerPostPayload
  ): Promise<{ scheduledCount: number; skippedCount: number }> {
    if (!this.prisma.isConnected) {
      return { scheduledCount: 0, skippedCount: 0 };
    }

    const now = new Date();
    let scheduledCount = 0;
    let skippedCount = 0;

    // Find all ACTIVE packages monitoring this account
    const activePackages = await this.prisma.package.findMany({
      where: {
        connectionId,
        status: "ACTIVE",
        autoPostEnabled: true,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: {
        items: {
          where: { enabled: true },
        },
      },
    });

    for (const pkg of activePackages) {
      for (const item of pkg.items) {
        // 1. Check media type eligibility
        const eligibleTypes = (item.eligibleMediaTypes as string[]) || [
          "IMAGE",
          "VIDEO",
          "REEL",
          "CAROUSEL_ALBUM",
        ];
        const isEligibleMedia =
          eligibleTypes.includes(media.mediaType) ||
          (media.mediaType === "REEL" && eligibleTypes.includes("VIDEO"));

        if (!isEligibleMedia) {
          skippedCount++;
          continue;
        }

        // 2. Check quota
        if (item.usageConsumed >= item.usageLimit) {
          skippedCount++;
          continue;
        }

        // 3. Compute scheduled execution timestamp with configured delay
        const delayMinutes = item.delayAfterPublication || 0;
        const targetRunTime = new Date(
          media.publishedAt.getTime() + delayMinutes * 60 * 1000
        );
        const scheduledAt = targetRunTime > now ? targetRunTime : now;

        const idempotencyKey = `exec_${pkg.id}_${media.mediaId}_${item.id}`;

        try {
          await this.prisma.automationExecution.create({
            data: {
              packageId: pkg.id,
              packageItemId: item.id,
              mediaId: media.mediaId,
              actionType: "ENGAGEMENT",
              status: "SCHEDULED",
              idempotencyKey,
              scheduledAt,
              attempts: 0,
            },
          });
          scheduledCount++;
        } catch (err: any) {
          // P2002: Unique constraint violation (packageId, mediaId, packageItemId) - already scheduled!
          if (err.code !== "P2002") {
            this.logger.warn({ err: err.message }, "Error scheduling automation execution");
          }
        }
      }
    }

    return { scheduledCount, skippedCount };
  }

  /**
   * Executes a scheduler tick to dispatch due AutomationExecution records.
   * Guarantees concurrent worker safety with FOR UPDATE SKIP LOCKED.
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

      const dueExecutions = await this.prisma.$queryRaw<
        Array<{
          id: string;
          packageId: string;
          packageItemId: string;
          mediaId: string;
          scheduledAt: Date;
          attempts: number;
          userId: string;
          packageStatus: string;
          packageEndDate: Date;
          serviceId: string;
          quantityPerPost: number | null;
          usageLimit: number;
          usageConsumed: number;
          permalink: string;
          providerId: string | null;
          providerServiceId: string | null;
        }>
      >`
        SELECT 
          e.id,
          e."packageId",
          e."packageItemId",
          e."mediaId",
          e."scheduledAt",
          e.attempts,
          p."userId",
          p.status as "packageStatus",
          p."endDate" as "packageEndDate",
          i."serviceId",
          i."quantityPerPost",
          i."usageLimit",
          i."usageConsumed",
          m.permalink,
          s."providerId",
          s."providerServiceId"
        FROM "AutomationExecution" e
        JOIN "Package" p ON e."packageId" = p.id
        JOIN "PackageItem" i ON e."packageItemId" = i.id
        JOIN "MonitoredMedia" m ON (m."connectionId" = p."connectionId" AND m."mediaId" = e."mediaId")
        JOIN "Service" s ON i."serviceId" = s.id
        WHERE e.status = 'SCHEDULED'
          AND e."scheduledAt" <= ${now}
        ORDER BY e."scheduledAt" ASC
        LIMIT 25
        FOR UPDATE SKIP LOCKED;
      `;

      if (!dueExecutions || dueExecutions.length === 0) {
        this.isProcessingExecutions = false;
        return { dispatchedCount: 0, errorsCount: 0 };
      }

      for (const exec of dueExecutions) {
        try {
          // Check package status & expiry
          if (exec.packageStatus !== "ACTIVE" || now > exec.packageEndDate) {
            await this.prisma.automationExecution.update({
              where: { id: exec.id },
              data: {
                status: "SKIPPED",
                errorMessage: `Package is ${exec.packageStatus} or expired.`,
              },
            });
            continue;
          }

          const actionQty = exec.quantityPerPost || 100;

          // Check quota limits
          if (exec.usageConsumed + actionQty > exec.usageLimit) {
            await this.prisma.automationExecution.update({
              where: { id: exec.id },
              data: {
                status: "SKIPPED",
                errorMessage: `Item usage limit reached (${exec.usageConsumed}/${exec.usageLimit}).`,
              },
            });
            continue;
          }

          await this.prisma.$transaction(async (tx) => {
            // 1. Mark execution PROCESSING
            await tx.automationExecution.update({
              where: { id: exec.id },
              data: {
                status: "PROCESSING",
                startedAt: now,
              },
            });

            // 2. Create Prepaid Child Order for the detected post permalink
            const childOrder = await tx.order.create({
              data: {
                userId: exec.userId,
                serviceId: exec.serviceId,
                target: exec.permalink,
                quantity: actionQty,
                charge: new Decimal(0.0), // Prepaid by package upfront debit
                isPrepaid: true,
                status: OrderStatus.PENDING,
                startCount: 0,
                remains: actionQty,
                providerId: exec.providerId || null,
              },
            });

            // 3. Mark execution COMPLETED and link provider reference
            await tx.automationExecution.update({
              where: { id: exec.id },
              data: {
                status: "COMPLETED",
                completedAt: new Date(),
                providerReference: childOrder.id,
              },
            });

            // 4. Update usage on PackageItem and Package
            await tx.packageItem.update({
              where: { id: exec.packageItemId },
              data: {
                usageConsumed: { increment: actionQty },
              },
            });

            await tx.package.update({
              where: { id: exec.packageId },
              data: {
                postsProcessed: { increment: 1 },
              },
            });

            // 5. Enqueue Outbox event
            await tx.outboxEvent.create({
              data: {
                aggregate: "ORDER",
                eventType: "ORDER_CREATED",
                payload: {
                  orderId: childOrder.id,
                  packageId: exec.packageId,
                  packageItemId: exec.packageItemId,
                  automationExecutionId: exec.id,
                  serviceId: exec.serviceId,
                  target: exec.permalink,
                  quantity: actionQty,
                  providerId: exec.providerId,
                  providerServiceId: exec.providerServiceId,
                  isPrepaid: true,
                },
                status: OutboxStatus.PENDING,
              },
            });
          });

          dispatchedCount++;
        } catch (execErr: any) {
          errorsCount++;
          this.logger.error(
            `Error executing automation task ${exec.id}: ${execErr.message}`
          );

          try {
            const nextAttempts = exec.attempts + 1;
            const newStatus = nextAttempts >= 3 ? "FAILED" : "SCHEDULED";
            await this.prisma.automationExecution.update({
              where: { id: exec.id },
              data: {
                attempts: nextAttempts,
                status: newStatus,
                errorMessage: execErr.message?.slice(0, 500),
                scheduledAt: new Date(Date.now() + 60 * 1000 * Math.pow(2, nextAttempts)),
              },
            });
          } catch {}
        }
      }
    } catch (err: any) {
      this.logger.error(`Error in automation executions scheduler tick: ${err.message}`);
    } finally {
      this.isProcessingExecutions = false;
    }

    return { dispatchedCount, errorsCount };
  }

  /**
   * Executes a scheduler tick to dispatch all due package runs (time-based).
   * Uses FOR UPDATE SKIP LOCKED to guarantee safe concurrent execution
   * across multiple worker instances.
   */
  async processDueRuns(): Promise<{ dispatchedCount: number; errorsCount: number }> {
    if (!this.prisma.isConnected || this.isProcessingRuns) {
      return { dispatchedCount: 0, errorsCount: 0 };
    }

    this.isProcessingRuns = true;
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
        this.isProcessingRuns = false;
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
      this.isProcessingRuns = false;
    }

    return { dispatchedCount, errorsCount };
  }
}

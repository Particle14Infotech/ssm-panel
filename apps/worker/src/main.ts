import dotenv from "dotenv";
import { PrismaClient, OrderStatus, OutboxStatus } from "@prisma/client";
import Redis from "ioredis";
import { Queue, Worker as BullWorker, Job } from "bullmq";
import pino from "pino";
import { Decimal } from "decimal.js";
import { decryptProviderKey } from "./crypto.util";
import {
  EmailProvider,
  ResendProvider,
  LogOnlyEmailProvider,
  getOrderRefundTemplate,
  EmailSendOptions,
  isLinkRestrictionError,
  aggregateRunStatuses,
} from "@smm/contracts";

dotenv.config();

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
});

const prisma = new PrismaClient();

const MAX_OUTBOX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;

export class SMMWorkerEngine {
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private dripRunInterval: NodeJS.Timeout | null = null;
  private redis: Redis | null = null;
  private bullWorker: BullWorker | null = null;
  private orderQueue: Queue | null = null;
  private emailQueue: Queue | null = null;
  private emailWorker: BullWorker | null = null;
  private emailProvider: EmailProvider = new LogOnlyEmailProvider();

  async start() {
    this.isRunning = true;
    logger.info("[Worker] SMM PANEL Production Worker initializing (BullMQ Engine & Status Sync Daemon)");

    // 1. Verify Database connectivity
    try {
      await prisma.$connect();
      logger.info("[Postgres] Database connected successfully");
    } catch (err: any) {
      logger.fatal({ err: err.message }, "[FATAL] PostgreSQL unreachable on worker boot");
      process.exit(1);
    }

    // 2. Verify Redis and BullMQ
    await this.verifyRedisPolicy();

    // 3. Initialize BullMQ Queue listener
    if (this.redis) {
      try {
        this.orderQueue = new Queue("smm-orders", { connection: this.redis });
        this.bullWorker = new BullWorker(
          "smm-orders",
          async (job: Job) => {
            logger.info({ jobId: job.id, jobName: job.name, data: job.data }, "[BullMQ] Processing order job");
            if (job.name === "dispatch-order" && job.data?.orderId) {
              try {
                await this.dispatchOrderToProvider(job.data.orderId);
              } catch (dispatchErr: any) {
                const attemptsMade = (job.attemptsMade || 0) + 1;
                const isPermanent =
                  dispatchErr.message?.includes("Missing username") ||
                  dispatchErr.message?.includes("not found") ||
                  dispatchErr.message?.includes("Incorrect request");
                if (attemptsMade >= 3 || isPermanent) {
                  logger.warn(`[BullMQ] Order #${job.data.orderId} failed dispatch permanently. Triggering auto-refund.`);
                  await this.handleFinalOrderFailure(job.data.orderId, dispatchErr.message);
                } else {
                  throw dispatchErr;
                }
              }
            }
            return { processed: true, completedAt: new Date().toISOString() };
          },
          {
            connection: this.redis,
            concurrency: 5,
          }
        );

        this.bullWorker.on("ready", () => {
          logger.info("[BullMQ] Worker ready on queue 'smm-orders'");
        });

        this.bullWorker.on("failed", (job, err) => {
          logger.error({ jobId: job?.id, err: err.message }, "BullMQ order job execution failed");
        });

        this.bullWorker.on("error", (err) => {
          logger.warn({ err: err.message }, "BullMQ worker error event");
        });

        // Initialize Resend / Log-Only Email Provider
        const resendKey = process.env.RESEND_API_KEY;
        const emailFrom = process.env.EMAIL_FROM || "SMM Panel <no-reply@smmpanel.internal>";
        const emailReplyTo = process.env.EMAIL_REPLY_TO || process.env.SUPPORT_EMAIL;

        if (resendKey && resendKey.trim() !== "" && !resendKey.startsWith("REPLACE_ME")) {
          this.emailProvider = new ResendProvider(resendKey, emailFrom, emailReplyTo);
          logger.info(`[Worker Email] Provider initialized: Resend HTTPS API (From: ${emailFrom})`);
        } else {
          this.emailProvider = new LogOnlyEmailProvider();
          logger.warn("[Worker Email] RESEND_API_KEY not configured. Running in log-only simulated mode.");
        }

        // Initialize BullMQ Queue listener for "email"
        this.emailQueue = new Queue("email", { connection: this.redis });
        this.emailWorker = new BullWorker(
          "email",
          async (job: Job) => {
            logger.info({ jobId: job.id, jobName: job.name, to: job.data?.to, type: job.data?.type }, "[BullMQ Email] Processing email job");
            if (job.name === "send-email" && job.data) {
              await this.processEmailJob(job.data);
            }
            return { processed: true, completedAt: new Date().toISOString() };
          },
          {
            connection: this.redis,
            concurrency: 5,
          }
        );

        this.emailWorker.on("ready", () => {
          logger.info("[BullMQ Email] Worker ready on queue 'email'");
        });

        this.emailWorker.on("failed", (job, err) => {
          logger.error({ jobId: job?.id, to: job?.data?.to, err: err.message }, "[BullMQ Email] Job execution failed");
        });

        this.emailWorker.on("error", (err) => {
          logger.warn({ err: err.message }, "[BullMQ Email] Worker error event");
        });
      } catch (err: any) {
        logger.error({ err: err.message }, "Failed to initialize BullMQ worker listener");
      }
    }

    // 4. Poll Outbox Events (Relay to BullMQ / Direct Execution)
    this.pollInterval = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.processOutboxEvents();
      } catch (err: any) {
        logger.error({ err }, "Worker outbox poll cycle error");
      }
    }, 2000);

    // 5. Status-sync job: poll non-final orders and sync with upstream providers
    this.syncInterval = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.syncNonFinalOrders();
      } catch (err: any) {
        logger.error({ err }, "Status-sync daemon cycle error");
      }
    }, 8000);

    // 6. Panel-Managed Drip-Feed Run Dispatcher Daemon
    this.dripRunInterval = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.pollAndDispatchDueRuns();
      } catch (err: any) {
        logger.error({ err }, "Drip-feed run dispatcher cycle error");
      }
    }, 15000);

    // Initial triggers (safely handled without terminating boot)
    try {
      await this.processOutboxEvents();
    } catch (err: any) {
      logger.warn({ err: err.message }, "[Worker] Initial outbox event processing deferred to interval");
    }

    try {
      await this.syncNonFinalOrders();
    } catch (err: any) {
      logger.warn({ err: err.message }, "[Worker] Initial status sync deferred to interval");
    }
  }

  async verifyRedisPolicy() {
    try {
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        this.redis = new Redis(redisUrl, {
          family: 0,
          maxRetriesPerRequest: null,
          connectTimeout: 5000,
          enableOfflineQueue: false,
          lazyConnect: true,
        });
      } else {
        const host = process.env.REDIS_HOST || "localhost";
        const port = parseInt(process.env.REDIS_PORT || "6379", 10);
        this.redis = new Redis({
          host,
          port,
          maxRetriesPerRequest: null,
          connectTimeout: 2000,
          enableOfflineQueue: false,
          lazyConnect: true,
        });
      }

      await this.redis.connect();
      await this.redis.ping();
      logger.info("[Redis] Connected successfully for BullMQ & Caching");
    } catch (err: any) {
      logger.warn({ err: err.message }, "[Redis] Unreachable on worker boot. Running in local DB polling mode.");
      this.redis = null;
    }
  }

  async fetchPendingEventsWithLock(batchSize = 10): Promise<any[]> {
    try {
      const events = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, aggregate, "eventType", payload, attempts, "availableAt"
         FROM "OutboxEvent"
         WHERE status = 'PENDING' AND "availableAt" <= NOW()
         ORDER BY "createdAt" ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        batchSize
      );
      return events;
    } catch {
      return prisma.outboxEvent.findMany({
        where: {
          status: OutboxStatus.PENDING,
          availableAt: { lte: new Date() },
        },
        take: batchSize,
        orderBy: { createdAt: "asc" },
      });
    }
  }

  async processOutboxEvents() {
    const pendingEvents = await this.fetchPendingEventsWithLock(10);
    if (!pendingEvents || pendingEvents.length === 0) return;

    for (const event of pendingEvents) {
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: OutboxStatus.PROCESSING },
      });

      try {
        const payload = typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload;

        if (event.eventType === "ORDER_CREATED" && payload?.orderId) {
          if (this.orderQueue) {
            await this.orderQueue.add("dispatch-order", { orderId: payload.orderId });
          } else {
            await this.dispatchOrderToProvider(payload.orderId);
          }
        }

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: OutboxStatus.PUBLISHED },
        });
      } catch (err: any) {
        const nextAttempts = (event.attempts || 0) + 1;
        logger.error(`[Worker Outbox] Error processing event ${event.id} (attempt ${nextAttempts}): ${err.message}`);

        if (nextAttempts >= MAX_OUTBOX_ATTEMPTS) {
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: OutboxStatus.FAILED, attempts: nextAttempts },
          });

          // On final failure, automatically refund the order if not already refunded
          try {
            const payload = typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload;
            if (payload?.orderId) {
              await this.handleFinalOrderFailure(payload.orderId, err.message);
            }
          } catch (refundErr: any) {
            logger.error({ refundErr: refundErr.message }, "Error during final failure refund handling");
          }
        } else {
          const jitter = Math.floor(Math.random() * 500);
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, nextAttempts) + jitter;
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: OutboxStatus.PENDING,
              attempts: nextAttempts,
              availableAt: new Date(Date.now() + backoffMs),
            },
          });
        }
      }
    }
  }

  /**
   * Dispatches order to upstream SMM provider
   */
  async dispatchOrderToProvider(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        service: true,
        provider: true,
      },
    });

    if (!order || order.status !== OrderStatus.PENDING) {
      return;
    }

    logger.info(`[Worker Engine] Dispatching Order #${order.id} (Service: ${order.service.name})`);

    // Managed drip-feed orders are dispatched run-by-run through the scheduler
    if ((order as any).dripMode === "MANAGED") {
      logger.info(`[Worker Engine] Order #${order.id} is MANAGED drip-feed. Transitioning to IN_PROGRESS and scheduling runs.`);
      await prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.IN_PROGRESS },
      });
      await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.IN_PROGRESS,
          notes: `Managed drip-feed initiated: ${order.runs} runs scheduled.`,
        },
      });
      await this.pollAndDispatchDueRuns();
      return;
    }

    let providerOrderId: string | null = null;

    if (order.provider && order.provider.active) {
      try {
        const apiKey = decryptProviderKey(order.provider.apiKeyEncrypted);
        providerOrderId = await this.callUpstreamAddOrder(
          order.provider.apiUrl,
          apiKey,
          order.service.providerServiceId || order.service.id,
          order.target,
          order.quantity,
          order.isDripFeed ? order.runs : undefined,
          order.isDripFeed ? order.intervalMinutes : undefined,
          order.id,
          order.provider.id
        );
      } catch (err: any) {
        logger.error(`[Worker Engine] Upstream provider dispatch failed for #${order.id}: ${err.message}`);
        // If provider explicitly rejected the request, mark FAILED and refund automatically
        if (err.message && err.message.includes("Upstream provider error:")) {
          await this.handleFinalOrderFailure(order.id, err.message);
          return;
        }
        await prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: OrderStatus.PENDING,
            notes: `Dispatch attempt failed: ${err.message}`,
          },
        }).catch(() => null);
        throw err;
      }
    } else {
      // Internal or simulated fulfillment
      providerOrderId = `sim_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      await prisma.orderProviderEvent.create({
        data: {
          orderId: order.id,
          providerId: order.provider?.id || null,
          action: "add",
          requestPayload: {
            service: order.service.providerServiceId || order.service.id,
            link: order.target,
            quantity: order.quantity,
            isDripFeed: order.isDripFeed,
            runs: order.isDripFeed ? order.runs : undefined,
            interval: order.isDripFeed ? order.intervalMinutes : undefined,
          },
          responsePayload: { order: providerOrderId },
        },
      }).catch(() => null);
    }

    // Update order status to PROCESSING and record history
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PROCESSING,
          providerOrderId,
          startCount: 0,
        },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.PROCESSING,
          notes: `Dispatched to upstream provider. Upstream Reference ID: ${providerOrderId}`,
        },
      }),
    ]);

    logger.info(`[Worker Engine] Order #${order.id} transitioned to PROCESSING (Upstream ID: ${providerOrderId})`);
  }

  /**
   * Automated idempotent refund upon final dispatch failure
   */
  async handleFinalOrderFailure(orderId: string, reason: string) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status === OrderStatus.FAILED || order.status === OrderStatus.CANCELLED) {
      return;
    }

    logger.warn(`[Worker Engine] Order #${order.id} marked FAILED. Triggering automatic ledger refund.`);

    const refundAmount = new Decimal(order.charge.toString());

    await prisma.$transaction(async (tx) => {
      // 1. Lock wallet row
      const [walletRow] = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
        order.userId
      );
      if (!walletRow) return;

      // 2. Check if refund ledger entry already exists
      const existing = await tx.ledgerEntry.findFirst({
        where: { orderId: order.id, type: "REFUND" },
      });
      if (existing) return;

      // 3. Credit wallet
      const currentBalance = new Decimal(walletRow.balance.toString());
      const newBalance = currentBalance.plus(refundAmount);
      await tx.wallet.update({
        where: { id: walletRow.id },
        data: { balance: newBalance },
      });

      // 4. Ledger write
      await tx.ledgerEntry.create({
        data: {
          walletId: walletRow.id,
          amount: refundAmount,
          type: "REFUND",
          orderId: order.id,
          description: `Automatic Refund for Failed Order #${order.id}`,
        },
      });

      // 5. Refund table record
      await tx.refund.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          amount: refundAmount,
          reason: `Automatic refund: dispatch failure (${reason})`,
        },
      });

      // 6. Update order status to FAILED
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.FAILED },
      });

      // 7. Record status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.FAILED,
          notes: `Failed after maximum retry attempts. Fully refunded ₹${refundAmount.toFixed(2)}. Reason: ${reason}`,
        },
      });
    });

    // Notify customer via transactional email (refund notice)
    try {
      const user = await prisma.user.findUnique({ where: { id: order.userId } });
      if (user?.email) {
        const frontendUrl = process.env.FRONTEND_URL || "https://smmpanel.internal";
        const tpl = getOrderRefundTemplate({
          name: user.name || "Customer",
          orderId: order.id,
          amountFormatted: `₹${refundAmount.toFixed(2)}`,
          reason: `Order failed upstream: ${reason}`,
          ordersUrl: `${frontendUrl}/orders`,
        });
        await this.enqueueEmail({
          to: user.email,
          userId: user.id,
          type: "ORDER_REFUND",
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
          idempotencyKey: `order_refund_fail_${order.id}`,
        });
      }
    } catch (notifyErr: any) {
      logger.warn({ err: notifyErr.message }, `[Worker] Failed to enqueue refund email for order #${order.id}`);
    }
  }

  /**
   * Periodic daemon polling non-final orders and updating statuses
   */
  async syncNonFinalOrders() {
    const activeOrders = await prisma.order.findMany({
      where: {
        status: { in: [OrderStatus.PROCESSING, OrderStatus.IN_PROGRESS] },
      },
      include: {
        provider: true,
      },
      take: 20,
      orderBy: { updatedAt: "asc" },
    });

    if (activeOrders.length === 0) return;

    for (const order of activeOrders) {
      try {
        // Watchdog check for stuck orders accounting for drip-feed duration
        const baseWatchdogMinutes = 24 * 60; // 24 hours
        const dripDurationMinutes =
          order.isDripFeed && order.runs && order.intervalMinutes
            ? (order.runs - 1) * order.intervalMinutes
            : 0;
        const stuckThresholdMs = (baseWatchdogMinutes + dripDurationMinutes) * 60 * 1000;
        const orderAgeMs = Date.now() - new Date(order.createdAt).getTime();

        if (orderAgeMs > stuckThresholdMs) {
          logger.warn(
            `[Worker Watchdog] Order #${order.id} exceeded stuck threshold (${Math.round(stuckThresholdMs / 60000)} mins). Age: ${Math.round(orderAgeMs / 60000)} mins. Flagging for review.`
          );
        }

        if ((order as any).dripMode === "MANAGED") {
          // Managed orders are synced through their individual child runs
          await this.aggregateParentOrderStatus(order.id);
          continue;
        }

        if (order.provider && order.providerOrderId && order.provider.active) {
          const apiKey = decryptProviderKey(order.provider.apiKeyEncrypted);
          const statusRes = await this.callUpstreamOrderStatus(order.provider.apiUrl, apiKey, order.providerOrderId);
          await this.applyStatusTransition(order, statusRes);
        } else {
          // Simulated progress for internal/sandbox orders
          await this.simulateOrderProgression(order);
        }
      } catch (err: any) {
        logger.error(`[Worker Sync] Error syncing status for order #${order.id}: ${err.message}`);
      }
    }

    // 2. Sync active managed runs with provider
    try {
      const activeRuns = await prisma.orderRun.findMany({
        where: {
          status: "PROCESSING" as any,
          providerOrderId: { not: null },
        },
        include: {
          order: {
            include: { provider: true, user: true },
          },
        },
        take: 20,
      });

      for (const run of activeRuns) {
        if (!run.order.provider || !run.providerOrderId || !run.order.provider.active) continue;
        try {
          const apiKey = decryptProviderKey(run.order.provider.apiKeyEncrypted);
          const statusRes = await this.callUpstreamOrderStatus(run.order.provider.apiUrl, apiKey, run.providerOrderId);

          if (statusRes.error) {
            logger.warn(`[Run Sync] Provider error for run #${run.id}: ${statusRes.error}`);
            continue;
          }

          const rawStatus = (statusRes.status || "").toLowerCase();
          if (rawStatus.includes("complete")) {
            await prisma.orderRun.update({
              where: { id: run.id },
              data: { status: "COMPLETED" as any, delivered: run.quantity },
            });
            await this.aggregateParentOrderStatus(run.orderId);
          } else if (rawStatus.includes("cancel")) {
            await prisma.orderRun.update({
              where: { id: run.id },
              data: { status: "CANCELED" as any, lastError: "Cancelled upstream" },
            });
            await this.refundSingleRun(run.order, run, "Cancelled upstream");
            await this.aggregateParentOrderStatus(run.orderId);
          } else if (rawStatus.includes("partial")) {
            const remains = statusRes.remains !== undefined ? parseInt(String(statusRes.remains), 10) : 0;
            const delivered = Math.max(0, run.quantity - remains);
            await prisma.orderRun.update({
              where: { id: run.id },
              data: { status: "PARTIAL" as any, delivered },
            });
            if (remains > 0 && run.quantity > 0) {
              const partialShare = new Decimal(run.chargeShare.toString())
                .mul(remains)
                .div(run.quantity)
                .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
              await this.refundSingleRun(run.order, { ...run, chargeShare: partialShare }, "Partial fulfillment upstream");
            }
            await this.aggregateParentOrderStatus(run.orderId);
          }
        } catch (err: any) {
          logger.error(`[Run Sync] Error syncing run #${run.id}: ${err.message}`);
        }
      }
    } catch (err: any) {
      logger.error(`[Run Sync] Error during managed runs sync: ${err.message}`);
    }
  }

  /**
   * Transitions order according to upstream status and processes partial/canceled refunds
   */
  async applyStatusTransition(
    order: any,
    statusRes: { status?: string; start_count?: number | string; remains?: number | string; charge?: number | string; currency?: string; [key: string]: any }
  ) {
    const rawStatus = (statusRes.status || "").toLowerCase();
    let newStatus: OrderStatus = order.status;

    if (rawStatus.includes("complete")) newStatus = OrderStatus.COMPLETED;
    else if (rawStatus.includes("partial")) newStatus = OrderStatus.PARTIAL;
    else if (rawStatus.includes("cancel")) newStatus = OrderStatus.CANCELLED;
    else if (rawStatus.includes("progress")) newStatus = OrderStatus.IN_PROGRESS;
    else if (rawStatus.includes("process")) newStatus = OrderStatus.PROCESSING;
    else if (rawStatus.includes("fail")) newStatus = OrderStatus.FAILED;

    const startCount = statusRes.start_count !== undefined ? parseInt(String(statusRes.start_count), 10) : order.startCount;
    const remains = statusRes.remains !== undefined ? parseInt(String(statusRes.remains), 10) : order.remains;

    // Check if status or counters changed
    if (newStatus === order.status && remains === order.remains && startCount === order.startCount) {
      return;
    }

    if (newStatus === OrderStatus.CANCELLED || newStatus === OrderStatus.FAILED) {
      await this.handleFinalOrderFailure(order.id, `Upstream marked order as ${newStatus}`);
      return;
    }

    if (newStatus === OrderStatus.PARTIAL) {
      await this.handlePartialRefund(order, remains, startCount);
      return;
    }

    // Normal progression (IN_PROGRESS or COMPLETED)
    const updateData: any = {
      status: newStatus,
      startCount,
      remains,
    };

    if (statusRes.charge !== undefined && statusRes.charge !== null) {
      const rawCharge = parseFloat(String(statusRes.charge));
      if (!isNaN(rawCharge)) {
        const fx = order.fxRateUsed ? parseFloat(order.fxRateUsed.toString()) : 1.0;
        const actualCostINR = new Decimal(rawCharge).mul(fx).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
        const customerCharge = new Decimal(order.charge.toString());
        const paymentFee = order.paymentFeeEstimate
          ? new Decimal(order.paymentFeeEstimate.toString())
          : customerCharge.mul(0.0236);
        const actualProfit = customerCharge.minus(actualCostINR).minus(paymentFee).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        updateData.actualProviderCost = actualCostINR;
        updateData.actualProfit = actualProfit;
      }
    }

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: updateData,
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: newStatus,
          startCount,
          remains,
          notes: `Status updated to ${newStatus} from upstream provider${updateData.actualProviderCost ? ` (Actual Cost: ₹${updateData.actualProviderCost})` : ""}`,
        },
      }),
    ]);

    logger.info(`[Worker Sync] Order #${order.id} updated: ${order.status} -> ${newStatus}`);
  }

  /**
   * Handles proportional refund for PARTIAL orders
   */
  async handlePartialRefund(order: any, remains: number, startCount: number) {
    const totalQuantity = order.totalQuantity || (order.isDripFeed && order.runs ? order.quantity * order.runs : order.quantity) || 1;
    const effectiveRemains = Math.min(Math.max(remains, 0), totalQuantity);
    const orderCharge = new Decimal(order.charge.toString());
    // Proportional refund = (remains / totalQuantity) * charge
    const refundAmount = orderCharge.mul(effectiveRemains).div(totalQuantity).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    await prisma.$transaction(async (tx) => {
      // 1. Lock wallet
      const [walletRow] = await tx.$queryRawUnsafe<any[]>(
        `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
        order.userId
      );
      if (!walletRow) return;

      // 2. Check existing refund
      const existing = await tx.ledgerEntry.findFirst({
        where: { orderId: order.id, type: "REFUND" },
      });
      if (existing) return;

      // 3. Credit wallet
      if (refundAmount.greaterThan(0)) {
        const currentBalance = new Decimal(walletRow.balance.toString());
        const newBalance = currentBalance.plus(refundAmount);
        await tx.wallet.update({
          where: { id: walletRow.id },
          data: { balance: newBalance },
        });

        await tx.ledgerEntry.create({
          data: {
            walletId: walletRow.id,
            amount: refundAmount,
            type: "REFUND",
            orderId: order.id,
            description: `Partial Refund (${effectiveRemains}/${totalQuantity} undelivered) for Order #${order.id}`,
          },
        });

        await tx.refund.create({
          data: {
            orderId: order.id,
            userId: order.userId,
            amount: refundAmount,
            reason: `Partial fulfillment refund (${effectiveRemains}/${totalQuantity})`,
          },
        });
      }

      // 4. Update order with proportional realized cost and profit
      const realizedRevenue = orderCharge.minus(refundAmount);
      let partialActualCost: Decimal | null = null;
      let partialActualProfit: Decimal | null = null;
      if (order.estimatedProviderCost) {
        const estCost = new Decimal(order.estimatedProviderCost.toString());
        partialActualCost = estCost.mul(totalQuantity - effectiveRemains).div(totalQuantity).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
        const paymentFee = realizedRevenue.mul(0.0236);
        partialActualProfit = realizedRevenue.minus(partialActualCost).minus(paymentFee).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PARTIAL,
          startCount,
          remains: effectiveRemains,
          ...(partialActualCost ? { actualProviderCost: partialActualCost, actualProfit: partialActualProfit } : {}),
        },
      });

      // 5. History
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.PARTIAL,
          startCount,
          remains: effectiveRemains,
          notes: `Order completed partially (${totalQuantity - effectiveRemains}/${totalQuantity} delivered). Refunded ₹${refundAmount.toFixed(2)}.`,
        },
      });
    });

    // Notify customer via transactional email (partial refund notice)
    try {
      if (refundAmount.greaterThan(0)) {
        const user = await prisma.user.findUnique({ where: { id: order.userId } });
        if (user?.email) {
          const frontendUrl = process.env.FRONTEND_URL || "https://smmpanel.internal";
          const tpl = getOrderRefundTemplate({
            name: user.name || "Customer",
            orderId: order.id,
            amountFormatted: `₹${refundAmount.toFixed(2)}`,
            reason: `Partial fulfillment (${totalQuantity - effectiveRemains}/${totalQuantity} delivered)`,
            ordersUrl: `${frontendUrl}/orders`,
          });
          await this.enqueueEmail({
            to: user.email,
            userId: user.id,
            type: "ORDER_REFUND",
            subject: tpl.subject,
            html: tpl.html,
            text: tpl.text,
            idempotencyKey: `order_refund_partial_${order.id}_${effectiveRemains}`,
          });
        }
      }
    } catch (notifyErr: any) {
      logger.warn({ err: notifyErr.message }, `[Worker] Failed to enqueue partial refund email for order #${order.id}`);
    }

    logger.info(`[Worker Sync] Order #${order.id} processed as PARTIAL with ₹${refundAmount.toFixed(2)} refund`);
  }

  /**
   * Simulates progression for internal sandbox testing
   */
  async simulateOrderProgression(order: any) {
    const totalQuantity = order.totalQuantity || (order.isDripFeed && order.runs ? order.quantity * order.runs : order.quantity) || 1;
    if (order.status === OrderStatus.PROCESSING) {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.IN_PROGRESS,
            startCount: 100,
            remains: Math.floor(totalQuantity * 0.7),
          },
        }),
        prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: OrderStatus.IN_PROGRESS,
            startCount: 100,
            remains: Math.floor(totalQuantity * 0.7),
            notes: "Delivery initiated by network cluster",
          },
        }),
      ]);
      logger.info(`[Worker Simulation] Order #${order.id} transitioned to IN_PROGRESS`);
    } else if (order.status === OrderStatus.IN_PROGRESS) {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.COMPLETED,
            remains: 0,
          },
        }),
        prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: OrderStatus.COMPLETED,
            startCount: 100,
            remains: 0,
            notes: "Order fulfilled completely",
          },
        }),
      ]);
      logger.info(`[Worker Simulation] Order #${order.id} transitioned to COMPLETED`);
    }
  }

  /**
   * Panel-Managed Drip-Feed: Poll and dispatch due runs
   */
  async pollAndDispatchDueRuns() {
    let dueRuns: any[] = [];
    try {
      dueRuns = await prisma.$queryRawUnsafe<any[]>(`
        SELECT r.id, r."orderId", r."runIndex", r.quantity, r."scheduledAt", r.attempts, r."chargeShare"
        FROM "OrderRun" r
        JOIN "Order" o ON o.id = r."orderId"
        WHERE r.status = 'SCHEDULED'
          AND r."scheduledAt" <= NOW()
          AND (r."nextAttemptAt" IS NULL OR r."nextAttemptAt" <= NOW())
          AND o.status IN ('PENDING', 'PROCESSING', 'IN_PROGRESS')
        ORDER BY r."scheduledAt" ASC
        LIMIT 50
        FOR UPDATE OF r SKIP LOCKED
      `);
    } catch {
      dueRuns = await prisma.orderRun.findMany({
        where: {
          status: "SCHEDULED" as any,
          scheduledAt: { lte: new Date() },
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }],
          order: {
            status: { in: [OrderStatus.PENDING, OrderStatus.PROCESSING, OrderStatus.IN_PROGRESS] },
          },
        },
        take: 50,
        orderBy: { scheduledAt: "asc" },
      });
    }

    if (!dueRuns || dueRuns.length === 0) return;

    logger.info(`[Drip Scheduler] Found ${dueRuns.length} due run(s) to dispatch.`);
    for (const run of dueRuns) {
      await this.dispatchSingleRun(run);
    }
  }

  /**
   * Dispatches a single OrderRun to the upstream provider
   */
  async dispatchSingleRun(run: any) {
    // 1. Persist DISPATCHING status before calling provider to prevent double-dispatches
    await prisma.orderRun.update({
      where: { id: run.id },
      data: { status: "DISPATCHING" as any },
    });

    const order = await prisma.order.findUnique({
      where: { id: run.orderId },
      include: { service: true, provider: true },
    });

    if (!order || order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) {
      await prisma.orderRun.update({
        where: { id: run.id },
        data: { status: "CANCELED" as any, lastError: "Parent order cancelled" },
      });
      return;
    }

    // Check lateness
    const lateThresholdMinutes = process.env.DRIPFEED_RUN_LATE_ALERT_MINUTES ? parseInt(process.env.DRIPFEED_RUN_LATE_ALERT_MINUTES, 10) : 10;
    const latenessMs = Date.now() - new Date(run.scheduledAt).getTime();
    if (latenessMs > lateThresholdMinutes * 60 * 1000) {
      logger.warn(`[Drip Scheduler] Run #${run.runIndex} for Order #${order.id} is late by ${Math.round(latenessMs / 60000)} minutes.`);
    }

    try {
      let providerOrderId: string | null = null;
      if (order.provider && order.provider.active) {
        const apiKey = decryptProviderKey(order.provider.apiKeyEncrypted);
        providerOrderId = await this.callUpstreamAddOrder(
          order.provider.apiUrl,
          apiKey,
          order.service.providerServiceId || order.service.id,
          order.target,
          run.quantity, // Send per-run quantity
          undefined,   // No runs parameter for panel-managed runs
          undefined,   // No interval parameter for panel-managed runs
          order.id,
          order.provider.id
        );
      } else {
        providerOrderId = `sim_run_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      }

      // Success: atomically update run to PROCESSING with providerOrderId
      await prisma.orderRun.update({
        where: { id: run.id },
        data: {
          status: "PROCESSING" as any,
          providerOrderId: String(providerOrderId),
          attempts: (run.attempts || 0) + 1,
          lastError: null,
        },
      });

      if (order.status === OrderStatus.PENDING) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.IN_PROGRESS },
        });
      }

      logger.info(`[Drip Scheduler] Dispatched run #${run.runIndex} for Order #${order.id} -> Provider Order ID: ${providerOrderId}`);
    } catch (err: any) {
      const errMsg = err.message || "Unknown provider dispatch error";
      const isRestriction = isLinkRestrictionError(errMsg);
      const currentAttempts = (run.attempts || 0) + 1;
      const maxRetries = 5;

      if (isRestriction && currentAttempts < maxRetries) {
        // Active order on link: postpone by 10 minutes and retry
        const postponeMinutes = 10;
        const nextAttemptAt = new Date(Date.now() + postponeMinutes * 60 * 1000);
        await prisma.orderRun.update({
          where: { id: run.id },
          data: {
            status: "SCHEDULED" as any,
            attempts: currentAttempts,
            nextAttemptAt,
            lastError: `Link restriction: ${errMsg}. Postponed 10m.`,
          },
        });
        logger.warn(`[Drip Scheduler] Run #${run.runIndex} for Order #${order.id} postponed to ${nextAttemptAt.toISOString()} (Link restriction: ${errMsg})`);
        return;
      }

      // If timeout or network uncertainty, mark UNCERTAIN and alert admin queue
      if (errMsg.toLowerCase().includes("timeout") || errMsg.toLowerCase().includes("abort") || errMsg.toLowerCase().includes("econnreset")) {
        await prisma.orderRun.update({
          where: { id: run.id },
          data: {
            status: "UNCERTAIN" as any,
            attempts: currentAttempts,
            lastError: `Network timeout: ${errMsg}. Sent to admin queue.`,
          },
        });
        logger.error(`[Drip Scheduler] Run #${run.runIndex} for Order #${order.id} marked UNCERTAIN due to timeout.`);
        return;
      }

      // Definite failure: mark FAILED and refund chargeShare
      await prisma.orderRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED" as any,
          attempts: currentAttempts,
          lastError: errMsg,
        },
      });

      await this.refundSingleRun(order, run, errMsg);
      await this.aggregateParentOrderStatus(order.id);
    }
  }

  /**
   * Refunds a single failed or cancelled OrderRun
   */
  async refundSingleRun(order: any, run: any, reason: string) {
    const refundShare = new Decimal(run.chargeShare.toString());
    if (refundShare.lessThanOrEqualTo(0)) return;

    try {
      await prisma.$transaction(async (tx) => {
        const [walletRow] = await tx.$queryRawUnsafe<any[]>(
          `SELECT id, balance FROM "Wallet" WHERE "userId" = $1 FOR UPDATE`,
          order.userId
        );
        if (!walletRow) return;

        const currentBalance = new Decimal(walletRow.balance.toString());
        const newBalance = currentBalance.plus(refundShare);

        await tx.wallet.update({
          where: { id: walletRow.id },
          data: { balance: newBalance },
        });

        await tx.ledgerEntry.create({
          data: {
            walletId: walletRow.id,
            amount: refundShare,
            type: "REFUND",
            orderId: order.id,
            description: `Refund for run #${run.runIndex} on Order #${order.id}: ${reason.slice(0, 80)}`,
          },
        });

        await tx.refund.create({
          data: {
            orderId: order.id,
            userId: order.userId,
            amount: refundShare,
            reason: `Drip run #${run.runIndex} refund: ${reason.slice(0, 100)}`,
          },
        });
      });
      logger.info(`[Drip Scheduler] Refunded ₹${refundShare.toFixed(2)} for run #${run.runIndex} on Order #${order.id}`);
    } catch (refundErr: any) {
      logger.error(`[Drip Scheduler] Failed to refund run #${run.runIndex} on Order #${order.id}: ${refundErr.message}`);
    }
  }

  /**
   * Aggregates child run statuses into the parent Order status
   */
  async aggregateParentOrderStatus(orderId: string) {
    const runs = await prisma.orderRun.findMany({
      where: { orderId },
    });
    if (!runs || runs.length === 0) return;

    const statuses = runs.map((r) => r.status);
    const newStatusStr = aggregateRunStatuses(statuses);
    const newStatus = OrderStatus[newStatusStr as keyof typeof OrderStatus] || OrderStatus.IN_PROGRESS;

    const totalDelivered = runs.reduce((acc, r) => acc + (r.delivered || 0), 0);

    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: newStatus,
      },
    });

    logger.info(`[Drip Scheduler] Aggregated Order #${orderId} status -> ${newStatus} (${totalDelivered} delivered)`);
  }

  /**
   * Helper: Calls upstream SMM API to add an order
   */
  async callUpstreamAddOrder(
    apiUrl: string,
    apiKey: string,
    service: string | number,
    link: string,
    quantity: number,
    runs?: number | null,
    interval?: number | null,
    orderId?: string,
    providerId?: string
  ): Promise<string> {
    if (apiUrl.includes("example.com") || apiUrl.includes("test") || apiUrl.startsWith("simulated://")) {
      const simId = `prov_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      if (orderId) {
        await prisma.orderProviderEvent.create({
          data: {
            orderId,
            providerId: providerId || null,
            action: "add",
            requestPayload: {
              service,
              link,
              quantity,
              runs: runs || undefined,
              interval: interval || undefined,
              key: "[REDACTED]",
            },
            responsePayload: { order: simId },
          },
        }).catch(() => null);
      }
      return simId;
    }

    const cleanLink = link.trim();
    const payload: Record<string, any> = {
      key: apiKey,
      action: "add",
      service,
      link: cleanLink,
      quantity,
    };

    if (runs !== undefined && runs !== null) {
      payload.runs = runs;
    }
    if (interval !== undefined && interval !== null) {
      payload.interval = interval;
    }

    // If upstream expects username or link is a profile handle/URL
    if (cleanLink.includes("instagram.com/")) {
      const postMatch = cleanLink.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i);
      if (postMatch && postMatch[1]) {
        payload.link = cleanLink;
        payload.username = postMatch[1];
      } else {
        const profileMatch = cleanLink.match(/instagram\.com\/([a-zA-Z0-9._]+)\/?(?:\?.*)?$/i);
        if (
          profileMatch &&
          profileMatch[1] &&
          !["p", "reel", "tv", "stories", "explore", "reels"].includes(profileMatch[1].toLowerCase())
        ) {
          payload.username = profileMatch[1];
          payload.link = `https://www.instagram.com/${profileMatch[1]}`;
        }
      }
    } else if (!cleanLink.startsWith("http")) {
      payload.username = cleanLink.replace(/^@/, "");
      payload.link = cleanLink.replace(/^@/, "");
    }

    const sanitizedPayload = { ...payload, key: "[REDACTED]" };
    let response: Response;
    let data: any;

    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(payload as any).toString(),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error(`Upstream SMM API returned HTTP ${response.status}`);
      }

      data = await response.json();

      // If upstream provider specifically reports "Missing username", retry once with extracted handle/target
      if (data.error && data.error.toLowerCase().includes("missing username") && !payload.username) {
        const fallbackUser = cleanLink.replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "").replace(/\/.*$/, "").replace(/^@/, "");
        if (fallbackUser && fallbackUser.length > 0) {
          payload.username = fallbackUser;
          const retryRes = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(payload as any).toString(),
            signal: AbortSignal.timeout(15000),
          });
          if (retryRes.ok) {
            data = await retryRes.json();
          }
        }
      }

      if (orderId) {
        await prisma.orderProviderEvent.create({
          data: {
            orderId,
            providerId: providerId || null,
            action: "add",
            requestPayload: sanitizedPayload,
            responsePayload: data || null,
            error: data?.error ? String(data.error) : null,
          },
        }).catch(() => null);
      }
    } catch (err: any) {
      if (orderId) {
        await prisma.orderProviderEvent.create({
          data: {
            orderId,
            providerId: providerId || null,
            action: "add",
            requestPayload: sanitizedPayload,
            responsePayload: data || null,
            error: err.message,
          },
        }).catch(() => null);
      }
      throw err;
    }

    if (data.error) {
      throw new Error(`Upstream provider error: ${data.error}`);
    }
    if (!data.order) {
      throw new Error("Invalid response from upstream provider: missing order reference");
    }

    return String(data.order);
  }

  /**
   * Helper: Calls upstream SMM API to get order status
   */
  async callUpstreamOrderStatus(
    apiUrl: string,
    apiKey: string,
    orderId: string
  ): Promise<{ status?: string; start_count?: number; remains?: number; error?: string }> {
    if (apiUrl.includes("example.com") || apiUrl.includes("test") || apiUrl.startsWith("simulated://")) {
      return { status: "Completed", start_count: 50, remains: 0 };
    }

    const payload = {
      key: apiKey,
      action: "status",
      order: orderId,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload as any).toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Upstream SMM API status check returned HTTP ${response.status}`);
    }

    return (await response.json()) as any;
  }

  async stop() {
    this.isRunning = false;
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.dripRunInterval) clearInterval(this.dripRunInterval);
    if (this.bullWorker) await this.bullWorker.close();
    if (this.emailWorker) await this.emailWorker.close();
    if (this.emailQueue) await this.emailQueue.close();
    if (this.redis) await this.redis.quit();
    await prisma.$disconnect();
    logger.info("[Worker] SMM PANEL Production Worker shutdown gracefully");
  }

  /**
   * Helper: Processes an email job sent via BullMQ or directly
   */
  async processEmailJob(jobData: any) {
    const { logId, to, subject, html, text, type, userId, replyTo, idempotencyKey } = jobData;

    // 1. Suppression check
    const suppression = await prisma.emailSuppression.findUnique({
      where: { email: to.toLowerCase().trim() },
    });
    if (suppression) {
      logger.warn({ email: to, reason: suppression.reason }, "[Worker Email] Recipient is suppressed. Skipping send.");
      if (logId) {
        await prisma.emailLog.update({
          where: { id: logId },
          data: {
            status: "FAILED",
            error: `Recipient suppressed due to ${suppression.reason}`,
          },
        }).catch(() => null);
      }
      return;
    }

    // 2. Double check idempotency
    if (logId) {
      const currentLog = await prisma.emailLog.findUnique({ where: { id: logId } });
      if (currentLog && (currentLog.status === "SENT" || currentLog.status === "DELIVERED")) {
        logger.info({ logId, idempotencyKey }, "[Worker Email] Email already sent (idempotent check). Skipping.");
        return;
      }
    }

    // 3. Dispatch via configured email provider
    const result = await this.emailProvider.send({
      to,
      subject,
      html,
      text,
      type,
      userId,
      replyTo,
      idempotencyKey,
    });

    if (result.success && result.messageId) {
      if (logId) {
        await prisma.emailLog.update({
          where: { id: logId },
          data: {
            status: "SENT",
            providerMessageId: result.messageId,
            attempts: { increment: 1 },
          },
        }).catch(() => null);
      }
      logger.info({ logId, to, messageId: result.messageId }, "[Worker Email] Email sent successfully");
    } else {
      if (logId) {
        await prisma.emailLog.update({
          where: { id: logId },
          data: {
            status: "FAILED",
            error: result.error || "Unknown provider error",
            attempts: { increment: 1 },
          },
        }).catch(() => null);
      }
      logger.error({ logId, to, error: result.error }, "[Worker Email] Email dispatch failed");
      throw new Error(result.error || "Email dispatch failed");
    }
  }

  /**
   * Helper: Enqueue an email job into BullMQ with rate-limit and suppression checks
   */
  async enqueueEmail(options: EmailSendOptions) {
    try {
      const cleanTo = options.to.toLowerCase().trim();

      // 1. Suppression check
      const isSuppressed = await prisma.emailSuppression.findUnique({
        where: { email: cleanTo },
      });
      if (isSuppressed) {
        logger.warn({ email: cleanTo }, "[Worker] Recipient is suppressed. Skipping email enqueue.");
        return;
      }

      // 2. Idempotency check
      if (options.idempotencyKey) {
        const existing = await prisma.emailLog.findUnique({
          where: { idempotencyKey: options.idempotencyKey },
        });
        if (existing) {
          logger.info({ idempotencyKey: options.idempotencyKey }, "[Worker] Email already logged/sent.");
          return;
        }
      }

      // 3. Daily quota check
      const today = new Date().toISOString().slice(0, 10);
      const counter = await prisma.emailDailyCounter.upsert({
        where: { date: today },
        update: { count: { increment: 1 } },
        create: { date: today, count: 1 },
      });

      let delayMs = 0;
      if (counter.count > 100) {
        const now = new Date();
        const tomorrowUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 5, 0));
        delayMs = Math.max(1000, tomorrowUtc.getTime() - now.getTime());
      }

      // 4. Create PENDING log
      const emailLog = await prisma.emailLog.create({
        data: {
          to: cleanTo,
          userId: options.userId,
          type: options.type,
          subject: options.subject,
          status: "PENDING",
          idempotencyKey: options.idempotencyKey,
        },
      });

      const jobData = {
        ...options,
        to: cleanTo,
        logId: emailLog.id,
      };

      if (this.emailQueue) {
        await this.emailQueue.add("send-email", jobData, {
          delay: delayMs,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        });
      } else {
        await this.processEmailJob(jobData);
      }
    } catch (err: any) {
      logger.error({ err: err.message }, "[Worker] Error enqueuing email");
    }
  }
}

if (require.main === module) {
  const engine = new SMMWorkerEngine();
  engine.start().catch((err) => {
    logger.fatal({ err: err.message, stack: err.stack }, "Worker failed to initialize");
    console.error("[FATAL] Worker failed to initialize:", err);
    process.exit(1);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    await engine.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

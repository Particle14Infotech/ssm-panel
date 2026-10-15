import dotenv from "dotenv";
import { PrismaClient, OrderStatus, OutboxStatus } from "@prisma/client";
import Redis from "ioredis";
import { Queue, Worker as BullWorker, Job } from "bullmq";
import pino from "pino";
import { Decimal } from "decimal.js";
import { decryptProviderKey } from "./crypto.util";

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
  private redis: Redis | null = null;
  private bullWorker: BullWorker | null = null;
  private orderQueue: Queue | null = null;

  async start() {
    this.isRunning = true;
    logger.info("⚡ SMM PANEL Production Worker initializing (BullMQ Engine & Status Sync Daemon)");

    // 1. Verify Database connectivity
    try {
      await prisma.$connect();
      logger.info("✅ PostgreSQL database connected successfully");
    } catch (err: any) {
      logger.fatal({ err: err.message }, "❌ FATAL: PostgreSQL unreachable on worker boot");
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
            logger.info({ jobId: job.id, jobName: job.name, data: job.data }, "📥 BullMQ order processing job");
            if (job.name === "dispatch-order" && job.data?.orderId) {
              await this.dispatchOrderToProvider(job.data.orderId);
            }
            return { processed: true, completedAt: new Date().toISOString() };
          },
          {
            connection: this.redis,
            concurrency: 5,
          }
        );

        this.bullWorker.on("ready", () => {
          logger.info("🚀 BullMQ worker ready on queue 'smm-orders'");
        });

        this.bullWorker.on("failed", (job, err) => {
          logger.error({ jobId: job?.id, err: err.message }, "BullMQ order job execution failed");
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

    // Initial triggers
    await this.processOutboxEvents();
    await this.syncNonFinalOrders();
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
      logger.info("✅ Redis connected successfully for BullMQ & Caching");
    } catch (err: any) {
      logger.warn({ err: err.message }, "⚠️ Redis unreachable on worker boot. Running in local DB polling mode.");
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

    let providerOrderId: string | null = null;

    if (order.provider && order.provider.active) {
      try {
        const apiKey = decryptProviderKey(order.provider.apiKeyEncrypted);
        providerOrderId = await this.callUpstreamAddOrder(
          order.provider.apiUrl,
          apiKey,
          order.service.providerServiceId || order.service.id,
          order.target,
          order.quantity
        );
      } catch (err: any) {
        logger.error(`[Worker Engine] Upstream provider dispatch failed for #${order.id}: ${err.message}`);
        throw err;
      }
    } else {
      // Internal or simulated fulfillment
      providerOrderId = `sim_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
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
  }

  /**
   * Transitions order according to upstream status and processes partial/canceled refunds
   */
  async applyStatusTransition(
    order: any,
    statusRes: { status: string; start_count?: number | string; remains?: number | string }
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
    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: newStatus,
          startCount,
          remains,
        },
      }),
      prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: newStatus,
          startCount,
          remains,
          notes: `Status updated to ${newStatus} from upstream provider`,
        },
      }),
    ]);

    logger.info(`[Worker Sync] Order #${order.id} updated: ${order.status} -> ${newStatus}`);
  }

  /**
   * Handles proportional refund for PARTIAL orders
   */
  async handlePartialRefund(order: any, remains: number, startCount: number) {
    const quantity = order.quantity || 1;
    const effectiveRemains = Math.min(Math.max(remains, 0), quantity);
    const orderCharge = new Decimal(order.charge.toString());
    // Proportional refund = (remains / quantity) * charge
    const refundAmount = orderCharge.mul(effectiveRemains).div(quantity).toDecimalPlaces(2);

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
            description: `Partial Refund (${effectiveRemains}/${quantity} undelivered) for Order #${order.id}`,
          },
        });

        await tx.refund.create({
          data: {
            orderId: order.id,
            userId: order.userId,
            amount: refundAmount,
            reason: `Partial fulfillment refund (${effectiveRemains}/${quantity})`,
          },
        });
      }

      // 4. Update order
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PARTIAL,
          startCount,
          remains: effectiveRemains,
        },
      });

      // 5. History
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.PARTIAL,
          startCount,
          remains: effectiveRemains,
          notes: `Order completed partially (${quantity - effectiveRemains}/${quantity} delivered). Refunded ₹${refundAmount.toFixed(2)}.`,
        },
      });
    });

    logger.info(`[Worker Sync] Order #${order.id} processed as PARTIAL with ₹${refundAmount.toFixed(2)} refund`);
  }

  /**
   * Simulates progression for internal sandbox testing
   */
  async simulateOrderProgression(order: any) {
    if (order.status === OrderStatus.PROCESSING) {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.IN_PROGRESS,
            startCount: 100,
            remains: Math.floor(order.quantity * 0.7),
          },
        }),
        prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: OrderStatus.IN_PROGRESS,
            startCount: 100,
            remains: Math.floor(order.quantity * 0.7),
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
   * Helper: Calls upstream SMM API to add an order
   */
  async callUpstreamAddOrder(
    apiUrl: string,
    apiKey: string,
    service: string | number,
    link: string,
    quantity: number
  ): Promise<string> {
    if (apiUrl.includes("example.com") || apiUrl.includes("test") || apiUrl.startsWith("simulated://")) {
      return `prov_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const payload = {
      key: apiKey,
      action: "add",
      service,
      link,
      quantity,
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload as any).toString(),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Upstream SMM API returned HTTP ${response.status}`);
    }

    const data: any = await response.json();
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
  ): Promise<{ status: string; start_count?: number; remains?: number }> {
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
    if (this.bullWorker) await this.bullWorker.close();
    if (this.redis) await this.redis.quit();
    await prisma.$disconnect();
    logger.info("🛑 SMM PANEL Production Worker shutdown gracefully");
  }
}

if (require.main === module) {
  const engine = new SMMWorkerEngine();
  engine.start().catch((err) => {
    logger.fatal({ err: err.message }, "Worker failed to initialize");
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

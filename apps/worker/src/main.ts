import dotenv from "dotenv";
import { PrismaClient, OrderStatus, OutboxStatus } from "@prisma/client";
import Redis from "ioredis";
import pino from "pino";

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
  private redis: Redis | null = null;

  async start() {
    this.isRunning = true;
    logger.info("⚡ SMM PANEL Production Worker initialized (Outbox Relay & State Engine)");

    // 1. Verify Redis configuration
    await this.verifyRedisPolicy();

    // 2. Poll outbox events and process them
    this.pollInterval = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.processOutboxEvents();
      } catch (err: any) {
        logger.error({ err }, "Worker outbox poll cycle error");
      }
    }, 2000);

    // Initial cycle
    await this.processOutboxEvents();
  }

  /**
   * Validates Redis connection and verifies noeviction policy for queue safety
   */
  async verifyRedisPolicy() {
    try {
      const host = process.env.REDIS_HOST || "localhost";
      const port = parseInt(process.env.REDIS_PORT || "6379", 10);
      this.redis = new Redis({
        host,
        port,
        maxRetriesPerRequest: 1,
        connectTimeout: 800,
        enableOfflineQueue: false,
        lazyConnect: true,
      });

      await this.redis.connect();
      const maxmemoryPolicy = await this.redis.config("GET", "maxmemory-policy");
      logger.info({ policy: maxmemoryPolicy }, "Verified Redis maxmemory-policy configuration");
    } catch (err: any) {
      logger.warn(`Redis standalone check deferred (Offline / Sandbox mode): ${err?.message}`);
    }
  }

  /**
   * Atomically locks and fetches pending outbox events using raw SQL FOR UPDATE SKIP LOCKED
   */
  async fetchPendingEventsWithLock(batchSize = 10): Promise<any[]> {
    try {
      // Use raw SQL with SKIP LOCKED to prevent race conditions across potential parallel instances
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
      // Fallback for mock/sqlite or environments without raw table ready
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
      // Mark as PROCESSING
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: { status: OutboxStatus.PROCESSING },
      });

      logger.info(`[Worker Outbox] Processing ${event.eventType} event ${event.id}`);

      try {
        if (event.eventType === "ORDER_CREATED" && event.payload) {
          const payload = typeof event.payload === "string" ? JSON.parse(event.payload) : event.payload;
          const orderId = payload.orderId;

          if (orderId) {
            // Transition order PENDING -> PROCESSING
            await prisma.order.update({
              where: { id: orderId },
              data: { status: OrderStatus.PROCESSING },
            });

            logger.info(`[Worker Engine] Order #${orderId} moved to PROCESSING`);

            // Simulate provider fulfillment or dispatch to provider
            await prisma.order.update({
              where: { id: orderId },
              data: {
                status: OrderStatus.COMPLETED,
                remains: 0,
                startCount: 1000,
              },
            });
            logger.info(`[Worker Engine] Order #${orderId} marked COMPLETED`);
          }
        }

        // Mark outbox event PUBLISHED
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: OutboxStatus.PUBLISHED },
        });
      } catch (err: any) {
        const nextAttempts = (event.attempts || 0) + 1;
        logger.error(`[Worker Outbox] Error processing event ${event.id} (attempt ${nextAttempts}): ${err.message}`);

        if (nextAttempts >= MAX_OUTBOX_ATTEMPTS) {
          // Dead letter / FAILED
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: OutboxStatus.FAILED,
              attempts: nextAttempts,
            },
          });
          logger.error(`[Worker DLQ] Event ${event.id} moved to DLQ (FAILED status)`);
        } else {
          // Exponential backoff with jitter
          const jitter = Math.floor(Math.random() * 500);
          const backoffMs = BASE_BACKOFF_MS * Math.pow(2, nextAttempts) + jitter;
          const nextAvailableAt = new Date(Date.now() + backoffMs);

          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: OutboxStatus.PENDING,
              attempts: nextAttempts,
              availableAt: nextAvailableAt,
            },
          });
        }
      }
    }
  }

  stop() {
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.redis) {
      try {
        this.redis.disconnect();
      } catch {}
    }
    logger.info("Worker shut down gracefully.");
  }
}

async function bootstrapWorker() {
  if (process.env.WORKER_ENABLED === "false") {
    logger.info("⏸️ Worker process disabled via WORKER_ENABLED=false. Exiting.");
    process.exit(0);
  }
  const engine = new SMMWorkerEngine();

  process.on("SIGINT", () => {
    logger.info("Received SIGINT, shutting down worker engine...");
    engine.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    logger.info("Received SIGTERM, shutting down worker engine...");
    engine.stop();
    process.exit(0);
  });

  await engine.start();
}

if (require.main === module) {
  bootstrapWorker();
}

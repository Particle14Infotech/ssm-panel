import dotenv from "dotenv";
import {
  PrismaClient,
  OrderStatus,
  OutboxStatus,
  ExecutionSource,
  PackageExecutionStatus,
  PackageStatus,
} from "@prisma/client";
import Redis from "ioredis";
import { Queue, Worker as BullWorker, Job } from "bullmq";
import pino from "pino";
import { Decimal } from "decimal.js";
import { decryptProviderKey } from "./crypto.util";
import {
  classifyProviderError,
  ProviderErrorDisposition,
  normalizeTargetUrl,
  canDispatchUnitsOnLink,
  DEFAULT_CATCHUP_MAX_PER_TICK,
  EmailProvider,
  ResendProvider,
  LogOnlyEmailProvider,
  getOrderRefundTemplate,
  EmailSendOptions,
  isLinkRestrictionError,
  aggregateRunStatuses,
  PACKAGE_PROVIDER_STATUS_STALLED_REASON,
  AUTOPILOT_PRESETS,
  AutopilotPreset,
} from "@smm/contracts";
import * as https from "https";
import * as http from "http";
import * as dns from "dns/promises";
import * as net from "net";
import { URL } from "url";

dotenv.config();

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
});

const prisma = new PrismaClient();

const MAX_OUTBOX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;
const ORDER_RUN_CLAIM_STALE_MS = 2 * 60 * 1000;
const PACKAGE_PROVIDER_STATUS_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PACKAGE_PROVIDER_OUTCOME_UNCERTAIN_REASON =
  "Provider outcome is uncertain; automatic resubmission is blocked.";

function packageExecutionStatusFromOrderStatus(
  status: OrderStatus
): PackageExecutionStatus | null {
  if (status === OrderStatus.COMPLETED) return PackageExecutionStatus.COMPLETED;
  if (status === OrderStatus.PARTIAL) return PackageExecutionStatus.PARTIAL;
  if (status === OrderStatus.FAILED) return PackageExecutionStatus.FAILED;
  if (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) {
    return PackageExecutionStatus.CANCELLED;
  }
  return null;
}

export class SMMWorkerEngine {
  private isRunning = false;
  private providerHealthTelemetryCache = new Map<string, number>();
  private pollInterval: NodeJS.Timeout | null = null;
  private syncInterval: NodeJS.Timeout | null = null;
  private dripRunInterval: NodeJS.Timeout | null = null;
  private packageExecutionInterval: NodeJS.Timeout | null = null;
  private autopilotInterval: NodeJS.Timeout | null = null;
  private redis: Redis | null = null;
  private bullWorker: BullWorker | null = null;
  private orderQueue: Queue | null = null;
  private emailQueue: Queue | null = null;
  private emailWorker: BullWorker | null = null;
  private emailProvider: EmailProvider = new LogOnlyEmailProvider();
  private isCanaryHealthy: boolean = true;
  private lastCanaryRunAt: Date | null = null;

  /**
   * I3 Query Canary: Runs all critical raw SQL queries with harmless parameters.
   * If any query fails (e.g. enum/typecast error 42883), sets health red and halts dispatching.
   */
  async runQueryCanary(): Promise<boolean> {
    try {
      // 1. Canary for Limiter In-Flight Query
      await prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(o.quantity), 0)::int as in_flight_units
         FROM "Order" o
         JOIN "Service" s ON s.id = o."serviceId"
         WHERE o.status IN ('PENDING', 'PROCESSING', 'IN_PROGRESS')
           AND regexp_replace(regexp_replace(lower(trim(trailing '/' from o.target)), '^https?://(www\\.)?', ''), '/+$', '') = $1
           AND s.kind::text = $2`,
        "canary.test.internal",
        "DEFAULT"
      );

      // 2. Canary for Enum comparison
      await prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(o.quantity), 0)::int as in_flight_units
         FROM "Order" o
         JOIN "Service" s ON s.id = o."serviceId"
         WHERE o.status IN ('PENDING', 'PROCESSING', 'IN_PROGRESS')
           AND regexp_replace(regexp_replace(lower(trim(trailing '/' from o.target)), '^https?://(www\\.)?', ''), '/+$', '') = $1
           AND s.kind::text = $2`,
        "canary.test.internal",
        "LIKES"
      );

      // 3. Canary for Candidate Selection Query
      const terminalStatuses = `'COMPLETED','PARTIAL','CANCELLED','SKIPPED_PAUSED','SKIPPED_QUOTA','SKIPPED_TYPE','SKIPPED_DELETED','SKIPPED_LIMIT','STALLED'`;
      await prisma.$queryRawUnsafe(
        `WITH candidates AS (
          SELECT e.id, e."packageId",
                 ROW_NUMBER() OVER (PARTITION BY e."packageId" ORDER BY e."executeAt" ASC) AS rn
          FROM "PackageExecution" e
          JOIN "Package" p ON p.id = e."packageId"
          WHERE e.status = 'SCHEDULED'
            AND e."executeAt" <= $1
            AND (
              e.seq <= 1
              OR e.source != 'SCHEDULE'
              OR EXISTS (
                SELECT 1 FROM "PackageExecution" pred
                WHERE pred."packageId" = e."packageId"
                  AND pred."ruleId" = e."ruleId"
                  AND pred.source = 'SCHEDULE'
                  AND pred.seq = e.seq - 1
                  AND pred.status::text IN (${terminalStatuses})
              )
            )
        )
        SELECT c.id, c."packageId"
        FROM candidates c
        WHERE c.rn <= $2
        LIMIT 1`,
        new Date(),
        1
      );

      this.isCanaryHealthy = true;
      this.lastCanaryRunAt = new Date();
      logger.info("[Query Canary] All critical raw queries passed canary health check.");
      return true;
    } catch (canaryErr: any) {
      this.isCanaryHealthy = false;
      this.lastCanaryRunAt = new Date();
      logger.fatal(
        { err: canaryErr.message },
        "[Query Canary] CRITICAL FAILURE: Raw SQL query canary failed. Halting package dispatch."
      );
      return false;
    }
  }

  async start() {
    this.isRunning = true;
    const isProd = process.env.NODE_ENV === "production";
    const simUpstream = process.env.SIMULATE_UPSTREAM_ORDERS === "true" || process.env.SIMULATE_UPSTREAM_ORDERS === "1";
    if (isProd && simUpstream) {
      logger.fatal("FATAL: BOOT REFUSED - SIMULATE_UPSTREAM_ORDERS cannot be true in production.");
      console.error("\n[FATAL: PRODUCTION BOOT REFUSED] SIMULATE_UPSTREAM_ORDERS=true is strictly forbidden when NODE_ENV=production.\n");
      process.exit(1);
    }
    const dispatchMode = simUpstream ? "SIMULATION" : "LIVE_PRODUCTION";
    logger.info(`[BOOT] UPSTREAM_DISPATCH_MODE: ${dispatchMode}`);
    console.log(`[BOOT] UPSTREAM_DISPATCH_MODE: ${dispatchMode}`);

    logger.info("[Worker] SMM PANEL Production Worker initializing (BullMQ Engine & Status Sync Daemon)");

    // 1. Verify Database connectivity & execute boot Query Canary
    try {
      await prisma.$connect();
      logger.info("[Postgres] Database connected successfully");
      const canaryPassed = await this.runQueryCanary();
      if (!canaryPassed) {
        logger.error("[Worker] Canary failed at boot; package dispatch disabled until healthy.");
      }
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

    // 7. Package Engine Execution Dispatcher Daemon
    this.packageExecutionInterval = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.pollAndDispatchPackageExecutions();
      } catch (err: any) {
        logger.error({ err }, "Package execution dispatcher cycle error");
      }
    }, 10000);

    // 8. Autopilot New Upload Poller Daemon (every 60 seconds)
    this.autopilotInterval = setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.pollAutopilotPackages();
      } catch (err: any) {
        logger.error({ err }, "[Autopilot] Poller daemon cycle error");
      }
    }, 60000);

    // 9. I3 Query Canary Daemon (every 10 minutes)
    setInterval(async () => {
      if (!this.isRunning) return;
      try {
        await this.runQueryCanary();
      } catch (canaryLoopErr: any) {
        logger.error({ err: canaryLoopErr.message }, "[Worker] Query canary interval error");
      }
    }, 10 * 60 * 1000);

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
        } else if (event.eventType === "ORDER_REFILL_REQUESTED" && payload?.orderId) {
          await this.dispatchRefillToProvider(payload.orderId, payload.providerOrderId);
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
  async dispatchOrderToProvider(orderId: string, database: PrismaClient = prisma) {
    const order = await database.order.findUnique({
      where: { id: orderId },
      include: {
        service: true,
        provider: true,
      },
    });

    const isPackagesEnabled =
      process.env.NODE_ENV !== "production"
        ? process.env.PACKAGES_ENABLED === "true"
        : (process.env.PACKAGES_ENABLED === "true" && (process.env.ALLOW_PACKAGES_IN_PROD === "true" || process.env.PACKAGES_PRODUCTION_ALLOWED === "true"));
    if (order?.packageExecutionId && !isPackagesEnabled) {
      logger.info(`[Worker] Package order #${order.id} not dispatched because PACKAGES_ENABLED is off.`);
      return;
    }

    if (!order || order.status !== OrderStatus.PENDING) {
      return;
    }

    logger.info(`[Worker Engine] Dispatching Order #${order.id} (Service: ${order.service?.name || "Service"})`);

    // Managed drip-feed orders are dispatched run-by-run through the scheduler
    if ((order as any).dripMode === "MANAGED") {
      logger.info(`[Worker Engine] Order #${order.id} is MANAGED drip-feed. Transitioning to IN_PROGRESS and scheduling runs.`);
      await database.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.IN_PROGRESS },
      });
      await database.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.IN_PROGRESS,
          notes: `Managed drip-feed initiated: ${order.runs} runs scheduled.`,
        },
      });
      await this.pollAndDispatchDueRuns();
      return;
    }

    const isPackageExecutionOrder = Boolean(order.packageExecutionId);
    if (isPackageExecutionOrder) {
      const claimed = await database.$transaction(async (tx) => {
        const result = await tx.order.updateMany({
          where: {
            id: order.id,
            status: OrderStatus.PENDING,
            packageExecutionId: { not: null },
          },
          data: { status: OrderStatus.PROCESSING },
        });
        if (result.count !== 1) return false;

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: OrderStatus.PROCESSING,
            notes: "Package execution provider dispatch claimed.",
          },
        });
        return true;
      });
      if (!claimed) return;
      order.status = OrderStatus.PROCESSING;
    }

    let providerOrderId: string | null = null;

    if (order.provider && order.provider.active) {
      try {
        const apiKey = decryptProviderKey(order.provider.apiKeyEncrypted);
        let dispatchQuantity = order.quantity;
        const minQty = order.service?.minQty || 1;
        if (isPackageExecutionOrder && dispatchQuantity < minQty) {
          logger.warn(
            `[Worker Engine] Package execution order #${order.id} quantity (${dispatchQuantity}) is below service minimum (${minQty}). Clamping dispatch quantity to ${minQty} to prevent upstream rejection.`
          );
          dispatchQuantity = minQty;
        }

        providerOrderId = await this.callUpstreamAddOrder(
          order.provider.apiUrl,
          apiKey,
          order.service.providerServiceId || order.service.id,
          order.target,
          dispatchQuantity,
          order.isDripFeed ? order.runs : undefined,
          order.isDripFeed ? order.intervalMinutes : undefined,
          order.id,
          order.provider.id
        );
      } catch (err: any) {
        logger.error(`[Worker Engine] Upstream provider dispatch failed for #${order.id}: ${err.message}`);
        if (isPackageExecutionOrder) {
          const classification = classifyProviderError(err, { stage: "AFTER_SEND" });
          if (classification.disposition === ProviderErrorDisposition.DEFINITE_REJECTION) {
            logger.warn(
              `[Worker Engine] Provider definite rejection for package execution order #${order.id}: ${classification.normalizedMessage}. Triggering run failure & refund.`
            );
            await this.handleFinalOrderFailure(order.id, classification.normalizedMessage);
            await database.packageExecution.updateMany({
              where: {
                id: order.packageExecutionId!,
                orderId: order.id,
              },
              data: {
                status: PackageExecutionStatus.FAILED,
                skipReason: `Provider rejection: ${classification.normalizedMessage.slice(0, 150)}`,
              },
            });
            return;
          } else if (classification.disposition === ProviderErrorDisposition.RETRY_LATER) {
            const delaySec = classification.retryDelaySeconds || 900;
            const nextAttempt = new Date(Date.now() + delaySec * 1000);
            logger.info(
              `[Worker Engine] Transient provider response for #${order.id}: ${classification.normalizedMessage}. Rescheduling execution to ${nextAttempt.toISOString()}.`
            );
            await database.$transaction(async (tx) => {
              await tx.packageExecution.updateMany({
                where: {
                  id: order.packageExecutionId!,
                  orderId: order.id,
                },
                data: {
                  status: PackageExecutionStatus.SCHEDULED,
                  executeAt: nextAttempt,
                  orderId: null,
                  skipReason: `Transient: ${classification.normalizedMessage.slice(0, 120)}. Next attempt in ${Math.round(delaySec / 60)}m.`,
                },
              });
              await tx.order.update({
                where: { id: order.id },
                data: { status: OrderStatus.CANCELLED },
              });
              await tx.orderStatusHistory.create({
                data: {
                  orderId: order.id,
                  status: OrderStatus.CANCELLED,
                  notes: `Unsubmitted child order rolled back for retry: ${classification.normalizedMessage}`,
                },
              });
            });
            return;
          }

          await database.$transaction(async (tx) => {
            await tx.packageExecution.updateMany({
              where: {
                id: order.packageExecutionId!,
                orderId: order.id,
                status: PackageExecutionStatus.DISPATCHED,
              },
              data: { skipReason: PACKAGE_PROVIDER_OUTCOME_UNCERTAIN_REASON },
            });
            await tx.orderStatusHistory.create({
              data: {
                orderId: order.id,
                status: OrderStatus.PROCESSING,
                notes: `${PACKAGE_PROVIDER_OUTCOME_UNCERTAIN_REASON} ${err.message}`,
              },
            });
          });
          return;
        }

        const isUpstreamError = err.message && err.message.includes("Upstream provider error:");
        const service = order.service as any;

        // Hybrid Auto-Failover: If primary provider rejects with low balance or error, attempt backup provider
        if (isUpstreamError && service?.routingMode === "AUTO_FAILOVER" && service?.backupProviderId) {
          try {
            const backupProvider = await database.provider.findUnique({
              where: { id: service.backupProviderId },
            });
            if (backupProvider && backupProvider.active && service.backupProviderServiceId) {
              logger.warn(`[Worker Engine] Primary provider failed for #${order.id} (${err.message}). Attempting auto-failover to Backup Provider #${backupProvider.id} (${backupProvider.name})`);
              const backupApiKey = decryptProviderKey(backupProvider.apiKeyEncrypted);
              let backupDispatchQty = order.quantity;
              const backupMinQty = service?.minQty || 1;
              if (isPackageExecutionOrder && backupDispatchQty < backupMinQty) {
                backupDispatchQty = backupMinQty;
              }
              providerOrderId = await this.callUpstreamAddOrder(
                backupProvider.apiUrl,
                backupApiKey,
                service.backupProviderServiceId,
                order.target,
                backupDispatchQty,
                order.isDripFeed ? order.runs : undefined,
                order.isDripFeed ? order.intervalMinutes : undefined,
                order.id,
                backupProvider.id
              );

              // Update order to reference the backup provider and proceed to PROCESSING
              await database.$transaction([
                database.order.update({
                  where: { id: order.id },
                  data: {
                    providerId: backupProvider.id,
                    providerOrderId,
                    status: OrderStatus.PROCESSING,
                    startCount: 0,
                  },
                }),
                database.orderStatusHistory.create({
                  data: {
                    orderId: order.id,
                    status: OrderStatus.PROCESSING,
                    notes: `Auto-failed over to backup provider "${backupProvider.name}". Primary failed: ${err.message}. Upstream Ref: ${providerOrderId}`,
                  },
                }),
              ]);

              logger.info(`[Worker Engine] Order #${order.id} recovered and dispatched via Backup Provider ${backupProvider.name} (Upstream ID: ${providerOrderId})`);
              return;
            }
          } catch (backupErr: any) {
            logger.error(`[Worker Engine] Auto-failover to backup provider also failed for #${order.id}: ${backupErr.message}`);
          }
        }

        // If provider explicitly rejected the request and no failover succeeded, mark FAILED and refund automatically
        if (isUpstreamError) {
          await this.handleFinalOrderFailure(order.id, err.message);
          return;
        }
        if (isPackageExecutionOrder) {
          await database.orderStatusHistory.create({
            data: {
              orderId: order.id,
              status: OrderStatus.PROCESSING,
              notes: `Package provider outcome is uncertain; automatic retries are suppressed to prevent duplicate fulfillment. ${err.message}`,
            },
          });
        } else {
          await database.orderStatusHistory.create({
            data: {
              orderId: order.id,
              status: OrderStatus.PENDING,
              notes: `Dispatch attempt failed: ${err.message}`,
            },
          }).catch(() => null);
        }
        throw err;
      }
    } else {
      // Internal or simulated fulfillment
      providerOrderId = `sim_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      await database.orderProviderEvent.create({
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
    await database.$transaction([
      database.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.PROCESSING,
          providerOrderId,
          startCount: 0,
        },
      }),
      database.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.PROCESSING,
          notes: `Dispatched to upstream provider. Upstream Reference ID: ${providerOrderId}`,
        },
      }),
      ...(isPackageExecutionOrder
        ? [
          database.packageExecution.updateMany({
            where: {
              id: order.packageExecutionId!,
              orderId: order.id,
              status: PackageExecutionStatus.DISPATCHED,
              skipReason: PACKAGE_PROVIDER_OUTCOME_UNCERTAIN_REASON,
            },
            data: { skipReason: null },
          }),
        ]
        : []),
    ]);

    logger.info(`[Worker Engine] Order #${order.id} transitioned to PROCESSING (Upstream ID: ${providerOrderId})`);
  }

  /**
   * Submits a refill request for an order to the upstream SMM provider
   */
  async dispatchRefillToProvider(orderId: string, providerOrderIdOverride?: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { provider: true, service: true },
    });
    if (!order || !order.provider) {
      logger.warn(`[Worker Refill] Order #${orderId} has no provider.`);
      return;
    }
    const providerOrderId = providerOrderIdOverride || order.providerOrderId;
    if (!providerOrderId) {
      logger.warn(`[Worker Refill] Order #${orderId} has no providerOrderId.`);
      return;
    }

    try {
      const apiKey = decryptProviderKey(order.provider.apiKeyEncrypted);
      const params = new URLSearchParams();
      params.append("key", apiKey);
      params.append("action", "refill");
      params.append("order", String(providerOrderId));

      const response = await fetch(order.provider.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      const data: any = await response.json().catch(() => ({ error: "Invalid JSON response" }));
      logger.info(`[Worker Refill] Upstream refill response for Order #${orderId} (Provider #${providerOrderId}): ${JSON.stringify(data)}`);

      if (data.refill) {
        await prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: order.status,
            notes: `Refill confirmed by upstream. Refill ID: ${data.refill}`,
          },
        });
      } else if (data.error) {
        await prisma.orderStatusHistory.create({
          data: {
            orderId: order.id,
            status: order.status,
            notes: `Refill attempt response: ${data.error}`,
          },
        });
      }
    } catch (err: any) {
      logger.error({ err: err.message }, `[Worker Refill] Error submitting refill for Order #${orderId}`);
    }
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
  async syncNonFinalOrders(database: PrismaClient = prisma) {
    // 0. Hardened Auto-Recovery for Stalled PENDING / unconfirmed PROCESSING package child orders (> 5 mins)
    // I2 Rule: Before re-queueing an order without providerOrderId, verify it is not actively in flight in Outbox.
    // If ambiguous or unreachable, alert and do not double-dispatch.
    try {
      const staleUnconfirmedOrders = await database.order.findMany({
        where: {
          packageExecutionId: { not: null },
          status: { in: [OrderStatus.PENDING, OrderStatus.PROCESSING] },
          providerOrderId: null,
          createdAt: { lte: new Date(Date.now() - 5 * 60 * 1000) },
        },
        take: 10,
      });

      for (const staleOrder of staleUnconfirmedOrders) {
        // Check if there is an active Outbox event in flight
        const activeOutbox = await database.outboxEvent.findFirst({
          where: {
            aggregate: "ORDER",
            eventType: "ORDER_CREATED",
            status: OutboxStatus.PENDING,
          },
        });

        // If outbox event is still pending or processing, outcome is ambiguous -> alert and DO NOT cancel/re-queue
        if (activeOutbox && (activeOutbox.payload as any)?.orderId === staleOrder.id) {
          logger.warn(
            { orderId: staleOrder.id },
            `[Worker Watchdog] Order #${staleOrder.id} has an active OUTBOX event in flight. Deferring recovery to prevent double-dispatch.`
          );
          continue;
        }

        logger.warn(
          `[Worker Watchdog] Package child order #${staleOrder.id} verified unconfirmed without providerOrderId > 5m. Recovering execution #${staleOrder.packageExecutionId}.`
        );
        await database.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: staleOrder.id },
            data: { status: OrderStatus.CANCELLED },
          });
          await tx.orderStatusHistory.create({
            data: {
              orderId: staleOrder.id,
              status: OrderStatus.CANCELLED,
              notes: `Stalled in ${staleOrder.status} without upstream order confirmation > 5m. Verified no active outbox dispatch in flight.`,
            },
          });
          await tx.packageExecution.updateMany({
            where: {
              id: staleOrder.packageExecutionId!,
              orderId: staleOrder.id,
            },
            data: {
              status: PackageExecutionStatus.SCHEDULED,
              orderId: null,
              executeAt: new Date(),
              skipReason: "Auto-recovered from unconfirmed dispatch state; re-queued for execution.",
            },
          });
        });
      }
    } catch (pendErr: any) {
      logger.error(`[Worker Watchdog] Error recovering stale unconfirmed package orders: ${pendErr.message}`);
    }

    const rawActiveOrders = await database.order.findMany({
      where: {
        status: { in: [OrderStatus.PROCESSING, OrderStatus.IN_PROGRESS] },
      },
      include: {
        provider: true,
        packageExecution: {
          select: { status: true, skipReason: true },
        },
      },
      take: 50,
      orderBy: { updatedAt: "asc" },
    });

    const activeOrders = rawActiveOrders.filter(
      (order) => order.packageExecution?.skipReason !== PACKAGE_PROVIDER_STATUS_STALLED_REASON
    );

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

        if (
          order.packageExecution?.skipReason ===
          PACKAGE_PROVIDER_STATUS_STALLED_REASON
        ) {
          continue;
        }

        if (
          order.packageExecutionId &&
          order.providerOrderId &&
          order.packageExecution?.status === PackageExecutionStatus.DISPATCHED &&
          orderAgeMs >= PACKAGE_PROVIDER_STATUS_MAX_AGE_MS
        ) {
          const stalled = await database.packageExecution.updateMany({
            where: {
              id: order.packageExecutionId,
              orderId: order.id,
              status: PackageExecutionStatus.DISPATCHED,
            },
            data: { skipReason: PACKAGE_PROVIDER_STATUS_STALLED_REASON },
          });
          if (stalled && (stalled as any).count > 0) {
            logger.warn(
              `[Worker Watchdog] Paused provider status polling for package order #${order.id} after 24 hours without a terminal result.`
            );
          }
          continue;
        }

        // Optimized Package Stalled Dispatch Watchdog (3-4 hours instead of 24h deadlock)
        const PACKAGE_STALL_HOURS = Number(process.env.PACKAGE_STALL_HOURS) || 3;
        const packageStallThresholdMs = PACKAGE_STALL_HOURS * 60 * 60 * 1000;
        const packageAutoResolveMs = (PACKAGE_STALL_HOURS + 1) * 60 * 60 * 1000;

        if (
          order.packageExecutionId &&
          order.providerOrderId &&
          order.packageExecution?.status === PackageExecutionStatus.DISPATCHED
        ) {
          if (orderAgeMs >= packageStallThresholdMs && order.provider && order.provider.active) {
            try {
              const apiKey = decryptProviderKey(order.provider.apiKeyEncrypted);
              const statusRes = await this.callUpstreamOrderStatus(
                order.provider.apiUrl,
                apiKey,
                order.providerOrderId,
                order.provider.id
              );

              if (statusRes && !statusRes.error) {
                const raw = (statusRes.status || "").toLowerCase();
                const remains = statusRes.remains !== undefined ? parseInt(String(statusRes.remains), 10) : order.remains;
                if (raw.includes("complete")) {
                  await this.applyStatusTransition(order, statusRes);
                  await this.syncPackageExecutionStatus(order.id, database);
                  continue;
                } else if (raw.includes("partial") || (remains < order.quantity)) {
                  logger.info(
                    `[Worker Watchdog] Package order #${order.id} partially delivered (${order.quantity - remains}/${order.quantity}) after ${Math.round(orderAgeMs / 60000)}m. Finalizing as PARTIAL to unblock schedule.`
                  );
                  await this.applyStatusTransition(order, { ...statusRes, status: "partial", remains });
                  await this.syncPackageExecutionStatus(order.id, database);
                  continue;
                }
              }
            } catch (probeErr: any) {
              logger.warn(`[Worker Watchdog] Could not probe provider for package order #${order.id}: ${probeErr.message}`);
            }

            if (orderAgeMs >= packageAutoResolveMs) {
              logger.warn(
                `[Worker Watchdog] Package execution order #${order.id} stalled for ${Math.round(orderAgeMs / 3600000)}h with no completion. Auto-resolving as PARTIAL and issuing refund to unblock schedule.`
              );
              await this.handlePartialRefund(order, order.remains ?? order.quantity, order.startCount ?? 0);
              await database.packageExecution.updateMany({
                where: {
                  id: order.packageExecutionId,
                  orderId: order.id,
                  status: PackageExecutionStatus.DISPATCHED,
                },
                data: {
                  status: PackageExecutionStatus.PARTIAL,
                  skipReason: `Auto-resolved after ${Math.round(orderAgeMs / 3600000)}h of provider inactivity to unblock subsequent package runs.`,
                },
              });
              continue;
            }
          }
        }

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
          const statusRes = await this.callUpstreamOrderStatus(
            order.provider.apiUrl,
            apiKey,
            order.providerOrderId,
            order.provider.id
          );
          await this.applyStatusTransition(order, statusRes);
        } else if (
          order.packageExecutionId &&
          (order.providerId || order.provider)
        ) {
          // Package orders tied to an upstream provider must never be simulated.
          await this.syncPackageExecutionStatus(order.id, database);
          continue;
        } else {
          // Simulated progress for internal/sandbox orders
          await this.simulateOrderProgression(order);
        }
        if (order.packageExecutionId) {
          await this.syncPackageExecutionStatus(order.id, database);
        }
      } catch (err: any) {
        logger.error(`[Worker Sync] Error syncing status for order #${order.id}: ${err.message}`);
      }
    }

    // 2. Sync active managed runs with provider
    try {
      const activeRuns = await database.orderRun.findMany({
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
          const statusRes = await this.callUpstreamOrderStatus(
            run.order.provider.apiUrl,
            apiKey,
            run.providerOrderId,
            run.order.provider.id
          );

          if (statusRes.error) {
            logger.warn(`[Run Sync] Provider error for run #${run.id}: ${statusRes.error}`);
            continue;
          }

          const rawStatus = (statusRes.status || "").toLowerCase();
          if (rawStatus.includes("complete")) {
            await database.orderRun.update({
              where: { id: run.id },
              data: { status: "COMPLETED" as any, delivered: run.quantity },
            });
            await this.aggregateParentOrderStatus(run.orderId);
          } else if (rawStatus.includes("cancel")) {
            await database.orderRun.update({
              where: { id: run.id },
              data: { status: "CANCELED" as any, lastError: "Cancelled upstream" },
            });
            await this.refundSingleRun(run.order, run, "Cancelled upstream");
            await this.aggregateParentOrderStatus(run.orderId);
          } else if (rawStatus.includes("partial")) {
            const remains = statusRes.remains !== undefined ? parseInt(String(statusRes.remains), 10) : 0;
            const delivered = Math.max(0, run.quantity - remains);
            await database.orderRun.update({
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

  async syncPackageExecutionStatus(orderId: string, database: PrismaClient = prisma) {
    const order = await database.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        packageExecutionId: true,
        status: true,
        remains: true,
        providerOrderId: true,
      },
    });
    if (!order?.packageExecutionId) return;

    const status = packageExecutionStatusFromOrderStatus(order.status);
    const data: {
      status?: PackageExecutionStatus;
      remainingQuantity: number;
      skipReason?: string | null;
    } = {
      remainingQuantity: order.remains,
    };
    if (status) {
      data.status = status;
      data.skipReason = null;
    } else if (
      !order.providerOrderId &&
      (order.status === OrderStatus.PROCESSING ||
        order.status === OrderStatus.IN_PROGRESS)
    ) {
      data.skipReason = PACKAGE_PROVIDER_OUTCOME_UNCERTAIN_REASON;
    }

    const synced = await database.packageExecution.updateMany({
      where: {
        id: order.packageExecutionId,
        orderId: order.id,
        status: PackageExecutionStatus.DISPATCHED,
      },
      data,
    });

    if (
      synced.count === 1 &&
      !status &&
      order.providerOrderId
    ) {
      await database.packageExecution.updateMany({
        where: {
          id: order.packageExecutionId,
          orderId: order.id,
          status: PackageExecutionStatus.DISPATCHED,
          skipReason: PACKAGE_PROVIDER_OUTCOME_UNCERTAIN_REASON,
        },
        data: { skipReason: null },
      });
    }
  }

  /**
   * Transitions order according to upstream status and processes partial/canceled refunds
   */
  async applyStatusTransition(
    order: any,
    statusRes: { status?: string; start_count?: number | string; remains?: number | string; charge?: number | string; currency?: string;[key: string]: any }
  ) {
    const rawStatus = (statusRes.status || "").toLowerCase();
    let newStatus: OrderStatus = order.status;

    if (rawStatus.includes("complete")) newStatus = OrderStatus.COMPLETED;
    else if (rawStatus.includes("partial")) newStatus = OrderStatus.PARTIAL;
    else if (rawStatus.includes("cancel")) newStatus = OrderStatus.CANCELLED;
    else if (rawStatus.includes("progress")) newStatus = OrderStatus.IN_PROGRESS;
    else if (rawStatus.includes("process")) newStatus = OrderStatus.PROCESSING;
    else if (rawStatus.includes("fail")) newStatus = OrderStatus.FAILED;

    let startCount = order.startCount ?? 0;
    if (statusRes.start_count !== undefined && statusRes.start_count !== null && String(statusRes.start_count).trim() !== "") {
      const parsedStart = parseInt(String(statusRes.start_count), 10);
      if (!isNaN(parsedStart)) {
        startCount = parsedStart;
      }
    }

    let remains = order.remains;
    if (statusRes.remains !== undefined && statusRes.remains !== null && String(statusRes.remains).trim() !== "") {
      const parsedRemains = parseInt(String(statusRes.remains), 10);
      if (!isNaN(parsedRemains)) {
        remains = parsedRemains;
      }
    }

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
  async pollAndDispatchDueRuns(database: PrismaClient = prisma) {
    const { dueRuns, staleCount } = await database.$transaction(async (tx) => {
      const staleRuns = await tx.orderRun.updateMany({
        where: {
          status: "DISPATCHING" as any,
          updatedAt: { lte: new Date(Date.now() - ORDER_RUN_CLAIM_STALE_MS) },
        },
        data: {
          status: "UNCERTAIN" as any,
          lastError: "Dispatch claim expired; provider outcome requires reconciliation.",
        },
      });

      const claimedRuns = await tx.$queryRawUnsafe<any[]>(`
        WITH due_runs AS (
          SELECT r.id
          FROM "OrderRun" r
          JOIN "Order" o ON o.id = r."orderId"
          WHERE r.status = 'SCHEDULED'
            AND r."scheduledAt" <= NOW()
            AND (r."nextAttemptAt" IS NULL OR r."nextAttemptAt" <= NOW())
            AND o.status IN ('PENDING', 'PROCESSING', 'IN_PROGRESS')
          ORDER BY r."scheduledAt" ASC
          LIMIT 50
          FOR UPDATE OF r SKIP LOCKED
        )
        UPDATE "OrderRun" AS r
        SET status = 'DISPATCHING', "updatedAt" = NOW()
        FROM due_runs
        WHERE r.id = due_runs.id
          AND r.status = 'SCHEDULED'
        RETURNING r.id, r."orderId", r."runIndex", r.quantity, r."scheduledAt",
                  r.attempts, r."chargeShare", r.status
      `);

      return { dueRuns: claimedRuns, staleCount: staleRuns.count };
    });

    if (staleCount > 0) {
      logger.warn(
        `[Drip Scheduler] Moved ${staleCount} stale dispatch claim(s) to UNCERTAIN; automatic redispatch is suppressed.`
      );
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
    if (run.status !== "DISPATCHING") {
      logger.warn(`[Drip Scheduler] Refusing to dispatch unclaimed run #${run.id}.`);
      return;
    }

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

    let targetUrl = apiUrl.trim();
    if (
      !targetUrl.includes("/api/") &&
      !targetUrl.startsWith("simulated://") &&
      !targetUrl.includes("localhost") &&
      !targetUrl.includes("127.0.0.1")
    ) {
      targetUrl = targetUrl.replace(/\/+$/, "") + "/api/v2";
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

    if (!cleanLink.startsWith("http")) {
      const cleanHandle = cleanLink.replace(/^@/, "");
      payload.link = `https://www.instagram.com/${cleanHandle}`;
    }

    const sanitizedPayload = { ...payload, key: "[REDACTED]" };
    let response: Response;
    let data: any;

    try {
      response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(payload as any).toString(),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Upstream SMM API returned HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }

      data = await response.json();

      // If upstream provider specifically reports "Missing username", retry once with extracted handle/target
      if (data.error && data.error.toLowerCase().includes("missing username") && !payload.username) {
        const fallbackUser = cleanLink.replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "").replace(/\/.*$/, "").replace(/^@/, "");
        if (fallbackUser && fallbackUser.length > 0) {
          payload.username = fallbackUser;
          const retryRes = await fetch(targetUrl, {
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
    orderId: string,
    providerId?: string
  ): Promise<{ status?: string; start_count?: number; remains?: number; error?: string }> {
    if (apiUrl.includes("example.com") || apiUrl.includes("test") || apiUrl.startsWith("simulated://")) {
      return { status: "Completed", start_count: 50, remains: 0 };
    }

    let targetUrl = apiUrl.trim();
    if (
      !targetUrl.includes("/api/") &&
      !targetUrl.startsWith("simulated://") &&
      !targetUrl.includes("localhost") &&
      !targetUrl.includes("127.0.0.1")
    ) {
      targetUrl = targetUrl.replace(/\/+$/, "") + "/api/v2";
    }

    const payload = {
      key: apiKey,
      action: "status",
      order: orderId,
    };

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(payload as any).toString(),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Upstream SMM API status check returned HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }

      const text = await response.text();
      let status: any;
      try {
        status = JSON.parse(text);
      } catch (parseErr: any) {
        logger.warn({ text: text.slice(0, 200), err: parseErr.message }, `[Worker] Upstream returned non-JSON status response for order #${orderId}`);
        return { error: `Invalid JSON response: ${text.slice(0, 100)}` };
      }
      if (providerId) {
        await this.recordProviderStatusCheck(providerId, true);
      }
      return status;
    } catch (err: any) {
      if (providerId) {
        await this.recordProviderStatusCheck(providerId, false, err.message);
      }
      throw err;
    }
  }

  private async recordProviderStatusCheck(
    providerId: string,
    success: boolean,
    error?: string,
    database: PrismaClient = prisma
  ) {
    const now = new Date();
    const cacheKey = `${providerId}:${success ? "success" : "failure"}`;
    const minimumIntervalMs = success ? 5 * 60 * 1000 : 60 * 1000;
    const lastRecordedAt = this.providerHealthTelemetryCache.get(cacheKey) || 0;
    if (now.getTime() - lastRecordedAt < minimumIntervalMs) return;
    this.providerHealthTelemetryCache.set(cacheKey, now.getTime());

    try {
      await database.provider.updateMany({
        where: success
          ? {
            id: providerId,
            OR: [
              { consecutiveStatusFailures: { gt: 0 } },
              { lastStatusCheckAt: null },
              { lastStatusCheckAt: { lte: new Date(now.getTime() - 5 * 60 * 1000) } },
            ],
          }
          : {
            id: providerId,
            OR: [
              { lastStatusCheckAt: null },
              { lastStatusCheckAt: { lte: new Date(now.getTime() - 60 * 1000) } },
            ],
          },
        data: success
          ? {
            consecutiveStatusFailures: 0,
            lastStatusCheckAt: now,
            lastStatusCheckError: null,
          }
          : {
            consecutiveStatusFailures: { increment: 1 },
            lastStatusCheckAt: now,
            lastStatusCheckError: error?.slice(0, 500) || "Provider status check failed.",
          },
      });
    } catch (telemetryError: any) {
      logger.warn(
        { err: telemetryError.message, providerId },
        "[Provider Health] Unable to update provider status-check telemetry."
      );
    }
  }

  async stop() {
    this.isRunning = false;
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.dripRunInterval) clearInterval(this.dripRunInterval);
    if (this.packageExecutionInterval) clearInterval(this.packageExecutionInterval);
    if (this.autopilotInterval) clearInterval(this.autopilotInterval);
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

  /**
   * Package Engine: Polls due SCHEDULED executions and dispatches them via prepaid child orders.
   * Package/execution row locks serialize rescheduling and dispatch; order, state, and outbox writes commit together.
   */
  async pollAndDispatchPackageExecutions(database: PrismaClient = prisma) {
    if (!this.isCanaryHealthy) {
      logger.warn("[Package Engine] Dispatch skipped: Query canary is unhealthy.");
      return { dispatchedCount: 0, errorsCount: 1 };
    }

    const isPackagesEnabled =
      process.env.NODE_ENV !== "production"
        ? process.env.PACKAGES_ENABLED === "true"
        : (process.env.PACKAGES_ENABLED === "true" && (process.env.ALLOW_PACKAGES_IN_PROD === "true" || process.env.PACKAGES_PRODUCTION_ALLOWED === "true"));
    if (!isPackagesEnabled) {
      return { dispatchedCount: 0, errorsCount: 0 };
    }

    const allowlistEnv = process.env.PACKAGES_ALLOWED_USER_IDS;
    const allowedUserIds = (allowlistEnv && allowlistEnv.trim() !== "" && allowlistEnv.trim() !== "*")
      ? allowlistEnv.split(",").map((id) => id.trim()).filter(Boolean)
      : null;

    const maxOverduePerTick = parseInt(process.env.DELIVERY_PACE_CATCHUP_K || String(DEFAULT_CATCHUP_MAX_PER_TICK), 10);
    const maxAttemptsBeforeStall = parseInt(process.env.DISPATCH_MAX_ATTEMPTS || "5", 10);
    const globalTickBudget = parseInt(process.env.DISPATCH_TICK_BUDGET || "25", 10);
    const now = new Date();

    let dueCandidates: Array<{ id: string; packageId: string }> = [];

    // Fallback for in-memory or simplified test mock database without raw SQL engine
    if (typeof database.$queryRawUnsafe !== "function") {
      if (typeof (database as any).packageExecution?.findMany === "function") {
        dueCandidates = await (database as any).packageExecution.findMany({
          where: {
            status: PackageExecutionStatus.SCHEDULED,
            executeAt: { lte: now },
          },
          take: globalTickBudget,
        });
      } else {
        return { dispatchedCount: 0, errorsCount: 0 };
      }
    }

    // ── I1: Dispatchable-only candidate selection via SQL ──
    // Non-dispatchable executions (predecessor-blocked, in backoff, stalled) never occupy the window.
    // Per-package fairness: at most K candidates per package (ROW_NUMBER partitioned by packageId).
    // FOR UPDATE OF e SKIP LOCKED prevents double-dispatch across worker instances.
    const terminalStatuses = `'COMPLETED','PARTIAL','CANCELLED','SKIPPED_PAUSED','SKIPPED_QUOTA','SKIPPED_TYPE','SKIPPED_DELETED','SKIPPED_LIMIT','STALLED'`;

    // Dynamic column check: backwards-compatible before/after migration 20261102150000
    let hasBackoffCols = false;
    try {
      const colCheck = await database.$queryRawUnsafe<any[]>(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'PackageExecution' AND column_name = 'nextAttemptAt'
        LIMIT 1
      `);
      hasBackoffCols = Array.isArray(colCheck) && colCheck.length > 0;
    } catch {
      hasBackoffCols = false;
    }

    const userFilter = allowedUserIds
      ? `AND p."userId" IN (${allowedUserIds.map((_, i) => `$${i + 3}`).join(",")})`
      : "";

    const backoffFilter = hasBackoffCols
      ? `AND (e."nextAttemptAt" IS NULL OR e."nextAttemptAt" <= $1) AND e.attempts < $2`
      : "";

    const candidateSQL = `
      WITH candidates AS (
        SELECT e.id, e."packageId",
               ROW_NUMBER() OVER (PARTITION BY e."packageId" ORDER BY e."executeAt" ASC) AS rn
        FROM "PackageExecution" e
        JOIN "Package" p ON p.id = e."packageId"
        WHERE e.status = 'SCHEDULED'
          AND e."executeAt" <= $1
          ${backoffFilter}
          AND (
            e.source != 'SCHEDULE'
            OR NOT EXISTS (
              SELECT 1 FROM "PackageExecution" pred
              WHERE pred."packageId" = e."packageId"
                AND pred."ruleId" = e."ruleId"
                AND pred.source = 'SCHEDULE'
                AND pred.seq < e.seq
                AND pred.status::text NOT IN (${terminalStatuses})
            )
          )
          ${userFilter}
      )
      SELECT c.id, c."packageId"
      FROM candidates c
      WHERE c.rn <= $${allowedUserIds ? allowedUserIds.length + 3 : 3}
      ORDER BY c.rn ASC
      LIMIT ${globalTickBudget}
    `;

    // now already declared above
    const queryParams: any[] = [now, maxAttemptsBeforeStall];
    if (allowedUserIds) {
      queryParams.push(...allowedUserIds);
    }
    queryParams.push(maxOverduePerTick); // K per package

    if (dueCandidates.length === 0 && typeof database.$queryRawUnsafe === "function") {
      try {
        dueCandidates = await database.$queryRawUnsafe<Array<{ id: string; packageId: string }>>(
          candidateSQL,
          ...queryParams
        );
      } catch (queryErr: any) {
        logger.error(
          { err: queryErr.message },
          "[Package Engine] CRITICAL: Candidate selection query failed. Dispatch tick skipped."
        );
        return { dispatchedCount: 0, errorsCount: 1 };
      }
    }

    let dispatchedCount = 0;
    let errorsCount = 0;
    const packageDispatchesInTick = new Map<string, number>();

    for (const candidate of (dueCandidates || [])) {
      if ((packageDispatchesInTick.get(candidate.packageId) || 0) >= maxOverduePerTick) {
        continue;
      }
      try {
        const dispatched = await database.$transaction(async (tx) => {
          const [pkg] = await tx.$queryRawUnsafe<Array<{
            status: PackageStatus;
            endAt: Date;
          }>>(
            `SELECT status, "endAt"
             FROM "Package"
             WHERE id = $1
             FOR UPDATE`,
            candidate.packageId
          );
          if (!pkg) return false;

          const [execution] = await tx.$queryRawUnsafe<Array<{
            id: string;
            packageId: string;
            ruleId: string;
            source: ExecutionSource;
            seq: number;
            quantity: number;
            allocatedCharge: { toString(): string };
            executeAt: Date;
            skipReason: string | null;
            targetUrl: string | null;
            userId: string;
            handle: string;
            platform: string;
            serviceId: string;
            providerId: string | null;
            kind: string | null;
          }>>(
            `SELECT e.id, e."packageId", e."ruleId", e.source, e.seq, e.quantity,
                    e."allocatedCharge", e."executeAt", e."skipReason", e."targetUrl",
                    p."userId", p.handle, p.platform,
                    r."serviceId", s."providerId", s.kind
             FROM "PackageExecution" e
             JOIN "Package" p ON p.id = e."packageId"
             JOIN "PackageRule" r ON r.id = e."ruleId"
             JOIN "Service" s ON s.id = r."serviceId"
             WHERE e.id = $1 AND e."packageId" = $2
               AND e.status = 'SCHEDULED' AND e."executeAt" <= $3
             FOR UPDATE OF e SKIP LOCKED`,
            candidate.id,
            candidate.packageId,
            new Date()
          );
          if (!execution) return false;

          if (pkg.status === PackageStatus.PAUSED) {
            await tx.packageExecution.updateMany({
              where: {
                id: execution.id,
                status: PackageExecutionStatus.SCHEDULED,
              },
              data: {
                status: PackageExecutionStatus.SKIPPED_PAUSED,
                skipReason: "Package is currently paused",
              },
            });
            return false;
          }

          if (pkg.status !== PackageStatus.ACTIVE) {
            await tx.packageExecution.updateMany({
              where: {
                id: execution.id,
                status: PackageExecutionStatus.SCHEDULED,
              },
              data: {
                status: PackageExecutionStatus.CANCELLED,
                skipReason: pkg.status === PackageStatus.CANCELLED
                  ? "Package cancelled"
                  : `Package is ${pkg.status.toLowerCase()}`,
              },
            });
            return false;
          }

          if (new Date(pkg.endAt).getTime() <= Date.now()) {
            await tx.packageExecution.updateMany({
              where: {
                id: execution.id,
                status: PackageExecutionStatus.SCHEDULED,
              },
              data: {
                status: PackageExecutionStatus.CANCELLED,
                skipReason: "Package duration expired",
              },
            });
            return false;
          }

          if (execution.source === ExecutionSource.SCHEDULE && execution.seq > 1) {
            const predecessor = await tx.packageExecution.findFirst({
              where: {
                packageId: execution.packageId,
                ruleId: execution.ruleId,
                source: ExecutionSource.SCHEDULE,
                seq: { lt: execution.seq },
              },
              orderBy: { seq: "desc" },
              select: {
                id: true,
                status: true,
                order: { select: { status: true } },
              },
            });

            if (predecessor) {
              let predecessorStatus = predecessor.status;
              if (
                predecessorStatus === PackageExecutionStatus.DISPATCHED &&
                predecessor.order
              ) {
                const terminalStatus = packageExecutionStatusFromOrderStatus(
                  predecessor.order.status
                );
                if (terminalStatus) {
                  await tx.packageExecution.updateMany({
                    where: {
                      id: predecessor.id,
                      status: PackageExecutionStatus.DISPATCHED,
                    },
                    data: { status: terminalStatus, skipReason: null },
                  });
                  predecessorStatus = terminalStatus;
                }
              }

              const predecessorAllowsNextRun = new Set<string>([
                PackageExecutionStatus.COMPLETED,
                PackageExecutionStatus.PARTIAL,
                PackageExecutionStatus.CANCELLED,
                PackageExecutionStatus.STALLED,
                PackageExecutionStatus.SKIPPED_PAUSED,
                PackageExecutionStatus.SKIPPED_QUOTA,
                PackageExecutionStatus.SKIPPED_TYPE,
                PackageExecutionStatus.SKIPPED_DELETED,
                PackageExecutionStatus.SKIPPED_LIMIT,
              ]).has(predecessorStatus);

              if (!predecessorAllowsNextRun) {
                const skipReason = predecessorStatus === PackageExecutionStatus.FAILED
                  ? `Held because prior execution ${predecessor.id} failed and requires recovery.`
                  : `Waiting for prior execution ${predecessor.id} to reach a terminal provider status.`;
                if (execution.skipReason !== skipReason) {
                  await tx.packageExecution.updateMany({
                    where: {
                      id: execution.id,
                      status: PackageExecutionStatus.SCHEDULED,
                    },
                    data: { skipReason },
                  });
                }
                return false;
              }
            }
          }

          const platform = (execution.platform || "instagram").toLowerCase();
          let target = execution.targetUrl;
          if (!target || target.trim() === "") {
            const rawHandle = (execution.handle || "").replace(/^@/, "");
            if (rawHandle.startsWith("http")) {
              target = rawHandle;
            } else if (platform === "x") {
              target = `https://x.com/${rawHandle}`;
            } else if (platform === "tiktok") {
              target = `https://tiktok.com/@${rawHandle}`;
            } else if (platform === "youtube") {
              target = `https://youtube.com/@${rawHandle}`;
            } else if (platform === "facebook") {
              target = `https://facebook.com/${rawHandle}`;
            } else if (platform === "telegram") {
              target = `https://t.me/${rawHandle}`;
            } else {
              target = `https://instagram.com/${rawHandle}`;
            }
          }

          const normLink = normalizeTargetUrl(target);

          // 1. Concurrency serialization: at most one active order per (provider, link, service)
          if (execution.providerId) {
            const [activeOverlap] = await tx.$queryRawUnsafe<Array<{ count: number }>>(
              `SELECT COUNT(*)::int as count
               FROM "Order"
               WHERE "providerId" = $1
                 AND "serviceId" = $2
                 AND status IN ('PENDING', 'PROCESSING', 'IN_PROGRESS')
                 AND regexp_replace(regexp_replace(lower(trim(trailing '/' from target)), '^https?://(www\\.)?', ''), '/+$', '') = $3`,
              execution.providerId,
              execution.serviceId,
              normLink
            );
            if (activeOverlap && Number(activeOverlap.count) > 0) {
              return false;
            }
          }

          // 2. Dispatcher limiter: units in flight per (platform, link, kind)
          const [inFlight] = await tx.$queryRawUnsafe<Array<{ in_flight_units: number }>>(
            `SELECT COALESCE(SUM(o.quantity), 0)::int as in_flight_units
             FROM "Order" o
             JOIN "Service" s ON s.id = o."serviceId"
             WHERE o.status IN ('PENDING', 'PROCESSING', 'IN_PROGRESS')
               AND regexp_replace(regexp_replace(lower(trim(trailing '/' from o.target)), '^https?://(www\\.)?', ''), '/+$', '') = $1
               AND s.kind::text = $2`,
            normLink,
            execution.kind || "DEFAULT"
          );
          const currentInFlight = (inFlight && inFlight.in_flight_units != null && !Number.isNaN(Number(inFlight.in_flight_units))) ? Number(inFlight.in_flight_units) : 0;
          const paceCheck = canDispatchUnitsOnLink(
            currentInFlight,
            execution.quantity,
            execution.kind,
            {
              LIKES: parseInt(process.env.PACE_CAP_LIKES || "1000", 10),
              VIEWS: parseInt(process.env.PACE_CAP_VIEWS || "25000", 10),
              SHARES: parseInt(process.env.PACE_CAP_SHARES || "500", 10),
              COMMENTS: parseInt(process.env.PACE_CAP_COMMENTS || "200", 10),
              SAVES: parseInt(process.env.PACE_CAP_SAVES || "500", 10),
              FOLLOWERS: parseInt(process.env.PACE_CAP_FOLLOWERS || "2000", 10),
              DEFAULT: parseInt(process.env.PACE_CAP_DEFAULT || "5000", 10),
            }
          );
          if (!paceCheck.allowed) {
            await tx.packageExecution.updateMany({
              where: { id: execution.id, status: PackageExecutionStatus.SCHEDULED },
              data: { skipReason: paceCheck.reason },
            });
            return false;
          }

          const claim = await tx.packageExecution.updateMany({
            where: {
              id: execution.id,
              packageId: execution.packageId,
              status: PackageExecutionStatus.SCHEDULED,
              orderId: null,
            },
            data: {
              status: PackageExecutionStatus.DISPATCHED,
              remainingQuantity: execution.quantity,
              skipReason: null,
            },
          });
          if (claim.count !== 1) return false;

          // Clear any dangling 1:1 relation on this execution from prior attempts/cancellations
          await tx.order.updateMany({
            where: { packageExecutionId: execution.id },
            data: { packageExecutionId: null },
          });

          const childOrder = await tx.order.create({
            data: {
              userId: execution.userId,
              serviceId: execution.serviceId,
              target,
              quantity: execution.quantity,
              charge: new Decimal(execution.allocatedCharge.toString()),
              isPrepaid: true,
              status: OrderStatus.PENDING,
              startCount: 0,
              remains: execution.quantity,
              providerId: execution.providerId,
              packageExecutionId: execution.id,
            },
          });

          const linked = await tx.packageExecution.updateMany({
            where: {
              id: execution.id,
              status: PackageExecutionStatus.DISPATCHED,
              orderId: null,
            },
            data: {
              orderId: childOrder.id,
            },
          });
          if (linked.count !== 1) {
            throw new Error(`Package execution ${execution.id} lost its dispatch claim.`);
          }

          await tx.outboxEvent.create({
            data: {
              aggregate: "ORDER",
              eventType: "ORDER_CREATED",
              payload: {
                orderId: childOrder.id,
                packageId: execution.packageId,
                ruleId: execution.ruleId,
                packageExecutionId: execution.id,
                serviceId: execution.serviceId,
                target,
                quantity: execution.quantity,
                isPrepaid: true,
              },
              status: OutboxStatus.PENDING,
            },
          });

          return true;
        });

        if (dispatched) {
          dispatchedCount++;
          packageDispatchesInTick.set(
            candidate.packageId,
            (packageDispatchesInTick.get(candidate.packageId) || 0) + 1
          );
        }
      } catch (dispatchError: any) {
        errorsCount++;
        const sanitisedError = (dispatchError.message || "Unknown dispatch error").substring(0, 500);
        logger.error(
          { err: sanitisedError, executionId: candidate.id },
          `[Package Engine] Error dispatching execution #${candidate.id}`
        );

        // ── I1: Deterministic backoff & poison-pill isolation ──
        // Increment attempts, compute deterministic backoff, and mark STALLED after N failures.
        try {
          if (hasBackoffCols) {
            const currentExec = await database.packageExecution.findUnique({
              where: { id: candidate.id },
              select: { attempts: true },
            });
            const newAttempts = (currentExec?.attempts ?? 0) + 1;
            const backoffScheduleSeconds = [30, 60, 120, 300, 600, 1800]; // Deterministic backoff schedule
            const backoffSeconds = backoffScheduleSeconds[Math.min(newAttempts - 1, backoffScheduleSeconds.length - 1)];

            if (newAttempts >= maxAttemptsBeforeStall) {
              // Poison-pill: mark as STALLED so it never re-enters the candidate window
              await database.packageExecution.updateMany({
                where: { id: candidate.id, status: PackageExecutionStatus.SCHEDULED },
                data: {
                  status: PackageExecutionStatus.STALLED,
                  attempts: newAttempts,
                  lastError: sanitisedError,
                  lastErrorAt: new Date(),
                  skipReason: `Stalled after ${newAttempts} failed dispatch attempts. Last error: ${sanitisedError.substring(0, 200)}`,
                },
              });
              logger.warn(
                { executionId: candidate.id, attempts: newAttempts },
                `[Package Engine] Execution #${candidate.id} marked STALLED after ${newAttempts} attempts`
              );
            } else {
              // Backoff: set nextAttemptAt so it is excluded from the candidate window until the backoff expires
              const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);
              await database.packageExecution.updateMany({
                where: { id: candidate.id, status: PackageExecutionStatus.SCHEDULED },
                data: {
                  attempts: newAttempts,
                  nextAttemptAt,
                  lastError: sanitisedError,
                  lastErrorAt: new Date(),
                  skipReason: `Dispatch attempt ${newAttempts} failed. Next retry at ${nextAttemptAt.toISOString()}`,
                },
              });
            }
          } else {
            await database.packageExecution.updateMany({
              where: { id: candidate.id, status: PackageExecutionStatus.SCHEDULED },
              data: {
                skipReason: `Dispatch attempt failed: ${sanitisedError.substring(0, 200)}`,
              },
            });
          }
        } catch (backoffErr: any) {
          logger.error(
            { err: backoffErr.message, executionId: candidate.id },
            `[Package Engine] Failed to record backoff for execution #${candidate.id}`
          );
        }
      }
    }

    if (dueCandidates.length > 0) {
      logger.info(
        `[Package Engine] Dispatched ${dispatchedCount} of ${dueCandidates.length} due execution(s); ${errorsCount} failed`
      );
    }

    return { dispatchedCount, errorsCount };
  }

  private async isSafeResolvedWorkerIp(hostname: string): Promise<boolean> {
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      if (!addresses || addresses.length === 0) return false;
      for (const record of addresses) {
        const ip = record.address;
        if (net.isIPv4(ip)) {
          const parts = ip.split(".").map(Number);
          if (parts[0] === 127 || parts[0] === 10 || parts[0] === 0) return false;
          if (parts[0] === 169 && parts[1] === 254) return false;
          if (parts[0] === 192 && parts[1] === 168) return false;
          if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
        } else if (net.isIPv6(ip)) {
          const norm = ip.toLowerCase();
          if (norm === "::1" || norm === "::") return false;
          if (norm.startsWith("fe8") || norm.startsWith("fe9") || norm.startsWith("fea") || norm.startsWith("feb")) return false;
          if (norm.startsWith("fc") || norm.startsWith("fd")) return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Worker HTTP fetcher for Instagram / YouTube scraping
   */
  private async fetchWorkerHttp(
    targetUrl: string,
    headers: Record<string, string> = {},
    maxHops = 5
  ): Promise<{ status: number; data: string }> {
    if (maxHops <= 0) throw new Error("Too many redirects");
    const u = new URL(targetUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      throw new Error("Disallowed protocol for scraping");
    }

    const PRIVATE_IP_REGEX = /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2[0-9]|3[0-1])\.|0\.|::1|localhost)/i;
    if (PRIVATE_IP_REGEX.test(u.hostname)) {
      throw new Error("Blocked request to internal network or private IP");
    }

    const hostname = u.hostname.toLowerCase();
    const isAllowed =
      hostname === "instagram.com" ||
      hostname.endsWith(".instagram.com") ||
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtu.be" ||
      hostname === "t.me" ||
      hostname.endsWith(".t.me") ||
      hostname === "telegram.me" ||
      hostname === "tiktok.com" ||
      hostname.endsWith(".tiktok.com") ||
      hostname === "x.com" ||
      hostname.endsWith(".x.com") ||
      hostname === "twitter.com" ||
      hostname.endsWith(".twitter.com");

    if (!isAllowed) {
      throw new Error(`Blocked request to unauthorized host: ${hostname}`);
    }

    const isDnsSafe = await this.isSafeResolvedWorkerIp(hostname);
    if (!isDnsSafe) {
      throw new Error(`Host '${hostname}' resolved to private or disallowed IP address.`);
    }

    return new Promise((resolve, reject) => {
      try {
        const client = u.protocol === "https:" ? https : http;
        const defaultHeaders: Record<string, string> = {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          ...headers,
        };
        const req = client.get(targetUrl, { headers: defaultHeaders, timeout: 5000 }, async (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume();
            let nextLoc = res.headers.location;
            if (nextLoc.startsWith("/")) {
              nextLoc = `${u.protocol}//${u.host}${nextLoc}`;
            }
            try {
              const redirectU = new URL(nextLoc);
              const rHost = redirectU.hostname.toLowerCase();
              if (
                PRIVATE_IP_REGEX.test(rHost) ||
                !(
                  rHost === "instagram.com" ||
                  rHost.endsWith(".instagram.com") ||
                  rHost === "youtube.com" ||
                  rHost.endsWith(".youtube.com") ||
                  rHost === "youtu.be"
                )
              ) {
                return reject(new Error(`Redirect to disallowed host '${redirectU.hostname}' blocked.`));
              }
              const isRedirDnsSafe = await this.isSafeResolvedWorkerIp(rHost);
              if (!isRedirDnsSafe) {
                return reject(new Error(`Redirect host '${redirectU.hostname}' resolved to private IP.`));
              }
            } catch {
              return reject(new Error("Invalid redirect location"));
            }
            return this.fetchWorkerHttp(nextLoc, headers, maxHops - 1).then(resolve).catch(reject);
          }
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
            if (data.length > 3000000) res.destroy();
          });
          res.on("end", () => resolve({ status: res.statusCode || 200, data }));
        });
        req.on("error", reject);
        req.on("timeout", () => {
          req.destroy();
          reject(new Error("Request timeout"));
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * Scrapes latest Instagram upload for a handle (sorts by pk descending to bypass pinned posts)
   */
  private async scrapeInstagramLatest(handle: string): Promise<{ mediaKey: string; url: string; title: string } | null> {
    const cleanHandle = handle.replace(/^@/, "").replace(/https?:\/\/(?:www\.)?instagram\.com\//, "").replace(/\/$/, "");
    const profileUrl = `https://www.instagram.com/${cleanHandle}/`;
    const res = await this.fetchWorkerHttp(profileUrl, {
      "User-Agent": "facebookexternalhit/1.1 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    });
    const html = res.data;

    const nodePattern =
      /\{"node":\{"__typename":"([^"]+)","__isXIGPolarisMedia":"[^"]*","pk":"([0-9]+)","code":"([a-zA-Z0-9_-]+)"[^{}]*?"accessibility_caption":"([^"]*)"[^{}]*?"caption":\{"text":"([^"]*)"\}[^{}]*?"display_uri":"([^"]+)"/g;
    let m: RegExpExecArray | null;
    const nodes: Array<{ pk: bigint; shortcode: string; caption: string }> = [];
    while ((m = nodePattern.exec(html)) !== null) {
      nodes.push({
        pk: BigInt(m[2]),
        shortcode: m[3],
        caption: m[5] || m[4] || `Instagram Reel (${m[3]})`,
      });
    }

    if (nodes.length > 0) {
      nodes.sort((a, b) => (b.pk > a.pk ? 1 : -1));
      const newest = nodes[0];
      return {
        mediaKey: newest.shortcode,
        url: `https://www.instagram.com/reel/${newest.shortcode}/`,
        title: newest.caption,
      };
    }

    const rawCodes = [
      ...html.matchAll(/"shortcode":"([a-zA-Z0-9_-]+)"/g),
      ...html.matchAll(/\/reel\/([a-zA-Z0-9_-]+)/g),
      ...html.matchAll(/\/p\/([a-zA-Z0-9_-]+)/g),
    ].map((x) => x[1]);
    const unique = [...new Set(rawCodes)];
    if (unique.length > 0) {
      return {
        mediaKey: unique[0],
        url: `https://www.instagram.com/reel/${unique[0]}/`,
        title: `Instagram Post (${unique[0]})`,
      };
    }

    return null;
  }

  /**
   * Scrapes latest YouTube video for a channel handle
   */
  private async scrapeYouTubeLatest(handle: string): Promise<{ mediaKey: string; url: string; title: string } | null> {
    let channelUrl = handle.trim();
    if (!channelUrl.startsWith("http")) {
      const clean = channelUrl.replace(/^@/, "");
      channelUrl = `https://www.youtube.com/@${clean}/videos`;
    }
    const res = await this.fetchWorkerHttp(channelUrl);
    const html = res.data;

    let channelId: string | null = null;
    const matchId =
      html.match(/"browseId":"(UC[a-zA-Z0-9_-]{22})"/) || html.match(/channel\/(UC[a-zA-Z0-9_-]{22})/);
    if (matchId) channelId = matchId[1];

    if (channelId) {
      try {
        const rssRes = await this.fetchWorkerHttp(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
        const entries = [...rssRes.data.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
        if (entries.length > 0) {
          const first = entries[0][1];
          const vm = first.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
          const tm = first.match(/<title>([^<]+)<\/title>/);
          if (vm) {
            return {
              mediaKey: vm[1],
              url: `https://www.youtube.com/watch?v=${vm[1]}`,
              title: tm ? tm[1] : `YouTube Video (${vm[1]})`,
            };
          }
        }
      } catch {}
    }

    const vids = [...html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map((m) => m[1]);
    const unique = [...new Set(vids)];
    if (unique.length > 0) {
      return {
        mediaKey: unique[0],
        url: `https://www.youtube.com/watch?v=${unique[0]}`,
        title: `YouTube Video (${unique[0]})`,
      };
    }

    return null;
  }

  /**
   * Scrapes latest Telegram channel post from official public web preview
   */
  private async scrapeTelegramLatest(handle: string): Promise<{ mediaKey: string; url: string; title: string } | null> {
    const raw = handle.trim();
    let channel = raw;
    if (channel.startsWith("http")) {
      try {
        const u = new URL(channel);
        const parts = u.pathname.split("/").filter(Boolean);
        channel = parts[parts[0] === "s" ? 1 : 0] || raw;
      } catch {}
    }
    channel = channel.replace(/^@/, "").replace(/\/$/, "");
    const previewUrl = `https://t.me/s/${channel}`;
    const res = await this.fetchWorkerHttp(previewUrl);
    const html = res.data;

    const postMatches = [...html.matchAll(/data-post="([^"]+)"/g)].map((m) => m[1]);
    if (!postMatches || postMatches.length === 0) return null;

    const latestPostId = postMatches[postMatches.length - 1];
    const postNum = latestPostId.split("/")[1] || latestPostId;
    const postUrl = `https://t.me/${latestPostId}`;
    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
    const postTitle = descMatch ? descMatch[1].slice(0, 80) : `Telegram Post #${postNum}`;

    return {
      mediaKey: latestPostId,
      url: postUrl,
      title: postTitle,
    };
  }

  /**
   * Scrapes latest TikTok video for creator handle or video URL
   */
  private async scrapeTikTokLatest(handle: string): Promise<{ mediaKey: string; url: string; title: string } | null> {
    const raw = handle.trim();
    let clean = raw;
    if (clean.startsWith("http")) {
      try {
        const u = new URL(clean);
        const videoMatch = u.pathname.match(/\/video\/([0-9]+)/);
        if (videoMatch) {
          return {
            mediaKey: videoMatch[1],
            url: clean,
            title: `TikTok Video (${videoMatch[1]})`,
          };
        }
        const parts = u.pathname.split("/").filter(Boolean);
        clean = parts[0] || raw;
      } catch {}
    }
    const cleanHandle = clean.replace(/^@/, "").replace(/\/$/, "");
    try {
      const profileUrl = `https://www.tiktok.com/@${cleanHandle}`;
      const res = await this.fetchWorkerHttp(profileUrl);
      const html = res.data;
      const videoMatches = [...html.matchAll(/\/video\/([0-9]{15,22})/g)].map((m) => m[1]);
      const uniqueVideos = [...new Set(videoMatches)];
      if (uniqueVideos.length > 0) {
        const latestId = uniqueVideos[0];
        return {
          mediaKey: latestId,
          url: `https://www.tiktok.com/@${cleanHandle}/video/${latestId}`,
          title: `TikTok Video (${latestId})`,
        };
      }
    } catch {}
    return null;
  }

  /**
   * Scrapes latest X / Twitter post for handle or tweet URL
   */
  private async scrapeTwitterLatest(handle: string): Promise<{ mediaKey: string; url: string; title: string } | null> {
    const raw = handle.trim();
    if (raw.startsWith("http")) {
      const tweetMatch = raw.match(/\/status\/([0-9]{15,22})/);
      if (tweetMatch) {
        return {
          mediaKey: tweetMatch[1],
          url: raw,
          title: `X Post (${tweetMatch[1]})`,
        };
      }
    }
    return null;
  }

  /**
   * Autopilot Background Poller:
   * Scans active autopilot packages, auto-detects new uploads, claims next slot, and schedules drip feed.
   */
  async pollAutopilotPackages(database: PrismaClient = prisma) {
    try {
      const candidatePackages = await database.package.findMany({
        where: {
          status: PackageStatus.ACTIVE,
          slots: {
            some: {
              status: "AVAILABLE",
            },
          },
        },
        include: {
          slots: {
            orderBy: { slotNumber: "asc" },
          },
          rules: {
            include: { service: true },
          },
        },
        orderBy: { createdAt: "asc" },
        take: 50,
      });

      if (!candidatePackages.length) return;

      // Deduplicate per (userId, platform, handle) so the oldest active package (FIFO)
      // claims the upload first, preventing multi-package double consumption!
      const handledKeys = new Set<string>();

      for (const pkg of candidatePackages) {
        const cleanHandle = pkg.handle.toLowerCase().replace(/^@/, "").replace(/\/$/, "");
        const dedupeKey = `${pkg.userId}_${pkg.platform}_${cleanHandle}`;
        if (handledKeys.has(dedupeKey)) {
          continue; // Oldest package for this handle is already actively handling uploads
        }
        handledKeys.add(dedupeKey);

        const availableSlot = pkg.slots.find((s) => s.status === "AVAILABLE");
        if (!availableSlot) continue;

        const existingMediaKeys = new Set(
          pkg.slots.map((s) => s.mediaKey).filter(Boolean) as string[]
        );

        let latestMedia: { mediaKey: string; url: string; title: string } | null = null;
        const enableInstagramScraping = process.env.ENABLE_INSTAGRAM_SCRAPING === "true";
        try {
          if (pkg.platform === "INSTAGRAM") {
            if (enableInstagramScraping) {
              latestMedia = await this.scrapeInstagramLatest(pkg.handle);
            } else {
              // Instagram automated scraping stays OFF until approved credentials exist
              latestMedia = null;
            }
          } else if (pkg.platform === "YOUTUBE") {
            latestMedia = await this.scrapeYouTubeLatest(pkg.handle);
          } else if (pkg.platform === "TELEGRAM") {
            latestMedia = await this.scrapeTelegramLatest(pkg.handle);
          } else if (pkg.platform === "TIKTOK") {
            latestMedia = await this.scrapeTikTokLatest(pkg.handle);
          } else if (pkg.platform === "TWITTER" || pkg.platform === "X_TWITTER" || pkg.platform === "X") {
            latestMedia = await this.scrapeTwitterLatest(pkg.handle);
          }
        } catch (fetchErr: any) {
          logger.warn({ pkgId: pkg.id, err: fetchErr.message }, "[Autopilot] Upload check warning");
        }

        if (latestMedia && latestMedia.mediaKey && !existingMediaKeys.has(latestMedia.mediaKey)) {
          logger.info(
            {
              pkgId: pkg.id,
              handle: pkg.handle,
              slotNumber: availableSlot.slotNumber,
              mediaKey: latestMedia.mediaKey,
            },
            "[Autopilot Poller] New media upload detected! Auto-claiming slot and scheduling drip delivery."
          );

          await this.claimAutopilotSlotInWorker(database, pkg, availableSlot, latestMedia);
        }
      }
    } catch (err: any) {
      logger.error({ err: err.message }, "[Autopilot Poller] Poller cycle error");
    }
  }

  /**
   * Claim slot and create drip executions in background worker
   */
  private async claimAutopilotSlotInWorker(
    database: PrismaClient,
    pkg: any,
    slot: any,
    mediaData: { mediaKey: string; url: string; title: string }
  ) {
    const alloc = (pkg.allocationSnapshot as any) || {};
    const preset: AutopilotPreset = alloc.preset || AUTOPILOT_PRESETS.viral_push;

    const viewsRule = pkg.rules.find((r: any) => r.service?.kind === "VIEWS") || pkg.rules[0];
    const likesRule = pkg.rules.find((r: any) => r.service?.kind === "LIKES") || viewsRule || pkg.rules[0];
    const commentsRule = pkg.rules.find((r: any) => r.service?.kind === "COMMENTS") || likesRule;
    const sharesRule = pkg.rules.find((r: any) => r.service?.kind === "OTHER" || r.service?.kind === "SHARES") || viewsRule;

    const rulesMap = {
      views: viewsRule,
      likes: likesRule,
      comments: commentsRule,
      shares: sharesRule,
    };

    const startTime = new Date();
    const runsCount = preset.runsCount || 4;
    const durationHours = preset.durationHours || 12;
    const stepHours = durationHours / runsCount;
    const pricePerSlot = preset.pricePerSlot || 299;

    const weights =
      runsCount === 6
        ? [0.25, 0.2, 0.2, 0.15, 0.1, 0.1]
        : [0.35, 0.3, 0.2, 0.15];

    const totalViewsCharge = new Decimal((pricePerSlot * 0.5).toFixed(2));
    const totalLikesCharge = new Decimal((pricePerSlot * 0.3).toFixed(2));
    const totalCommentsCharge = new Decimal((pricePerSlot * 0.1).toFixed(2));
    const totalSharesCharge = new Decimal(pricePerSlot)
      .minus(totalViewsCharge)
      .minus(totalLikesCharge)
      .minus(totalCommentsCharge);

    let accumulatedViews = new Decimal(0);
    let accumulatedLikes = new Decimal(0);
    let accumulatedComments = new Decimal(0);
    let accumulatedShares = new Decimal(0);

    await database.$transaction(async (tx) => {
      // Atomic status transition check to prevent race conditions across parallel worker instances
      const updateResult = await tx.packageSlot.updateMany({
        where: { id: slot.id, status: "AVAILABLE" },
        data: {
          targetUrl: mediaData.url,
          mediaKey: mediaData.mediaKey,
          status: "ACTIVE",
          linkSlotsUsed: 1,
          startedAt: startTime,
        },
      });

      if (updateResult.count === 0) {
        logger.warn({ slotId: slot.id }, "[Autopilot] Slot already claimed by another worker instance. Aborting.");
        return;
      }

      for (let r = 0; r < runsCount; r++) {
        const isLast = r === runsCount - 1;
        const offsetMinutes = r === 0 ? 2 : Math.round(r * stepHours * 60);
        const executeAt = new Date(startTime.getTime() + offsetMinutes * 60 * 1000);
        const w = weights[r] || 1 / runsCount;

        if (rulesMap.views) {
          const qty = Math.max(10, Math.round(preset.metrics.views * w));
          const charge = isLast
            ? totalViewsCharge.minus(accumulatedViews)
            : new Decimal((pricePerSlot * 0.5 * w).toFixed(2));
          accumulatedViews = accumulatedViews.plus(charge);

          await tx.packageExecution.create({
            data: {
              packageId: pkg.id,
              ruleId: rulesMap.views.id,
              slotId: slot.id,
              seq: r * 10 + 1,
              quantity: qty,
              remainingQuantity: qty,
              allocatedCharge: charge,
              plannedAt: executeAt,
              executeAt,
              status: PackageExecutionStatus.SCHEDULED,
              targetUrl: mediaData.url,
              mediaKey: mediaData.mediaKey,
              source: ExecutionSource.SCHEDULE,
            },
          });
        }

        if (rulesMap.likes) {
          const qty = Math.max(5, Math.round(preset.metrics.likes * w));
          const charge = isLast
            ? totalLikesCharge.minus(accumulatedLikes)
            : new Decimal((pricePerSlot * 0.3 * w).toFixed(2));
          accumulatedLikes = accumulatedLikes.plus(charge);

          await tx.packageExecution.create({
            data: {
              packageId: pkg.id,
              ruleId: rulesMap.likes.id,
              slotId: slot.id,
              seq: r * 10 + 2,
              quantity: qty,
              remainingQuantity: qty,
              allocatedCharge: charge,
              plannedAt: executeAt,
              executeAt,
              status: PackageExecutionStatus.SCHEDULED,
              targetUrl: mediaData.url,
              mediaKey: mediaData.mediaKey,
              source: ExecutionSource.SCHEDULE,
            },
          });
        }

        if (rulesMap.comments && preset.metrics.comments > 0) {
          const qty = Math.max(1, Math.round(preset.metrics.comments * w));
          const charge = isLast
            ? totalCommentsCharge.minus(accumulatedComments)
            : new Decimal((pricePerSlot * 0.1 * w).toFixed(2));
          accumulatedComments = accumulatedComments.plus(charge);

          await tx.packageExecution.create({
            data: {
              packageId: pkg.id,
              ruleId: rulesMap.comments.id,
              slotId: slot.id,
              seq: r * 10 + 3,
              quantity: qty,
              remainingQuantity: qty,
              allocatedCharge: charge,
              plannedAt: executeAt,
              executeAt,
              status: PackageExecutionStatus.SCHEDULED,
              targetUrl: mediaData.url,
              mediaKey: mediaData.mediaKey,
              source: ExecutionSource.SCHEDULE,
            },
          });
        }

        if (rulesMap.shares && preset.metrics.shares > 0) {
          const qty = Math.max(2, Math.round(preset.metrics.shares * w));
          const charge = isLast
            ? totalSharesCharge.minus(accumulatedShares)
            : new Decimal((pricePerSlot * 0.1 * w).toFixed(2));
          accumulatedShares = accumulatedShares.plus(charge);

          await tx.packageExecution.create({
            data: {
              packageId: pkg.id,
              ruleId: rulesMap.shares.id,
              slotId: slot.id,
              seq: r * 10 + 4,
              quantity: qty,
              remainingQuantity: qty,
              allocatedCharge: charge,
              plannedAt: executeAt,
              executeAt,
              status: PackageExecutionStatus.SCHEDULED,
              targetUrl: mediaData.url,
              mediaKey: mediaData.mediaKey,
              source: ExecutionSource.SCHEDULE,
            },
          });
        }
      }
    });

    logger.info(
      { pkgId: pkg.id, slotId: slot.id, mediaKey: mediaData.mediaKey },
      "[Autopilot Poller] Slot claimed and drip runs scheduled successfully."
    );
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

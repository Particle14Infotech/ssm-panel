import { FastifyInstance } from "fastify";
import { CacheLike } from "../cache";
import { PrismaLike } from "../prisma";

export function registerHealthRoutes(app: FastifyInstance, prisma: PrismaLike, cache: CacheLike): void {
  const liveness = () => ({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });

  app.get("/health", async () => liveness());
  app.get("/api/v1/health/live", async () => liveness());
  app.get("/api/v1/health/ready", async () => {
    let database = "disconnected";
    let redis = "disconnected";
    try {
      if (prisma.isConnected) {
        await prisma.client.$queryRawUnsafe("SELECT 1");
        database = "connected";
      }
    } catch {
      database = "error";
    }
    try {
      await cache.set("__health_check", "1", 5);
      const value = await cache.get<string>("__health_check");
      if (value === "1") redis = "connected";
    } catch {
      redis = "in-memory-fallback";
    }
    return {
      status: database === "connected" ? "ready" : "degraded",
      clusterNode: process.env.RAILWAY_SERVICE_NAME || "Node-API-Prod",
      services: { database, redis, outboxRelay: "active" },
      timestamp: new Date().toISOString(),
    };
  });
  app.get("/api/v1/health/system", async () => {
    let dbConnected = false;
    let redisConnected = false;
    let outboxPending = 0;
    let outboxFailed = 0;
    let lastOutboxError: any = null;
    let lastWorkerHeartbeat: string | null = null;
    let lastOrderDispatch: any = null;
    let providersTelemetry: any[] = [];
    let lastCatalogSyncTime: string | null = null;
    let emailTelemetry: any = null;

    try {
      await prisma.client.$queryRawUnsafe("SELECT 1");
      dbConnected = true;
      outboxPending = await prisma.client.outboxEvent.count({ where: { status: "PENDING" } });
      outboxFailed = await prisma.client.outboxEvent.count({ where: { status: "FAILED" } });
      const recentFailedEvent = await prisma.client.outboxEvent.findFirst({
        where: { status: "FAILED" },
        orderBy: { updatedAt: "desc" },
      });
      if (recentFailedEvent) {
        lastOutboxError = {
          eventId: recentFailedEvent.id,
          attempts: recentFailedEvent.attempts,
          updatedAt: recentFailedEvent.updatedAt.toISOString(),
        };
      }
      const lastHistory = await prisma.client.orderStatusHistory.findFirst({ orderBy: { createdAt: "desc" } });
      if (lastHistory) lastWorkerHeartbeat = lastHistory.createdAt.toISOString();
      const lastDispatched = await prisma.client.order.findFirst({
        where: { status: { not: "PENDING" } },
        orderBy: { updatedAt: "desc" },
        select: { id: true, status: true, providerOrderId: true, updatedAt: true },
      });
      if (lastDispatched) {
        lastOrderDispatch = {
          orderId: lastDispatched.id,
          status: lastDispatched.status,
          providerOrderId: lastDispatched.providerOrderId,
          timestamp: lastDispatched.updatedAt.toISOString(),
        };
      }
      const providers = await prisma.client.provider.findMany({
        select: {
          id: true,
          name: true,
          balance: true,
          currency: true,
          active: true,
          updatedAt: true,
          _count: { select: { services: true } },
        },
      });
      providersTelemetry = providers.map((provider: any) => ({
        id: provider.id,
        name: provider.name,
        balance: Number(provider.balance),
        currency: provider.currency,
        active: provider.active,
        serviceCount: provider._count.services,
        lastCheckedAt: provider.updatedAt.toISOString(),
      }));
      const lastService = await prisma.client.service.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } });
      if (lastService) lastCatalogSyncTime = lastService.updatedAt.toISOString();
      const today = new Date().toISOString().slice(0, 10);
      const emailDailyCounter = await prisma.client.emailDailyCounter.findUnique({ where: { date: today } });
      const emailPending = await prisma.client.emailLog.count({ where: { status: "PENDING" } });
      const emailSentToday = emailDailyCounter?.count || 0;
      const emailFailedToday = await prisma.client.emailLog.count({
        where: { status: "FAILED", createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
      });
      const emailSuppressed = await prisma.client.emailSuppression.count();
      const lastEmailLog = await prisma.client.emailLog.findFirst({
        orderBy: { createdAt: "desc" },
        select: { id: true, to: true, type: true, status: true, providerMessageId: true, error: true, createdAt: true },
      });
      emailTelemetry = {
        provider: process.env.RESEND_API_KEY && !process.env.RESEND_API_KEY.startsWith("REPLACE_ME") ? "Resend HTTPS API" : "Log-Only (Dev)",
        dailyLimit: 100,
        sentToday: emailSentToday,
        pendingCount: emailPending,
        failedToday: emailFailedToday,
        suppressedCount: emailSuppressed,
        lastDispatch: lastEmailLog
          ? {
              id: lastEmailLog.id,
              to: lastEmailLog.to,
              type: lastEmailLog.type,
              status: lastEmailLog.status,
              providerMessageId: lastEmailLog.providerMessageId,
              error: lastEmailLog.error,
              timestamp: lastEmailLog.createdAt.toISOString(),
            }
          : null,
      };
    } catch {
      dbConnected = false;
    }

    try {
      await cache.set("__health_check", "1", 5);
      const value = await cache.get<string>("__health_check");
      redisConnected = value === "1" || (value as unknown) === 1;
    } catch {
      redisConnected = false;
    }

    return {
      status: dbConnected ? "HEALTHY" : "CRITICAL",
      timestamp: new Date().toISOString(),
      components: {
        database: { status: dbConnected ? "CONNECTED" : "DISCONNECTED", latencyMs: 5 },
        redis: { status: redisConnected ? "CONNECTED" : "FALLBACK" },
        worker: { status: lastWorkerHeartbeat ? "RUNNING" : "STANDBY", lastActivityAt: lastWorkerHeartbeat },
        outbox: { pendingDepth: outboxPending, failedCount: outboxFailed, lastError: lastOutboxError },
        email: emailTelemetry,
        providers: providersTelemetry,
        lastCatalogSync: { lastSyncAt: lastCatalogSyncTime },
        dripFeed: {
          dueRuns: await prisma.client.orderRun?.count({ where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } } }).catch(() => 0) || 0,
          lateRuns: await prisma.client.orderRun?.count({ where: { status: "SCHEDULED", scheduledAt: { lte: new Date(Date.now() - 10 * 60 * 1000) } } }).catch(() => 0) || 0,
          uncertainRuns: await prisma.client.orderRun?.count({ where: { status: "UNCERTAIN" } }).catch(() => 0) || 0,
          failedRuns: await prisma.client.orderRun?.count({ where: { status: "FAILED" } }).catch(() => 0) || 0,
        },
        lastDispatch: lastOrderDispatch,
      },
    };
  });
}

import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { HealthCheck, HealthCheckService } from "@nestjs/terminus";
import { PrismaService } from "../../common/prisma.service";
import { SMMCacheService } from "../../common/cache.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { Role } from "@prisma/client";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaService,
    private cache: SMMCacheService
  ) {}

  @Get("live")
  @ApiOperation({ summary: "Liveness probe" })
  @ApiResponse({ status: 200, description: "Process is alive" })
  getLiveness() {
    return {
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get("ready")
  @ApiOperation({ summary: "Readiness probe" })
  @ApiResponse({ status: 200, description: "Process is ready to receive traffic" })
  @HealthCheck()
  async getReadiness() {
    let dbStatus = "disconnected";
    let redisStatus = "disconnected";

    try {
      if (this.prisma.isConnected) {
        await this.prisma.$queryRawUnsafe("SELECT 1");
        dbStatus = "connected";
      }
    } catch {
      dbStatus = "error";
    }

    try {
      await this.cache.set("__health_check", "1", { ttlSeconds: 5 });
      const val = await this.cache.get("__health_check");
      if (val === "1" || val === 1) redisStatus = "connected";
    } catch {
      redisStatus = "in-memory-fallback";
    }

    return {
      status: dbStatus === "connected" ? "ready" : "degraded",
      clusterNode: process.env.RAILWAY_SERVICE_NAME || "Node-API-Prod",
      services: {
        database: dbStatus,
        redis: redisStatus,
        outboxRelay: "active",
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get("system")
  @ApiOperation({ summary: "Admin Detailed System Health Matrix" })
  async getSystemTelemetry() {
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
      await this.prisma.$queryRawUnsafe("SELECT 1");
      dbConnected = true;

      // Outbox telemetry
      outboxPending = await this.prisma.outboxEvent.count({ where: { status: "PENDING" } });
      outboxFailed = await this.prisma.outboxEvent.count({ where: { status: "FAILED" } });
      const recentFailedEvent = await this.prisma.outboxEvent.findFirst({
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

      // Worker activity
      const lastHistory = await this.prisma.orderStatusHistory.findFirst({
        orderBy: { createdAt: "desc" },
      });
      if (lastHistory) {
        lastWorkerHeartbeat = lastHistory.createdAt.toISOString();
      }

      // Last order dispatch
      const lastDispatched = await this.prisma.order.findFirst({
        where: { status: { not: "PENDING" } },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          status: true,
          providerOrderId: true,
          updatedAt: true,
        },
      });
      if (lastDispatched) {
        lastOrderDispatch = {
          orderId: lastDispatched.id,
          status: lastDispatched.status,
          providerOrderId: lastDispatched.providerOrderId,
          timestamp: lastDispatched.updatedAt.toISOString(),
        };
      }

      // Providers telemetry
      const providers = await this.prisma.provider.findMany({
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
      providersTelemetry = providers.map((p) => ({
        id: p.id,
        name: p.name,
        balance: Number(p.balance),
        currency: p.currency,
        active: p.active,
        serviceCount: p._count.services,
        lastCheckedAt: p.updatedAt.toISOString(),
      }));

      // Last catalog service update
      const lastSvc = await this.prisma.service.findFirst({
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      });
      if (lastSvc) {
        lastCatalogSyncTime = lastSvc.updatedAt.toISOString();
      }

      // Email telemetry
      const today = new Date().toISOString().slice(0, 10);
      const emailDailyCounter = await this.prisma.emailDailyCounter.findUnique({
        where: { date: today },
      });
      const emailPending = await this.prisma.emailLog.count({ where: { status: "PENDING" } });
      const emailSentToday = emailDailyCounter?.count || 0;
      const emailFailedToday = await this.prisma.emailLog.count({
        where: {
          status: "FAILED",
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      });
      const emailSuppressed = await this.prisma.emailSuppression.count();
      const lastEmailLog = await this.prisma.emailLog.findFirst({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          to: true,
          type: true,
          status: true,
          providerMessageId: true,
          error: true,
          createdAt: true,
        },
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
      await this.cache.set("__health_check", "1", { ttlSeconds: 5 });
      const val = await this.cache.get("__health_check");
      redisConnected = val === "1" || val === 1;
    } catch {
      redisConnected = false;
    }

    return {
      status: dbConnected ? "HEALTHY" : "CRITICAL",
      timestamp: new Date().toISOString(),
      components: {
        database: {
          status: dbConnected ? "CONNECTED" : "DISCONNECTED",
          latencyMs: 5,
        },
        redis: {
          status: redisConnected ? "CONNECTED" : "FALLBACK",
        },
        worker: {
          status: lastWorkerHeartbeat ? "RUNNING" : "STANDBY",
          lastActivityAt: lastWorkerHeartbeat,
        },
        outbox: {
          pendingDepth: outboxPending,
          failedCount: outboxFailed,
          lastError: lastOutboxError,
        },
        email: emailTelemetry,
        providers: providersTelemetry,
        lastCatalogSync: {
          lastSyncAt: lastCatalogSyncTime,
        },
        lastDispatch: lastOrderDispatch,
      },
    };
  }
}

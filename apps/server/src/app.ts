import { randomBytes } from "node:crypto";
import Fastify, { FastifyInstance } from "fastify";
import { registerAuth } from "./auth";
import { Cache, CacheLike } from "./cache";
import { ApiError, statusCodeToCode, zodDetails } from "./errors";
import { PrismaConnection, PrismaLike } from "./prisma";
import { registerRateLimit } from "./rate-limit";
import { registerHealthRoutes } from "./routes/health";
import { registerCatalogRoutes } from "./routes/catalog";
import { registerServicesRoutes } from "./routes/services";
import { registerPlatformsRoutes } from "./routes/platforms";
import { registerUsersRoutes } from "./routes/users";
import { registerSettingsRoutes } from "./routes/settings";
import { ServicesService } from "./services/services.service";
import { PlatformsService } from "./services/platforms.service";
import { UsersService } from "./services/users.service";
import { SettingsService } from "./services/settings.service";
import { ZodError } from "zod";

export interface ServerDependencies {
  cache?: CacheLike;
  prisma?: PrismaLike;
}

export async function buildServer(dependencies: ServerDependencies = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie", "req.headers.x-api-key", "password", "passwordHash", "refreshToken", "apiKey", "secret", "twoFactorSecret", "token"],
        censor: "[REDACTED_PII]",
      },
    },
    trustProxy: true,
    requestIdHeader: "x-request-id",
    genReqId: (request) => {
      const header = request.headers["x-request-id"];
      return typeof header === "string" && header.trim() ? header : `req_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
    },
  });
  const cache = dependencies.cache ?? new Cache();
  const prisma = dependencies.prisma ?? new PrismaConnection();

  app.addHook("onRequest", async (request, reply) => {
    reply.header("X-Request-Id", request.id);
    reply.header("X-Frame-Options", "DENY");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    const origin = request.headers.origin;
    if (origin) {
      reply.header("Access-Control-Allow-Origin", origin);
      reply.header("Access-Control-Allow-Credentials", "true");
      reply.header("Vary", "Origin");
    }
  });
  app.options("*", async (_request, reply) => reply.status(204).send());
  app.setErrorHandler((error, request, reply) => {
    const fastifyError = error as { statusCode?: number; message?: string };
    const statusCode = error instanceof ApiError ? error.statusCode : fastifyError.statusCode && fastifyError.statusCode < 500 ? fastifyError.statusCode : 500;
    const code = error instanceof ApiError ? error.code : statusCodeToCode(statusCode);
    const details = error instanceof ApiError ? error.details : error instanceof ZodError ? zodDetails(error) : undefined;
    const message = error instanceof ApiError
      ? error.message
      : error instanceof ZodError
        ? error.issues.map((issue) => issue.message).join(", ")
        : statusCode === 500 && process.env.NODE_ENV === "production"
          ? "Internal server error"
          : fastifyError.message || "An internal server error occurred.";
    if (statusCode >= 500) request.log.error({ err: error }, "Unhandled exception");
    return reply.status(statusCode).send({ code, message, details, requestId: request.id, timestamp: new Date().toISOString(), path: request.url });
  });

  registerAuth(app);
  registerRateLimit(app, cache);
  registerHealthRoutes(app, prisma, cache);

  const servicesService = new ServicesService(prisma);
  registerCatalogRoutes(app, servicesService);
  registerServicesRoutes(app, servicesService);

  const platformsService = new PlatformsService(prisma);
  registerPlatformsRoutes(app, platformsService);

  const usersService = new UsersService(prisma);
  registerUsersRoutes(app, usersService);

  const settingsService = new SettingsService();
  registerSettingsRoutes(app, settingsService);

  app.get("/", async () => ({ status: "ok", service: "smm-server", uptime: process.uptime(), timestamp: new Date().toISOString() }));

  app.addHook("onReady", async () => prisma.connect?.());
  app.addHook("onClose", async () => {
    await cache.close?.();
    await prisma.disconnect?.();
  });
  return app;
}

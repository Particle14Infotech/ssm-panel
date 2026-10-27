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
import { registerNotificationsRoutes } from "./routes/notifications";
import { registerTicketsRoutes } from "./routes/tickets";
import { registerFavoritesRoutes } from "./routes/favorites";
import { registerAuthRoutes } from "./routes/auth";
import { registerResellerRoutes } from "./routes/reseller";
import { registerProvidersRoutes } from "./routes/providers";
import { registerOrdersRoutes } from "./routes/orders";
import { registerPackagesRoutes, PackagesServiceLike } from "./routes/packages";
import { registerWalletRoutes } from "./routes/wallet";
import { registerPaymentsRoutes } from "./routes/payments";
import { registerPricingRoutes } from "./routes/pricing";
import { registerCouponsRoutes } from "./routes/coupons";
import { registerAnnouncementsRoutes } from "./routes/announcements";
import { registerReportsRoutes } from "./routes/reports";
import { registerEmailRoutes } from "./routes/email";
import { ServicesService } from "./services/services.service";
import { PlatformsService } from "./services/platforms.service";
import { UsersService } from "./services/users.service";
import { SettingsService } from "./services/settings.service";
import { NotificationsService } from "./services/notifications.service";
import { TicketsService } from "./services/tickets.service";
import { FavoritesService } from "./services/favorites.service";
import { AuthService } from "./services/auth.service";
import { ResellerService } from "./services/reseller.service";
import { ProvidersService } from "./services/providers.service";
import { OrdersService } from "./services/orders.service";
import { PackagesService } from "./services/packages.service";
import { PackagesQuoteService } from "./services/packages-quote.service";
import { WalletService } from "./services/wallet.service";
import { PaymentsService } from "./services/payments.service";
import { PricingService } from "./services/pricing.service";
import { CouponsService } from "./services/coupons.service";
import { AnnouncementsService } from "./services/announcements.service";
import { ReportsService } from "./services/reports.service";
import { EmailService } from "./services/email.service";
import { SmmProviderClient } from "./services/smm-provider.client";
import { ZodError } from "zod";

export interface ServerDependencies {
  cache?: CacheLike;
  prisma?: PrismaLike;
  smmClient?: SmmProviderClient;
  packagesService?: PackagesServiceLike;
  walletService?: WalletService;
  paymentsService?: PaymentsService;
  onRoute?: (routeOptions: any) => void;
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
  if (dependencies.onRoute) {
    app.addHook("onRoute", dependencies.onRoute);
  }
  const cache = dependencies.cache ?? new Cache();
  const prisma = dependencies.prisma ?? new PrismaConnection();
  if (prisma.connect && !prisma.isConnected) {
    await prisma.connect();
  }

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
    let statusCode = 500;
    let code = "INTERNAL_SERVER_ERROR";
    let message = "An internal server error occurred.";
    let details: unknown = undefined;

    if (error instanceof ApiError) {
      statusCode = error.statusCode;
      code = error.code;
      message = error.message;
      details = error.details;
    } else if (error instanceof ZodError) {
      statusCode = 400;
      code = "BAD_REQUEST";
      message = error.issues.map((i) => i.message).join(", ");
      details = zodDetails(error);
    } else if (typeof (error as any)?.getStatus === "function") {
      statusCode = (error as any).getStatus();
      const res = (error as any).getResponse?.();
      if (typeof res === "string") {
        message = res;
        code = statusCodeToCode(statusCode);
      } else if (res && typeof res === "object") {
        message = (res as any).message || error.message;
        code = (res as any).code || statusCodeToCode(statusCode);
        details = (res as any).details || (Array.isArray((res as any).message) ? (res as any).message : undefined);
      } else {
        message = error.message;
        code = statusCodeToCode(statusCode);
      }
    } else {
      const fastifyError = error as { statusCode?: number; message?: string };
      statusCode = fastifyError.statusCode && fastifyError.statusCode < 500 ? fastifyError.statusCode : 500;
      code = statusCodeToCode(statusCode);
      message =
        statusCode === 500 && process.env.NODE_ENV === "production"
          ? "Internal server error"
          : fastifyError.message || message;
    }

    if (statusCode >= 500) request.log.error({ err: error }, "Unhandled exception");
    return reply.status(statusCode).send({
      code,
      message: Array.isArray(message) ? message.join(", ") : message,
      details,
      requestId: request.id,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
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

  const notificationsService = new NotificationsService();
  registerNotificationsRoutes(app, notificationsService);

  const ticketsService = new TicketsService(prisma);
  registerTicketsRoutes(app, ticketsService);

  const favoritesService = new FavoritesService(prisma);
  registerFavoritesRoutes(app, favoritesService);

  const authService = new AuthService(prisma);
  registerAuthRoutes(app, authService);

  const resellerService = new ResellerService(prisma, servicesService);
  registerResellerRoutes(app, resellerService, prisma);

  const providersService = new ProvidersService(prisma, dependencies.smmClient);
  registerProvidersRoutes(app, providersService);

  const ordersService = new OrdersService(prisma);
  registerOrdersRoutes(app, ordersService);

  const packagesQuoteService = new PackagesQuoteService(prisma, platformsService);
  const packagesService = dependencies.packagesService ?? new PackagesService(prisma, packagesQuoteService, platformsService, cache);
  registerPackagesRoutes(app, packagesService);

  const walletService = dependencies.walletService ?? new WalletService(prisma);
  registerWalletRoutes(app, walletService);

  const paymentsService = dependencies.paymentsService ?? new PaymentsService(prisma, walletService);
  registerPaymentsRoutes(app, paymentsService);

  const pricingService = new PricingService(prisma);
  registerPricingRoutes(app, pricingService);

  const couponsService = new CouponsService();
  registerCouponsRoutes(app, couponsService);

  const announcementsService = new AnnouncementsService();
  registerAnnouncementsRoutes(app, announcementsService);

  const reportsService = new ReportsService(prisma);
  registerReportsRoutes(app, reportsService);

  const emailService = new EmailService(prisma);
  registerEmailRoutes(app, emailService);

  app.get("/", async () => ({ status: "ok", service: "smm-server", uptime: process.uptime(), timestamp: new Date().toISOString() }));

  app.addHook("onReady", async () => prisma.connect?.());
  app.addHook("onClose", async () => {
    await cache.close?.();
    await prisma.disconnect?.();
  });
  return app;
}

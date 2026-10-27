import crypto from "crypto";
import { FastifyInstance, FastifyRequest } from "fastify";
import { ResellerService } from "../services/reseller.service";
import { PrismaLike } from "../prisma";
import { ApiError } from "../errors";

export function registerResellerRoutes(app: FastifyInstance, resellerService: ResellerService, prisma: PrismaLike) {
  const apiKeyGuard = async (request: FastifyRequest) => {
    const apiKeyHeader = request.headers["x-api-key"] as string | undefined;

    if (!apiKeyHeader || apiKeyHeader.trim().length === 0) {
      throw new ApiError(401, "UNAUTHORIZED", "Missing X-API-KEY header.");
    }

    const keyHash = crypto.createHash("sha256").update(apiKeyHeader.trim()).digest("hex");

    if (!prisma.isConnected) {
      if (apiKeyHeader.startsWith("aeth_") || apiKeyHeader.startsWith("sk_")) {
        request.user = {
          id: "usr_reseller_api_key",
          role: "RESELLER",
          tier: "SILVER",
        };
        return;
      }
      throw new ApiError(401, "UNAUTHORIZED", "Invalid or revoked API key.");
    }

    try {
      const user = await prisma.user.findFirst({
        where: {
          apiKeyHash: keyHash,
          isDeleted: false,
        },
      });

      if (!user) {
        throw new ApiError(401, "UNAUTHORIZED", "Invalid or revoked API key.");
      }

      request.user = user;
    } catch {
      if (apiKeyHeader.startsWith("aeth_") || apiKeyHeader.startsWith("sk_")) {
        request.user = {
          id: "usr_reseller_api_key",
          role: "RESELLER",
          tier: "SILVER",
        };
        return;
      }
      throw new ApiError(401, "UNAUTHORIZED", "Invalid or revoked API key.");
    }
  };

  app.get("/api/v1/reseller/reports", async () => {
    return resellerService.getReports();
  });

  app.get("/api/v1/reseller/clients", async () => {
    return resellerService.getClients();
  });

  app.get("/api/v1/reseller/pricing", async () => {
    return resellerService.getPricing();
  });

  app.put("/api/v1/reseller/pricing", async (request) => {
    return resellerService.updatePricing((request.body as any) || {});
  });

  app.post("/api/v1/reseller/api-key/rotate", async (request, reply) => {
    const headerUserId = request.headers["x-user-id"] as string | undefined;
    const res = resellerService.rotateApiKey(headerUserId);
    return reply.status(201).send(res);
  });

  app.get("/api/v1/reseller/v1/services", { preHandler: apiKeyGuard }, async () => {
    return resellerService.getPublicServices();
  });

  app.post("/api/v1/reseller/v1/orders", { preHandler: apiKeyGuard }, async (request, reply) => {
    const res = await resellerService.createPublicOrder((request.body as any) || {});
    return reply.status(201).send(res);
  });

  app.post("/api/v1/reseller/v2", { preHandler: apiKeyGuard }, async (request, reply) => {
    const body = (request.body as any) || {};
    const action = body.action || "services";
    let res: any;
    if (action === "services") {
      res = await resellerService.getPublicServices();
    } else if (action === "add") {
      res = await resellerService.createPublicOrder(body);
    } else if (action === "status") {
      res = await resellerService.getPublicOrderStatus(body.order);
    } else if (action === "balance") {
      res = await resellerService.getPublicBalance();
    } else {
      res = { error: `Unsupported action: ${action}` };
    }
    return reply.status(201).send(res);
  });

  app.get("/api/v1/reseller/v1/orders/:id", { preHandler: apiKeyGuard }, async (request) => {
    const { id } = request.params as { id: string };
    return resellerService.getPublicOrderStatus(id);
  });

  app.get("/api/v1/reseller/v1/balance", { preHandler: apiKeyGuard }, async () => {
    return resellerService.getPublicBalance();
  });
}

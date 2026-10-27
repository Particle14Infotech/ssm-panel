import { FastifyInstance, FastifyRequest } from "fastify";
import { WalletService } from "../services/wallet.service";
import { ApiError } from "../errors";
import { Decimal } from "decimal.js";

export function registerWalletRoutes(app: FastifyInstance, walletService: WalletService) {
  app.get("/api/v1/wallet/balance", { preHandler: app.authenticate }, async (request) => {
    const user = request.user!;
    const query = (request.query as any) || {};
    const queryUserId = query.userId as string | undefined;

    const targetUserId =
      user.role === "ADMIN" && queryUserId
        ? queryUserId
        : (user.sub || user.id || queryUserId || "none");

    const tier = (user as any).tier || "PRO_SCALE";

    try {
      const live = await walletService.getBalance(targetUserId);
      return {
        ...live,
        tier: tier || "PRO_SCALE",
        threshold: 500.0,
        autoRefill: false,
      };
    } catch {
      return {
        userId: targetUserId,
        balance: 0,
        currency: "INR",
        tier: tier || "PRO_SCALE",
        threshold: 500.0,
        autoRefill: false,
      };
    }
  });

  app.get("/api/v1/wallet/ledger", { preHandler: app.authenticate }, async (request) => {
    const user = request.user!;
    const query = (request.query as any) || {};
    const queryUserId = query.userId as string | undefined;

    const targetUserId =
      user.role === "ADMIN" && queryUserId
        ? queryUserId
        : (user.sub || user.id || queryUserId || "none");

    return walletService.getLedger(targetUserId);
  });

  app.post("/api/v1/wallet/adjust", { preHandler: [app.authenticate, app.authorize("ADMIN")] }, async (request, reply) => {
    const body = (request.body as any) || {};
    if (!body.userId) {
      throw new ApiError(400, "BAD_REQUEST", "Target userId is required.");
    }
    if (!body.reason || body.reason.trim().length === 0) {
      throw new ApiError(400, "BAD_REQUEST", "A valid non-empty reason is mandatory for administrative balance adjustments.");
    }

    const res = await walletService.adjustBalance(body.userId, new Decimal(body.amount), body.reason);
    return reply.status(201).send(res);
  });

  app.post("/api/v1/wallet/deposit", { preHandler: app.authenticate }, async (request, reply) => {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(404, "NOT_FOUND", "POST /wallet/deposit is disabled in production. Use /payments/initiate with verified webhooks.");
    }

    const user = request.user!;
    const body = (request.body as any) || {};
    const amount = Number(body.amount || 0);
    const method = body.method || "UPI";

    let bonus = 0;
    if (amount >= 5000) bonus = amount * 0.15;
    else if (amount >= 1000) bonus = amount * 0.1;
    else if (amount >= 500) bonus = amount * 0.05;

    const res = {
      success: true,
      depositId: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      userId: user.sub || user.id || body.userId || "usr_default_demo",
      amount,
      bonus,
      creditedTotal: amount + bonus,
      method,
      status: "SUCCESS",
      referenceId: `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      timestamp: new Date().toISOString(),
    };

    return reply.status(201).send(res);
  });
}

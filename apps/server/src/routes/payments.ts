import { FastifyInstance } from "fastify";
import { PaymentsService } from "../services/payments.service";
import { ApiError } from "../errors";

export function registerPaymentsRoutes(app: FastifyInstance, paymentsService: PaymentsService) {
  app.post("/api/v1/payments/create-order", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.user!;
    const body = (request.body as any) || {};
    const effectiveUserId = user.sub || user.id;
    if (!effectiveUserId) {
      throw new ApiError(400, "BAD_REQUEST", "Authenticated user ID is required.");
    }
    const res = await paymentsService.createPaymentOrder({
      userId: effectiveUserId,
      amount: body.amount,
      idempotencyKey: body.idempotencyKey,
    });
    return reply.status(201).send(res);
  });

  app.post("/api/v1/payments/initiate", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.user!;
    const body = (request.body as any) || {};
    const effectiveUserId = user.sub || user.id || body.userId;
    if (!effectiveUserId) {
      throw new ApiError(400, "BAD_REQUEST", "Authenticated user ID is required.");
    }
    const res = await paymentsService.createPaymentOrder({
      userId: effectiveUserId,
      amount: body.amount,
    });
    return reply.status(201).send(res);
  });

  app.post("/api/v1/payments/verify", { preHandler: app.authenticate }, async (request, reply) => {
    const user = request.user!;
    const body = (request.body as any) || {};
    const effectiveUserId = user.sub || user.id;
    if (!effectiveUserId) {
      throw new ApiError(400, "BAD_REQUEST", "Authenticated user ID is required.");
    }
    const res = await paymentsService.verifyPayment({
      ...body,
      userId: effectiveUserId,
    });
    return reply.status(201).send(res);
  });

  app.post("/api/v1/payments/webhook", async (request, reply) => {
    const razorpaySignature = request.headers["x-razorpay-signature"] as string | undefined;
    const genericSignature = request.headers["x-webhook-signature"] as string | undefined;
    const payload = (request.body as any) || {};
    const signature = razorpaySignature || genericSignature || payload?.signature;
    const rawBody = (request as any).rawBody as Buffer | undefined;

    const res = await paymentsService.handleWebhook(signature, payload, rawBody);
    return reply.status(201).send(res);
  });

  app.post("/api/v1/payments/sandbox-complete", async (request, reply) => {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(404, "NOT_FOUND", "Sandbox completion endpoint is disabled in production.");
    }
    const body = (request.body as any) || {};
    const res = await paymentsService.sandboxComplete(body.gatewayOrderId);
    return reply.status(201).send(res);
  });

  app.get("/api/v1/payments", { preHandler: app.authenticate }, async (request) => {
    const user = request.user!;
    const query = (request.query as any) || {};
    const queryUserId = query.userId as string | undefined;

    const effectiveUserId = user.sub || user.id || queryUserId;
    const role = user.role;
    return paymentsService.findAll(effectiveUserId, role);
  });
}

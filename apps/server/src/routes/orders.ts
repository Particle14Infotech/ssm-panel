import { FastifyInstance, FastifyRequest } from "fastify";
import { OrdersService, PackageProviderReconciliationInputSchema } from "../services/orders.service";
import { ApiError } from "../errors";

export function registerOrdersRoutes(app: FastifyInstance, ordersService: OrdersService) {
  const authGuard = async (request: FastifyRequest) => {
    await app.authenticate(request);
  };

  const adminGuard = app.authorize("ADMIN");

  app.get("/api/v1/orders", { preHandler: authGuard }, async (request) => {
    const user = request.user!;
    const query = (request.query as any) || {};
    const targetUserId = user.role === "ADMIN" ? (query.userId || undefined) : (user.sub || user.id);

    return ordersService.findAll(targetUserId, user.role, {
      status: query.status,
      query: query.q,
      startDate: query.startDate,
      endDate: query.endDate,
      dripFeedOnly: query.dripFeedOnly === "true" || query.dripFeedOnly === "1",
    });
  });

  app.get("/api/v1/orders/:id", { preHandler: authGuard }, async (request) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const order = await ordersService.findOne(id, user.sub || user.id, user.role);
    if (!order) throw new ApiError(404, "NOT_FOUND", `Order #${id} not found.`);
    return order;
  });

  app.post("/api/v1/orders/:id/report-problem", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const res = await ordersService.reportProblem(user.sub || user.id || "", id, (request.body as any) || {});
    return reply.status(201).send(res);
  });

  app.post("/api/v1/orders", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const body = (request.body as any) || {};
    const res = await ordersService.create({
      ...body,
      userId: user.sub || user.id,
      requesterRole: user.role,
    });
    return reply.status(201).send(res);
  });

  app.post("/api/v1/orders/create", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const body = (request.body as any) || {};
    const res = await ordersService.create({
      ...body,
      userId: user.sub || user.id,
      requesterRole: user.role,
    });
    return reply.status(201).send(res);
  });

  app.post("/api/v1/orders/:id/refill", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const res = await ordersService.refill(id, user.sub || user.id, user.role);
    return reply.status(201).send(res);
  });

  app.post("/api/v1/orders/:id/cancel", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const res = await ordersService.cancel(id, user.sub || user.id, user.role);
    return reply.status(201).send(res);
  });

  app.put("/api/v1/orders/:id/status", { preHandler: adminGuard }, async (request) => {
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    return ordersService.updateStatus(id, body.status);
  });

  app.post("/api/v1/orders/:id/refund", { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    const res = await ordersService.adminRefund(id, body.amount);
    return reply.status(201).send(res);
  });

  app.post("/api/v1/orders/:id/retry", { preHandler: adminGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const res = await ordersService.retry(id, user.sub || user.id || "");
    return reply.status(201).send(res);
  });

  app.post("/api/v1/orders/:id/package-provider-reconciliation", { preHandler: adminGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const parsed = PackageProviderReconciliationInputSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ApiError(400, "BAD_REQUEST", parsed.error.errors[0]?.message || "Invalid reconciliation details.");
    }
    const res = await ordersService.reconcilePackageProviderOutcome(id, user.sub || user.id || "", parsed.data);
    return reply.status(201).send(res);
  });

  app.put("/api/v1/orders/:id/provider", { preHandler: adminGuard }, async (request) => {
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    return ordersService.changeProvider(id, body.providerId);
  });

  app.put("/api/v1/orders/:id/notes", { preHandler: adminGuard }, async (request) => {
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    return ordersService.updateNotes(id, body.notes);
  });
}

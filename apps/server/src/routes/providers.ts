import { FastifyInstance } from "fastify";
import { ProvidersService } from "../services/providers.service";

export function registerProvidersRoutes(app: FastifyInstance, providersService: ProvidersService) {
  const adminGuard = app.authorize("ADMIN");

  app.get("/api/v1/providers", { preHandler: adminGuard }, async () => {
    return providersService.findAll();
  });

  app.post("/api/v1/providers", { preHandler: adminGuard }, async (request, reply) => {
    const res = await providersService.create((request.body as any) || {});
    return reply.status(201).send(res);
  });

  app.post("/api/v1/providers/create", { preHandler: adminGuard }, async (request, reply) => {
    const res = await providersService.create((request.body as any) || {});
    return reply.status(201).send(res);
  });

  app.get("/api/v1/providers/:id", { preHandler: adminGuard }, async (request) => {
    const { id } = request.params as { id: string };
    return providersService.findOne(id);
  });

  app.put("/api/v1/providers/:id", { preHandler: adminGuard }, async (request) => {
    const { id } = request.params as { id: string };
    return providersService.update(id, (request.body as any) || {});
  });

  app.delete("/api/v1/providers/:id", { preHandler: adminGuard }, async (request) => {
    const { id } = request.params as { id: string };
    return providersService.remove(id);
  });

  app.get("/api/v1/providers/:id/balance", { preHandler: adminGuard }, async (request) => {
    const { id } = request.params as { id: string };
    return providersService.getBalance(id);
  });

  app.post("/api/v1/providers/:id/sync", { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const res = await providersService.sync(id);
    return reply.status(201).send(res);
  });

  app.post("/api/v1/providers/:id/import", { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const res = await providersService.importServices(id, (request.body as any) || {});
    return reply.status(201).send(res);
  });

  app.put("/api/v1/providers/services/:serviceId/managed-drip", { preHandler: adminGuard }, async (request) => {
    const { serviceId } = request.params as { serviceId: string };
    const body = (request.body as any) || {};
    return providersService.setAllowManagedDrip(serviceId, Boolean(body.allow));
  });

  app.put("/api/v1/providers/categories/:categoryId/managed-drip", { preHandler: adminGuard }, async (request) => {
    const { categoryId } = request.params as { categoryId: string };
    const body = (request.body as any) || {};
    return providersService.bulkSetAllowManagedDripByCategory(categoryId, Boolean(body.allow));
  });
}

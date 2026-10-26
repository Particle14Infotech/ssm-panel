import { FastifyInstance } from "fastify";
import { ApiError } from "../errors";
import { ServicesService } from "../services/services.service";

export function registerServicesRoutes(app: FastifyInstance, servicesService: ServicesService): void {
  app.get("/api/v1/services/platforms", async () => {
    return servicesService.getPlatforms();
  });

  app.get("/api/v1/services/categories", async () => {
    return servicesService.getCategories();
  });

  app.get("/api/v1/services/grouped", async (request) => {
    const query = request.query as { platform?: string };
    return servicesService.getGroupedCatalog(query.platform);
  });

  app.post("/api/v1/services/categories", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request, reply) => {
    const body = request.body as { name: string; slug?: string };
    const result = await servicesService.createCategory(body);
    return reply.status(201).send(result);
  });

  app.get("/api/v1/services", async (request) => {
    const query = request.query as {
      platform?: string;
      q?: string;
      categoryId?: string;
      sortBy?: string;
      packageEligible?: string;
    };
    return servicesService.findAll(query.platform, query.q, query.categoryId, query.sortBy, query.packageEligible);
  });

  app.get("/api/v1/services/:id", async (request) => {
    const params = request.params as { id: string };
    const service = await servicesService.findOne(params.id);
    return service;
  });

  app.post("/api/v1/services", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request, reply) => {
    const body = request.body as any;
    const result = await servicesService.create(body);
    return reply.status(201).send(result);
  });

  app.put("/api/v1/services/:id", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request) => {
    const params = request.params as { id: string };
    const body = request.body as any;
    const res = await servicesService.update(params.id, body);
    if (!res) {
      throw new ApiError(404, "NOT_FOUND", `Service #${params.id} not found.`);
    }
    return res;
  });

  app.delete("/api/v1/services/:id", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request) => {
    const params = request.params as { id: string };
    const deleted = await servicesService.remove(params.id);
    if (!deleted) {
      throw new ApiError(404, "NOT_FOUND", `Service #${params.id} not found.`);
    }
    return { success: true, message: `Service #${params.id} removed.` };
  });
}

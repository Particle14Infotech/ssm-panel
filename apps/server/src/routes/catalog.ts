import { FastifyInstance } from "fastify";
import { ServicesService } from "../services/services.service";

export function registerCatalogRoutes(app: FastifyInstance, servicesService: ServicesService): void {
  app.get("/api/v1/catalog/grouped", async (request) => {
    const query = request.query as { platform?: string };
    return servicesService.getGroupedCatalog(query.platform);
  });
}

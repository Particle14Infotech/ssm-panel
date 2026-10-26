import { FastifyInstance } from "fastify";
import { PlatformsService } from "../services/platforms.service";

export function registerPlatformsRoutes(app: FastifyInstance, platformsService: PlatformsService): void {
  // Public routes
  app.get("/api/v1/platforms", async () => {
    return platformsService.getPublicPlatforms();
  });

  app.get("/api/v1/platforms/:platform", async (request) => {
    const params = request.params as { platform: string };
    return platformsService.getPlatformConfig(params.platform);
  });

  // Admin routes
  app.get("/api/v1/admin/platforms", {
    preHandler: [app.authorize("ADMIN")],
  }, async () => {
    return platformsService.adminListPlatforms();
  });

  app.get("/api/v1/admin/platforms/blocklist", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request) => {
    const query = request.query as { platform?: string };
    return platformsService.adminListBlocklist(query.platform);
  });

  app.post("/api/v1/admin/platforms/blocklist", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request, reply) => {
    const body = request.body as { platform: string; handle: string; reason?: string };
    const result = await platformsService.adminAddBlocklist(body.platform, body.handle, body.reason);
    return reply.status(201).send(result);
  });

  app.delete("/api/v1/admin/platforms/blocklist/:id", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request) => {
    const params = request.params as { id: string };
    return platformsService.adminRemoveBlocklist(params.id);
  });

  app.get("/api/v1/admin/platforms/:id", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request) => {
    const params = request.params as { id: string };
    return platformsService.adminGetPlatform(params.id);
  });

  app.post("/api/v1/admin/platforms", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request, reply) => {
    const body = request.body as any;
    const result = await platformsService.adminCreatePlatform(body);
    return reply.status(201).send(result);
  });

  app.put("/api/v1/admin/platforms/:id", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request) => {
    const params = request.params as { id: string };
    const body = request.body as any;
    return platformsService.adminUpdatePlatform(params.id, body);
  });
}

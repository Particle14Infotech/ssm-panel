import { FastifyInstance } from "fastify";
import { AnnouncementsService } from "../services/announcements.service";

export function registerAnnouncementsRoutes(app: FastifyInstance, announcementsService: AnnouncementsService) {
  const adminGuard = [app.authenticate, app.authorize("ADMIN")];

  app.get("/api/v1/announcements", async () => {
    return announcementsService.findAll();
  });

  app.post("/api/v1/announcements", { preHandler: adminGuard }, async (request, reply) => {
    const body = (request.body as any) || {};
    const res = announcementsService.create(body);
    return reply.status(201).send(res);
  });
}

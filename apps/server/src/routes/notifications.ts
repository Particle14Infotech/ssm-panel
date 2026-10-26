import { FastifyInstance } from "fastify";
import { NotificationsService } from "../services/notifications.service";

export function registerNotificationsRoutes(app: FastifyInstance, notificationsService: NotificationsService): void {
  app.get("/api/v1/notifications", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request) => {
    const user = request.user;
    const effectiveUserId = (user?.id || user?.sub || request.headers["x-user-id"]) as string;
    return notificationsService.findAll(effectiveUserId);
  });

  app.put("/api/v1/notifications/:id/read", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request) => {
    const params = request.params as { id: string };
    const user = request.user;
    const effectiveUserId = (user?.id || user?.sub || request.headers["x-user-id"]) as string;
    return notificationsService.markAsRead(params.id, effectiveUserId);
  });
}

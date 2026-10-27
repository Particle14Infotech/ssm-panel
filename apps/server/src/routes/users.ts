import { FastifyInstance } from "fastify";
import { UsersService } from "../services/users.service";

export function registerUsersRoutes(app: FastifyInstance, usersService: UsersService): void {
  app.get("/api/v1/users/me", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request) => {
    const user = request.user;
    const headerUserId = request.headers["x-user-id"];
    const effectiveUserId = (user?.id || user?.sub || headerUserId) as string | undefined;
    return usersService.getProfile(effectiveUserId);
  });

  app.put("/api/v1/users/me", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request) => {
    const user = request.user;
    const headerUserId = request.headers["x-user-id"];
    const effectiveUserId = (user?.id || user?.sub || (typeof headerUserId === "string" ? headerUserId : "")) as string;
    const body = (request.body as any) || {};
    return usersService.updateProfile(effectiveUserId, body);
  });

  app.get("/api/v1/users", {
    preHandler: [app.authorize("ADMIN")],
  }, async () => {
    return usersService.findAll();
  });

  app.get("/api/v1/users/:id", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request) => {
    const params = request.params as { id: string };
    return usersService.findOne(params.id);
  });

  app.put("/api/v1/users/:id", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request) => {
    const params = request.params as { id: string };
    const body = (request.body as any) || {};
    return usersService.update(params.id, body);
  });

  app.delete("/api/v1/users/:id", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request) => {
    const params = request.params as { id: string };
    return usersService.remove(params.id);
  });

  app.put("/api/v1/users/:id/status", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request) => {
    const params = request.params as { id: string };
    const body = (request.body as any) || {};
    return usersService.updateStatus(params.id, body);
  });

  app.post("/api/v1/users/:id/reset-password", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request, reply) => {
    const params = request.params as { id: string };
    const body = (request.body as any) || {};
    const res = await usersService.adminResetPassword(params.id, body);
    return reply.status(201).send(res);
  });
}

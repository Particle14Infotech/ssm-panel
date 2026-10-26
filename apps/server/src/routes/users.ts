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
}

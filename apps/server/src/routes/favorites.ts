import { FastifyInstance } from "fastify";
import { CreateFavoriteInputSchema } from "@smm/contracts";
import { FavoritesService } from "../services/favorites.service";
import { ApiError } from "../errors";

export function registerFavoritesRoutes(app: FastifyInstance, favoritesService: FavoritesService): void {
  app.get("/api/v1/favorites", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request) => {
    const user = request.user;
    const userId = (user?.id || user?.sub) as string;
    return favoritesService.listFavorites(userId);
  });

  app.post("/api/v1/favorites", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request, reply) => {
    const user = request.user;
    const userId = (user?.id || user?.sub) as string;
    const body = request.body as any;

    if (body.config) {
      const result = await favoritesService.createFavoriteWithConfig(userId, body);
      return reply.status(201).send(result);
    }

    const parseRes = CreateFavoriteInputSchema.safeParse(body);
    if (!parseRes.success) {
      const err = parseRes.error.errors[0]?.message || "Invalid input";
      throw new ApiError(400, "BAD_REQUEST", err);
    }
    const result = await favoritesService.createFavorite(userId, parseRes.data);
    return reply.status(201).send(result);
  });

  app.delete("/api/v1/favorites/:id", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request) => {
    const params = request.params as { id: string };
    const user = request.user;
    const userId = (user?.id || user?.sub) as string;
    return favoritesService.deleteFavorite(userId, params.id);
  });

  app.get("/api/v1/favorites/suggestions", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request) => {
    const user = request.user;
    const userId = (user?.id || user?.sub) as string;
    return favoritesService.getSuggestions(userId);
  });

  app.post("/api/v1/favorites/suggestions/dismiss", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request) => {
    const user = request.user;
    const userId = (user?.id || user?.sub) as string;
    const body = request.body as { serviceId: string; targetUrl: string };
    if (!body?.serviceId || !body?.targetUrl) {
      throw new ApiError(400, "BAD_REQUEST", "serviceId and targetUrl are required.");
    }
    return favoritesService.dismissSuggestion(userId, body.serviceId, body.targetUrl);
  });
}

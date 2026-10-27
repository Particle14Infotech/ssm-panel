import { FastifyInstance } from "fastify";
import { CouponsService } from "../services/coupons.service";

export function registerCouponsRoutes(app: FastifyInstance, couponsService: CouponsService) {
  const adminGuard = [app.authenticate, app.authorize("ADMIN")];

  app.get("/api/v1/coupons", async () => {
    return couponsService.findAll();
  });

  app.post("/api/v1/coupons", { preHandler: adminGuard }, async (request, reply) => {
    const body = (request.body as any) || {};
    const res = couponsService.create(body);
    return reply.status(201).send(res);
  });

  app.post("/api/v1/coupons/apply", async (request, reply) => {
    const body = (request.body as any) || {};
    const res = couponsService.apply(body.code, Number(body.orderAmount));
    return reply.status(201).send(res);
  });

  app.get("/api/v1/bonuses", async () => {
    return couponsService.findAllBonuses();
  });

  app.post("/api/v1/bonuses", { preHandler: adminGuard }, async (request, reply) => {
    const body = (request.body as any) || {};
    const res = couponsService.createBonus(body);
    return reply.status(201).send(res);
  });
}

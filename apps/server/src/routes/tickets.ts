import { FastifyInstance } from "fastify";
import { TicketsService } from "../services/tickets.service";

export function registerTicketsRoutes(app: FastifyInstance, ticketsService: TicketsService): void {
  app.get("/api/v1/tickets", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request) => {
    const user = request.user;
    const query = request.query as { userId?: string };
    const role = user?.role;
    const effectiveUserId = role === "ADMIN" ? query.userId : (user?.id || user?.sub);
    return ticketsService.findAll(effectiveUserId, role);
  });

  app.get("/api/v1/tickets/admin/all", {
    preHandler: [app.authorize("ADMIN")],
  }, async () => {
    return ticketsService.findAll(undefined, "ADMIN");
  });

  app.get("/api/v1/tickets/:id", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request) => {
    const params = request.params as { id: string };
    const user = request.user;
    const effectiveUserId = (user?.id || user?.sub) as string;
    return ticketsService.findOne(params.id, effectiveUserId, user?.role);
  });

  app.post("/api/v1/tickets", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request, reply) => {
    const user = request.user;
    const body = request.body as { subject: string; message?: string; priority?: string };
    const effectiveUserId = (user?.id || user?.sub) as string;
    const result = await ticketsService.create(effectiveUserId, {
      subject: body.subject,
      message: body.message || body.subject,
      priority: body.priority,
    });
    return reply.status(201).send(result);
  });

  app.post("/api/v1/tickets/create", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request, reply) => {
    const user = request.user;
    const body = request.body as { subject: string; message?: string; priority?: string };
    const effectiveUserId = (user?.id || user?.sub) as string;
    const result = await ticketsService.create(effectiveUserId, {
      subject: body.subject,
      message: body.message || body.subject,
      priority: body.priority,
    });
    return reply.status(201).send(result);
  });

  app.post("/api/v1/tickets/:id/reply", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request, reply) => {
    const params = request.params as { id: string };
    const user = request.user;
    const body = request.body as { message: string };
    const effectiveUserId = (user?.id || user?.sub) as string;
    const result = await ticketsService.reply(params.id, effectiveUserId, body.message, user?.role);
    return reply.status(201).send(result);
  });

  app.post("/api/v1/tickets/:id/close", {
    preHandler: [async (request) => {
      await app.authenticate(request);
    }],
  }, async (request, reply) => {
    const params = request.params as { id: string };
    const user = request.user;
    const effectiveUserId = (user?.id || user?.sub) as string;
    const result = await ticketsService.close(params.id, effectiveUserId, user?.role);
    return reply.status(201).send(result);
  });

  app.put("/api/v1/tickets/:id/status", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request) => {
    const params = request.params as { id: string };
    const body = request.body as { status: string };
    return ticketsService.updateStatus(params.id, body.status);
  });
}

import { randomBytes } from "crypto";
import { FastifyInstance, FastifyRequest } from "fastify";
import { ApiError } from "../errors";
import {
  PackageQuoteInputSchema,
  PackagePurchaseInputSchema,
  TriggerPreviewInputSchema,
  TriggerExecutionInputSchema,
  RescheduleExecutionInputSchema,
} from "@smm/contracts";

export interface PackagesServiceLike {
  getQuote(input: any, userId?: string, clientIp?: string): Promise<any>;
  purchasePackage(userId: string, data: any): Promise<any>;
  listPackages(userId: string): Promise<any>;
  getAdminPackageSummary(id: string): Promise<any>;
  adminResolveExecution(executionId: string, action: string, body: any): Promise<any>;
  getAdminExecutionsQueue(query: any): Promise<any>;
  getPackage(userId: string, id: string): Promise<any>;
  reportProblem(userId: string, id: string, body: any): Promise<any>;
  pausePackage(userId: string, id: string): Promise<any>;
  resumePackage(userId: string, id: string): Promise<any>;
  getPackageTriggers(userId: string, id: string): Promise<any>;
  getPackageExecutions(userId: string, id: string): Promise<any>;
  triggerPreview(userId: string, id: string, data: any): Promise<any>;
  triggerStart(userId: string, id: string, data: any, key: string): Promise<any>;
  rescheduleExecution(userId: string, id: string, executionId: string, data: any): Promise<any>;
  swapTriggerLink(userId: string, id: string, tid: string, body: any): Promise<any>;
  speedUpPackage(userId: string, id: string, body: any): Promise<any>;
  moderateComments(comments: string[], expectedQuantity: number): any;
  getBundleTemplates(): any;
  purchaseBundle(userId: string, body: any): Promise<any>;
  renewPackage(userId: string, id: string, body: any): Promise<any>;
  setAutoRenew(userId: string, id: string, enabled: boolean): Promise<any>;
  cancelPackage(userId: string, id: string): Promise<any>;
}

export function registerPackagesRoutes(app: FastifyInstance, packagesService: PackagesServiceLike) {
  const enabledGuard = async () => {
    if (process.env.PACKAGES_ENABLED === "false") {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Package functionality is disabled.");
    }
  };

  const authGuard = async (request: FastifyRequest) => {
    await enabledGuard();
    await app.authenticate(request);
  };

  const adminGuard = async (request: FastifyRequest) => {
    await enabledGuard();
    await app.authorize("ADMIN")(request);
  };

  app.post("/api/v1/packages/quote", { preHandler: enabledGuard }, async (request, reply) => {
    let user: any = undefined;
    if (request.headers.authorization?.startsWith("Bearer ")) {
      try {
        user = await app.authenticate(request);
      } catch {}
    }
    const parseRes = PackageQuoteInputSchema.safeParse(request.body);
    if (!parseRes.success) {
      throw new ApiError(400, "BAD_REQUEST", parseRes.error.errors[0]?.message || "Invalid package configuration");
    }
    const forwardedFor = request.headers["x-forwarded-for"] as string | undefined;
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : undefined;
    const res = await packagesService.getQuote(
      parseRes.data,
      user?.sub || user?.id,
      user?.id ? undefined : clientIp
    );
    return reply.status(201).send(res);
  });

  app.post("/api/v1/packages/purchase", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const parseRes = PackagePurchaseInputSchema.safeParse(request.body);
    if (!parseRes.success) {
      throw new ApiError(400, "BAD_REQUEST", parseRes.error.errors[0]?.message || "Invalid package purchase data");
    }
    const res = await packagesService.purchasePackage(user.sub || user.id || "", parseRes.data);
    return reply.status(201).send(res);
  });

  app.post("/api/v1/packages", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const parseRes = PackagePurchaseInputSchema.safeParse(request.body);
    if (!parseRes.success) {
      throw new ApiError(400, "BAD_REQUEST", parseRes.error.errors[0]?.message || "Invalid package purchase data");
    }
    const res = await packagesService.purchasePackage(user.sub || user.id || "", parseRes.data);
    return reply.status(201).send(res);
  });

  app.get("/api/v1/packages", { preHandler: authGuard }, async (request) => {
    const user = request.user!;
    return packagesService.listPackages(user.sub || user.id || "");
  });

  app.get("/api/v1/packages/bundle/templates", { preHandler: enabledGuard }, async () => {
    return packagesService.getBundleTemplates();
  });

  app.post("/api/v1/packages/bundle/purchase", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const body = (request.body as any) || {};
    if (!body.templateId || !body.handle) {
      throw new ApiError(400, "BAD_REQUEST", "templateId and handle are required.");
    }
    const idempotencyKey = request.headers["idempotency-key"] as string | undefined;
    const res = await packagesService.purchaseBundle(user.sub || user.id || "", {
      templateId: body.templateId,
      handle: body.handle,
      idempotencyKey,
    });
    return reply.status(201).send(res);
  });

  app.get("/api/v1/packages/admin/:id/summary", { preHandler: adminGuard }, async (request) => {
    const { id } = request.params as { id: string };
    return packagesService.getAdminPackageSummary(id);
  });

  app.post("/api/v1/packages/admin/executions/:executionId/resolve", { preHandler: adminGuard }, async (request, reply) => {
    const { executionId } = request.params as { executionId: string };
    const body = (request.body as any) || {};
    if (!body || !body.action) {
      throw new ApiError(400, "BAD_REQUEST", "action is required ('RETRY' | 'MARK_SENT' | 'REFUND').");
    }
    const res = await packagesService.adminResolveExecution(executionId, body.action, body);
    return reply.status(201).send(res);
  });

  app.get("/api/v1/packages/admin/executions/queue", { preHandler: adminGuard }, async (request) => {
    const query = (request.query as any) || {};
    return packagesService.getAdminExecutionsQueue({
      status: query.status,
      page: query.page ? parseInt(query.page, 10) : undefined,
      limit: query.limit ? parseInt(query.limit, 10) : undefined,
    });
  });

  app.get("/api/v1/packages/:id", { preHandler: authGuard }, async (request) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    return packagesService.getPackage(user.sub || user.id || "", id);
  });

  app.post("/api/v1/packages/:id/report-problem", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const res = await packagesService.reportProblem(user.sub || user.id || "", id, (request.body as any) || {});
    return reply.status(201).send(res);
  });

  app.post("/api/v1/packages/:id/pause", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const res = await packagesService.pausePackage(user.sub || user.id || "", id);
    return reply.status(201).send(res);
  });

  app.post("/api/v1/packages/:id/resume", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const res = await packagesService.resumePackage(user.sub || user.id || "", id);
    return reply.status(201).send(res);
  });

  app.get("/api/v1/packages/:id/triggers", { preHandler: authGuard }, async (request) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    return packagesService.getPackageTriggers(user.sub || user.id || "", id);
  });

  app.get("/api/v1/packages/:id/executions", { preHandler: authGuard }, async (request) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    return packagesService.getPackageExecutions(user.sub || user.id || "", id);
  });

  app.post("/api/v1/packages/:id/triggers/preview", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const parseRes = TriggerPreviewInputSchema.safeParse(request.body);
    if (!parseRes.success) {
      throw new ApiError(400, "BAD_REQUEST", parseRes.error.errors[0]?.message || "Invalid preview payload");
    }
    const res = await packagesService.triggerPreview(user.sub || user.id || "", id, parseRes.data);
    return reply.status(201).send(res);
  });

  app.post("/api/v1/packages/:id/triggers", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    const effectiveKey = (request.headers["idempotency-key"] as string | undefined) || body.idempotencyKey;
    if (!effectiveKey || effectiveKey.trim() === "") {
      throw new ApiError(400, "BAD_REQUEST", "Idempotency-Key header is required for starting post delivery.");
    }
    const parseRes = TriggerExecutionInputSchema.safeParse(body);
    if (!parseRes.success) {
      throw new ApiError(400, "BAD_REQUEST", parseRes.error.errors[0]?.message || "Invalid trigger execution payload");
    }
    const res = await packagesService.triggerStart(user.sub || user.id || "", id, parseRes.data, effectiveKey);
    return reply.status(201).send(res);
  });

  app.post("/api/v1/packages/:id/executions/:executionId/reschedule", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id, executionId } = request.params as { id: string; executionId: string };
    const parseRes = RescheduleExecutionInputSchema.safeParse(request.body);
    if (!parseRes.success) {
      throw new ApiError(400, "BAD_REQUEST", parseRes.error.errors[0]?.message || "Invalid reschedule payload");
    }
    const res = await packagesService.rescheduleExecution(user.sub || user.id || "", id, executionId, parseRes.data);
    return reply.status(201).send(res);
  });

  app.post("/api/v1/packages/:id/trigger", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    if (!body || !body.url) {
      throw new ApiError(400, "BAD_REQUEST", "url is required to trigger package post execution.");
    }
    const key = (request.headers["idempotency-key"] as string | undefined) || body.idempotencyKey || `trig_${Date.now()}_${randomBytes(4).toString("hex")}`;
    const res = await packagesService.triggerStart(
      user.sub || user.id || "",
      id,
      { url: body.url, mediaType: body.mediaType, rules: [] },
      key
    );
    return reply.status(201).send(res);
  });

  app.post("/api/v1/packages/:id/triggers/:tid/swap-link", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id, tid } = request.params as { id: string; tid: string };
    const body = (request.body as any) || {};
    if (!body?.newTargetUrl) {
      throw new ApiError(400, "BAD_REQUEST", "newTargetUrl is required.");
    }
    const res = await packagesService.swapTriggerLink(user.sub || user.id || "", id, tid, body);
    return reply.status(201).send(res);
  });

  app.post("/api/v1/packages/:id/speed-up", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    const res = await packagesService.speedUpPackage(user.sub || user.id || "", id, { speedFactor: body?.speedFactor || 1.2 });
    return reply.status(201).send(res);
  });

  app.post("/api/v1/packages/:id/comments", { preHandler: authGuard }, async (request, reply) => {
    const body = (request.body as any) || {};
    const moderation = packagesService.moderateComments(body.comments, body.expectedQuantity);
    if (!moderation.isValid) {
      throw new ApiError(400, "BAD_REQUEST", moderation.errors.join("; "));
    }
    return reply.status(201).send({ success: true, count: moderation.sanitizedComments.length });
  });

  app.post("/api/v1/packages/:id/renew", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    const res = await packagesService.renewPackage(user.sub || user.id || "", id, { explicitConsent: body?.explicitConsent === true });
    return reply.status(201).send(res);
  });

  app.post("/api/v1/packages/:id/auto-renew", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const body = (request.body as any) || {};
    const res = await packagesService.setAutoRenew(user.sub || user.id || "", id, body?.enabled === true);
    return reply.status(201).send(res);
  });

  app.post("/api/v1/packages/:id/cancel", { preHandler: authGuard }, async (request, reply) => {
    const user = request.user!;
    const { id } = request.params as { id: string };
    const res = await packagesService.cancelPackage(user.sub || user.id || "", id);
    return reply.status(201).send(res);
  });
}

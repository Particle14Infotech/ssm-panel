import { FastifyInstance } from "fastify";
import { EmailService } from "../services/email.service";
import { ApiError } from "../errors";

export function registerEmailRoutes(app: FastifyInstance, emailService: EmailService) {
  const adminGuard = [app.authenticate, app.authorize("ADMIN")];

  app.post("/api/v1/webhooks/resend", async (request, reply) => {
    const rawBody = (request as any).rawBody || JSON.stringify(request.body);
    const headers = request.headers as Record<string, string>;

    const isValid = emailService.verifyWebhookSignature(rawBody, headers);
    if (!isValid) {
      throw new ApiError(400, "BAD_REQUEST", "Invalid webhook signature or timestamp expired.");
    }

    const event = request.body;
    const result = await emailService.handleWebhookEvent(event);

    return reply.status(200).send({
      success: true,
      result,
    });
  });

  app.get("/api/v1/admin/email/telemetry", { preHandler: adminGuard }, async () => {
    return emailService.getEmailTelemetry();
  });
}

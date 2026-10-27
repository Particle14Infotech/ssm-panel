import { FastifyInstance, FastifyRequest } from "fastify";
import { AuthService } from "../services/auth.service";

export function registerAuthRoutes(app: FastifyInstance, authService: AuthService) {
  app.post("/api/v1/auth/login", async (request) => {
    return authService.login((request.body as any) || {});
  });

  app.post("/api/v1/auth/register", async (request) => {
    return authService.register((request.body as any) || {});
  });

  app.post("/api/v1/auth/refresh", async (request) => {
    const body = (request.body as any) || {};
    return authService.refreshSession(body.refreshToken);
  });

  app.post("/api/v1/auth/logout", async (request) => {
    const body = (request.body as any) || {};
    return authService.logout(body.refreshToken, body.userId);
  });

  app.post("/api/v1/auth/forgot-password", async (request) => {
    const body = (request.body as any) || {};
    return authService.forgotPassword(body.email);
  });

  app.post("/api/v1/auth/reset-password", async (request) => {
    return authService.resetPassword((request.body as any) || {});
  });

  app.post("/api/v1/auth/verify-email", async (request) => {
    const body = (request.body as any) || {};
    return authService.verifyEmail(body.token, body.email);
  });

  app.post("/api/v1/auth/resend-verification", async (request) => {
    const body = (request.body as any) || {};
    return authService.resendVerification(body.email);
  });

  app.post("/api/v1/auth/2fa/setup", async (request) => {
    const body = (request.body as any) || {};
    return authService.setup2fa(body.userId);
  });

  app.post("/api/v1/auth/2fa/verify", async (request) => {
    const body = (request.body as any) || {};
    return authService.verify2fa(body.userId, body.code);
  });

  app.get("/api/v1/auth/sessions", async (request: FastifyRequest) => {
    const headerUserId = request.headers["x-user-id"] as string | undefined;
    const userId = headerUserId || "usr_default_demo";
    return authService.listSessions(userId);
  });

  app.post("/api/v1/auth/sessions/revoke", async (request) => {
    const body = (request.body as any) || {};
    return authService.revokeSession(body.sessionId);
  });

  app.get("/api/v1/auth/verify-key", async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    return authService.verifyKey(authHeader);
  });
}

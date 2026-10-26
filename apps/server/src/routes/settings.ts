import { FastifyInstance } from "fastify";
import { SettingsService } from "../services/settings.service";

export function registerSettingsRoutes(app: FastifyInstance, settingsService: SettingsService): void {
  app.get("/api/v1/settings", {
    preHandler: [app.authorize("ADMIN")],
  }, async () => {
    return settingsService.getSettings();
  });

  app.put("/api/v1/settings", {
    preHandler: [app.authorize("ADMIN")],
  }, async (request) => {
    const body = request.body as Record<string, any>;
    return settingsService.updateSettings(body);
  });
}

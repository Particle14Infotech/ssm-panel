import { FastifyInstance } from "fastify";
import { ReportsService } from "../services/reports.service";

export function registerReportsRoutes(app: FastifyInstance, reportsService: ReportsService) {
  const adminGuard = [app.authenticate, app.authorize("ADMIN")];

  app.get("/api/v1/reports/summary", { preHandler: adminGuard }, async () => {
    return reportsService.getSummary();
  });

  app.get("/api/v1/reports/audit-logs", { preHandler: adminGuard }, async () => {
    return reportsService.getAuditLogs();
  });

  app.get("/api/v1/reports/export-csv", { preHandler: adminGuard }, async () => {
    return reportsService.exportCsv();
  });
}

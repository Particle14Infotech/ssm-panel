import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    return {
      totalRevenue: 148520.0,
      activeOrders: 42,
      completedOrders: 1890,
      failedOrders: 8,
      totalUsers: 340,
      providerLatencyMs: 14.2,
      grossProfitMarginPct: 24.6,
      timestamp: new Date().toISOString(),
    };
  }

  async exportCsv() {
    const csvContent = [
      "OrderId,UserId,Service,Charge,Status,CreatedAt",
      "ORD-98421,usr_1,Instagram High-Retention,180.00,COMPLETED,2026-10-10T12:00:00Z",
      "ORD-98422,usr_2,YouTube Views,160.00,IN_PROGRESS,2026-10-11T14:30:00Z",
      "ORD-98423,usr_3,TikTok Views,36.00,COMPLETED,2026-10-12T09:15:00Z",
    ].join("\n");

    return {
      fileName: `smm_reports_${new Date().toISOString().split("T")[0]}.csv`,
      contentType: "text/csv",
      content: csvContent,
    };
  }
}

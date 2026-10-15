import { Test, TestingModule } from "@nestjs/testing";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

describe("ReportsController Unit Tests", () => {
  let controller: ReportsController;
  let mockReportsService: Partial<ReportsService>;

  beforeEach(async () => {
    mockReportsService = {
      getSummary: jest.fn().mockResolvedValue({
        totalRevenue: 245000.0,
        activeOrders: 142,
        completedOrders: 12500,
        totalCustomers: 850,
        currency: "INR",
      }),
      exportCsv: jest.fn().mockResolvedValue({
        fileName: "ledger_export.csv",
        contentType: "text/csv",
        content: "id,amount,type,createdAt\n1,100,CREDIT,2026-10-13",
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [{ provide: ReportsService, useValue: mockReportsService }],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  it("returns financial and operational summary analytics", async () => {
    const summary = await controller.getSummary();
    expect(summary.totalRevenue).toBe(245000.0);
  });

  it("exports CSV ledger report", async () => {
    const csv = await controller.exportCsv();
    expect(csv.fileName.endsWith(".csv")).toBe(true);
    expect(csv.content).toContain("amount,type");
  });
});

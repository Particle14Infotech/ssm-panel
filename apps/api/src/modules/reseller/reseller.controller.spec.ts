import { Test, TestingModule } from "@nestjs/testing";
import { ResellerController } from "./reseller.controller";
import { ResellerService } from "./reseller.service";
import { ServicesService } from "../services/services.service";
import { OrdersService } from "../orders/orders.service";
import { WalletService } from "../wallet/wallet.service";
import { PrismaService } from "../../common/prisma.service";

describe("ResellerController & API B2B Endpoints", () => {
  let controller: ResellerController;
  let resellerService: ResellerService;

  beforeEach(async () => {
    const mockServicesService = {
      findAll: jest.fn().mockReturnValue([
        { id: "1042", name: "Instagram Followers", platform: "Instagram", ratePer1000: 180.0 },
      ]),
    };

    const mockOrdersService = {
      create: jest.fn().mockResolvedValue({ id: "ord_reseller_123" }),
      findOne: jest.fn().mockResolvedValue({
        id: "ord_reseller_123",
        charge: "18.00",
        startCount: 500,
        status: "COMPLETED",
        remains: 0,
      }),
    };

    const mockWalletService = {
      getBalance: jest.fn().mockResolvedValue({ balance: 14500.0, currency: "INR" }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResellerController],
      providers: [
        ResellerService,
        { provide: ServicesService, useValue: mockServicesService },
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: WalletService, useValue: mockWalletService },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<ResellerController>(ResellerController);
    resellerService = module.get<ResellerService>(ResellerService);
  });

  it("returns reseller overview reports", () => {
    const reports = controller.getReports();
    expect(reports.monthlyVolumeOrders).toBeGreaterThan(0);
    expect(reports.currency).toBe("INR");
  });

  it("rotates reseller API key securely", () => {
    const rotated = controller.rotateApiKey();
    expect(rotated.success).toBe(true);
    expect(rotated.apiKey.startsWith("smm_live_")).toBe(true);
  });

  it("calculates wholesale pricing with tier discount", async () => {
    const pricing = await controller.getPricing();
    expect(pricing.length).toBe(1);
    expect(pricing[0].resellerRate).toBeLessThan(pricing[0].standardRate);
  });

  it("handles standardized public v1/orders dispatch", async () => {
    const orderRes = await controller.createPublicOrder({
      service: "1042",
      link: "https://instagram.com/p/test",
      quantity: 100,
    });
    expect(orderRes.order).toBe("ord_reseller_123");
  });

  it("handles standardized public v1/orders/:id status query", async () => {
    const statusRes = await controller.getPublicOrderStatus("ord_reseller_123");
    expect(statusRes.status).toBe("COMPLETED");
    expect(statusRes.charge).toBe(18);
  });

  it("handles standardized public v1/balance", async () => {
    const bal = await controller.getPublicBalance();
    expect(bal.balance).toBeGreaterThan(0);
  });
});

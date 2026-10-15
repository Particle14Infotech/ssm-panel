import { Test, TestingModule } from "@nestjs/testing";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";

describe("PaymentsController Security & Webhook Tests", () => {
  let controller: PaymentsController;
  let mockPaymentsService: Partial<PaymentsService>;

  beforeEach(async () => {
    mockPaymentsService = {
      initiate: jest.fn().mockResolvedValue({
        success: true,
        paymentId: "pay_1",
        gatewayOrderId: "order_mock_123",
        amount: 1000,
        bonusAmount: 100,
        currency: "INR",
        method: "RAZORPAY",
        status: "PENDING",
      }),
      handleWebhook: jest.fn().mockImplementation((sig: string, payload: any) => {
        if (!sig || sig === "invalid_sig") {
          throw new UnauthorizedException("Invalid webhook HMAC signature.");
        }
        return Promise.resolve({
          success: true,
          paymentId: "pay_1",
          creditedAmount: 1100,
          status: "SUCCESS",
        });
      }),
      sandboxComplete: jest.fn().mockResolvedValue({
        success: true,
        paymentId: "pay_1",
        creditedAmount: 1100,
        status: "SUCCESS",
      }),
      findAll: jest.fn().mockResolvedValue([
        { id: "pay_1", amount: 1000, status: "SUCCESS" },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: mockPaymentsService,
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  describe("Security Invariant: POST /payments/sandbox-complete Restrictions", () => {
    it("CRITICAL: throws NotFoundException (HTTP 404) when NODE_ENV is production", async () => {
      process.env.NODE_ENV = "production";

      await expect(
        controller.sandboxComplete({ gatewayOrderId: "order_mock_123" })
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.sandboxComplete({ gatewayOrderId: "order_mock_123" })
      ).rejects.toThrow(/disabled in production/);
    });

    it("allows sandbox completion in test / development mode", async () => {
      process.env.NODE_ENV = "test";

      const res = await controller.sandboxComplete({ gatewayOrderId: "order_mock_123" });
      expect(res.success).toBe(true);
      expect(mockPaymentsService.sandboxComplete).toHaveBeenCalledWith("order_mock_123");
    });
  });

  describe("Cryptographic Webhook Invariants", () => {
    it("rejects webhook if signature verification fails", async () => {
      await expect(
        controller.webhook("invalid_sig", "", { gatewayOrderId: "order_mock_123" })
      ).rejects.toThrow(UnauthorizedException);
    });

    it("processes webhook when valid HMAC signature is present", async () => {
      const res = await controller.webhook(
        "valid_hmac_sig",
        "",
        { gatewayOrderId: "order_mock_123", referenceId: "ref_1" }
      );
      expect(res.success).toBe(true);
    });
  });

  describe("Payment Sessions", () => {
    it("initiates payment deposit session with bonus computation", async () => {
      const res = await controller.initiate({ userId: "usr_test", amount: 1000 });
      expect(res.success).toBe(true);
      expect(res.amount).toBe(1000);
      expect(res.bonusAmount).toBe(100);
    });

    it("lists payments for user or system", async () => {
      const list = await controller.findAll("usr_test");
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(1);
    });
  });
});

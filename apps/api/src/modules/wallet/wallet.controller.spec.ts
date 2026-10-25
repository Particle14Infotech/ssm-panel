import { Test, TestingModule } from "@nestjs/testing";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";
import { Decimal } from "decimal.js";

describe("WalletController Unit & Security Invariant Tests", () => {
  let controller: WalletController;
  let mockWalletService: Partial<WalletService>;
  let originalEnvironment: Record<string, string | undefined>;
  const environmentKeys = ["NODE_ENV", "ALLOW_SIMULATED_PAYMENTS", "PAYMENTS_MODE"];

  beforeEach(async () => {
    originalEnvironment = Object.fromEntries(
      environmentKeys.map((key) => [key, process.env[key]])
    );
    mockWalletService = {
      getBalance: jest.fn().mockResolvedValue({
        balance: 1500.0,
        currency: "INR",
        userId: "usr_test",
      }),
      getLedger: jest.fn().mockResolvedValue([
        {
          id: "led_1",
          walletId: "wal_1",
          amount: "500.00",
          type: "CREDIT",
          description: "Payment gateway top-up",
          createdAt: new Date().toISOString(),
        },
      ]),
      adjustBalance: jest.fn().mockResolvedValue({
        success: true,
        userId: "usr_test",
        adjustedAmount: 250.0,
        newBalance: 1750.0,
        reason: "Administrative manual correction",
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WalletController],
      providers: [
        {
          provide: WalletService,
          useValue: mockWalletService,
        },
      ],
    }).compile();

    controller = module.get<WalletController>(WalletController);
  });

  afterEach(() => {
    for (const key of environmentKeys) {
      const value = originalEnvironment[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  describe("Security Invariant: POST /wallet/deposit Restrictions", () => {
    it("CRITICAL: throws NotFoundException (HTTP 404) when NODE_ENV is production", () => {
      process.env.NODE_ENV = "production";
      process.env.ALLOW_SIMULATED_PAYMENTS = "true";
      process.env.PAYMENTS_MODE = "sandbox";

      expect(() => {
        controller.deposit({ amount: 1000, method: "UPI" });
      }).toThrow(NotFoundException);

      expect(() => {
        controller.deposit({ amount: 1000, method: "UPI" });
      }).toThrow(/disabled in production/);
    });

    it("allows deposit in sandbox / development mode and computes tier bonuses", () => {
      process.env.NODE_ENV = "test";

      const res = controller.deposit({ amount: 1000, method: "UPI" });
      expect(res.success).toBe(true);
      expect(res.amount).toBe(1000);
      expect(res.bonus).toBe(100); // 10% bonus for >= 1000
      expect(res.creditedTotal).toBe(1100);
      expect(res.status).toBe("SUCCESS");
    });

    it("computes 15% bonus for deposits of 5000 or greater in sandbox mode", () => {
      process.env.NODE_ENV = "development";

      const res = controller.deposit({ amount: 5000, method: "NETBANKING" });
      expect(res.bonus).toBe(750);
      expect(res.creditedTotal).toBe(5750);
    });
  });

  describe("Administrative Adjustments: POST /wallet/adjust", () => {
    it("rejects adjustment if reason is empty or whitespace", async () => {
      await expect(
        controller.adjustBalance({ userId: "usr_test", amount: 100, reason: "" })
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.adjustBalance({ userId: "usr_test", amount: 100, reason: "   " })
      ).rejects.toThrow(/mandatory/);
    });

    it("rejects adjustment if userId is missing", async () => {
      await expect(
        controller.adjustBalance({ userId: "", amount: 100, reason: "Manual adjustment" })
      ).rejects.toThrow(BadRequestException);
    });

    it("successfully calls WalletService.adjustBalance with valid parameters", async () => {
      const res = await controller.adjustBalance({
        userId: "usr_test",
        amount: 250,
        reason: "Administrative manual correction",
      });

      expect(res.success).toBe(true);
      expect(mockWalletService.adjustBalance).toHaveBeenCalledWith(
        "usr_test",
        new Decimal(250),
        "Administrative manual correction"
      );
    });
  });

  describe("Balance & Ledger Endpoints", () => {
    it("returns balance and Pro tier details", async () => {
      const balance = await controller.getBalance("usr_test");
      expect(balance.balance).toBe(1500.0);
      expect(balance.tier).toBe("PRO_SCALE");
    });

    it("returns ledger history", async () => {
      const ledger = await controller.getLedger("usr_test");
      expect(Array.isArray(ledger)).toBe(true);
      expect(ledger.length).toBe(1);
    });
  });
});

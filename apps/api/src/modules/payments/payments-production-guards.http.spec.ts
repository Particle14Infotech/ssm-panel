import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import { Reflector } from "@nestjs/core";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { WalletController } from "../wallet/wallet.controller";
import { WalletService } from "../wallet/wallet.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard } from "../../common/roles.guard";

describe("production payment guards over HTTP", () => {
  let app: INestApplication;
  let originalEnvironment: Record<string, string | undefined>;
  const environmentKeys = [
    "NODE_ENV",
    "PAYMENT_PROVIDER",
    "ALLOW_SIMULATED_PAYMENTS",
    "PAYMENTS_MODE",
  ];
  const walletService = {
    creditFunds: jest.fn(),
    adjustBalance: jest.fn(),
  };
  const prisma = {
    isConnected: false,
  };
  const paymentsService = new PaymentsService(
    prisma as any,
    walletService as any
  );
  const userToken = jwt.sign(
    { sub: "production-guard-user", role: "USER" },
    process.env.JWT_ACCESS_SECRET ||
      process.env.JWT_SECRET ||
      "smm_panel_jwt_secret_dev_environment_key_32bytes",
    { expiresIn: "5m" }
  );

  beforeAll(async () => {
    originalEnvironment = Object.fromEntries(
      environmentKeys.map((key) => [key, process.env[key]])
    );
    process.env.NODE_ENV = "production";
    process.env.PAYMENT_PROVIDER = "simulated";
    process.env.ALLOW_SIMULATED_PAYMENTS = "true";
    process.env.PAYMENTS_MODE = "sandbox";

    const module = await Test.createTestingModule({
      controllers: [PaymentsController, WalletController],
      providers: [
        { provide: PaymentsService, useValue: paymentsService },
        { provide: WalletService, useValue: {} },
        JwtAuthGuard,
        RolesGuard,
        Reflector,
      ],
    })
      .compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    for (const key of environmentKeys) {
      const value = originalEnvironment[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("rejects sandbox completion even when legacy flags request simulated payments", async () => {
    await request(app.getHttpServer())
      .post("/payments/sandbox-complete")
      .send({ gatewayOrderId: "order_test" })
      .expect(404);

    expect(walletService.creditFunds).not.toHaveBeenCalled();
  });

  it("rejects fake wallet deposits for an authenticated user in production", async () => {
    await request(app.getHttpServer())
      .post("/wallet/deposit")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ amount: 500, method: "UPI" })
      .expect(404);

    expect(walletService.creditFunds).not.toHaveBeenCalled();
  });

  it("rejects simulated payment verification without crediting the wallet", async () => {
    await request(app.getHttpServer())
      .post("/payments/verify")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        orderId: "order_test",
        paymentId: "pay_test",
        testOutcome: "success",
      })
      .expect(403);

    expect(walletService.creditFunds).not.toHaveBeenCalled();
  });

  it("rejects simulated webhook credit without writing a wallet ledger entry", async () => {
    await request(app.getHttpServer())
      .post("/payments/webhook")
      .set("x-webhook-signature", "unverified-signature")
      .send({
        gatewayOrderId: "order_test",
        paymentId: "pay_test",
      })
      .expect(403);

    expect(walletService.creditFunds).not.toHaveBeenCalled();
  });

  it("denies regular users administrative wallet adjustments", async () => {
    await request(app.getHttpServer())
      .post("/wallet/adjust")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        userId: "production-guard-user",
        amount: 500,
        reason: "Not an administrator",
      })
      .expect(403);

    expect(walletService.adjustBalance).not.toHaveBeenCalled();
  });
});

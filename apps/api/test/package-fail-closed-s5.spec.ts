import { ServiceUnavailableException } from "@nestjs/common";
import { Decimal } from "decimal.js";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PlatformsService } from "../src/modules/platforms/platforms.service";
import { WalletService } from "../src/modules/wallet/wallet.service";
import { OrdersService } from "../src/modules/orders/orders.service";
import { TicketsService } from "../src/modules/tickets/tickets.service";
import { UsersService } from "../src/modules/users/users.service";
import * as fs from "fs";
import * as path from "path";

describe("S5: GAP-5 Fail-Closed Architecture", () => {
  describe("1. Fail-Closed On Database Disconnection (503 Service Unavailable)", () => {
    const disconnectedPrisma: any = {
      isConnected: false,
      package: { findFirst: jest.fn(), create: jest.fn() },
      wallet: { findUnique: jest.fn(), update: jest.fn() },
      order: { create: jest.fn() },
      ticket: { create: jest.fn() },
      user: { findUnique: jest.fn() },
      platformConfig: { findUnique: jest.fn(), upsert: jest.fn() },
    };

    it("PackagesService.purchasePackage throws 503 ServiceUnavailableException when DB is disconnected", async () => {
      const platformsService = new PlatformsService(disconnectedPrisma);
      const quoteService: any = { calculateQuote: jest.fn() };
      const packagesService = new PackagesService(disconnectedPrisma, quoteService, platformsService);

      await expect(
        packagesService.purchasePackage(
          "u_test_1",
          {
            platform: "instagram",
            handle: "test_handle",
            quoteHash: "qh_v2_default_12345_abc",
            idempotencyKey: "idem_test_key_1",
            consentRulesUnderstood: true,
          } as any
        )
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it("WalletService write operations throw 503 ServiceUnavailableException when DB is disconnected", async () => {
      const walletService = new WalletService(disconnectedPrisma);

      await expect(
        walletService.debitForOrder("u_test_1", "ord_1", new Decimal(100), "idem_key")
      ).rejects.toThrow(ServiceUnavailableException);

      await expect(
        walletService.creditFunds("u_test_1", new Decimal(100), "MANUAL_CREDIT" as any, "Admin credit")
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it("OrdersService.create throws 503 ServiceUnavailableException when DB is disconnected", async () => {
      const ordersService = new OrdersService(disconnectedPrisma, {} as any, {} as any);

      await expect(
        ordersService.create({
          userId: "u_test_1",
          serviceId: "srv_1",
          target: "https://instagram.com/p/123",
          quantity: 1000,
        } as any)
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it("PlatformsService, TicketsService, UsersService fail closed when DB is disconnected", async () => {
      const platformsService = new PlatformsService(disconnectedPrisma);
      const ticketsService = new TicketsService(disconnectedPrisma);
      const usersService = new UsersService(disconnectedPrisma);

      await expect(
        platformsService.adminCreatePlatform({ platform: "instagram" } as any)
      ).rejects.toThrow(ServiceUnavailableException);

      await expect(
        ticketsService.create("u_test_1", { subject: "Help", message: "Error" })
      ).rejects.toThrow(ServiceUnavailableException);

      await expect(
        usersService.getProfile("u_test_1")
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe("2. Static Source Gate: Zero In-Memory Sandbox Fallback Maps in Production Source", () => {
    it("proves no sandboxPackages or in-memory fallback maps exist in production service files", () => {
      const targetFiles = [
        path.resolve(__dirname, "../src/modules/packages/packages.service.ts"),
        path.resolve(__dirname, "../src/modules/wallet/wallet.service.ts"),
        path.resolve(__dirname, "../src/modules/orders/orders.service.ts"),
        path.resolve(__dirname, "../src/modules/platforms/platforms.service.ts"),
        path.resolve(__dirname, "../src/modules/tickets/tickets.service.ts"),
        path.resolve(__dirname, "../src/modules/users/users.service.ts"),
      ];

      const violations: string[] = [];
      const forbiddenPatterns = [
        /sandboxPackages/,
        /sandboxUsers/,
        /sandboxOrders/,
        /sandboxTickets/,
        /sandboxWallets/,
        /if\s*\(\s*!this\.prisma\.isConnected\s*\)\s*return\s*\{[^}]*success:\s*true/,
      ];

      for (const file of targetFiles) {
        if (!fs.existsSync(file)) continue;
        const content = fs.readFileSync(file, "utf-8");
        for (const pattern of forbiddenPatterns) {
          if (pattern.test(content)) {
            violations.push(`${file}: contains forbidden fail-open sandbox pattern ${pattern}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });
});

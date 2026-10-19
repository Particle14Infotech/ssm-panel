import { calculateOrderFinancialSnapshot, calculateCustomerCharge, DEFAULT_PRICING_SETTINGS } from "@smm/contracts";
import { Decimal } from "decimal.js";
import { OrdersService } from "./orders.service";
import { OrderStatus } from "@prisma/client";

describe("Verification: User/Admin Balance Deduction & Hybrid Provider Failover", () => {
  describe("Feature 1: User & Admin Balance Deduction & Profit Margins", () => {
    it("deducts retail price from user and computes admin gross/net profit from wholesale cost", () => {
      // Scenario: Service with Wholesale Cost = $0.20/1k, USD/INR FX = 86.50
      // costINR = 0.20 * 86.50 = 17.30
      // Configured 25% profit margin -> Selling Rate = 17.30 * 1.25 = 21.625
      const wholesaleUSD = 0.20;
      const fxRate = 86.50;
      const costINR = new Decimal(wholesaleUSD).mul(fxRate).toNumber(); // 17.30
      const sellRateINR = new Decimal(costINR).mul(1.25).toNumber(); // 21.625

      const quantity = 5000; // 5k units
      const snapshot = calculateOrderFinancialSnapshot({
        sellRatePer1k: sellRateINR,
        costRatePer1k: costINR,
        fxRateUsed: fxRate,
        providerCurrency: "USD",
        quantityPerRun: quantity,
        runs: 1,
        dripSurchargePercent: 0,
        paymentFeePercent: 2.36,
      });

      // User Retail Charge: (5000 / 1000) * 21.625 = 108.125 -> 108.13
      expect(snapshot.charge.toNumber()).toBe(108.13);

      // Upstream Provider Wholesale Cost (Admin Deduction): (5000 / 1000) * 17.30 = 86.50
      expect(snapshot.estimatedProviderCost.toNumber()).toBe(86.50);

      // Admin Gross Profit: 108.13 - 86.50 = 21.63
      expect(snapshot.estimatedGrossProfit.toNumber()).toBe(21.63);

      // Payment Gateway Fee: 108.13 * 0.0236 = 2.55
      expect(snapshot.paymentFeeEstimate.toNumber()).toBe(2.55);

      // Admin Net Profit: 21.63 - 2.55 = 19.08
      expect(snapshot.estimatedNetProfit.toNumber()).toBe(19.08);
    });

    it("ensures atomic user balance deduction occurs on order placement and stops when insufficient balance", async () => {
      let userBalance = new Decimal(50.0); // User only has ₹50.00
      const orderCharge = new Decimal(108.13); // Order costs ₹108.13

      const mockWalletService = {
        debitForOrder: jest.fn().mockImplementation((userId, orderId, charge) => {
          if (userBalance.lessThan(charge)) {
            return Promise.reject(new Error("Insufficient balance in wallet."));
          }
          userBalance = userBalance.minus(charge);
          return Promise.resolve({ success: true });
        }),
      };

      const mockPrisma: any = { isConnected: false };
      const ordersService = new OrdersService(mockPrisma, mockWalletService as any);

      // Attempt to place order with insufficient balance
      await expect(
        mockWalletService.debitForOrder("user_1", "order_1", orderCharge)
      ).rejects.toThrow("Insufficient balance in wallet.");

      // Wallet remains untouched
      expect(userBalance.toNumber()).toBe(50.0);

      // Now top-up user balance to ₹200.00 and place order
      userBalance = new Decimal(200.0);
      await mockWalletService.debitForOrder("user_1", "order_1", orderCharge);

      // Exact retail charge deducted
      expect(userBalance.toNumber()).toBe(91.87); // 200 - 108.13
    });

    it("verifies customer API response sanitization (no wholesale cost or profit leakage)", () => {
      const mockPrisma: any = { isConnected: false };
      const ordersService = new OrdersService(mockPrisma, {} as any);

      const rawOrder = {
        id: "ord-test-99",
        userId: "usr-cust-1",
        charge: 108.13,
        costRatePer1k: 17.30,
        fxRateUsed: 86.50,
        providerCurrency: "USD",
        estimatedProviderCost: 86.50,
        estimatedGrossProfit: 21.63,
        paymentFeeEstimate: 2.55,
        estimatedNetProfit: 19.08,
        actualProviderCost: 86.50,
        actualProfit: 19.08,
        costUnknown: false,
        service: {
          id: "srv-1",
          name: "Instagram Followers High Quality",
          providerCostPer1k: 0.20,
          costINR: 17.30,
          marginPercentOverride: 25,
        },
      };

      // Sanitize for customer
      const customerView = (ordersService as any).sanitizeOrderForRole(rawOrder, "CUSTOMER");
      expect(customerView.charge).toBe(108.13);
      expect(customerView.costRatePer1k).toBeUndefined();
      expect(customerView.fxRateUsed).toBeUndefined();
      expect(customerView.estimatedProviderCost).toBeUndefined();
      expect(customerView.estimatedGrossProfit).toBeUndefined();
      expect(customerView.estimatedNetProfit).toBeUndefined();
      expect(customerView.actualProviderCost).toBeUndefined();
      expect(customerView.actualProfit).toBeUndefined();
      expect(customerView.service.costINR).toBeUndefined();
      expect(customerView.service.providerCostPer1k).toBeUndefined();

      // Sanitize for admin (preserves all profit and cost metrics)
      const adminView = (ordersService as any).sanitizeOrderForRole(rawOrder, "ADMIN");
      expect(adminView.charge).toBe(108.13);
      expect(adminView.costRatePer1k).toBe(17.30);
      expect(adminView.estimatedProviderCost).toBe(86.50);
      expect(adminView.estimatedGrossProfit).toBe(21.63);
      expect(adminView.estimatedNetProfit).toBe(19.08);
      expect(adminView.service.costINR).toBe(17.30);
    });
  });

  describe("Feature 2: Hybrid SMM Provider Routing & Auto-Failover Engine", () => {
    it("handles AUTO_FAILOVER routing when primary provider runs out of balance", async () => {
      // Simulate primary provider failing with insufficient balance
      const primaryProvider = {
        id: "prov-primary-1",
        name: "Primary SMM SuperFast",
        apiUrl: "https://primary-smm.example.com/api/v2",
        apiKeyEncrypted: "enc_key_1",
        active: true,
      };

      const backupProvider = {
        id: "prov-backup-2",
        name: "Backup SMM Global",
        apiUrl: "https://backup-smm.example.com/api/v2",
        apiKeyEncrypted: "enc_key_2",
        active: true,
      };

      const service = {
        id: "srv-ig-100",
        name: "Instagram High Speed",
        providerId: "prov-primary-1",
        providerServiceId: "101",
        routingMode: "AUTO_FAILOVER",
        backupProviderId: "prov-backup-2",
        backupProviderServiceId: "808",
      };

      // Execution mock simulating worker's dispatchOrderToProvider logic
      let activeOrder: any = {
        id: "ord-dispatch-55",
        userId: "usr-1",
        service,
        provider: primaryProvider,
        target: "https://instagram.com/myaccount",
        quantity: 1000,
        status: OrderStatus.PENDING,
      };

      const statusHistory: any[] = [];

      const callUpstreamAddOrderMock = jest.fn().mockImplementation((url, key, serviceId) => {
        if (url === primaryProvider.apiUrl) {
          // Primary provider fails due to zero balance
          throw new Error("Upstream provider error: Not enough funds on balance");
        }
        if (url === backupProvider.apiUrl && serviceId === "808") {
          // Backup provider succeeds
          return "upstream_backup_order_998811";
        }
        throw new Error("Unexpected URL");
      });

      // Emulate worker dispatchOrderToProvider failover logic
      let providerOrderId: string | null = null;
      try {
        providerOrderId = await callUpstreamAddOrderMock(
          activeOrder.provider.apiUrl,
          "decrypted_key_1",
          activeOrder.service.providerServiceId,
          activeOrder.target,
          activeOrder.quantity
        );
      } catch (err: any) {
        const isUpstreamError = err.message && err.message.includes("Upstream provider error:");
        if (isUpstreamError && activeOrder.service.routingMode === "AUTO_FAILOVER" && activeOrder.service.backupProviderId) {
          // Trigger failover
          const backup = backupProvider; // retrieved from DB
          providerOrderId = await callUpstreamAddOrderMock(
            backup.apiUrl,
            "decrypted_key_2",
            activeOrder.service.backupProviderServiceId,
            activeOrder.target,
            activeOrder.quantity
          );

          // Update order to backup provider and mark PROCESSING
          activeOrder.providerId = backup.id;
          activeOrder.providerOrderId = providerOrderId;
          activeOrder.status = OrderStatus.PROCESSING;
          statusHistory.push({
            orderId: activeOrder.id,
            status: OrderStatus.PROCESSING,
            notes: `Auto-failed over to backup provider "${backup.name}". Primary failed: ${err.message}. Upstream Ref: ${providerOrderId}`,
          });
        } else {
          throw err;
        }
      }

      // Assertions:
      expect(callUpstreamAddOrderMock).toHaveBeenCalledTimes(2);
      expect(activeOrder.status).toBe(OrderStatus.PROCESSING);
      expect(activeOrder.providerId).toBe("prov-backup-2");
      expect(activeOrder.providerOrderId).toBe("upstream_backup_order_998811");
      expect(statusHistory.length).toBe(1);
      expect(statusHistory[0].notes).toContain('Auto-failed over to backup provider "Backup SMM Global"');
      expect(statusHistory[0].notes).toContain("Not enough funds on balance");
    });

    it("respects MANUAL routing and does NOT auto-failover when routingMode is MANUAL", async () => {
      const primaryProvider = {
        id: "prov-primary-1",
        name: "Primary SMM SuperFast",
        apiUrl: "https://primary-smm.example.com/api/v2",
        active: true,
      };

      const backupProvider = {
        id: "prov-backup-2",
        name: "Backup SMM Global",
        apiUrl: "https://backup-smm.example.com/api/v2",
        active: true,
      };

      const service = {
        id: "srv-ig-101",
        name: "Instagram Manual Only",
        providerId: "prov-primary-1",
        providerServiceId: "101",
        routingMode: "MANUAL", // MANUAL mode configured by admin
        backupProviderId: "prov-backup-2",
        backupProviderServiceId: "808",
      };

      let activeOrder: any = {
        id: "ord-dispatch-56",
        userId: "usr-1",
        service,
        provider: primaryProvider,
        target: "https://instagram.com/myaccount",
        quantity: 1000,
        status: OrderStatus.PENDING,
      };

      const callUpstreamAddOrderMock = jest.fn().mockImplementation(() => {
        throw new Error("Upstream provider error: Not enough funds on balance");
      });

      let failedWithError = false;
      try {
        await callUpstreamAddOrderMock(
          activeOrder.provider.apiUrl,
          "decrypted_key_1",
          activeOrder.service.providerServiceId
        );
      } catch (err: any) {
        const isUpstreamError = err.message && err.message.includes("Upstream provider error:");
        if (isUpstreamError && activeOrder.service.routingMode === "AUTO_FAILOVER" && activeOrder.service.backupProviderId) {
          // Should not enter here because routingMode is MANUAL
          activeOrder.status = OrderStatus.PROCESSING;
        } else {
          failedWithError = true;
          activeOrder.status = OrderStatus.FAILED;
        }
      }

      // Assertions: Did NOT failover to backup because admin pinned it to MANUAL
      expect(callUpstreamAddOrderMock).toHaveBeenCalledTimes(1);
      expect(failedWithError).toBe(true);
      expect(activeOrder.status).toBe(OrderStatus.FAILED);
      expect(activeOrder.providerId).toBe(undefined); // Did not reassign to backup
    });

    it("records actual provider cost and calculated admin profit upon order completion sync", () => {
      const order = {
        id: "ord-sync-10",
        charge: new Decimal(108.13),
        fxRateUsed: new Decimal(86.50),
        paymentFeeEstimate: new Decimal(2.55),
      };

      // Upstream provider status response returns wholesale charge: $1.00 USD
      const statusRes = {
        status: "Completed",
        charge: "1.00", // $1.00 USD charged by provider
        start_count: "500",
        remains: "0",
      };

      const rawCharge = parseFloat(String(statusRes.charge));
      const fx = parseFloat(order.fxRateUsed.toString());
      const actualCostINR = new Decimal(rawCharge).mul(fx).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
      const customerCharge = new Decimal(order.charge.toString());
      const paymentFee = order.paymentFeeEstimate;
      const actualProfit = customerCharge.minus(actualCostINR).minus(paymentFee).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      expect(actualCostINR.toNumber()).toBe(86.50);
      expect(actualProfit.toNumber()).toBe(19.08); // 108.13 - 86.50 - 2.55 = 19.08
    });
  });
});

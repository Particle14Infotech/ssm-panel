import { SmmProviderClient } from "../providers/smm-provider.client";
import { encryptProviderKey, decryptProviderKey } from "../../common/crypto.util";
import { calculateOrderCharge } from "../../common/money.util";
import { Decimal } from "decimal.js";

describe("PHASE 4: Services, Providers and Orders Backend Flow Tests", () => {
  describe("1. SMM Provider Encryption & Masking", () => {
    it("encrypts and decrypts provider API key using AES-256-GCM authenticated cipher", () => {
      const originalKey = "sk_live_alpha_node_secret_key_9988";
      const encrypted = encryptProviderKey(originalKey);

      expect(encrypted).not.toEqual(originalKey);
      expect(encrypted.split(":")).toHaveLength(3); // iv:authTag:ciphertext

      const decrypted = decryptProviderKey(encrypted);
      expect(decrypted).toEqual(originalKey);
    });

    it("fails decryption when ciphertext or authentication tag is tampered with", () => {
      const encrypted = encryptProviderKey("test_secret_key");
      const [iv, tag, cipher] = encrypted.split(":");
      const tamperedCipher = Buffer.from(cipher, "base64");
      tamperedCipher[0] = tamperedCipher[0] ^ 0xff; // bit-flip byte
      const tamperedPayload = `${iv}:${tag}:${tamperedCipher.toString("base64")}`;

      expect(() => decryptProviderKey(tamperedPayload)).toThrow();
    });
  });

  describe("2. Standard SMM API Provider Client Actions", () => {
    let client: SmmProviderClient;

    beforeEach(() => {
      client = new SmmProviderClient();
    });

    it("fetches upstream provider catalog via action: services", async () => {
      const services = await client.getServices("simulated://upstream.smm/api/v2", "mock_key");
      expect(Array.isArray(services)).toBe(true);
      expect(services.length).toBeGreaterThan(0);
      expect(services[0]).toHaveProperty("service");
      expect(services[0]).toHaveProperty("rate");
    });

    it("dispatches new order to upstream provider via action: add", async () => {
      const res = await client.addOrder("simulated://upstream.smm/api/v2", "mock_key", "101", "https://instagram.com/p/test", 1000);
      expect(res).toHaveProperty("order");
      expect(typeof res.order).toBe("string");
    });

    it("polls order status from upstream provider via action: status", async () => {
      const statusRes = await client.getOrderStatus("simulated://upstream.smm/api/v2", "mock_key", "ord_1001");
      expect(statusRes).toHaveProperty("status");
      expect(statusRes).toHaveProperty("remains");
      expect(statusRes).toHaveProperty("start_count");
    });

    it("fetches upstream provider account balance via action: balance", async () => {
      const balanceRes = await client.getBalance("simulated://upstream.smm/api/v2", "mock_key");
      expect(balanceRes).toHaveProperty("balance");
      expect(Number(balanceRes.balance)).toBeGreaterThan(0);
    });

    it("requests refill via action: refill", async () => {
      const refillRes = await client.requestRefill("simulated://upstream.smm/api/v2", "mock_key", "ord_1001");
      expect(refillRes).toHaveProperty("refill");
    });

    it("requests cancellation via action: cancel", async () => {
      const cancelRes = await client.cancelOrder("simulated://upstream.smm/api/v2", "mock_key", "ord_1001");
      expect(Array.isArray(cancelRes)).toBe(true);
      expect(cancelRes[0]).toHaveProperty("cancel");
    });
  });

  describe("3. Order Charge Calculation & Financial Precision", () => {
    it("calculates exact charge = rate x quantity / 1000 without float drift", () => {
      const ratePer1000 = 180.50;
      const quantity = 2500;
      const charge = calculateOrderCharge(quantity, ratePer1000);

      // 2500 * 180.50 / 1000 = 451.25
      expect(charge.toNumber()).toBe(451.25);
    });

    it("handles large quantities and fractional rates precisely", () => {
      const ratePer1000 = 22.33;
      const quantity = 50000;
      const charge = calculateOrderCharge(quantity, ratePer1000);

      // 50000 * 22.33 / 1000 = 1116.50
      expect(charge.toNumber()).toBe(1116.50);
    });

    it("calculates proportional refund for PARTIAL orders exactly", () => {
      const quantity = 1000;
      const charge = new Decimal(200.00);
      const remains = 300; // 300 out of 1000 undelivered

      // (remains / quantity) * charge = (300 / 1000) * 200 = 60.00
      const refundAmount = charge.mul(remains).div(quantity).toDecimalPlaces(2);
      expect(refundAmount.toNumber()).toBe(60.00);
    });

    it("calculates zero refund when remains is 0", () => {
      const quantity = 5000;
      const charge = new Decimal(500.00);
      const remains = 0;

      const refundAmount = charge.mul(remains).div(quantity).toDecimalPlaces(2);
      expect(refundAmount.toNumber()).toBe(0.00);
    });

    it("calculates full refund when remains equals total quantity", () => {
      const quantity = 2000;
      const charge = new Decimal(350.00);
      const remains = 2000;

      const refundAmount = charge.mul(remains).div(quantity).toDecimalPlaces(2);
      expect(refundAmount.toNumber()).toBe(350.00);
    });
  });

  describe("4. Selling Rate & Margin Calculation", () => {
    it("computes selling rate = provider cost + margin % accurately", () => {
      const providerCost = 150.00;
      const marginPercent = 25; // 25%

      const sellingRate = Number((providerCost * (1 + marginPercent / 100)).toFixed(2));
      expect(sellingRate).toBe(187.50);
    });
  });
});

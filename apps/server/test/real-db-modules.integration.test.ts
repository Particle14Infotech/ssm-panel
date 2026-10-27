import { buildServer } from "../src/app";
import { PrismaConnection } from "../src/prisma";
import { assertSafeTestDatabase } from "../src/utils/db-safety-guard";
import jwt from "jsonwebtoken";

describe("P5: Multi-Module Real PostgreSQL Integration Suite", () => {
  let app: any;
  let prisma: PrismaConnection;
  let adminToken: string;

  beforeAll(async () => {
    assertSafeTestDatabase();
    process.env.JWT_ACCESS_SECRET = "jwt-secret-min-32-chars-for-test!!";
    prisma = new PrismaConnection();
    app = await buildServer({ prisma });
    await app.ready();

    adminToken = jwt.sign(
      { sub: "admin-test-id", email: "admin@smm.dev", role: "ADMIN" },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.disconnect();
    }
  });

  describe("1. Health Module Live DB Check", () => {
    it("GET /api/v1/health/ready executes SELECT 1 against PostgreSQL", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/health/ready",
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.services.database).toBe("connected");
      expect(body.status).toBe("ready");
    });
  });

  describe("2. Services & Catalog Module", () => {
    it("queries categories and services with real relations", async () => {
      const categories = await prisma.client.category.findMany({
        take: 5,
        include: { services: { take: 2 } },
      });
      expect(Array.isArray(categories)).toBe(true);
    });

    it("executes uncategorized services filter without schema violation", async () => {
      const uncategorized = await prisma.client.service.findMany({
        where: {
          isDeleted: false,
          active: true,
          categoryId: "",
        },
      });
      expect(Array.isArray(uncategorized)).toBe(true);
    });

    it("GET /api/v1/services returns live service listings", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/services",
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });

  describe("3. Platforms & Settings Modules", () => {
    it("GET /api/v1/platforms returns platform listings from database", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/platforms",
      });
      expect(res.statusCode).toBe(200);
    });

    it("GET /api/v1/settings returns system configuration with Admin token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/settings",
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      });
      expect(res.statusCode).toBe(200);
    });

    it("queries SystemSetting model directly against PostgreSQL", async () => {
      const settings = await prisma.client.systemSetting.findMany({
        take: 5,
      });
      expect(Array.isArray(settings)).toBe(true);
    });
  });

  describe("4. Announcements Module", () => {
    it("GET /api/v1/announcements fetches active announcements", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/announcements",
      });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });
  });

  describe("5. Providers Module Schema Integrity", () => {
    it("queries providers table without field mapping errors", async () => {
      const providers = await prisma.client.provider.findMany({
        take: 5,
      });
      expect(Array.isArray(providers)).toBe(true);
    });
  });

  describe("6. Users & Roles Schema Integrity", () => {
    it("queries users table with valid schema fields", async () => {
      const users = await prisma.client.user.findMany({
        take: 2,
        select: {
          id: true,
          email: true,
          role: true,
          tier: true,
          twoFactorEnabled: true,
          isDeleted: true,
        },
      });
      expect(Array.isArray(users)).toBe(true);
    });
  });

  describe("7. Orders & Wallet Schema Integrity", () => {
    it("queries orders table schema", async () => {
      const orders = await prisma.client.order.findMany({
        take: 2,
      });
      expect(Array.isArray(orders)).toBe(true);
    });

    it("queries wallet and LedgerEntry tables schema", async () => {
      const wallets = await prisma.client.wallet.findMany({
        take: 2,
      });
      const ledgers = await prisma.client.ledgerEntry.findMany({
        take: 2,
      });
      expect(Array.isArray(wallets)).toBe(true);
      expect(Array.isArray(ledgers)).toBe(true);
    });
  });

  describe("8. Tickets & Support Schema Integrity", () => {
    it("queries tickets and ticketMessage tables without mismatch", async () => {
      const tickets = await prisma.client.ticket.findMany({
        take: 2,
      });
      const messages = await prisma.client.ticketMessage.findMany({
        take: 2,
      });
      expect(Array.isArray(tickets)).toBe(true);
      expect(Array.isArray(messages)).toBe(true);
    });
  });

  describe("9. Packages & Outbox Schema Integrity", () => {
    it("queries packages and outboxEvent tables schema", async () => {
      const packages = await prisma.client.package.findMany({
        take: 2,
      });
      const events = await prisma.client.outboxEvent.findMany({
        take: 2,
      });
      expect(Array.isArray(packages)).toBe(true);
      expect(Array.isArray(events)).toBe(true);
    });
  });
});

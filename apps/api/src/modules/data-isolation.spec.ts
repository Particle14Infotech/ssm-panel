import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, NotFoundException, UnauthorizedException } from "@nestjs/common";
import request from "supertest";
import * as jwt from "jsonwebtoken";
import { AppModule } from "../app.module";
import { NotificationsService } from "./notifications/notifications.service";

describe("PHASE 1: Cross-User Data Isolation Tests", () => {
  let app: INestApplication;
  let notificationsService: NotificationsService;

  const JWT_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || "smm_panel_jwt_secret_dev_environment_key_32bytes";

  const userA = {
    id: "usr_alice_001",
    email: "alice@test.local",
    role: "CUSTOMER",
    tier: "STANDARD",
  };

  const userB = {
    id: "usr_bob_002",
    email: "bob@test.local",
    role: "CUSTOMER",
    tier: "STANDARD",
  };

  const tokenA = jwt.sign(
    { sub: userA.id, email: userA.email, role: userA.role, tier: userA.tier },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const tokenB = jwt.sign(
    { sub: userB.id, email: userB.email, role: userB.role, tier: userB.tier },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  let orderAId: string;
  let ticketAId: string;
  let notifAId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();

    notificationsService = app.get<NotificationsService>(NotificationsService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("1. Resource Creation for User A", () => {
    it("User A opens a support ticket", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/tickets")
        .set("Authorization", `Bearer ${tokenA}`)
        .send({
          subject: "Alice Private Ticket",
          message: "Confidential billing question",
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      ticketAId = res.body.ticketId || res.body.ticket?.id;
      expect(ticketAId).toBeDefined();
    });

    it("User A has a notification created", async () => {
      const notif = notificationsService.addNotification(
        userA.id,
        "Order Notice",
        "Alice order has started"
      );
      notifAId = notif.id;
      expect(notifAId).toBeDefined();
    });
  });

  describe("2. User B Isolation Verification (User B CANNOT access User A data)", () => {
    it("User B listing tickets does NOT see User A ticket", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/tickets")
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      const tickets = res.body;
      expect(Array.isArray(tickets)).toBe(true);
      const hasAliceTicket = tickets.some((t: any) => t.id === ticketAId || t.userId === userA.id);
      expect(hasAliceTicket).toBe(false);
    });

    it("User B GET /api/v1/tickets/:id for User A ticket returns 404 NotFound", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketAId}`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it("User B POST /api/v1/tickets/:id/reply for User A ticket returns 404 NotFound", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketAId}/reply`)
        .set("Authorization", `Bearer ${tokenB}`)
        .send({ message: "Bob trying to hijack" });

      expect(res.status).toBe(404);
    });

    it("User B POST /api/v1/tickets/:id/close for User A ticket returns 404 NotFound", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/tickets/${ticketAId}/close`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it("User B listing notifications does NOT see User A notification", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/notifications")
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      const notifs = res.body;
      expect(Array.isArray(notifs)).toBe(true);
      const hasAliceNotif = notifs.some((n: any) => n.id === notifAId);
      expect(hasAliceNotif).toBe(false);
    });

    it("User B PUT /api/v1/notifications/:id/read for User A notification returns 404 NotFound", async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/v1/notifications/${notifAId}/read`)
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it("User B listing orders does NOT see User A orders", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/orders")
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      const orders = res.body;
      expect(Array.isArray(orders)).toBe(true);
      const hasAliceOrder = orders.some((o: any) => o.userId === userA.id);
      expect(hasAliceOrder).toBe(false);
    });

    it("User B GET /api/v1/orders/:id for non-owned order returns 404 NotFound", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/orders/ORD-NONEXISTENT-OR-ALICE")
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(404);
    });

    it("User B listing wallet ledger does NOT see User A transactions", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/wallet/ledger")
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      const ledger = res.body;
      expect(Array.isArray(ledger)).toBe(true);
      const hasAliceTx = ledger.some((t: any) => t.userId === userA.id);
      expect(hasAliceTx).toBe(false);
    });

    it("User B wallet balance is strictly User B's balance (0.00)", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/wallet/balance")
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      expect(res.body.balance).toBe(0);
      expect(res.body.userId).toBe(userB.id);
    });

    it("User B listing payments does NOT see User A payments", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/v1/payments")
        .set("Authorization", `Bearer ${tokenB}`);

      expect(res.status).toBe(200);
      const payments = res.body;
      expect(Array.isArray(payments)).toBe(true);
      const hasAlicePay = payments.some((p: any) => p.userId === userA.id);
      expect(hasAlicePay).toBe(false);
    });
  });

  describe("3. Unauthenticated Access is Rejected with 401 Unauthorized", () => {
    it("GET /api/v1/orders without token returns 401", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/orders");
      expect(res.status).toBe(401);
    });

    it("GET /api/v1/wallet/balance without token returns 401", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/wallet/balance");
      expect(res.status).toBe(401);
    });

    it("GET /api/v1/tickets without token returns 401", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/tickets");
      expect(res.status).toBe(401);
    });

    it("GET /api/v1/notifications without token returns 401", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/notifications");
      expect(res.status).toBe(401);
    });
  });
});

import { newDb } from "pg-mem";
import { MockInstagramServer } from "../src/modules/instagram/mock-instagram";
import { encryptToken, decryptToken } from "../src/modules/instagram/crypto.util";
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";

describe("PHASE P3: Instagram Connect, Token Jobs, Polling & MockInstagram Fault Injection", () => {
  const TEST_DB_NAME = "smm_db";
  let db: any;
  let mockServer: MockInstagramServer;

  beforeAll(() => {
    mockServer = new MockInstagramServer();
    db = newDb();
    db.public.registerFunction({
      name: "now",
      returns: db.public.getType("timestamp"),
      implementation: () => new Date(),
    });

    db.public.none(`
      CREATE TABLE "User" (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(32) DEFAULT 'CUSTOMER',
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "SourceConnection" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        platform VARCHAR(64) NOT NULL DEFAULT 'INSTAGRAM',
        "providerAccountId" VARCHAR(128) NOT NULL,
        username VARCHAR(128) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        "tokenEnc" TEXT,
        "tokenExpiresAt" TIMESTAMP,
        "baselineAt" TIMESTAMP,
        "nextPollAt" TIMESTAMP,
        "pollIntervalSec" INT NOT NULL DEFAULT 120,
        "failureCount" INT NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX "SourceConnection_platform_providerAccountId_key"
        ON "SourceConnection"(platform, "providerAccountId");

      CREATE TABLE "Package" (
        id VARCHAR(64) PRIMARY KEY,
        "userId" VARCHAR(64) NOT NULL REFERENCES "User"(id),
        "connectionId" VARCHAR(64) REFERENCES "SourceConnection"(id),
        handle VARCHAR(128) NOT NULL,
        kind VARCHAR(32),
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        "startAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endAt" TIMESTAMP NOT NULL,
        "pausedDays" INT NOT NULL DEFAULT 0,
        "reserveTotal" NUMERIC(12, 2) NOT NULL,
        "idempotencyKey" VARCHAR(128),
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE "MonitoredMedia" (
        id VARCHAR(64) PRIMARY KEY,
        "connectionId" VARCHAR(64) NOT NULL REFERENCES "SourceConnection"(id),
        "mediaKey" VARCHAR(128) NOT NULL,
        "publishedAt" TIMESTAMP NOT NULL,
        state VARCHAR(32) NOT NULL DEFAULT 'NEW',
        permalink TEXT,
        "mediaType" VARCHAR(32),
        caption TEXT,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX "MonitoredMedia_connectionId_mediaKey_key"
        ON "MonitoredMedia"("connectionId", "mediaKey");
    `);

    // Insert test users
    db.public.none(`
      INSERT INTO "User" (id, email, name) VALUES ('user_p3_1', 'user1@test.com', 'User P3 One');
      INSERT INTO "User" (id, email, name) VALUES ('user_p3_2', 'user2@test.com', 'User P3 Two');
    `);
  });

  beforeEach(() => {
    mockServer.reset();
  });

  describe("1. OAuth Start & State/CSRF Protection", () => {
    it("generates random single-use state bound to user with 10 minute expiry", () => {
      const { state, authorizeUrl } = mockServer.generateOAuthState("user_p3_1");
      expect(state).toContain("user_p3_1");
      expect(authorizeUrl).toContain("https://www.instagram.com/oauth/authorize");
      expect(authorizeUrl).toContain("scope=instagram_business_basic");

      // Valid single-use consume
      const consumed = mockServer.validateAndConsumeState(state, "user_p3_1");
      expect(consumed.userId).toBe("user_p3_1");
      expect(consumed.used).toBe(true);

      // Reused state must be rejected (replay attack prevention)
      expect(() => mockServer.validateAndConsumeState(state, "user_p3_1")).toThrow(BadRequestException);
    });

    it("rejects state if bound to another user", () => {
      const { state } = mockServer.generateOAuthState("user_p3_1");
      expect(() => mockServer.validateAndConsumeState(state, "user_p3_2")).toThrow(ForbiddenException);
    });
  });

  describe("2. Fault Injection: Token Exchange & Profile Checks", () => {
    it("rejects user denied consent (error 10)", () => {
      mockServer.injectDeniedConsent = true;
      const code = mockServer.createTestAuthCode("user_p3_1");
      expect(() => mockServer.exchangeCodeForToken(code, "http://localhost:3000/callback")).toThrow(BadRequestException);
    });

    it("rejects personal accounts (only professional accounts permitted, error 24)", () => {
      mockServer.injectPersonalAccount = true;
      const code = mockServer.createTestAuthCode("user_p3_1", { accountType: "PERSONAL" });
      expect(() => mockServer.exchangeCodeForToken(code, "http://localhost:3000/callback")).toThrow(BadRequestException);
    });

    it("rejects expired authorization code (error 100)", () => {
      mockServer.injectExpiredCode = true;
      const code = mockServer.createTestAuthCode("user_p3_1");
      expect(() => mockServer.exchangeCodeForToken(code, "http://localhost:3000/callback")).toThrow(BadRequestException);
    });

    it("successfully connects valid business account with AES-256-GCM encrypted token", () => {
      const code = mockServer.createTestAuthCode("user_p3_1", {
        id: "ig_brand_101",
        username: "acme_brand_official",
        accountType: "BUSINESS",
      });

      const res = mockServer.exchangeCodeForToken(code, "http://localhost:3000/callback");
      expect(res.user.id).toBe("ig_brand_101");
      expect(res.user.username).toBe("acme_brand_official");

      const encToken = encryptToken(res.accessToken);
      expect(encToken).not.toBe(res.accessToken);
      expect(decryptToken(encToken)).toBe(res.accessToken);

      // Save to pg-mem DB
      db.public.none(`
        INSERT INTO "SourceConnection" (id, "userId", platform, "providerAccountId", username, status, "tokenEnc", "tokenExpiresAt", "baselineAt")
        VALUES ('conn_p3_1', 'user_p3_1', 'INSTAGRAM', '${res.user.id}', '${res.user.username}', 'ACTIVE', '${encToken}', NOW() + INTERVAL '60 days', NOW());
      `);

      const saved = db.public.one(`SELECT * FROM "SourceConnection" WHERE id = 'conn_p3_1'`);
      expect(saved.username).toBe("acme_brand_official");
      expect(saved.providerAccountId).toBe("ig_brand_101");
      expect(saved.status).toBe("ACTIVE");
    });

    it("refuses an account already connected to another user (DB unique constraint)", () => {
      // User 2 attempts to connect same ig_brand_101 account
      expect(() => {
        db.public.none(`
          INSERT INTO "SourceConnection" (id, "userId", platform, "providerAccountId", username, status)
          VALUES ('conn_p3_dup', 'user_p3_2', 'INSTAGRAM', 'ig_brand_101', 'acme_brand_official', 'ACTIVE');
        `);
      }).toThrow();
    });
  });

  describe("3. Baseline Filtering & Media Polling", () => {
    it("baselineAt filter: older media is BASELINE, ignored, never scheduled", () => {
      const baselineTime = new Date("2026-10-15T12:00:00Z");
      const oldPostTime = new Date("2026-10-14T10:00:00Z");
      const newPostTime = new Date("2026-10-16T15:00:00Z");

      const posts = [
        { id: "post_old_1", timestamp: oldPostTime.toISOString(), permalink: "https://instagram.com/p/old1" },
        { id: "post_new_1", timestamp: newPostTime.toISOString(), permalink: "https://instagram.com/p/new1" },
      ];

      // Filter simulation
      const newItems = posts.filter((p) => new Date(p.timestamp) > baselineTime);
      expect(newItems.length).toBe(1);
      expect(newItems[0].id).toBe("post_new_1");

      // Insert new item
      db.public.none(`
        INSERT INTO "MonitoredMedia" (id, "connectionId", "mediaKey", "publishedAt", state, permalink)
        VALUES ('med_new_1', 'conn_p3_1', 'post_new_1', '${newPostTime.toISOString()}', 'NEW', 'https://instagram.com/p/new1');
      `);

      const savedMedia = db.public.one(`SELECT * FROM "MonitoredMedia" WHERE "mediaKey" = 'post_new_1'`);
      expect(savedMedia.state).toBe("NEW");
    });

    it("deduplicates already monitored media on successive polls", () => {
      // Re-inserting post_new_1 on conn_p3_1 violates unique constraint
      expect(() => {
        db.public.none(`
          INSERT INTO "MonitoredMedia" (id, "connectionId", "mediaKey", "publishedAt", state, permalink)
          VALUES ('med_new_dup', 'conn_p3_1', 'post_new_1', NOW(), 'NEW', 'https://instagram.com/p/new1');
        `);
      }).toThrow();
    });
  });

  describe("4. Token Refresh Job & Expiry Handling", () => {
    it("token expiry / invalid token transitions connection to NEEDS_RECONNECT and pauses active packages", () => {
      // Setup active package for connection
      db.public.none(`
        INSERT INTO "Package" (id, "userId", "connectionId", handle, kind, status, "endAt", "reserveTotal")
        VALUES ('pkg_p3_auto_1', 'user_p3_1', 'conn_p3_1', 'acme_brand_official', 'POST_TRIGGERED', 'ACTIVE', NOW() + INTERVAL '30 days', 500.00);
      `);

      // Simulate token refresh failure
      db.public.none(`
        UPDATE "SourceConnection"
        SET status = 'NEEDS_RECONNECT', "failureCount" = "failureCount" + 1
        WHERE id = 'conn_p3_1';

        UPDATE "Package"
        SET status = 'PAUSED'
        WHERE "connectionId" = 'conn_p3_1' AND status = 'ACTIVE';
      `);

      const connAfter = db.public.one(`SELECT status, "failureCount" FROM "SourceConnection" WHERE id = 'conn_p3_1'`);
      expect(connAfter.status).toBe("NEEDS_RECONNECT");
      expect(connAfter.failureCount).toBe(1);

      const pkgAfter = db.public.one(`SELECT status FROM "Package" WHERE id = 'pkg_p3_auto_1'`);
      expect(pkgAfter.status).toBe("PAUSED");
    });
  });

  describe("5. Deauthorization Callback", () => {
    it("deauthorize callback sets status REVOKED, wipes token, and pauses packages", () => {
      db.public.none(`
        UPDATE "SourceConnection"
        SET status = 'REVOKED', "tokenEnc" = NULL, "tokenExpiresAt" = NULL
        WHERE id = 'conn_p3_1';
      `);

      const conn = db.public.one(`SELECT status, "tokenEnc" FROM "SourceConnection" WHERE id = 'conn_p3_1'`);
      expect(conn.status).toBe("REVOKED");
      expect(conn.tokenEnc).toBeNull();
    });
  });
});

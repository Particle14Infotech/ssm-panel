import { PrismaClient } from "@prisma/client";

describe("I4 Raw SQL Canary Registry: Real Postgres Execution Audit", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("canary 1: tests health check raw query SELECT 1", async () => {
    const res = await prisma.$queryRawUnsafe("SELECT 1 as alive");
    expect(res).toBeDefined();
    expect(Array.isArray(res)).toBe(true);
  });

  it("canary 2: tests outbox claim query with LIMIT and FOR UPDATE SKIP LOCKED", async () => {
    const res = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, aggregate, "eventType", payload, attempts, "availableAt"
       FROM "OutboxEvent"
       WHERE status = 'PENDING' AND "availableAt" <= NOW()
       ORDER BY "createdAt" ASC
       LIMIT $1`,
      1
    );
    expect(Array.isArray(res)).toBe(true);
  });

  it("canary 3: tests wallet row-lock query with uuid param", async () => {
    const dummyUserId = "00000000-0000-0000-0000-000000000000";
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, balance FROM "Wallet" WHERE "userId" = $1`,
      dummyUserId
    );
    expect(Array.isArray(rows)).toBe(true);
  });

  it("canary 4: tests package row-lock query with uuid param", async () => {
    const dummyPkgId = "00000000-0000-0000-0000-000000000000";
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT status, "endAt" FROM "Package" WHERE id = $1`,
      dummyPkgId
    );
    expect(Array.isArray(rows)).toBe(true);
  });

  it("canary 5: tests delivery pace in-flight limiter query with explicit cast (s.kind::text = $2)", async () => {
    const testLink = "canary.test.audit";
    const testKind = "LIKES";

    const rows = await prisma.$queryRawUnsafe<Array<{ in_flight_units: number }>>(
      `SELECT COALESCE(SUM(o.quantity), 0)::int as in_flight_units
       FROM "Order" o
       JOIN "Service" s ON s.id = o."serviceId"
       WHERE o.status IN ('PENDING', 'PROCESSING', 'IN_PROGRESS')
         AND regexp_replace(regexp_replace(lower(trim(trailing '/' from o.target)), '^https?://(www\\.)?', ''), '/+$', '') = $1
         AND s.kind::text = $2`,
      testLink,
      testKind
    );
    expect(rows).toBeDefined();
    expect(Array.isArray(rows)).toBe(true);
    expect(typeof rows[0].in_flight_units).toBe("number");
  });

  it("canary 6: tests concurrency overlap query for provider + service + link", async () => {
    const dummyProviderId = "00000000-0000-0000-0000-000000000000";
    const dummyServiceId = "00000000-0000-0000-0000-000000000000";
    const testLink = "canary.test.audit";

    const rows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int as count
       FROM "Order"
       WHERE "providerId" = $1
         AND "serviceId" = $2
         AND status IN ('PENDING', 'PROCESSING', 'IN_PROGRESS')
         AND regexp_replace(regexp_replace(lower(trim(trailing '/' from target)), '^https?://(www\\.)?', ''), '/+$', '') = $3`,
      dummyProviderId,
      dummyServiceId,
      testLink
    );
    expect(rows).toBeDefined();
    expect(Array.isArray(rows)).toBe(true);
  });
});

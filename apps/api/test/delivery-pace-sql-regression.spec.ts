import { PrismaClient } from "@prisma/client";

describe("I1 Regression Gate: Delivery Pace Limiter Postgres Typecast Bug (42883) & Fix Verification", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Test 1: Unfixed raw query reproduces Postgres error 42883
  it("confirms unfixed raw query reproduces Postgres error 42883 when comparing ServiceKind enum with text", async () => {
    const normLink = "instagram.com/reel/dfmallpsocm";
    const kind = "LIKES";

    let errorCaught: any = null;
    try {
      await prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(o.quantity), 0)::int as in_flight_units
         FROM "Order" o
         JOIN "Service" s ON s.id = o."serviceId"
         WHERE o.status IN ('PENDING', 'PROCESSING', 'IN_PROGRESS')
           AND regexp_replace(regexp_replace(lower(trim(trailing '/' from o.target)), '^https?://(www\\.)?', ''), '/+$', '') = $1
           AND s.kind = $2`,
        normLink,
        kind
      );
    } catch (err: any) {
      errorCaught = err;
    }

    expect(errorCaught).not.toBeNull();
    expect(errorCaught.message).toContain("42883");
    expect(errorCaught.message).toMatch(/operator does not exist: "ServiceKind" = text/i);
  });

  // Test 2: Fixed raw query with explicit cast (s.kind::text = $2) succeeds for ALL ServiceKind values
  it("verifies fixed raw query (s.kind::text = $2) succeeds for EVERY ServiceKind value and fallback DEFAULT", async () => {
    const normLink = "instagram.com/reel/dfmallpsocm";
    const allKinds = [
      "LIKES",
      "VIEWS",
      "FOLLOWERS",
      "SUBSCRIBERS",
      "COMMENTS",
      "REACH",
      "IMPRESSIONS",
      "SHARES",
      "SAVES",
      "OTHER",
      "DEFAULT", // fallback string when kind is null or unset
    ];

    for (const kind of allKinds) {
      const result = await prisma.$queryRawUnsafe<Array<{ in_flight_units: number }>>(
        `SELECT COALESCE(SUM(o.quantity), 0)::int as in_flight_units
         FROM "Order" o
         JOIN "Service" s ON s.id = o."serviceId"
         WHERE o.status IN ('PENDING', 'PROCESSING', 'IN_PROGRESS')
           AND regexp_replace(regexp_replace(lower(trim(trailing '/' from o.target)), '^https?://(www\\.)?', ''), '/+$', '') = $1
           AND s.kind::text = $2`,
        normLink,
        kind
      );
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(typeof result[0].in_flight_units).toBe("number");
    }
  }, 20000);

  // Test 3: Candidate selection query verification (dispatchable only, fair per package)
  it("verifies the I1 candidate selection query executes cleanly on real database", async () => {
    const terminalStatuses = `'COMPLETED','PARTIAL','FAILED','CANCELLED','SKIPPED_PAUSED','SKIPPED_QUOTA','SKIPPED_TYPE','SKIPPED_DELETED','SKIPPED_LIMIT','STALLED'`;

    // Dynamic column check matching worker logic
    const colCheck = await prisma.$queryRawUnsafe<any[]>(`
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'PackageExecution' AND column_name = 'nextAttemptAt'
      LIMIT 1
    `);
    const hasBackoffCols = Array.isArray(colCheck) && colCheck.length > 0;

    const backoffFilter = hasBackoffCols
      ? `AND (e."nextAttemptAt" IS NULL OR e."nextAttemptAt" <= $1) AND e.attempts < $2`
      : "";

    const candidateSQL = `
      WITH candidates AS (
        SELECT e.id, e."packageId",
               ROW_NUMBER() OVER (PARTITION BY e."packageId" ORDER BY e."executeAt" ASC) AS rn
        FROM "PackageExecution" e
        JOIN "Package" p ON p.id = e."packageId"
        WHERE e.status = 'SCHEDULED'
          AND e."executeAt" <= $1
          ${backoffFilter}
          AND (
            e.seq <= 1
            OR e.source != 'SCHEDULE'
            OR EXISTS (
              SELECT 1 FROM "PackageExecution" pred
              WHERE pred."packageId" = e."packageId"
                AND pred."ruleId" = e."ruleId"
                AND pred.source = 'SCHEDULE'
                AND pred.seq = e.seq - 1
                AND pred.status::text IN (${terminalStatuses})
            )
          )
      )
      SELECT c.id, c."packageId"
      FROM candidates c
      WHERE c.rn <= $2
      ORDER BY c.rn ASC
      LIMIT 25
    `;

    const now = new Date();
    const K = 2;

    const candidates = await prisma.$queryRawUnsafe<Array<{ id: string; packageId: string }>>(
      candidateSQL,
      now,
      K
    );

    expect(candidates).toBeDefined();
    expect(Array.isArray(candidates)).toBe(true);
    expect(candidates.length).toBeGreaterThan(0);
  });
});

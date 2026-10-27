import { buildServer } from "../src/app";
import { PrismaConnection } from "../src/prisma";
import { assertSafeTestDatabase } from "../src/utils/db-safety-guard";

describe("P4: Real PostgreSQL Integration Test - Catalog Grouped", () => {
  let app: any;
  let prisma: PrismaConnection;

  beforeAll(async () => {
    assertSafeTestDatabase();
    prisma = new PrismaConnection();
    app = await buildServer({ prisma });
    await app.ready();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.disconnect();
    }
  });

  it("should fetch grouped catalog from real PostgreSQL without Prisma schema errors", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/catalog/grouped",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("categories");
    expect(Array.isArray(body.categories)).toBe(true);

    if (body.categories.length > 0) {
      const firstCategory = body.categories[0];
      expect(firstCategory).toHaveProperty("id");
      expect(firstCategory).toHaveProperty("name");
      expect(firstCategory).toHaveProperty("slug");
      expect(firstCategory).toHaveProperty("services");
      expect(Array.isArray(firstCategory.services)).toBe(true);
    }
  });

  it("should filter grouped catalog by platform without Prisma query errors", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/catalog/grouped?platform=INSTAGRAM",
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("categories");
    expect(Array.isArray(body.categories)).toBe(true);
  });

  it("verifies uncategorized service query succeeds on non-nullable categoryId column", async () => {
    // Directly invoke findMany with categoryId: "" against the real Prisma client
    const uncategorizedServices = await prisma.client.service.findMany({
      where: {
        isDeleted: false,
        active: true,
        categoryId: "",
      },
      orderBy: { ratePer1000: "asc" },
    });

    expect(Array.isArray(uncategorizedServices)).toBe(true);
  });
});

import fs from "fs";
import path from "path";
import { buildServer } from "../src/app";

interface RouteInfo {
  method: string;
  url: string;
  schema?: any;
}

function getTagForPath(p: string): string {
  if (p.startsWith("/api/v1/health") || p === "/health") return "Health";
  if (p.startsWith("/api/v1/auth")) return "Auth";
  if (p.startsWith("/api/v1/services") || p.startsWith("/api/v1/catalog")) return "Services & Catalog";
  if (p.startsWith("/api/v1/orders")) return "Orders";
  if (p.startsWith("/api/v1/packages")) return "Packages";
  if (p.startsWith("/api/v1/wallet")) return "Wallet & Ledger";
  if (p.startsWith("/api/v1/payments")) return "Payments";
  if (p.startsWith("/api/v1/providers")) return "Providers";
  if (p.startsWith("/api/v1/users")) return "Users";
  if (p.startsWith("/api/v1/tickets")) return "Tickets & Support";
  if (p.startsWith("/api/v1/favorites")) return "Favorites";
  if (p.startsWith("/api/v1/coupons")) return "Coupons";
  if (p.startsWith("/api/v1/announcements")) return "Announcements";
  if (p.startsWith("/api/v1/notifications")) return "Notifications";
  if (p.startsWith("/api/v1/settings")) return "Settings";
  if (p.startsWith("/api/v1/reseller")) return "Reseller API";
  if (p.startsWith("/api/v1/admin/platforms")) return "Admin Platform Rules & Blocklist";
  if (p.startsWith("/api/v1/admin/pricing")) return "Admin Pricing & Margins";
  if (p.startsWith("/api/v1/admin/profit")) return "Admin Profit";
  if (p.startsWith("/api/v1/admin/email")) return "Admin Email Telemetry";
  if (p.startsWith("/api/v1/reports")) return "Reports";
  if (p.startsWith("/api/v1/bonuses")) return "Bonuses";
  if (p.startsWith("/api/v1/platforms")) return "Platforms";
  return "General";
}

function isPublicRoute(method: string, p: string): boolean {
  if (p.startsWith("/api/v1/health") || p === "/health" || p === "/") return true;
  if (p === "/api/v1/auth/login" || p === "/api/v1/auth/register" || p === "/api/v1/auth/refresh") return true;
  if (p === "/api/v1/auth/forgot-password" || p === "/api/v1/auth/reset-password" || p === "/api/v1/auth/verify-email") return true;
  if (p === "/api/v1/payments/webhook" || p === "/api/v1/payments/sandbox-complete") return true;
  if (method === "GET" && (p === "/api/v1/catalog/grouped" || p === "/api/v1/services" || p.startsWith("/api/v1/services/"))) return true;
  return false;
}

async function exportOpenApi() {
  const collectedRoutes: RouteInfo[] = [];

  const dummyPrisma = {
    isConnected: true,
    client: {},
  };
  const dummyCache = {
    get: async () => null,
    set: async () => {},
    del: async () => {},
  };

  const app = await buildServer({
    prisma: dummyPrisma,
    cache: dummyCache,
    onRoute: (routeOptions) => {
      const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method];
      for (const m of methods) {
        if (m === "HEAD" || m === "OPTIONS") continue;
        if (routeOptions.url === "*" || routeOptions.url === "/*") continue;
        collectedRoutes.push({
          method: m,
          url: routeOptions.url,
          schema: routeOptions.schema,
        });
      }
    },
  });

  await app.ready();

  const openApiDoc: any = {
    openapi: "3.0.0",
    info: {
      title: "SMM PANEL Platform API",
      description: "Modular Monolith Fastify REST API for SMM Services, Orders, Ledger & Resellers",
      version: "1.0.0",
      contact: {},
    },
    servers: [
      {
        url: "http://localhost:4000",
        description: "Development Fastify Server",
      },
    ],
    paths: {},
    components: {
      securitySchemes: {
        bearer: {
          scheme: "bearer",
          bearerFormat: "JWT",
          type: "http",
        },
        "reseller-api-key": {
          type: "apiKey",
          in: "header",
          name: "X-API-KEY",
        },
      },
      schemas: {},
    },
  };

  for (const route of collectedRoutes) {
    // Convert Fastify path syntax :param to OpenAPI {param}
    const openApiPath = route.url.replace(/:([a-zA-Z0-9_]+)/g, "{$1}");
    if (!openApiDoc.paths[openApiPath]) {
      openApiDoc.paths[openApiPath] = {};
    }

    const methodLower = route.method.toLowerCase();
    const tag = getTagForPath(route.url);

    // Extract path parameters
    const paramMatches = [...route.url.matchAll(/:([a-zA-Z0-9_]+)/g)];
    const parameters = paramMatches.map((m) => ({
      name: m[1],
      in: "path",
      required: true,
      schema: {
        type: "string",
      },
      description: `${m[1]} path parameter`,
    }));

    // Security requirements
    const security: any[] = [];
    if (route.url.startsWith("/api/v1/reseller")) {
      security.push({ "reseller-api-key": [] });
      security.push({ bearer: [] });
    } else if (!isPublicRoute(route.method, route.url)) {
      security.push({ bearer: [] });
    }

    const responses: any = {
      200: {
        description: route.method === "POST" ? "Created / Accepted" : "Successful operation",
      },
    };
    if (security.length > 0) {
      responses[401] = { description: "Unauthorized" };
      responses[403] = { description: "Forbidden" };
    }
    responses[400] = { description: "Bad Request" };
    responses[500] = { description: "Internal Server Error" };

    openApiDoc.paths[openApiPath][methodLower] = {
      operationId: `${methodLower}_${openApiPath.replace(/[^a-zA-Z0-9]/g, "_")}`,
      summary: `${route.method} ${openApiPath}`,
      tags: [tag],
      parameters,
      responses,
      ...(security.length > 0 ? { security } : {}),
    };
  }

  const outPath = path.resolve(__dirname, "../../../docs/openapi.json");
  fs.writeFileSync(outPath, JSON.stringify(openApiDoc, null, 2), "utf8");
  console.log(`[PASS] Exported OpenAPI specification from Fastify server to ${outPath}`);
  console.log(`Total OpenAPI paths: ${Object.keys(openApiDoc.paths).length}`);

  await app.close();
}

exportOpenApi().catch((err) => {
  console.error("OpenAPI Export Error:", err);
  process.exit(1);
});

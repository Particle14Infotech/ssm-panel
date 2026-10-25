import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Client } from "pg";

export interface PgStartupCheckResult {
  testDatabaseUrl: string;
  hostHash: string;
  currentDb: string;
}

/**
 * Asserts that real PostgreSQL test environment is configured and connects.
 * Fails (throws) if DATABASE_URL_TEST is unset.
 * Prints connected host hash and current database.
 */
export async function assertRealPostgresStartup(options: { quiet?: boolean } = {}): Promise<PgStartupCheckResult> {
  // Try loading from .env.test if not present
  if (!process.env.DATABASE_URL_TEST) {
    const candidates = [
      path.resolve(__dirname, "../../../.env.test"),
      path.resolve(__dirname, "../../../../.env.test"),
      path.resolve(process.cwd(), ".env.test"),
      path.resolve(process.cwd(), "../../.env.test"),
    ];
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        const content = fs.readFileSync(cand, "utf8");
        for (const line of content.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const idx = trimmed.indexOf("=");
          if (idx !== -1) {
            const key = trimmed.substring(0, idx).trim();
            const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, "");
            if (key === "DATABASE_URL_TEST" || key === "DATABASE_URL") {
              process.env[key] = val;
            }
          }
        }
        break;
      }
    }
  }

  const testDatabaseUrl = process.env.DATABASE_URL_TEST;
  if (!testDatabaseUrl || testDatabaseUrl.trim() === "") {
    throw new Error(
      "FAIL: DATABASE_URL_TEST is unset. Real PostgreSQL is required for @pg tests. Skipping is not allowed."
    );
  }

  // Synchronize DATABASE_URL for Prisma / NestJS modules in this process
  process.env.DATABASE_URL = testDatabaseUrl;

  // Extract hostname and compute host hash
  let hostname = "unknown";
  try {
    const parsed = new URL(testDatabaseUrl);
    hostname = parsed.hostname;
  } catch {
    // If not a full URL, fallback
    hostname = "postgres-host";
  }

  const hostHash = crypto
    .createHash("sha256")
    .update(hostname)
    .digest("hex")
    .substring(0, 12);

  const client = new Client({
    connectionString: testDatabaseUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  let currentDb = "unknown";
  try {
    await client.connect();
    const res = await client.query("SELECT current_database()");
    currentDb = res.rows[0]?.current_database || "unknown";
  } catch (err: any) {
    throw new Error(
      `FAIL: Could not connect to real PostgreSQL at hostHash=${hostHash}: ${err?.message}`
    );
  } finally {
    try {
      await client.end();
    } catch {}
  }

  if (!options.quiet) {
    console.log(
      `[@pg STARTUP] Connected host hash: ${hostHash}, database: ${currentDb}`
    );
  }

  return { testDatabaseUrl, hostHash, currentDb };
}

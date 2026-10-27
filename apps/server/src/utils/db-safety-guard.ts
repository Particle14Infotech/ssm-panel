export function assertSafeUrl(varName: string, dbUrl?: string): void {
  if (!dbUrl) return;

  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch (err: any) {
    throw new Error(`[DB SAFETY GUARD] Invalid ${varName} format: ${err.message}`);
  }

  const host = (parsed.hostname || "").toLowerCase();

  // Explicit check for main production Neon database
  if (host.includes("ep-lingering-grass-aormacom")) {
    throw new Error(
      `[DB SAFETY GUARD CRITICAL] ${varName} points to main production database host "${host}" (ep-lingering-grass-aormacom). Aborting immediately.`
    );
  }

  const allowlist = (process.env.TEST_DB_HOST_ALLOWLIST || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  const defaultAllowed = ["localhost", "127.0.0.1", "::1", "postgres"];
  const isAllowed =
    defaultAllowed.includes(host) ||
    allowlist.some((allowed) => host === allowed || host.includes(allowed));

  if (!isAllowed) {
    throw new Error(
      `[DB SAFETY GUARD CRITICAL] ${varName} refused non-test host "${host}". ` +
      `Allowed hosts: localhost, 127.0.0.1, or hosts in TEST_DB_HOST_ALLOWLIST.`
    );
  }
}

export function assertSafeTestDatabase(env: Record<string, string | undefined> = process.env): void {
  const varsToCheck = ["DATABASE_URL", "DATABASE_URL_TEST", "DIRECT_URL"];
  for (const v of varsToCheck) {
    if (env[v]) {
      assertSafeUrl(v, env[v]);
    }
  }
}

export function assertSafeTestDatabase(dbUrl: string | undefined = process.env.DATABASE_URL): void {
  if (!dbUrl) {
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(dbUrl);
  } catch (err: any) {
    throw new Error(`[DB SAFETY GUARD] Invalid DATABASE_URL format: ${err.message}`);
  }

  const host = (parsed.hostname || "").toLowerCase();
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
      `[DB SAFETY GUARD CRITICAL] Refused to run against non-test database host "${host}". ` +
      `Allowed hosts: localhost, 127.0.0.1, or hosts in TEST_DB_HOST_ALLOWLIST.`
    );
  }
}

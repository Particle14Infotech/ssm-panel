function assertSafeTestDatabase(dbUrl = process.env.DATABASE_URL) {
  if (!dbUrl) {
    return;
  }
  let parsed;
  try {
    parsed = new URL(dbUrl);
  } catch (err) {
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

module.exports = { assertSafeTestDatabase };

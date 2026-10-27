import { assertSafeTestDatabase, assertSafeUrl } from "../src/utils/db-safety-guard";

describe("FIX 4: Test Database Safety Guard with 3-variable check", () => {
  const originalAllowlist = process.env.TEST_DB_HOST_ALLOWLIST;

  afterEach(() => {
    if (originalAllowlist !== undefined) {
      process.env.TEST_DB_HOST_ALLOWLIST = originalAllowlist;
    } else {
      delete process.env.TEST_DB_HOST_ALLOWLIST;
    }
  });

  it("should permit localhost, 127.0.0.1, and postgres hosts for all variables", () => {
    expect(() =>
      assertSafeTestDatabase({
        DATABASE_URL: "postgresql://postgres:secret@localhost:5432/testdb",
        DATABASE_URL_TEST: "postgresql://postgres:secret@127.0.0.1:5432/testdb",
        DIRECT_URL: "postgresql://postgres:secret@postgres:5432/testdb",
      })
    ).not.toThrow();
  });

  it("should reject ep-lingering-grass-aormacom on ANY of the three variables even if allowlisted", () => {
    process.env.TEST_DB_HOST_ALLOWLIST = "ep-lingering-grass-aormacom-pooler.c-2.ap-southeast-1.aws.neon.tech";

    expect(() =>
      assertSafeTestDatabase({
        DATABASE_URL:
          "postgresql://user:pass@ep-lingering-grass-aormacom-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb",
      })
    ).toThrow(/points to main production database host/);

    expect(() =>
      assertSafeTestDatabase({
        DATABASE_URL: "postgresql://localhost:5432/db",
        DATABASE_URL_TEST:
          "postgresql://user:pass@ep-lingering-grass-aormacom-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb",
      })
    ).toThrow(/points to main production database host/);

    expect(() =>
      assertSafeTestDatabase({
        DATABASE_URL: "postgresql://localhost:5432/db",
        DIRECT_URL:
          "postgresql://user:pass@ep-lingering-grass-aormacom.c-2.ap-southeast-1.aws.neon.tech/neondb",
      })
    ).toThrow(/points to main production database host/);
  });

  it("should allow a remote host for all variables when explicitly listed in TEST_DB_HOST_ALLOWLIST", () => {
    process.env.TEST_DB_HOST_ALLOWLIST = "ep-test-branch-xyz.neon.tech,ci-db.internal";

    expect(() =>
      assertSafeTestDatabase({
        DATABASE_URL: "postgresql://user:pass@ep-test-branch-xyz.neon.tech/neondb",
        DATABASE_URL_TEST: "postgresql://user:pass@ep-test-branch-xyz.neon.tech/neondb",
        DIRECT_URL: "postgresql://user:pass@ep-test-branch-xyz.neon.tech/neondb",
      })
    ).not.toThrow();
  });

  it("should no-op when variables are undefined", () => {
    expect(() => assertSafeTestDatabase({})).not.toThrow();
  });
});

import { assertSafeTestDatabase } from "../src/utils/db-safety-guard";

describe("FIX 4: Test Database Safety Guard", () => {
  const originalAllowlist = process.env.TEST_DB_HOST_ALLOWLIST;

  afterEach(() => {
    if (originalAllowlist !== undefined) {
      process.env.TEST_DB_HOST_ALLOWLIST = originalAllowlist;
    } else {
      delete process.env.TEST_DB_HOST_ALLOWLIST;
    }
  });

  it("should permit localhost, 127.0.0.1, and postgres hosts", () => {
    expect(() =>
      assertSafeTestDatabase("postgresql://postgres:secret@localhost:5432/testdb")
    ).not.toThrow();

    expect(() =>
      assertSafeTestDatabase("postgresql://postgres:secret@127.0.0.1:5432/testdb")
    ).not.toThrow();

    expect(() =>
      assertSafeTestDatabase("postgresql://postgres:secret@postgres:5432/testdb")
    ).not.toThrow();
  });

  it("should refuse remote/production hosts by default", () => {
    expect(() =>
      assertSafeTestDatabase(
        "postgresql://user:pass@ep-lingering-grass-aormacom-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb"
      )
    ).toThrow(/DB SAFETY GUARD CRITICAL/);

    expect(() =>
      assertSafeTestDatabase("postgresql://user:pass@production-db.rds.amazonaws.com/live")
    ).toThrow(/DB SAFETY GUARD CRITICAL/);
  });

  it("should allow a remote host when explicitly listed in TEST_DB_HOST_ALLOWLIST", () => {
    process.env.TEST_DB_HOST_ALLOWLIST = "ep-test-branch.neon.tech,ci-db.internal";

    expect(() =>
      assertSafeTestDatabase(
        "postgresql://user:pass@ep-test-branch.neon.tech/test_branch_db"
      )
    ).not.toThrow();

    expect(() =>
      assertSafeTestDatabase("postgresql://user:pass@ci-db.internal:5432/testdb")
    ).not.toThrow();
  });

  it("should no-op when dbUrl is undefined", () => {
    expect(() => assertSafeTestDatabase(undefined)).not.toThrow();
  });
});

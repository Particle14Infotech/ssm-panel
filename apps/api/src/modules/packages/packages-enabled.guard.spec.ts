import { ServiceUnavailableException } from "@nestjs/common";
import { PackagesEnabledGuard } from "./packages-enabled.guard";

describe("PackagesEnabledGuard", () => {
  const previousValue = process.env.PACKAGES_ENABLED;
  const guard = new PackagesEnabledGuard();

  afterAll(() => {
    if (previousValue === undefined) {
      delete process.env.PACKAGES_ENABLED;
    } else {
      process.env.PACKAGES_ENABLED = previousValue;
    }
  });

  it("disables package endpoints by default", () => {
    delete process.env.PACKAGES_ENABLED;

    expect(() => guard.canActivate({} as any)).toThrow(
      ServiceUnavailableException,
    );
  });

  it("allows package endpoints only when explicitly enabled", () => {
    process.env.NODE_ENV = "test";
    process.env.PACKAGES_ENABLED = "true";

    expect(guard.canActivate({} as any)).toBe(true);
  });

  it("keeps package endpoints disabled in production even if opted in", () => {
    process.env.NODE_ENV = "production";
    process.env.PACKAGES_ENABLED = "true";

    expect(() => guard.canActivate({} as any)).toThrow(
      ServiceUnavailableException,
    );
    process.env.NODE_ENV = "test";
  });
});

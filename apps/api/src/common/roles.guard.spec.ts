import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";
import { Role } from "@prisma/client";

describe("RolesGuard RBAC Matrix", () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockContext(userRole?: Role): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: userRole ? { role: userRole } : null,
        }),
      }),
    } as any;
  }

  it("allows access when no roles are required on route", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);
    const ctx = createMockContext();
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("blocks unauthenticated user when roles are required", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue([Role.ADMIN]);
    const ctx = createMockContext(undefined);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it("blocks CUSTOMER from accessing ADMIN endpoints", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue([Role.ADMIN]);
    const ctx = createMockContext(Role.CUSTOMER);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it("blocks RESELLER from accessing ADMIN endpoints", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue([Role.ADMIN]);
    const ctx = createMockContext(Role.RESELLER);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it("allows ADMIN to access ADMIN endpoints", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue([Role.ADMIN]);
    const ctx = createMockContext(Role.ADMIN);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("allows SUPPORT or ADMIN on SUPPORT-level endpoints", () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue([Role.SUPPORT, Role.ADMIN]);
    expect(guard.canActivate(createMockContext(Role.SUPPORT))).toBe(true);
    expect(guard.canActivate(createMockContext(Role.ADMIN))).toBe(true);
    expect(guard.canActivate(createMockContext(Role.CUSTOMER))).toBe(false);
  });
});

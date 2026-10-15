import { Test, TestingModule } from "@nestjs/testing";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

describe("UsersController Unit Tests", () => {
  let controller: UsersController;
  let mockUsersService: Partial<UsersService>;

  beforeEach(async () => {
    mockUsersService = {
      getProfile: jest.fn().mockResolvedValue({
        id: "usr_me",
        email: "test@smm.io",
        name: "Test User",
        role: "CUSTOMER",
      }),
      updateProfile: jest.fn().mockResolvedValue({
        success: true,
        user: { id: "usr_me", name: "Updated Name" },
      }),
      findAll: jest.fn().mockResolvedValue([
        { id: "usr_1", email: "user1@smm.io", role: "CUSTOMER" },
        { id: "usr_2", email: "admin@smm.io", role: "ADMIN" },
      ]),
      findOne: jest.fn().mockResolvedValue({ id: "usr_1", email: "user1@smm.io" }),
      update: jest.fn().mockResolvedValue({ id: "usr_1", name: "Renamed" }),
      remove: jest.fn().mockResolvedValue({ success: true, message: "User soft-deleted." }),
      updateStatus: jest.fn().mockResolvedValue({
        success: true,
        user: { id: "usr_1", role: "RESELLER" },
      }),
      adminResetPassword: jest.fn().mockResolvedValue({ success: true, message: "Password reset." }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it("retrieves current authenticated profile via /users/me", async () => {
    const profile = await controller.getProfile("usr_me");
    expect(profile.email).toBe("test@smm.io");
  });

  it("updates user profile details", async () => {
    const updated = await controller.updateProfile({ name: "Updated Name" }, "usr_me");
    expect(updated.success).toBe(true);
  });

  it("admin lists all users", async () => {
    const users = await controller.findAll();
    expect(users.length).toBe(2);
  });

  it("admin updates user status", async () => {
    const res = await controller.updateStatus("usr_1", { role: "RESELLER" });
    expect(res.user.role).toBe("RESELLER");
  });

  it("admin resets user password", async () => {
    const res = await controller.resetPassword("usr_1", { newPassword: "SecurePassword123!" });
    expect(res.success).toBe(true);
  });

  it("admin soft-deletes a user", async () => {
    const res = await controller.remove("usr_1");
    expect(res.success).toBe(true);
  });
});

import { BadRequestException } from "@nestjs/common";
import { PackagesController } from "../src/modules/packages/packages.controller";
import { SettingsController } from "../src/modules/settings/settings.controller";
import { SettingsService } from "../src/modules/settings/settings.service";

describe("Package API contract verification", () => {
  const quote = {
    valid: true,
    timezone: "Asia/Kolkata",
    totalCharge: 1,
    totalRuns: 1,
    days: 1,
    items: [],
    timeline: [
      {
        runIndex: 1,
        scheduledAt: "2026-10-23T12:00:00.000Z",
        serviceId: "service-1",
        serviceName: "Followers",
        quantity: 100,
        chargeShare: 1,
      },
    ],
    warnings: [],
    disclaimer: "Maximum total; unused balance is refunded to your wallet.",
  };

  it("validates and forwards a timezone-aware quote request", async () => {
    const getQuote = jest.fn().mockResolvedValue(quote);
    const controller = new PackagesController({ getQuote } as any);
    const request = {
      platform: "instagram",
      handle: "travel_notes",
      timezone: "Asia/Kolkata",
      followersDrip: {
        serviceId: "service-1",
        quantity: 100,
        days: 1,
        intervalHours: 24,
      },
    };

    await expect(controller.getQuote(request)).resolves.toEqual(quote);
    expect(getQuote).toHaveBeenCalledWith(request);
    await expect(
      controller.getQuote({ ...request, timezone: "Not/A_Timezone" }),
    ).rejects.toThrow(BadRequestException);
  });

  it("returns the backend-calculated execution timeline unchanged", async () => {
    const controller = new PackagesController({
      getQuote: jest.fn().mockResolvedValue(quote),
    } as any);

    const result = await controller.getQuote({
      platform: "instagram",
      handle: "travel_notes",
      timezone: "Asia/Kolkata",
      followersDrip: {
        serviceId: "service-1",
        quantity: 100,
        days: 1,
        intervalHours: 24,
      },
    });
    expect(result.timeline).toEqual(quote.timeline);
  });

  it("validates and forwards an absolute reschedule instant", async () => {
    const rescheduleExecution = jest.fn().mockResolvedValue({ success: true });
    const controller = new PackagesController({
      rescheduleExecution,
    } as any);
    const executeAt = "2026-10-23T12:00:00.000Z";

    await expect(
      controller.rescheduleExecution(
        { id: "user-1" } as any,
        "package-1",
        "execution-1",
        { executeAt },
      ),
    ).resolves.toEqual({ success: true });
    expect(rescheduleExecution).toHaveBeenCalledWith(
      "user-1",
      "package-1",
      "execution-1",
      { executeAt },
    );
    await expect(
      controller.rescheduleExecution(
        { id: "user-1" } as any,
        "package-1",
        "execution-1",
        { executeAt: "2026-10-23T12:00:00" },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("forwards supported package operations with the authenticated user", async () => {
    const service = {
      purchasePackage: jest.fn().mockResolvedValue({ success: true }),
      listPackages: jest.fn().mockResolvedValue([]),
      getPackage: jest.fn().mockResolvedValue({ id: "package-1" }),
      pausePackage: jest.fn().mockResolvedValue({ status: "PAUSED" }),
      resumePackage: jest.fn().mockResolvedValue({ status: "ACTIVE" }),
      cancelPackage: jest.fn().mockResolvedValue({ success: true }),
      triggerStart: jest.fn().mockResolvedValue({ success: true }),
      getAdminExecutionsQueue: jest.fn().mockResolvedValue({
        page: 1,
        limit: 20,
        totalCount: 1,
        totalPages: 1,
        items: [{ id: "exec-1", status: "SCHEDULED" }],
      }),
    };
    const controller = new PackagesController(service as any);
    const user = { id: "user-1" } as any;
    const purchaseInput = {
      platform: "instagram",
      handle: "travel_notes",
      timezone: "Asia/Kolkata",
      followersDrip: {
        serviceId: "service-1",
        quantity: 100,
        days: 1,
        intervalHours: 24,
      },
      consentRulesUnderstood: true,
      quoteHash: "qh_v2_primary_9999999999999_validhash",
      idempotencyKey: "purchase-key",
    };

    await expect(
      controller.purchasePackage(user, purchaseInput),
    ).resolves.toEqual({ success: true });
    expect(service.purchasePackage).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining(purchaseInput),
    );
    await expect(controller.listPackages(user)).resolves.toEqual([]);
    expect(service.listPackages).toHaveBeenCalledWith(user.id);
    await expect(controller.getPackage(user, "package-1")).resolves.toEqual({
      id: "package-1",
    });
    expect(service.getPackage).toHaveBeenCalledWith(user.id, "package-1");
    await expect(controller.pausePackage(user, "package-1")).resolves.toEqual({
      status: "PAUSED",
    });
    expect(service.pausePackage).toHaveBeenCalledWith(user.id, "package-1");
    await expect(controller.resumePackage(user, "package-1")).resolves.toEqual({
      status: "ACTIVE",
    });
    expect(service.resumePackage).toHaveBeenCalledWith(user.id, "package-1");
    await expect(controller.cancelPackage(user, "package-1")).resolves.toEqual({
      success: true,
    });
    expect(service.cancelPackage).toHaveBeenCalledWith(user.id, "package-1");
    await expect(
      controller.triggerManualPost(user, "package-1", {
        url: "https://instagram.com/p/post-1",
        mediaType: "POST",
        idempotencyKey: "trigger-key",
      }),
    ).resolves.toEqual({ success: true });
    expect(service.triggerStart).toHaveBeenCalledWith(
      user.id,
      "package-1",
      {
        url: "https://instagram.com/p/post-1",
        mediaType: "POST",
        rules: [],
      },
      "trigger-key",
    );

    await expect(
      controller.getAdminExecutionsQueue("SCHEDULED", "1", "20"),
    ).resolves.toEqual({
      page: 1,
      limit: 20,
      totalCount: 1,
      totalPages: 1,
      items: [{ id: "exec-1", status: "SCHEDULED" }],
    });
    expect(service.getAdminExecutionsQueue).toHaveBeenCalledWith({
      status: "SCHEDULED",
      page: 1,
      limit: 20,
    });
  });

  it("preserves the supported package-engine settings defaults and updates", () => {
    const controller = new SettingsController(new SettingsService());
    const settings = controller.getSettings();

    expect(settings).toEqual(
      expect.objectContaining({
        packagesEnabled: true,
        packageMaxDurationDays: 90,
        packageMaxPosts: 100,
        packageMaxPerDay: 10,
        packageMinSpacingMin: 15,
        packageMaxPauseDays: 14,
        packageMarginFloor: 0.15,
      }),
    );
    expect(
      controller.updateSettings({
        packageMaxPosts: 150,
        packageMarginFloor: 0.2,
      }),
    ).toEqual({
      success: true,
      settings: expect.objectContaining({
        packageMaxPosts: 150,
        packageMarginFloor: 0.2,
      }),
    });
  });
});

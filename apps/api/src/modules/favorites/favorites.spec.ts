import { FavoritesService } from "./favorites.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";

describe("FavoritesService (Phase 1 MVP Unit Tests)", () => {
  let service: FavoritesService;
  const mockPrisma = { isConnected: false } as any;

  beforeEach(() => {
    service = new FavoritesService(mockPrisma);
  });

  it("should create and list favorites for a user", async () => {
    const userId = "user-123";
    const created = await service.createFavorite(userId, {
      serviceId: "srv-instagram-followers",
      targetUrl: "https://instagram.com/myprofile",
      defaultQuantity: 1000,
      customName: "My Daily IG Growth",
    });

    expect(created.id).toBeDefined();
    expect(created.userId).toBe(userId);
    expect(created.defaultQuantity).toBe(1000);

    const list = await service.listFavorites(userId);
    expect(list.length).toBe(1);
    expect(list[0].targetUrl).toBe("https://instagram.com/myprofile");
  });

  it("should strictly enforce 50 favorites per user limit", async () => {
    const userId = "user-power-customer";

    // Create 50 favorites
    for (let i = 1; i <= 50; i++) {
      await service.createFavorite(userId, {
        serviceId: `srv-${i}`,
        targetUrl: `https://instagram.com/target_${i}`,
        defaultQuantity: 500,
      });
    }

    const list = await service.listFavorites(userId);
    expect(list.length).toBe(50);

    // Attempting 51st favorite must throw BadRequestException
    await expect(
      service.createFavorite(userId, {
        serviceId: "srv-overflow",
        targetUrl: "https://instagram.com/overflow_target",
        defaultQuantity: 500,
      })
    ).rejects.toThrow(BadRequestException);
  });

  it("should enforce tenant data isolation (User B cannot see or delete User A favorites)", async () => {
    const userA = "user-alice";
    const userB = "user-bob";

    const favA = await service.createFavorite(userA, {
      serviceId: "srv-a",
      targetUrl: "https://tiktok.com/@alice",
      defaultQuantity: 1000,
    });

    // User B listing favorites should NOT see User A's favorite
    const bobList = await service.listFavorites(userB);
    expect(bobList.length).toBe(0);

    // User B trying to delete User A's favorite must throw NotFoundException
    await expect(service.deleteFavorite(userB, favA.id)).rejects.toThrow(NotFoundException);

    // User A can successfully delete their own favorite
    const deleteRes = await service.deleteFavorite(userA, favA.id);
    expect(deleteRes.success).toBe(true);

    const aliceList = await service.listFavorites(userA);
    expect(aliceList.length).toBe(0);
  });

  it("should update existing favorite when same serviceId and targetUrl are submitted", async () => {
    const userId = "user-updater";

    await service.createFavorite(userId, {
      serviceId: "srv-yt-views",
      targetUrl: "https://youtube.com/watch?v=123",
      defaultQuantity: 1000,
      customName: "Old Name",
    });

    const updated = await service.createFavorite(userId, {
      serviceId: "srv-yt-views",
      targetUrl: "https://youtube.com/watch?v=123",
      defaultQuantity: 2500,
      customName: "New Name",
    });

    expect(updated.defaultQuantity).toBe(2500);
    expect(updated.customName).toBe("New Name");

    const list = await service.listFavorites(userId);
    expect(list.length).toBe(1);
    expect(list[0].defaultQuantity).toBe(2500);
  });
});

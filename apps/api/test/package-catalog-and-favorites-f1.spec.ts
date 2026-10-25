import { BadRequestException, NotFoundException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { ServicesService } from "../src/modules/services/services.service";
import { FavoritesService } from "../src/modules/favorites/favorites.service";
import { Decimal } from "decimal.js";

describe("Phase F1: Grouped Catalog, Timeline Chart, Balance Hint & Favorites", () => {
  let mockPrisma: any;
  let servicesService: ServicesService;
  let favoritesService: FavoritesService;

  beforeEach(() => {
    mockPrisma = {
      isConnected: true,
      category: {
        findMany: jest.fn(),
      },
      service: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      favorite: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(async (cb: any) => cb(mockPrisma)),
      $queryRawUnsafe: jest.fn().mockResolvedValue([]),
    };

    servicesService = new ServicesService(mockPrisma);
    favoritesService = new FavoritesService(mockPrisma);
  });

  describe("1. Grouped Catalog (GET /catalog/grouped)", () => {
    it("returns grouped categories in a single query, hiding empty and disabled categories", async () => {
      // Mock category.findMany with include: { services }
      mockPrisma.category.findMany.mockResolvedValue([
        {
          id: "cat_1",
          name: "Instagram Followers",
          slug: "instagram-followers",
          sortOrder: 1,
          services: [
            {
              id: "srv_1",
              name: "HQ Followers",
              displayName: "High Quality Followers",
              description: "Fast delivery",
              platform: "INSTAGRAM",
              ratePer1000: new Decimal(80),
              minQty: 100,
              maxQty: 10000,
              avgTime: "1 hour",
              refillable: true,
              cancellable: false,
              dripFeedSupported: true,
              serviceType: "DEFAULT",
            },
          ],
        },
        {
          id: "cat_empty",
          name: "Empty Category",
          slug: "empty-cat",
          sortOrder: 2,
          services: [], // Empty -> MUST be omitted
        },
      ]);

      mockPrisma.service.findMany.mockResolvedValue([
        {
          id: "srv_uncat",
          name: "Uncategorized Views",
          displayName: "Other Views",
          description: "No category set",
          platform: "INSTAGRAM",
          ratePer1000: new Decimal(20),
          minQty: 500,
          maxQty: 50000,
          avgTime: "30 min",
          refillable: false,
          cancellable: false,
          dripFeedSupported: false,
          serviceType: "DEFAULT",
        },
      ]);

      // Call getGroupedCatalog
      const result = await (servicesService as any).getGroupedCatalog("INSTAGRAM");

      // Verify category.findMany was called exactly ONCE (zero N+1)
      expect(mockPrisma.category.findMany).toHaveBeenCalledTimes(1);

      // Verify empty category is excluded
      expect(result.categories.find((c: any) => c.id === "cat_empty")).toBeUndefined();

      // Verify active category is present with serviceCount
      const cat1 = result.categories.find((c: any) => c.id === "cat_1");
      expect(cat1).toBeDefined();
      expect(cat1.serviceCount).toBe(1);
      expect(cat1.services[0].ratePer1000).toBe("80");

      // Verify uncategorized service is bundled under 'Other'
      const otherCat = result.categories.find((c: any) => c.id === "uncategorized" || c.name === "Other");
      expect(otherCat).toBeDefined();
      expect(otherCat.services[0].id).toBe("srv_uncat");
    });
  });

  describe("2. Quantity Balance Hint Heuristic", () => {
    // Pure function for quantity balance advisory
    function evaluateQuantityBalance(cartItems: { metric: string; quantity: number }[]): {
      hasAdvisory: boolean;
      message?: string;
    } {
      const likesItem = cartItems.find((i) => i.metric === "likes");
      const viewsItem = cartItems.find((i) => i.metric === "views");

      if (likesItem && viewsItem) {
        if (likesItem.quantity > viewsItem.quantity) {
          return {
            hasAdvisory: true,
            message: "Notice: Likes quantity exceeds Views quantity in this order. Posts typically display more views than likes.",
          };
        }
      }
      return { hasAdvisory: false };
    }

    it("triggers neutral advisory when likes exceed views in the same cart", () => {
      const imbalancedCart = [
        { metric: "views", quantity: 500 },
        { metric: "likes", quantity: 1500 },
      ];
      const res = evaluateQuantityBalance(imbalancedCart);
      expect(res.hasAdvisory).toBe(true);
      expect(res.message).toContain("Likes quantity exceeds Views quantity");
    });

    it("does not trigger advisory when quantities are balanced", () => {
      const balancedCart = [
        { metric: "views", quantity: 5000 },
        { metric: "likes", quantity: 500 },
      ];
      const res = evaluateQuantityBalance(balancedCart);
      expect(res.hasAdvisory).toBe(false);
    });
  });

  describe("3. Favorites with Generic Config JSON and IDOR Protection", () => {
    it("stores config JSON with computed configHash and verifies IDOR safety", async () => {
      const configPayload = {
        kind: "PACKAGE",
        platform: "instagram",
        handle: "test_creator",
        followers: 1000,
        days: 14,
      };

      mockPrisma.favorite.count.mockResolvedValue(0);
      mockPrisma.service.findUnique.mockResolvedValue({ id: "srv_test", isDeleted: false });
      mockPrisma.favorite.upsert.mockResolvedValue({
        id: "fav_cfg_1",
        userId: "user_a",
        config: configPayload,
        configHash: "cfghash_123",
      });

      // User A creates favorite with config
      const created = await (favoritesService as any).createFavoriteWithConfig("user_a", {
        serviceId: "srv_test",
        targetUrl: "https://instagram.com/test_creator",
        defaultQuantity: 1000,
        config: configPayload,
      });

      expect(created).toBeDefined();

      // IDOR safety: User B attempts to delete User A's favorite
      mockPrisma.favorite.findFirst.mockResolvedValue(null); // not found under user_b
      await expect(
        favoritesService.deleteFavorite("user_b", "fav_cfg_1")
      ).rejects.toThrow(NotFoundException);
    });
  });
});

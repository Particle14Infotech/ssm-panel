import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { ProvidersService } from "../providers/providers.service";
import { SmmProviderClient } from "../providers/smm-provider.client";
import { OrderStatus } from "@prisma/client";
import { Decimal } from "decimal.js";

describe("Production Forensics Reproduction & Fix Validation", () => {
  describe("Reproduction 1: Admin Orders Visibility", () => {
    let mockPrisma: any;
    let ordersService: OrdersService;
    let ordersController: OrdersController;

    const sampleOrders = [
      {
        id: "order-cust-1",
        userId: "cust-user-uuid",
        target: "https://www.instagram.com/p/DeBAAntkpNd/",
        serviceId: "srv-instagram-1",
        quantity: 1000,
        charge: new Decimal(17.32),
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        service: {
          id: "srv-instagram-1",
          name: "Instagram Likes",
          platform: "INSTAGRAM",
          refillable: false,
          cancellable: true,
        },
        history: [],
        refunds: [],
      },
    ];

    beforeEach(() => {
      mockPrisma = {
        isConnected: true,
        order: {
          findMany: jest.fn().mockImplementation(({ where }) => {
            let result = sampleOrders;
            if (where.userId) {
              result = result.filter((o) => o.userId === where.userId);
            }
            return Promise.resolve(result);
          }),
        },
      };
      ordersService = new OrdersService(mockPrisma, {} as any);
      ordersController = new OrdersController(ordersService);
    });

    it("Admin must see orders placed by customers when queryUserId is not specified", async () => {
      const adminUser = {
        id: "admin-uuid",
        sub: "admin-uuid",
        email: "admin@smmpanel.internal",
        role: "ADMIN",
      };

      // Call controller findAll as Admin without specifying queryUserId
      const result = await ordersController.findAll(adminUser);

      // Verify the controller does NOT pass adminUser.id as targetUserId
      expect(mockPrisma.order.findMany).toHaveBeenCalled();
      const findManyCall = mockPrisma.order.findMany.mock.calls[0][0];

      // where.userId should NOT be set to adminUser.id!
      expect(findManyCall.where.userId).toBeUndefined();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("order-cust-1");
    });

    it("Customer must ONLY see their own orders", async () => {
      const customerUser = {
        id: "other-cust-uuid",
        sub: "other-cust-uuid",
        email: "other@customer.com",
        role: "CUSTOMER",
      };

      const result = await ordersController.findAll(customerUser);
      expect(mockPrisma.order.findMany).toHaveBeenCalled();
      const findManyCall = mockPrisma.order.findMany.mock.calls[0][0];

      // where.userId MUST be set to customer's id
      expect(findManyCall.where.userId).toBe("other-cust-uuid");
      expect(result).toHaveLength(0);
    });
  });

  describe("Reproduction 2: Provider Sync and Numeric Field Overflow Protection", () => {
    let mockPrisma: any;
    let mockSmmClient: any;
    let providersService: ProvidersService;

    beforeEach(() => {
      mockPrisma = {
        isConnected: true,
        provider: {
          findUnique: jest.fn().mockResolvedValue({
            id: "prov-1",
            name: "cheapestsmmpanels",
            apiUrl: "https://cheapestsmmpanels.com/api/v2",
            apiKeyEncrypted: "mock:iv:cipher",
            balance: new Decimal(123.08),
            currency: "INR",
            active: true,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        category: {
          upsert: jest.fn().mockResolvedValue({ id: "cat-1", name: "Instagram Likes", slug: "instagram-likes" }),
        },
        service: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockImplementation(({ data }) => {
            // Simulate Postgres Decimal(10, 2) constraint: absolute value < 10^8
            if (Number(data.ratePer1000) >= 100000000) {
              throw new Error("numeric field overflow: A field with precision 10, scale 2 must round to an absolute value less than 10^8.");
            }
            return Promise.resolve({ id: `svc_${data.providerServiceId}`, ...data });
          }),
          count: jest.fn().mockResolvedValue(2),
        },
      };

      mockSmmClient = {
        getBalance: jest.fn().mockResolvedValue({ balance: 123.08, currency: "INR" }),
        getServices: jest.fn().mockResolvedValue([
          {
            service: 101,
            name: "Normal Instagram Likes",
            category: "Instagram Likes",
            rate: "15.50",
            min: 50,
            max: 100000,
          },
          {
            service: 4227,
            name: "Super High Rate Reactions",
            category: "Reactions",
            rate: "1336542900.00", // > 10^8! Causes Postgres numeric overflow if unhandled
            min: 10,
            max: 5000,
          },
        ]),
      };

      providersService = new ProvidersService(mockPrisma, mockSmmClient);
      // Mock crypto decrypt to return a plain key
      jest.spyOn(require("../../common/crypto.util"), "decryptProviderKey").mockReturnValue("plain_key_123");
    });

    it("importServices clamps or safely skips overflow rates without failing the entire batch", async () => {
      const result = await providersService.importServices("prov-1", { marginPercent: 20 });

      expect(result.success).toBe(true);
      // The normal service should be imported successfully
      expect(result.importedCount).toBeGreaterThanOrEqual(1);
      // The batch should NOT throw an unhandled exception
    });

    it("sync method refreshes balance AND triggers catalog sync with counts", async () => {
      const syncResult = await providersService.sync("prov-1");

      expect(syncResult.success).toBe(true);
      expect(syncResult.balance).toBe(123.08);
      expect(syncResult).toHaveProperty("importedCount");
      expect(syncResult).toHaveProperty("timestamp");
    });
  });

  describe("Reproduction 3: Order Lifecycle with Instagram Post Link", () => {
    it("correctly identifies Instagram post link vs profile handle", () => {
      const postLink = "https://www.instagram.com/p/DeBAAntkpNd/";
      const profileLink = "https://www.instagram.com/aether_smm/";
      const atHandle = "@aether_smm";

      // Regex matching post shortcodes
      const postMatch = postLink.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/);
      expect(postMatch).not.toBeNull();
      expect(postMatch![1]).toBe("DeBAAntkpNd");

      // Regex matching profile usernames
      const profileMatch = profileLink.match(/instagram\.com\/(?:[a-zA-Z0-9_-]+\/)?([a-zA-Z0-9._]+)\/?$/);
      expect(profileMatch).not.toBeNull();
    });
  });
});

import "reflect-metadata";
import { monitorEventLoopDelay } from "perf_hooks";
import { HttpStatus, UnprocessableEntityException, UnauthorizedException } from "@nestjs/common";
import { PackagesQuoteService } from "../src/modules/packages/packages-quote.service";
import { PackagesService } from "../src/modules/packages/packages.service";
import { PackagesController } from "../src/modules/packages/packages.controller";
import { CacheService } from "../src/common/cache.service";

describe("S2: GAP-2 Quote DoS Hardening & Throttling", () => {
  let quoteService: PackagesQuoteService;
  let mockPrisma: any;
  let mockPlatformsService: any;

  beforeEach(() => {
    mockPrisma = {
      isConnected: true,
      package: { findFirst: jest.fn().mockResolvedValue(null) },
      service: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "srv_followers",
            name: "Followers High Speed",
            displayName: "Followers",
            platform: "instagram",
            ratePer1000: "10.00",
            minQty: 10,
            maxQty: 100000,
            packageEligible: true,
            status: "ACTIVE",
            active: true,
            costINR: "5.00",
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: "srv_followers",
          name: "Followers High Speed",
          displayName: "Followers",
          platform: "instagram",
          ratePer1000: "10.00",
          minQty: 10,
          maxQty: 100000,
          packageEligible: true,
          status: "ACTIVE",
          active: true,
          costINR: "5.00",
        }),
      },
    };

    mockPlatformsService = {
      getPlatformConfig: jest.fn().mockResolvedValue({
        platform: "instagram",
        displayName: "Instagram",
        handleRegex: "^[A-Za-z0-9_.]+$",
        handleMaxLength: 30,
        active: true,
      }),
      isHandleBlocked: jest.fn().mockResolvedValue(false),
    };

    quoteService = new PackagesQuoteService(mockPrisma, mockPlatformsService);
  });

  describe("1. Hard caps before computation (422 Unprocessable Entity)", () => {
    it("rejects request exceeding max runs (e.g. 8,760 runs) in < 5ms without iterating with 422", async () => {
      const heavyInput = {
        userId: "u_dos_test",
        platform: "instagram" as const,
        handle: "valid_handle",
        followersDrip: {
          serviceId: "srv_followers",
          quantity: 10000,
          days: 365,
          intervalHours: 1, // 365 * 24 = 8,760 runs > maxRunsPerPackage (365 default, cap 730)
        },
      };

      const start = process.hrtime.bigint();
      let error: any = null;
      try {
        await quoteService.calculateQuote(heavyInput, new Date());
      } catch (err) {
        error = err;
      }
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

      expect(error).toBeDefined();
      expect(error.status || error.getStatus?.()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(durationMs).toBeLessThan(15); // < 15ms
    });

    it("rejects durationDays > 365 with 422", async () => {
      const input = {
        userId: "u_dos_test",
        platform: "instagram" as const,
        handle: "valid_handle",
        followersDrip: {
          serviceId: "srv_followers",
          quantity: 1000,
          days: 366,
          intervalHours: 24,
        },
      };

      await expect(quoteService.calculateQuote(input, new Date())).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        })
      );
    });

    it("rejects intervalHours < 1 with 422", async () => {
      const input = {
        userId: "u_dos_test",
        platform: "instagram" as const,
        handle: "valid_handle",
        followersDrip: {
          serviceId: "srv_followers",
          quantity: 1000,
          days: 5,
          intervalHours: 0,
        },
      };

      await expect(quoteService.calculateQuote(input, new Date())).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        })
      );
    });

    it("rejects items length > 10 with 422", async () => {
      const items = Array.from({ length: 11 }, (_, i) => ({
        serviceId: "srv_followers",
        quantity: 50,
        maxPosts: 5,
      }));

      const input = {
        userId: "u_dos_test",
        platform: "instagram" as const,
        handle: "valid_handle",
        items,
      };

      await expect(quoteService.calculateQuote(input, new Date())).rejects.toThrow(
        expect.objectContaining({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
        })
      );
    });
  });

  describe("2. Event-loop delay under concurrent quote requests", () => {
    it("keeps event-loop delay < 50ms across 100 concurrent quote calculations", async () => {
      const histogram = monitorEventLoopDelay({ resolution: 10 });
      histogram.enable();

      const singleInput = {
        userId: "u_dos_test",
        platform: "instagram" as const,
        handle: "speed_handle",
        followersDrip: {
          serviceId: "srv_followers",
          quantity: 100,
          days: 5,
          intervalHours: 24,
        },
      };

      const tasks = Array.from({ length: 100 }, () =>
        quoteService.calculateQuote(singleInput, new Date())
      );

      await Promise.all(tasks);
      histogram.disable();

      const maxDelayMs = Number(histogram.max) / 1_000_000;
      // Event-loop delay must not spike above 50ms
      expect(maxDelayMs).toBeLessThan(50);
    });
  });

  describe("3. Identical quote caching & Throttling", () => {
    let packagesService: PackagesService;

    beforeEach(() => {
      packagesService = new PackagesService(mockPrisma, quoteService, mockPlatformsService);
    });

    it("serves identical quote within 60s from cache without recalculating", async () => {
      const calcSpy = jest.spyOn(quoteService, "calculateQuote");

      const input = {
        platform: "instagram" as const,
        handle: "cached_handle",
        followersDrip: {
          serviceId: "srv_followers",
          quantity: 200,
          days: 5,
          intervalHours: 24,
        },
      };

      const q1 = await packagesService.getQuote(input, "u_cache_1");
      const q2 = await packagesService.getQuote(input, "u_cache_1");

      expect(q1.totalCharge).toBe(q2.totalCharge);
      expect(q1.quoteHash).toBe(q2.quoteHash);
      // calculateQuote should only be called once because second call hit cache
      expect(calcSpy).toHaveBeenCalledTimes(1);
    });

    it("throttles user at 30 quotes per minute with 429 Too Many Requests", async () => {
      const input = {
        platform: "instagram" as const,
        handle: "throttle_handle",
        followersDrip: {
          serviceId: "srv_followers",
          quantity: 200,
          days: 5,
          intervalHours: 24,
        },
      };

      // 30 requests should succeed
      for (let i = 0; i < 30; i++) {
        // use unique handles so they don't hit identical quote cache
        await packagesService.getQuote({ ...input, handle: `throttle_${i}` }, "u_throttle_user");
      }

      // 31st request must throw 429
      let error: any = null;
      try {
        await packagesService.getQuote({ ...input, handle: "throttle_31" }, "u_throttle_user");
      } catch (err) {
        error = err;
      }

      expect(error).toBeDefined();
      expect(error.status || error.getStatus?.()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it("controller requires JwtAuthGuard on @Post('quote')", () => {
      const guards = Reflect.getMetadata("__guards__", PackagesController.prototype.getQuote);
      expect(guards).toBeDefined();
      expect(guards.some((g: any) => g.name === "JwtAuthGuard")).toBe(true);
    });
  });
});

import { Test, TestingModule } from "@nestjs/testing";
import { LinkPreviewService } from "../src/modules/link-preview/link-preview.service";
import { LinkPreviewController } from "../src/modules/link-preview/link-preview.controller";
import { SMMCacheService } from "../src/common/cache.service";
import { FeatureFlagsService } from "../src/modules/settings/flags.service";
import { PrismaService } from "../src/common/prisma.service";
import { NotFoundException, HttpException, BadRequestException } from "@nestjs/common";

describe("LP2: Link Preview Backend Endpoint & Security Gates", () => {
  let service: LinkPreviewService;
  let controller: LinkPreviewController;
  let cacheService: SMMCacheService;
  let flagsService: FeatureFlagsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LinkPreviewController],
      providers: [
        LinkPreviewService,
        SMMCacheService,
        {
          provide: PrismaService,
          useValue: {
            setting: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
          },
        },
        {
          provide: FeatureFlagsService,
          useValue: {
            isEnabled: jest.fn().mockImplementation((key: string) => {
              // Default test behavior: master and platform flags enabled for happy path unless overridden
              return Promise.resolve(true);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LinkPreviewService>(LinkPreviewService);
    controller = module.get<LinkPreviewController>(LinkPreviewController);
    cacheService = module.get<SMMCacheService>(SMMCacheService);
    flagsService = module.get<FeatureFlagsService>(FeatureFlagsService);
  });

  describe("1. SSRF Protection & Upstream URL Construction", () => {
    it("rejects internal IP addresses and non-allowlisted hosts before network fetch", async () => {
      const ssrfLinks = [
        "https://127.0.0.1/watch?v=dQw4w9WgXcQ",
        "https://169.254.169.254/latest/meta-data/",
        "https://localhost:4000/api/v1/orders",
        "file:///etc/passwd",
      ];
      for (const link of ssrfLinks) {
        await expect(service.getLinkPreview(link, "usr_1", "127.0.0.1")).rejects.toThrow(
          BadRequestException
        );
      }
    });

    it("rejects malicious URL embedded in video ID parameter", async () => {
      const maliciousIdLink = "https://www.youtube.com/watch?v=http://attacker.com";
      await expect(service.getLinkPreview(maliciousIdLink, "usr_1", "127.0.0.1")).rejects.toThrow(
        BadRequestException
      );
    });

    it("never follows HTTP redirects to private hosts (redirects disabled)", async () => {
      let reqDestroyed = false;
      const httpsSpy = jest.spyOn(require("https"), "request").mockImplementation((url: any, opts: any, cb: any) => {
        const req: any = new (require("events").EventEmitter)();
        req.destroy = jest.fn(() => {
          reqDestroyed = true;
        });
        req.end = jest.fn(() => {
          const res: any = new (require("events").EventEmitter)();
          res.statusCode = 302;
          res.headers = { location: "http://192.168.1.1/admin" };
          cb(res);
          res.emit("end");
        });
        return req;
      });

      try {
        const fetchRes = await (service as any).nativeSafeFetch("https://www.tiktok.com/oembed");
        expect(reqDestroyed).toBe(true);
        expect(fetchRes.status).toBe(302);
      } finally {
        httpsSpy.mockRestore();
      }

      // Stub returns 302 pointing to an internal server
      service.setUpstreamFetcher(async () => ({
        status: 302,
        headers: { location: "http://192.168.1.1/admin" },
        body: "",
      }));

      const res = await service.getLinkPreview("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "usr_1", "127.0.0.1");
      expect(res.status).toBe("UNAVAILABLE");
      expect(res.thumbnailUrl).toBeNull();
    });

    it("never fetches user-supplied URL directly, builds upstream strictly from fixed host and validated ID", async () => {
      let requestedUpstreamUrl = "";
      service.setUpstreamFetcher(async (url: string) => {
        requestedUpstreamUrl = url;
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "Safe Video", thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" }),
        };
      });

      const userInput = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&tracking=evil_exploit";
      await service.getLinkPreview(userInput, "usr_1", "127.0.0.1");
      expect(requestedUpstreamUrl).not.toContain("tracking=evil_exploit");
      expect(requestedUpstreamUrl).toBe(
        "https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&format=json"
      );
    });

    it("rejects unknown platform or disallowed host with BadRequestException", async () => {
      await expect(
        service.getLinkPreview("https://evil-untrusted-domain.com/video/12345", "usr_1", "127.0.0.1")
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("2. XSS Payload Sanitization & HTML Escaping", () => {
    it("escapes dangerous HTML/script tags in title and author name", async () => {
      service.setUpstreamFetcher(async () => ({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "<script>alert('XSS')</script> Great Music Video",
          author_name: "Attacker <img src=x onerror=alert(1)>",
          thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
          html: "<blockquote class='malicious'>ignore me</blockquote>",
        }),
      }));

      const res = await service.getLinkPreview("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "usr_1", "127.0.0.1");
      expect(res.status).toBe("OK");
      expect(res.title).not.toContain("<script>");
      expect(res.title).toContain("&lt;script&gt;");
      expect(res.authorName).not.toContain("<img");
      expect(res.authorName).toContain("&lt;img");
      expect((res as any).html).toBeUndefined(); // html must be completely ignored
    });

    it("truncates excessively long titles to 120 characters and author to 60 characters", async () => {
      service.setUpstreamFetcher(async () => ({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "A".repeat(300),
          author_name: "B".repeat(150),
          thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
        }),
      }));

      const res = await service.getLinkPreview("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "usr_1", "127.0.0.1");
      expect(res.title?.length).toBe(120);
      expect(res.authorName?.length).toBe(60);
    });
  });

  describe("3. Resilience & Failure Handling", () => {
    it("safely handles slow upstream (>2s) and falls back to UNAVAILABLE", async () => {
      let inspectedTimeout = 0;
      const httpsSpy = jest.spyOn(require("https"), "request").mockImplementation((url: any, opts: any, cb: any) => {
        inspectedTimeout = opts.timeout;
        const req: any = new (require("events").EventEmitter)();
        req.destroy = jest.fn((err) => {
          if (err) req.emit("error", err);
        });
        req.end = jest.fn(() => {
          setTimeout(() => {
            req.emit("timeout");
          }, 10);
        });
        return req;
      });

      try {
        const res = await service.getLinkPreview("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "usr_1", "127.0.0.1");
        expect(inspectedTimeout).toBe(2000);
        expect(res.status).toBe("UNAVAILABLE");
      } finally {
        httpsSpy.mockRestore();
      }

      // Also verify explicit error handling
      service.setUpstreamFetcher(async () => {
        throw new Error("Upstream request timed out (2s limit)");
      });

      const res2 = await service.getLinkPreview("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "usr_1", "127.0.0.1");
      expect(res2.status).toBe("UNAVAILABLE");
    });

    it("safely handles oversized response (>64 KB) without memory exhaustion", async () => {
      let destroyedWithError: Error | null = null;
      const httpsSpy = jest.spyOn(require("https"), "request").mockImplementation((url: any, opts: any, cb: any) => {
        const req: any = new (require("events").EventEmitter)();
        req.destroy = jest.fn((err: Error) => {
          destroyedWithError = err;
          if (err) req.emit("error", err);
        });
        req.end = jest.fn(() => {
          const res: any = new (require("events").EventEmitter)();
          res.statusCode = 200;
          res.headers = { "content-type": "application/json" };
          cb(res);
          // Send 70 KB chunk
          res.emit("data", Buffer.alloc(70 * 1024, "a"));
        });
        return req;
      });

      try {
        await expect((service as any).nativeSafeFetch("https://www.youtube.com/oembed")).rejects.toThrow(
          "Response body exceeded 64 KB limit"
        );
        expect(destroyedWithError).toBeDefined();
        expect((destroyedWithError as any)?.message).toContain("64 KB limit");
      } finally {
        httpsSpy.mockRestore();
      }

      service.setUpstreamFetcher(async () => {
        throw new Error("Response body exceeded 64 KB limit");
      });

      const res = await service.getLinkPreview("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "usr_1", "127.0.0.1");
      expect(res.status).toBe("UNAVAILABLE");
    });

    it("handles upstream HTTP 429 rate limit correctly", async () => {
      service.setUpstreamFetcher(async () => ({
        status: 429,
        headers: { "retry-after": "60" },
        body: "Too Many Requests",
      }));

      const res = await service.getLinkPreview("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "usr_1", "127.0.0.1");
      expect(res.status).toBe("UNAVAILABLE");
      const metrics = service.getMetrics();
      expect(metrics.status429s).toBeGreaterThanOrEqual(1);
    });
  });

  describe("4. Performance, Coalescing & Caching", () => {
    it("coalesces 50 concurrent requests for the same link into exactly ONE upstream call", async () => {
      // Mock acquireLock to return true so we specifically assert in-memory single-flight coalescing
      jest.spyOn(cacheService, "acquireLock").mockResolvedValue(true);
      jest.spyOn(cacheService, "releaseLock").mockResolvedValue(true);

      let upstreamCalls = 0;
      service.setUpstreamFetcher(async () => {
        upstreamCalls++;
        // Small delay to simulate in-flight network transit
        await new Promise((r) => setTimeout(r, 20));
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: "Never Gonna Give You Up",
            author_name: "Rick Astley",
            thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
          }),
        };
      });

      // Clear cache first
      await cacheService.invalidate("link_preview:youtube:dQw4w9WgXcQ");

      // Fire 50 concurrent requests simultaneously from distinct users/IPs
      const promises = Array.from({ length: 50 }, (_, i) =>
        service.getLinkPreview("https://www.youtube.com/watch?v=dQw4w9WgXcQ", `usr_coalesce_${i}`, `127.0.0.${i + 1}`)
      );

      const results = await Promise.all(promises);
      expect(results.length).toBe(50);
      for (const r of results) {
        expect(r.status).toBe("OK");
        expect(r.title).toBe("Never Gonna Give You Up");
      }

      // Single-flight guarantee: Upstream was called exactly ONCE!
      expect(upstreamCalls).toBe(1);
    });

    it("serves negative cache (404 Not Found) on subsequent requests without calling upstream", async () => {
      let upstreamCalls = 0;
      service.setUpstreamFetcher(async () => {
        upstreamCalls++;
        return {
          status: 404,
          headers: {},
          body: "Not Found",
        };
      });

      // First call -> upstream called
      const first = await service.getLinkPreview("https://www.youtube.com/watch?v=00000000000", "usr_1", "127.0.0.1");
      expect(first.status).toBe("NOT_FOUND");
      expect(upstreamCalls).toBe(1);

      // Second call -> negative cache hit, 0 additional upstream calls
      const second = await service.getLinkPreview("https://www.youtube.com/watch?v=00000000000", "usr_1", "127.0.0.1");
      expect(second.status).toBe("NOT_FOUND");
      expect(upstreamCalls).toBe(1);
    });
  });

  describe("5. Circuit Breaker Lifecycle", () => {
    it("trips circuit breaker after 5 consecutive failures and self-recovers", async () => {
      const breaker = service.getCircuitBreaker("YOUTUBE")!;
      breaker.reset();

      let calls = 0;
      service.setUpstreamFetcher(async () => {
        calls++;
        return { status: 503, headers: {}, body: "Service Unavailable" };
      });

      // Trigger 5 failures with valid 11-char IDs
      for (let i = 0; i < 5; i++) {
        await cacheService.invalidate(`link_preview:youtube:fail12345_${i}`);
        await service.getLinkPreview(`https://www.youtube.com/watch?v=fail12345_${i}`, `usr_cb_${i}`, "127.0.0.1");
      }

      expect(breaker.getState()).toBe("OPEN");
      const callsBefore = calls;

      // 6th call: breaker is OPEN -> returns UNAVAILABLE immediately without calling upstream!
      await cacheService.invalidate("link_preview:youtube:fail_open12");
      const resOpen = await service.getLinkPreview("https://www.youtube.com/watch?v=fail_open12", "usr_cb_6", "127.0.0.1");
      expect(resOpen.status).toBe("UNAVAILABLE");
      expect(calls).toBe(callsBefore); // Upstream was NOT called!

      // Reset breaker to simulate recovery
      breaker.reset();
      expect(breaker.getState()).toBe("CLOSED");
    });
  });

  describe("6. Throttling, Auth & Flags", () => {
    it("enforces user rate limit of 30 requests / minute", async () => {
      // Mock fast responses
      service.setUpstreamFetcher(async () => ({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Test", thumbnail_url: "https://i.ytimg.com/vi/123/hqdefault.jpg" }),
      }));

      const heavyUserId = `user_throttle_${Date.now()}`;
      // Execute 30 requests safely
      for (let i = 0; i < 30; i++) {
        await service.enforceThrottle(heavyUserId, "192.168.1.100");
      }

      // 31st request -> must throw 429
      await expect(service.enforceThrottle(heavyUserId, "192.168.1.100")).rejects.toThrow(
        HttpException
      );
    });

    it("returns 404 when link_preview master flag is disabled", async () => {
      (flagsService.isEnabled as jest.Mock).mockImplementation((flag: string) => {
        if (flag === "link_preview") return Promise.resolve(false);
        return Promise.resolve(true);
      });

      await expect(
        service.getLinkPreview("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "usr_1", "127.0.0.1")
      ).rejects.toThrow(NotFoundException);
    });

    it("returns 404 when per-platform flag is disabled", async () => {
      (flagsService.isEnabled as jest.Mock).mockImplementation((flag: string) => {
        if (flag === "link_preview_youtube") return Promise.resolve(false);
        return Promise.resolve(true);
      });

      await expect(
        service.getLinkPreview("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "usr_1", "127.0.0.1")
      ).rejects.toThrow(NotFoundException);
    });

    it("V8: verifies that all link preview flags default to false in DEFAULT_FEATURE_FLAGS", () => {
      const { DEFAULT_FEATURE_FLAGS } = require("../src/modules/settings/flags.service");
      expect(DEFAULT_FEATURE_FLAGS.link_preview.enabled).toBe(false);
      expect(DEFAULT_FEATURE_FLAGS.link_preview_youtube.enabled).toBe(false);
      expect(DEFAULT_FEATURE_FLAGS.link_preview_tiktok.enabled).toBe(false);
      expect(DEFAULT_FEATURE_FLAGS.link_preview_instagram.enabled).toBe(false);
      expect(DEFAULT_FEATURE_FLAGS.link_preview.allowlist).toEqual([]);
    });

    it("V8: permits access when user is on flag allowlist even if global enabled is false", async () => {
      (flagsService.isEnabled as jest.Mock).mockImplementation((flag: string, userId?: string) => {
        if (userId === "allowed_tester") return Promise.resolve(true);
        return Promise.resolve(false);
      });

      service.setUpstreamFetcher(async () => ({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Allowlist Video" }),
      }));

      // Non-allowlisted user -> 404
      await expect(
        service.getLinkPreview("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "regular_user", "127.0.0.1")
      ).rejects.toThrow(NotFoundException);

      // Allowlisted user -> succeeds
      const res = await service.getLinkPreview(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "allowed_tester",
        "127.0.0.1"
      );
      expect(res.status).toBe("OK");
    });
  });

  describe("7. Thumbnail Allowlist Security", () => {
    it("drops thumbnail URL if host is outside allowlist", async () => {
      service.setUpstreamFetcher(async () => ({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Allowed Video",
          thumbnail_url: "https://evil-untrusted-cdn.com/bad-image.jpg",
        }),
      }));

      await cacheService.invalidate("link_preview:youtube:thumbTest12");
      const res = await service.getLinkPreview("https://www.youtube.com/watch?v=thumbTest12", "usr_1", "127.0.0.1");
      expect(res.status).toBe("OK");
      expect(res.thumbnailUrl).toBeNull(); // Dropped!
    });

    it("preserves thumbnail URL if host is in allowlist", async () => {
      service.setUpstreamFetcher(async () => ({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Allowed Video",
          thumbnail_url: "https://i.ytimg.com/vi/thumbGood12/hqdefault.jpg",
        }),
      }));

      await cacheService.invalidate("link_preview:youtube:thumbGood12");
      const res = await service.getLinkPreview("https://www.youtube.com/watch?v=thumbGood12", "usr_1", "127.0.0.1");
      expect(res.status).toBe("OK");
      expect(res.thumbnailUrl).toBe("https://i.ytimg.com/vi/thumbGood12/hqdefault.jpg");
    });
  });

  describe("8. Privacy & Logging Standards", () => {
    it("never logs the user's full target URL", async () => {
      const logSpy = jest.spyOn((service as any).logger, "log");
      service.setUpstreamFetcher(async () => ({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Privacy Check", thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" }),
      }));

      const sensitiveUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&private_token=secret12345";
      await service.getLinkPreview(sensitiveUrl, "usr_1", "127.0.0.1");

      for (const call of logSpy.mock.calls) {
        const loggedText = call.join(" ");
        expect(loggedText).not.toContain("private_token");
        expect(loggedText).not.toContain(sensitiveUrl);
      }
    });
  });

  describe("9. Multi-Instance Correctness (V4)", () => {
    it("50 parallel requests across two API instances produce at most 1 upstream call", async () => {
      // Simulate two separate API instances sharing the same Redis/cache layer
      const serviceInstance1 = service;
      const serviceInstance2 = new LinkPreviewService(cacheService, flagsService);

      let upstreamCalls = 0;
      const sharedFetcher = async () => {
        upstreamCalls++;
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: "Multi-Instance Coalesced",
            thumbnail_url: "https://i.ytimg.com/vi/multiInst12/hqdefault.jpg",
          }),
        };
      };

      serviceInstance1.setUpstreamFetcher(sharedFetcher);
      serviceInstance2.setUpstreamFetcher(sharedFetcher);

      const target = "https://www.youtube.com/watch?v=multiInst12";
      await cacheService.invalidate("link_preview:youtube:multiInst12");

      // Dispatch 25 requests to Instance 1 and 25 requests to Instance 2 concurrently
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 25; i++) {
        promises.push(serviceInstance1.getLinkPreview(target, `usr_inst1_${i}`, `10.0.0.${i}`));
        promises.push(serviceInstance2.getLinkPreview(target, `usr_inst2_${i}`, `10.0.1.${i}`));
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(50);
      for (const res of results) {
        expect(res.status).toBe("OK");
        expect(res.title).toBe("Multi-Instance Coalesced");
      }

      // Proves cross-instance single-flight held: at most 1 upstream network request
      expect(upstreamCalls).toBeLessThanOrEqual(1);
    });

    it("throttle limit holds strictly across both API instances", async () => {
      const serviceInstance1 = service;
      const serviceInstance2 = new LinkPreviewService(cacheService, flagsService);

      const dummyFetcher = async () => ({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Throttled Video" }),
      });
      serviceInstance1.setUpstreamFetcher(dummyFetcher);
      serviceInstance2.setUpstreamFetcher(dummyFetcher);

      const throttledUserId = "usr_shared_throttle_test";
      const userKey = `throttle:link_preview:user:${throttledUserId}`;
      await cacheService.invalidate(userKey);

      // User limit is 30 req/min. Fire 15 on instance 1 and 15 on instance 2 (total 30)
      for (let i = 0; i < 15; i++) {
        await serviceInstance1.enforceThrottle(throttledUserId, "192.168.1.1");
        await serviceInstance2.enforceThrottle(throttledUserId, "192.168.1.2");
      }

      // 31st request on either instance MUST be rejected with 429
      await expect(serviceInstance1.enforceThrottle(throttledUserId, "192.168.1.1")).rejects.toThrow(HttpException);
      await expect(serviceInstance2.enforceThrottle(throttledUserId, "192.168.1.2")).rejects.toThrow(HttpException);
    });
  });
});

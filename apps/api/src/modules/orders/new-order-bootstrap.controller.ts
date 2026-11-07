import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { OptionalJwtAuthGuard } from "../../common/jwt-auth.guard";
import { CurrentUser, CurrentUserData } from "../../common/current-user.decorator";
import { PrismaService } from "../../common/prisma.service";
import { SMMCacheService } from "../../common/cache.service";
import { FeatureFlagsService } from "../settings/flags.service";
import { ServiceKind } from "@prisma/client";

@ApiTags("New Order Bootstrap")
@Controller("new-order")
export class NewOrderBootstrapController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: SMMCacheService,
    private readonly flagsService: FeatureFlagsService
  ) {}

  @Get("bootstrap")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Get Initial Configuration & Catalogs for New Order Page (Redis 60s)" })
  async getBootstrap(
    @Query("platform") platformQuery?: string,
    @CurrentUser() user?: CurrentUserData
  ) {
    const rawPlatform = (platformQuery || "INSTAGRAM").toUpperCase();
    const platform = rawPlatform === "X" ? "X_TWITTER" : rawPlatform;
    const userId = user?.id;
    const isAdmin = user?.role === "ADMIN";

    const cacheKey = `new_order:bootstrap:${platform}:${userId || "anon"}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    // 1. Fetch resolved feature flags for user
    const flags = await this.flagsService.resolveUserFlags(userId, isAdmin);

    // 2. Fetch User balance if authenticated
    let balance = 0;
    if (userId && this.prisma.isConnected) {
      const wallet = await this.prisma.wallet.findUnique({
        where: { userId },
        select: { balance: true },
      });
      if (wallet) balance = Number(wallet.balance);
    }

    // 3. Fetch PlatformConfig
    let platformConfig: any = null;
    let enabledTabs = ["SINGLE", "CUSTOM_DRIP", "COMBOS", "AUTOPILOT"];
    let dripIntervals = [1, 2, 4, 8, 12, 24];
    let durationChips = [1, 3, 5, 7, 10, 14, 21, 30, 45, 60];

    if (this.prisma.isConnected) {
      platformConfig = await this.prisma.platformConfig.findFirst({
        where: {
          platform: { equals: platform.toLowerCase(), mode: "insensitive" },
          active: true,
        },
      });
      if (platformConfig) {
        if (platformConfig.dripIntervals?.length) dripIntervals = platformConfig.dripIntervals;
        if (platformConfig.durationChips?.length) durationChips = platformConfig.durationChips;
        if (platformConfig.enabledTabs?.length) enabledTabs = platformConfig.enabledTabs;
      }
    }

    // 4. Fetch Enabled Platforms
    let enabledPlatforms: string[] = ["INSTAGRAM", "YOUTUBE", "TIKTOK", "TELEGRAM", "X", "SPOTIFY", "FACEBOOK"];
    if (this.prisma.isConnected) {
      const distinct = await this.prisma.service.findMany({
        where: { isDeleted: false, active: true },
        select: { platform: true },
        distinct: ["platform"],
      });
      if (distinct.length > 0) {
        enabledPlatforms = distinct.map((p) => (p.platform === "X_TWITTER" ? "X" : p.platform));
      }
    }

    // 5. Fetch Active Services for this platform
    let services: any[] = [];
    let categories: any[] = [];

    if (this.prisma.isConnected) {
      const dbServices = await this.prisma.service.findMany({
        where: {
          isDeleted: false,
          active: true,
          platform: { equals: platform, mode: "insensitive" },
        },
        include: {
          category: true,
        },
        orderBy: [{ ratePer1000: "asc" }],
      });

      services = dbServices.map((s) => ({
        id: s.id,
        categoryId: s.categoryId,
        categoryName: s.category.name,
        name: s.displayName || s.name,
        displayName: s.displayName || s.name,
        description: s.description || null,
        ratePer1000: Number(s.ratePer1000),
        minQty: s.minQty,
        maxQty: s.maxQty,
        kind: s.kind || ServiceKind.OTHER,
        geoCountry: s.geoCountry || null,
        geoRegion: s.geoRegion || null,
        refillable: s.refillable,
        cancellable: s.cancellable,
        dripFeedSupported: s.dripFeedSupported,
        avgTime: s.avgTime || "0 - 15 mins",
        serviceType: s.serviceType,
        linkType: s.linkType,
        platform: s.platform
          ? (s.platform === "X_TWITTER" ? "x" : s.platform).toLowerCase()
          : (platform === "X_TWITTER" ? "x" : platform).toLowerCase(),
      }));

      // Extract unique categories for this platform
      const categoryMap = new Map<string, any>();
      for (const s of dbServices) {
        if (!categoryMap.has(s.category.id)) {
          categoryMap.set(s.category.id, {
            id: s.category.id,
            name: s.category.name,
            slug: s.category.slug,
            sortOrder: s.category.sortOrder,
          });
        }
      }
      categories = Array.from(categoryMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);
    }

    // 6. Group services by kind (Strict kind filtering: FOLLOWERS cannot contain mentions/visits)
    const servicesByKind: Record<string, any[]> = {
      LIKES: [],
      VIEWS: [],
      FOLLOWERS: [],
      SUBSCRIBERS: [],
      COMMENTS: [],
      REACH: [],
      IMPRESSIONS: [],
      SHARES: [],
      SAVES: [],
      OTHER: [],
    };

    for (const service of services) {
      const kindKey = service.kind in servicesByKind ? service.kind : "OTHER";
      
      // Strict filter rule: FOLLOWERS slot can NEVER list MENTIONS or PROFILE_VISITS
      if (kindKey === "FOLLOWERS") {
        const lowerName = service.name.toLowerCase();
        if (lowerName.includes("mention") || lowerName.includes("profile visit") || lowerName.includes("reach")) {
          servicesByKind.OTHER.push(service);
          continue;
        }
      }

      servicesByKind[kindKey].push(service);
    }

    // 7. Fetch active combo templates for this platform
    let combos: any[] = [];
    if (this.prisma.isConnected) {
      try {
        const dbTemplates = await this.prisma.packageTemplate.findMany({
          where: {
            active: true,
            archived: false,
            platform: { equals: platform, mode: "insensitive" },
          },
          include: {
            tiers: {
              where: { active: true },
              include: {
                items: {
                  include: { service: true },
                },
              },
              orderBy: { price: "asc" },
            },
          },
          orderBy: { displayOrder: "asc" },
        });

        combos = dbTemplates.map((t) => ({
          id: t.id,
          slug: t.slug,
          name: t.name,
          description: t.description,
          badge: t.badge,
          pricingMode: t.pricingMode,
          tiers: t.tiers.map((tier) => ({
            id: tier.id,
            version: tier.version,
            name: tier.name,
            price: Number(tier.price),
            durationDays: tier.durationDays,
            soldCount: tier.soldCount,
            items: tier.items.map((item) => ({
              id: item.id,
              serviceId: item.serviceId,
              serviceName: item.service.displayName || item.service.name,
              quantity: item.quantity,
              kind: item.kind,
              allocationBp: item.allocationBp,
            })),
          })),
        }));
      } catch (err: any) {
        // Table might be freshly created
      }
    }

    const payload = {
      platform,
      enabledPlatforms,
      enabledTabs,
      balance,
      categories,
      services,
      servicesByKind,
      dripOptions: {
        intervals: dripIntervals,
        minRuns: 2,
        maxRuns: 100,
      },
      durationChips,
      combos,
      complianceNotice: "Services are dispatched deterministically through verified providers. The target profile or post must be public.",
      flags,
    };

    await this.cacheService.set(cacheKey, payload, { ttlSeconds: 60 });
    return payload;
  }
}

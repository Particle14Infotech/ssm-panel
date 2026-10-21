import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { ServiceItem, ServicePlatform } from "@smm/contracts";
import { Decimal } from "decimal.js";

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPlatforms(): Promise<string[]> {
    if (!this.prisma.isConnected) {
      return ["INSTAGRAM", "YOUTUBE", "TIKTOK", "TELEGRAM", "X_TWITTER", "FACEBOOK", "SPOTIFY"];
    }

    try {
      const distinctPlatforms = await this.prisma.service.findMany({
        where: { isDeleted: false, active: true },
        select: { platform: true },
        distinct: ["platform"],
      });
      const platforms = distinctPlatforms.map((p) => p.platform);
      return platforms.length > 0
        ? platforms
        : ["INSTAGRAM", "YOUTUBE", "TIKTOK", "TELEGRAM", "X_TWITTER", "FACEBOOK", "SPOTIFY"];
    } catch {
      return ["INSTAGRAM", "YOUTUBE", "TIKTOK", "TELEGRAM", "X_TWITTER", "FACEBOOK", "SPOTIFY"];
    }
  }

  async getCategories() {
    if (!this.prisma.isConnected) {
      return [];
    }

    try {
      const categories = await this.prisma.category.findMany({
        include: {
          _count: {
            select: { services: { where: { isDeleted: false, active: true } } },
          },
        },
        orderBy: { sortOrder: "asc" },
      });

      return categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        sortOrder: cat.sortOrder,
        serviceCount: cat._count.services,
      }));
    } catch (err: any) {
      this.logger.error(`Error fetching categories: ${err.message}`);
      return [];
    }
  }

  async createCategory(input: { name: string; slug?: string; sortOrder?: number }) {
    const slug = input.slug || input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!this.prisma.isConnected) {
      return { success: true, category: { id: `cat_${Date.now()}`, name: input.name, slug } };
    }

    const category = await this.prisma.category.upsert({
      where: { slug },
      update: { name: input.name, sortOrder: input.sortOrder || 0 },
      create: { name: input.name, slug, sortOrder: input.sortOrder || 0 },
    });

    return { success: true, category };
  }

  async findAll(
    platform?: string,
    query?: string,
    categoryId?: string,
    sortBy?: string,
    packageEligible?: boolean | string
  ): Promise<ServiceItem[]> {
    if (!this.prisma.isConnected) {
      return [];
    }

    try {
      const where: any = {
        isDeleted: false,
        active: true,
      };

      if (platform && platform !== "ALL") {
        const p = platform.toUpperCase();
        if (p === "X" || p === "TWITTER" || p === "X_TWITTER") {
          where.platform = { in: ["X", "TWITTER", "X_TWITTER"] };
        } else {
          where.platform = { equals: p, mode: "insensitive" };
        }
      }

      if (packageEligible !== undefined) {
        where.packageEligible = packageEligible === true || packageEligible === "true";
      }

      if (categoryId) {
        where.categoryId = categoryId;
      }

      if (query && query.trim()) {
        const q = query.trim();
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ];
      }

      const orderBy: any = {};
      if (sortBy === "price_asc") {
        orderBy.ratePer1000 = "asc";
      } else if (sortBy === "price_desc") {
        orderBy.ratePer1000 = "desc";
      } else {
        orderBy.createdAt = "desc";
      }

      const [services, providers] = await Promise.all([
        this.prisma.service.findMany({
          where,
          include: {
            category: true,
            provider: {
              select: { id: true, name: true },
            },
          },
          orderBy,
        }),
        this.prisma.provider.findMany({
          select: { id: true, name: true },
        }).catch(() => []),
      ]);

      const providerMap = new Map((providers || []).map((p) => [p.id, p.name]));

      return services.map((s) => {
        let linkType = s.linkType;
        if (!linkType) {
          const lower = (s.name || "").toLowerCase();
          if (lower.includes("follower") || lower.includes("subscriber") || lower.includes("member")) {
            linkType = s.platform === "YOUTUBE" ? "CHANNEL" : "PROFILE";
          } else {
            linkType = "POST_OR_REEL";
          }
        }

        const costVal = s.costINR ? Number(s.costINR) : (s.providerCostPer1k ? Number(s.providerCostPer1k) : null);
        let marginPct: number | undefined = undefined;
        if (s.marginPercentOverride !== null && s.marginPercentOverride !== undefined) {
          marginPct = Number(s.marginPercentOverride);
        } else if (costVal && costVal > 0) {
          marginPct = Number((((Number(s.ratePer1000) - costVal) / costVal) * 100).toFixed(1));
        }

        const providerName = s.providerId ? (providerMap.get(s.providerId) || s.provider?.name) : undefined;
        const backupProviderName = s.backupProviderId ? providerMap.get(s.backupProviderId) : undefined;

        return {
          id: s.id,
          name: s.name,
          displayName: s.displayName || s.name,
          categoryId: s.categoryId,
          categoryName: s.category?.name || "General",
          platform: s.platform as ServicePlatform,
          ratePer1000: Number(s.ratePer1000),
          providerCostPer1k: s.providerCostPer1k ? Number(s.providerCostPer1k) : undefined,
          costINR: costVal ?? undefined,
          marginPercent: marginPct,
          priceBelowCost: s.priceBelowCost ?? false,
          minQty: s.minQty,
          maxQty: s.maxQty,
          description: s.description || "",
          refillable: s.refillable,
          cancellable: s.cancellable,
          dripFeedSupported: s.dripFeedSupported,
          allowManagedDrip: s.allowManagedDrip !== null && s.allowManagedDrip !== undefined ? s.allowManagedDrip : (s.serviceType !== "CUSTOM_COMMENTS" && !s.name?.toLowerCase().includes("comment")),
          packageEligible: s.packageEligible ?? false,
          providerId: s.providerId || null,
          providerServiceId: s.providerServiceId || null,
          providerName,
          routingMode: (s.routingMode as any) || "MANUAL",
          backupProviderId: s.backupProviderId || null,
          backupProviderServiceId: s.backupProviderServiceId || null,
          backupProviderName,
          rawMeta: (s.rawMeta as any) || undefined,
          dripFeedMinRuns: s.dripFeedMinRuns,
          dripFeedMaxRuns: s.dripFeedMaxRuns,
          dripFeedMinInterval: s.dripFeedMinInterval,
          dripFeedMaxInterval: s.dripFeedMaxInterval,
          serviceType: s.serviceType || "DEFAULT",
          linkType: linkType as any,
          avgStartTime: s.avgTime || "15-30 min",
          avgProcessingSpeed: "High Speed",
          status: (s.status === "ACTIVE" ? "ACTIVE" : "DISABLED") as any,
        };
      });
    } catch (err: any) {
      this.logger.error(`Error querying services: ${err.message}`);
      return [];
    }
  }

  async findOne(id: string): Promise<ServiceItem | null> {
    if (!this.prisma.isConnected) {
      return null;
    }

    const s = await this.prisma.service.findUnique({
      where: { id },
      include: {
        category: true,
        provider: { select: { id: true, name: true } },
      },
    });

    if (!s || s.isDeleted) return null;

    let linkType = s.linkType;
    if (!linkType) {
      const lower = (s.name || "").toLowerCase();
      if (lower.includes("follower") || lower.includes("subscriber") || lower.includes("member")) {
        linkType = s.platform === "YOUTUBE" ? "CHANNEL" : "PROFILE";
      } else {
        linkType = "POST_OR_REEL";
      }
    }

    const costVal = s.costINR ? Number(s.costINR) : (s.providerCostPer1k ? Number(s.providerCostPer1k) : null);
    let marginPct: number | undefined = undefined;
    if (s.marginPercentOverride !== null && s.marginPercentOverride !== undefined) {
      marginPct = Number(s.marginPercentOverride);
    } else if (costVal && costVal > 0) {
      marginPct = Number((((Number(s.ratePer1000) - costVal) / costVal) * 100).toFixed(1));
    }

    let backupProviderName: string | undefined = undefined;
    if (s.backupProviderId) {
      const bp = await this.prisma.provider.findUnique({
        where: { id: s.backupProviderId },
        select: { name: true },
      }).catch(() => null);
      backupProviderName = bp?.name;
    }

    return {
      id: s.id,
      name: s.name,
      displayName: s.displayName || s.name,
      categoryId: s.categoryId,
      categoryName: s.category?.name || "General",
      platform: s.platform as ServicePlatform,
      ratePer1000: Number(s.ratePer1000),
      providerCostPer1k: s.providerCostPer1k ? Number(s.providerCostPer1k) : undefined,
      costINR: costVal ?? undefined,
      marginPercent: marginPct,
      priceBelowCost: s.priceBelowCost ?? false,
      minQty: s.minQty,
      maxQty: s.maxQty,
      description: s.description || "",
      refillable: s.refillable,
      cancellable: s.cancellable,
      dripFeedSupported: s.dripFeedSupported,
      allowManagedDrip: s.allowManagedDrip !== null && s.allowManagedDrip !== undefined ? s.allowManagedDrip : (s.serviceType !== "CUSTOM_COMMENTS" && !s.name?.toLowerCase().includes("comment")),
      providerId: s.providerId || null,
      providerServiceId: s.providerServiceId || null,
      providerName: s.provider?.name,
      routingMode: (s.routingMode as any) || "MANUAL",
      backupProviderId: s.backupProviderId || null,
      backupProviderServiceId: s.backupProviderServiceId || null,
      backupProviderName,
      rawMeta: (s.rawMeta as any) || undefined,
      dripFeedMinRuns: s.dripFeedMinRuns,
      dripFeedMaxRuns: s.dripFeedMaxRuns,
      dripFeedMinInterval: s.dripFeedMinInterval,
      dripFeedMaxInterval: s.dripFeedMaxInterval,
      serviceType: s.serviceType || "DEFAULT",
      linkType: linkType as any,
      avgStartTime: s.avgTime || "Instant",
      avgProcessingSpeed: "High Speed",
      status: (s.status === "ACTIVE" ? "ACTIVE" : "DISABLED") as any,
    };
  }

  async create(input: any) {
    if (!this.prisma.isConnected) {
      return { success: true, service: { id: `srv_${Date.now()}`, ...input } };
    }

    // Ensure category exists
    let categoryId = input.categoryId;
    if (!categoryId) {
      const defaultCat = await this.prisma.category.upsert({
        where: { slug: "general" },
        update: {},
        create: { name: "General", slug: "general" },
      });
      categoryId = defaultCat.id;
    }

    const created = await this.prisma.service.create({
      data: {
        name: input.name,
        categoryId,
        platform: (input.platform || "INSTAGRAM").toUpperCase(),
        ratePer1000: new Decimal(Number(input.ratePer1000 || 100)),
        minQty: parseInt(String(input.minQty || 10), 10),
        maxQty: parseInt(String(input.maxQty || 100000), 10),
        description: input.description || "",
        avgTime: input.avgTime || input.avgStartTime || "Instant",
        refillable: Boolean(input.refillable),
        cancellable: Boolean(input.cancellable),
        dripFeedSupported: Boolean(input.dripFeedSupported),
        allowManagedDrip: input.allowManagedDrip !== undefined ? Boolean(input.allowManagedDrip) : true,
        dripFeedMinRuns: input.dripFeedMinRuns ? parseInt(String(input.dripFeedMinRuns), 10) : null,
        dripFeedMaxRuns: input.dripFeedMaxRuns ? parseInt(String(input.dripFeedMaxRuns), 10) : null,
        dripFeedMinInterval: input.dripFeedMinInterval ? parseInt(String(input.dripFeedMinInterval), 10) : null,
        dripFeedMaxInterval: input.dripFeedMaxInterval ? parseInt(String(input.dripFeedMaxInterval), 10) : null,
        active: input.active !== false,
        status: input.status || "ACTIVE",
        routingMode: input.routingMode || "MANUAL",
        providerId: input.providerId || null,
        providerServiceId: input.providerServiceId || null,
        backupProviderId: input.backupProviderId || null,
        backupProviderServiceId: input.backupProviderServiceId || null,
      },
      include: { category: true },
    });

    return { success: true, service: created };
  }

  async update(id: string, input: any) {
    if (!this.prisma.isConnected) {
      return { success: true, service: { id, ...input } };
    }

    const data: any = {};
    if (input.name) data.name = input.name;
    if (input.categoryId) data.categoryId = input.categoryId;
    if (input.platform) data.platform = input.platform.toUpperCase();
    if (input.ratePer1000 !== undefined) data.ratePer1000 = new Decimal(Number(input.ratePer1000));
    if (input.minQty !== undefined) data.minQty = parseInt(String(input.minQty), 10);
    if (input.maxQty !== undefined) data.maxQty = parseInt(String(input.maxQty), 10);
    if (input.description !== undefined) data.description = input.description;
    if (input.avgTime !== undefined) data.avgTime = input.avgTime;
    if (input.refillable !== undefined) data.refillable = Boolean(input.refillable);
    if (input.cancellable !== undefined) data.cancellable = Boolean(input.cancellable);
    if (input.dripFeedSupported !== undefined) data.dripFeedSupported = Boolean(input.dripFeedSupported);
    if (input.allowManagedDrip !== undefined) data.allowManagedDrip = Boolean(input.allowManagedDrip);
    if (input.dripFeedMinRuns !== undefined) data.dripFeedMinRuns = input.dripFeedMinRuns ? parseInt(String(input.dripFeedMinRuns), 10) : null;
    if (input.dripFeedMaxRuns !== undefined) data.dripFeedMaxRuns = input.dripFeedMaxRuns ? parseInt(String(input.dripFeedMaxRuns), 10) : null;
    if (input.dripFeedMinInterval !== undefined) data.dripFeedMinInterval = input.dripFeedMinInterval ? parseInt(String(input.dripFeedMinInterval), 10) : null;
    if (input.dripFeedMaxInterval !== undefined) data.dripFeedMaxInterval = input.dripFeedMaxInterval ? parseInt(String(input.dripFeedMaxInterval), 10) : null;
    if (input.active !== undefined) data.active = Boolean(input.active);
    if (input.status !== undefined) data.status = input.status;
    if (input.routingMode !== undefined) data.routingMode = input.routingMode;
    if (input.providerId !== undefined) data.providerId = input.providerId;
    if (input.providerServiceId !== undefined) data.providerServiceId = input.providerServiceId;
    if (input.backupProviderId !== undefined) data.backupProviderId = input.backupProviderId;
    if (input.backupProviderServiceId !== undefined) data.backupProviderServiceId = input.backupProviderServiceId;

    const updated = await this.prisma.service.update({
      where: { id },
      data,
      include: { category: true },
    });

    return { success: true, service: updated };
  }

  async remove(id: string) {
    if (!this.prisma.isConnected) {
      return true;
    }

    try {
      await this.prisma.service.update({
        where: { id },
        data: { isDeleted: true, deletedAt: new Date(), active: false },
      });
      return true;
    } catch {
      return false;
    }
  }
}

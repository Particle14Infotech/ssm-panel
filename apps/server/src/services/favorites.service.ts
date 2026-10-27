import { CreateFavoriteInput } from "@smm/contracts";
import * as crypto from "crypto";
import { PrismaLike } from "../prisma";
import { ApiError } from "../errors";

export class FavoritesService {
  private sandboxFavorites = new Map<string, any[]>();
  private sandboxDismissals = new Set<string>();

  constructor(private readonly prisma: PrismaLike) {}

  private get client(): any {
    return this.prisma.client || this.prisma;
  }

  private get isConnected(): boolean {
    return Boolean(this.prisma.isConnected);
  }

  async listFavorites(userId: string) {
    if (!this.isConnected) {
      return this.sandboxFavorites.get(userId) || [];
    }

    const favorites = await this.client.favorite.findMany({
      where: { userId },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            displayName: true,
            platform: true,
            ratePer1000: true,
            minQty: true,
            maxQty: true,
            status: true,
            dripFeedSupported: true,
            allowManagedDrip: true,
            isDeleted: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return favorites.map((fav: any) => ({
      id: fav.id,
      userId: fav.userId,
      serviceId: fav.serviceId,
      customName: fav.customName,
      targetUrl: fav.targetUrl,
      defaultQuantity: fav.defaultQuantity,
      isDripFeed: fav.isDripFeed,
      dripRuns: fav.dripRuns,
      dripInterval: fav.dripInterval,
      comments: fav.comments,
      createdAt: fav.createdAt.toISOString(),
      updatedAt: fav.updatedAt.toISOString(),
      service: fav.service
        ? {
            id: fav.service.id,
            name: fav.service.name,
            displayName: fav.service.displayName,
            platform: fav.service.platform,
            ratePer1000: Number(fav.service.ratePer1000),
            minQty: fav.service.minQty,
            maxQty: fav.service.maxQty,
            status: fav.service.isDeleted ? "DELETED" : fav.service.status,
            dripFeedSupported: fav.service.dripFeedSupported,
            allowManagedDrip: fav.service.allowManagedDrip,
          }
        : undefined,
    }));
  }

  async createFavorite(userId: string, input: CreateFavoriteInput) {
    if (!this.isConnected) {
      const userFavs = this.sandboxFavorites.get(userId) || [];
      if (userFavs.length >= 50) {
        throw new ApiError(400, "BAD_REQUEST", "Maximum limit of 50 favorites reached. Please delete an older favorite.");
      }
      const existingIdx = userFavs.findIndex(
        (f) => f.serviceId === input.serviceId && f.targetUrl === input.targetUrl
      );
      const newFav = {
        id: existingIdx >= 0 ? userFavs[existingIdx].id : `fav_${Date.now()}`,
        userId,
        serviceId: input.serviceId,
        customName: input.customName || null,
        targetUrl: input.targetUrl,
        defaultQuantity: input.defaultQuantity,
        isDripFeed: Boolean(input.isDripFeed),
        dripRuns: input.dripRuns || null,
        dripInterval: input.dripInterval || null,
        comments: input.comments || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (existingIdx >= 0) {
        userFavs[existingIdx] = newFav;
      } else {
        userFavs.unshift(newFav);
      }
      this.sandboxFavorites.set(userId, userFavs);
      return newFav;
    }

    const currentCount = await this.client.favorite.count({ where: { userId } });
    if (currentCount >= 50) {
      const existing = await this.client.favorite.findUnique({
        where: {
          userId_serviceId_targetUrl: {
            userId,
            serviceId: input.serviceId,
            targetUrl: input.targetUrl,
          },
        },
      });
      if (!existing) {
        throw new ApiError(400, "BAD_REQUEST", "Maximum limit of 50 favorites reached. Please delete an older favorite.");
      }
    }

    const service = await this.client.service.findUnique({ where: { id: input.serviceId } });
    if (!service || service.isDeleted) {
      throw new ApiError(400, "BAD_REQUEST", "Selected service does not exist or has been discontinued.");
    }

    const fav = await this.client.favorite.upsert({
      where: {
        userId_serviceId_targetUrl: {
          userId,
          serviceId: input.serviceId,
          targetUrl: input.targetUrl,
        },
      },
      create: {
        userId,
        serviceId: input.serviceId,
        customName: input.customName || null,
        targetUrl: input.targetUrl,
        defaultQuantity: input.defaultQuantity,
        isDripFeed: Boolean(input.isDripFeed),
        dripRuns: input.dripRuns || null,
        dripInterval: input.dripInterval || null,
        comments: input.comments || null,
      },
      update: {
        customName: input.customName || null,
        defaultQuantity: input.defaultQuantity,
        isDripFeed: Boolean(input.isDripFeed),
        dripRuns: input.dripRuns || null,
        dripInterval: input.dripInterval || null,
        comments: input.comments || null,
      },
    });

    return {
      id: fav.id,
      userId: fav.userId,
      serviceId: fav.serviceId,
      customName: fav.customName,
      targetUrl: fav.targetUrl,
      defaultQuantity: fav.defaultQuantity,
      isDripFeed: fav.isDripFeed,
      dripRuns: fav.dripRuns,
      dripInterval: fav.dripInterval,
      comments: fav.comments,
      createdAt: fav.createdAt.toISOString(),
      updatedAt: fav.updatedAt.toISOString(),
    };
  }

  async createFavoriteWithConfig(
    userId: string,
    input: {
      serviceId?: string;
      customName?: string;
      targetUrl?: string;
      defaultQuantity?: number;
      isDripFeed?: boolean;
      dripRuns?: number;
      dripInterval?: number;
      comments?: string;
      config: Record<string, any>;
    }
  ) {
    if (!input.config || typeof input.config !== "object") {
      throw new ApiError(400, "BAD_REQUEST", "Favorite config must be a valid object.");
    }

    const serialized = JSON.stringify(input.config, Object.keys(input.config).sort());
    const configHash = crypto.createHash("sha256").update(serialized).digest("hex");

    const serviceId = input.serviceId || input.config.serviceId || "pkg_custom";
    const targetUrl = input.targetUrl || input.config.targetUrl || input.config.handle || "https://example.com";
    const defaultQuantity = input.defaultQuantity || input.config.quantity || input.config.followers || 100;

    if (!this.isConnected) {
      const userFavs = this.sandboxFavorites.get(userId) || [];
      if (userFavs.length >= 50) {
        throw new ApiError(400, "BAD_REQUEST", "Maximum limit of 50 favorites reached. Please delete an older favorite.");
      }
      const newFav = {
        id: `fav_${Date.now()}`,
        userId,
        serviceId,
        customName: input.customName || input.config.name || null,
        targetUrl,
        defaultQuantity,
        isDripFeed: Boolean(input.isDripFeed),
        dripRuns: input.dripRuns || null,
        dripInterval: input.dripInterval || null,
        comments: input.comments || null,
        config: input.config,
        configHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      userFavs.unshift(newFav);
      this.sandboxFavorites.set(userId, userFavs);
      return newFav;
    }

    const currentCount = await this.client.favorite.count({ where: { userId } });
    if (currentCount >= 50) {
      const existing = await this.client.favorite.findUnique({
        where: {
          userId_serviceId_targetUrl: {
            userId,
            serviceId,
            targetUrl,
          },
        },
      });
      if (!existing) {
        throw new ApiError(400, "BAD_REQUEST", "Maximum limit of 50 favorites reached. Please delete an older favorite.");
      }
    }

    if (serviceId !== "pkg_custom") {
      const service = await this.client.service.findUnique({ where: { id: serviceId } });
      if (!service || service.isDeleted) {
        throw new ApiError(400, "BAD_REQUEST", "Selected service does not exist or has been discontinued.");
      }
    }

    const fav = await this.client.favorite.upsert({
      where: {
        userId_serviceId_targetUrl: {
          userId,
          serviceId,
          targetUrl,
        },
      },
      create: {
        userId,
        serviceId,
        customName: input.customName || null,
        targetUrl,
        defaultQuantity,
        isDripFeed: Boolean(input.isDripFeed),
        dripRuns: input.dripRuns || null,
        dripInterval: input.dripInterval || null,
        comments: input.comments || null,
        config: input.config,
        configHash,
      },
      update: {
        customName: input.customName || null,
        defaultQuantity,
        isDripFeed: Boolean(input.isDripFeed),
        dripRuns: input.dripRuns || null,
        dripInterval: input.dripInterval || null,
        comments: input.comments || null,
        config: input.config,
        configHash,
      },
    });

    return fav;
  }

  async deleteFavorite(userId: string, favoriteId: string) {
    if (!this.isConnected) {
      const userFavs = this.sandboxFavorites.get(userId) || [];
      const filtered = userFavs.filter((f) => f.id !== favoriteId);
      if (filtered.length === userFavs.length) {
        throw new ApiError(404, "NOT_FOUND", "Favorite not found.");
      }
      this.sandboxFavorites.set(userId, filtered);
      return { success: true };
    }

    const fav = await this.client.favorite.findFirst({
      where: { id: favoriteId, userId },
    });
    if (!fav) {
      throw new ApiError(404, "NOT_FOUND", "Favorite not found.");
    }

    await this.client.favorite.delete({
      where: { id: favoriteId },
    });

    return { success: true };
  }

  async getSuggestions(userId: string) {
    if (!this.isConnected) {
      return [];
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    let candidates: any[] = [];
    try {
      candidates = await (this.client.$queryRaw || this.client.$queryRawUnsafe)`
        SELECT 
          o."serviceId", 
          o."target", 
          COUNT(o."id") as "orderCount",
          ROUND(AVG(o."quantity")) as "avgQuantity",
          MAX(o."createdAt") as "lastOrderedAt"
        FROM "Order" o
        WHERE o."userId" = ${userId}
          AND o."createdAt" >= ${ninetyDaysAgo}
        GROUP BY o."serviceId", o."target"
        HAVING COUNT(o."id") >= 2
        ORDER BY "orderCount" DESC, "lastOrderedAt" DESC
        LIMIT 10;
      `;
    } catch {
      candidates = [];
    }

    if (!candidates || candidates.length === 0) {
      return [];
    }

    const existingFavorites = await this.client.favorite.findMany({
      where: { userId },
      select: { serviceId: true, targetUrl: true },
    });
    const dismissals = await this.client.suggestionDismissal.findMany({
      where: { userId },
      select: { serviceId: true, targetUrl: true },
    });

    const isExcluded = (serviceId: string, target: string) => {
      const inFav = existingFavorites.some((f: any) => f.serviceId === serviceId && f.targetUrl === target);
      const inDismissed = dismissals.some((d: any) => d.serviceId === serviceId && d.targetUrl === target);
      return inFav || inDismissed;
    };

    const filtered = candidates.filter((c: any) => !isExcluded(c.serviceId, c.target));
    if (filtered.length === 0) return [];

    const serviceIds = [...new Set(filtered.map((c: any) => c.serviceId))];
    const services = await this.client.service.findMany({
      where: { id: { in: serviceIds }, isDeleted: false },
      select: { id: true, name: true, displayName: true, platform: true, ratePer1000: true },
    });
    const serviceMap = new Map(services.map((s: any) => [s.id, s]));

    return filtered
      .map((c: any) => {
        const svc = serviceMap.get(c.serviceId) as any;
        if (!svc) return null;
        return {
          serviceId: c.serviceId,
          serviceName: svc.displayName || svc.name,
          platform: svc.platform,
          targetUrl: c.target,
          orderCount: Number(c.orderCount),
          avgQuantity: Number(c.avgQuantity),
          lastOrderedAt: new Date(c.lastOrderedAt).toISOString(),
          ratePer1000: Number(svc.ratePer1000),
        };
      })
      .filter(Boolean);
  }

  async dismissSuggestion(userId: string, serviceId: string, targetUrl: string) {
    if (!this.isConnected) {
      this.sandboxDismissals.add(`${userId}_${serviceId}_${targetUrl}`);
      return { success: true };
    }

    await this.client.suggestionDismissal.upsert({
      where: {
        userId_serviceId_targetUrl: {
          userId,
          serviceId,
          targetUrl,
        },
      },
      create: {
        userId,
        serviceId,
        targetUrl,
      },
      update: {},
    });

    return { success: true };
  }
}

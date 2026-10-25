import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { CreateFavoriteInput } from "@smm/contracts";
import * as crypto from "crypto";

@Injectable()
export class FavoritesService {
  private sandboxFavorites = new Map<string, any[]>();
  private sandboxDismissals = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists all favorites saved by the current user
   */
  async listFavorites(userId: string) {
    if (!this.prisma.isConnected) {
      const userFavs = this.sandboxFavorites.get(userId) || [];
      return userFavs;
    }

    const favorites = await this.prisma.favorite.findMany({
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

    return favorites.map((fav) => ({
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

  /**
   * Adds or updates a favorite for the user.
   * Enforces a maximum limit of 50 favorites per user.
   */
  async createFavorite(userId: string, input: CreateFavoriteInput) {
    if (!this.prisma.isConnected) {
      const userFavs = this.sandboxFavorites.get(userId) || [];
      if (userFavs.length >= 50) {
        throw new BadRequestException("Maximum limit of 50 favorites reached. Please delete an older favorite.");
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

    // 1. Atomic Transaction with User row lock to eliminate cap race conditions
    return await this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`SELECT id FROM "User" WHERE id = $1 FOR UPDATE`, userId);

      const currentCount = await tx.favorite.count({
        where: { userId },
      });
      if (currentCount >= 50) {
        const existing = await tx.favorite.findUnique({
          where: {
            userId_serviceId_targetUrl: {
              userId,
              serviceId: input.serviceId,
              targetUrl: input.targetUrl,
            },
          },
        });
        if (!existing) {
          throw new BadRequestException("Maximum limit of 50 favorites reached. Please delete an older favorite.");
        }
      }

      // 2. Validate that target service exists
      const service = await tx.service.findUnique({
        where: { id: input.serviceId },
      });
      if (!service || service.isDeleted) {
        throw new BadRequestException("Selected service does not exist or has been discontinued.");
      }

      // 3. Upsert favorite
      const fav = await tx.favorite.upsert({
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
        include: {
          service: true,
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
    });
  }

  /**
   * Adds or updates a favorite with generic configuration (ORDER or PACKAGE kind).
   * Enforces 50 limit, IDOR scoping to userId, and deterministic configHash.
   */
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
      throw new BadRequestException("Favorite config must be a valid object.");
    }

    const serialized = JSON.stringify(input.config, Object.keys(input.config).sort());
    const configHash = crypto.createHash("sha256").update(serialized).digest("hex");

    const serviceId = input.serviceId || input.config.serviceId || "pkg_custom";
    const targetUrl = input.targetUrl || input.config.targetUrl || input.config.handle || "https://example.com";
    const defaultQuantity = input.defaultQuantity || input.config.quantity || input.config.followers || 100;

    if (!this.prisma.isConnected) {
      const userFavs = this.sandboxFavorites.get(userId) || [];
      if (userFavs.length >= 50) {
        throw new BadRequestException("Maximum limit of 50 favorites reached. Please delete an older favorite.");
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

    return await this.prisma.$transaction(async (tx: any) => {
      await tx.$queryRawUnsafe(`SELECT id FROM "User" WHERE id = $1 FOR UPDATE`, userId);

      const currentCount = await tx.favorite.count({
        where: { userId },
      });
      if (currentCount >= 50) {
        const existing = await tx.favorite.findUnique({
          where: {
            userId_serviceId_targetUrl: {
              userId,
              serviceId,
              targetUrl,
            },
          },
        });
        if (!existing) {
          throw new BadRequestException("Maximum limit of 50 favorites reached. Please delete an older favorite.");
        }
      }

      if (serviceId !== "pkg_custom") {
        const service = await tx.service.findUnique({
          where: { id: serviceId },
        });
        if (!service || service.isDeleted) {
          throw new BadRequestException("Selected service does not exist or has been discontinued.");
        }
      }

      const fav = await tx.favorite.upsert({
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
    });
  }

  /**
   * Deletes a favorite belonging to the user
   */
  async deleteFavorite(userId: string, favoriteId: string) {
    if (!this.prisma.isConnected) {
      const userFavs = this.sandboxFavorites.get(userId) || [];
      const filtered = userFavs.filter((f) => f.id !== favoriteId);
      if (filtered.length === userFavs.length) {
        throw new NotFoundException("Favorite not found.");
      }
      this.sandboxFavorites.set(userId, filtered);
      return { success: true };
    }

    const fav = await this.prisma.favorite.findFirst({
      where: { id: favoriteId, userId },
    });
    if (!fav) {
      throw new NotFoundException("Favorite not found.");
    }

    await this.prisma.favorite.delete({
      where: { id: favoriteId },
    });

    return { success: true };
  }

  /**
   * Recommends favorites based on repeated orders from the past 90 days.
   * Finds (serviceId, target) combos with at least 2 orders that are not
   * already favorited or dismissed by the user.
   */
  async getSuggestions(userId: string) {
    if (!this.prisma.isConnected) {
      return [];
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    // Raw aggregation for speed and flexibility
    const candidates = await this.prisma.$queryRaw<
      Array<{
        serviceId: string;
        target: string;
        orderCount: bigint;
        avgQuantity: number;
        lastOrderedAt: Date;
      }>
    >`
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

    if (!candidates || candidates.length === 0) {
      return [];
    }

    // Filter out existing favorites and dismissals
    const existingFavorites = await this.prisma.favorite.findMany({
      where: { userId },
      select: { serviceId: true, targetUrl: true },
    });
    const dismissals = await this.prisma.suggestionDismissal.findMany({
      where: { userId },
      select: { serviceId: true, targetUrl: true },
    });

    const isExcluded = (serviceId: string, target: string) => {
      const inFav = existingFavorites.some(
        (f) => f.serviceId === serviceId && f.targetUrl === target
      );
      const inDismissed = dismissals.some(
        (d) => d.serviceId === serviceId && d.targetUrl === target
      );
      return inFav || inDismissed;
    };

    const filtered = candidates.filter((c) => !isExcluded(c.serviceId, c.target));
    if (filtered.length === 0) return [];

    // Fetch service info for display
    const serviceIds = [...new Set(filtered.map((c) => c.serviceId))];
    const services = await this.prisma.service.findMany({
      where: { id: { in: serviceIds }, isDeleted: false },
      select: { id: true, name: true, displayName: true, platform: true, ratePer1000: true },
    });
    const serviceMap = new Map(services.map((s) => [s.id, s]));

    return filtered
      .map((c) => {
        const svc = serviceMap.get(c.serviceId);
        if (!svc) return null;
        return {
          serviceId: c.serviceId,
          serviceName: svc.displayName || svc.name,
          platform: svc.platform,
          targetUrl: c.target,
          orderCount: Number(c.orderCount),
          avgQuantity: Number(c.avgQuantity),
          lastOrderedAt: c.lastOrderedAt.toISOString(),
          ratePer1000: Number(svc.ratePer1000),
        };
      })
      .filter(Boolean);
  }

  /**
   * Dismisses a suggested favorite so it does not appear again
   */
  async dismissSuggestion(userId: string, serviceId: string, targetUrl: string) {
    if (!this.prisma.isConnected) {
      this.sandboxDismissals.add(`${userId}_${serviceId}_${targetUrl}`);
      return { success: true };
    }

    await this.prisma.suggestionDismissal.upsert({
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

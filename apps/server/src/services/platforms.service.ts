import { PrismaLike } from "../prisma";
import { ApiError } from "../errors";
import {
  DEFAULT_PLATFORM_CONFIGS,
  PlatformRuleDefinition,
  normalizeHandle,
} from "./platform-rules.util";

export class PlatformsService {
  constructor(private readonly prisma: PrismaLike) {}

  private get client(): any {
    return this.prisma.client || this.prisma;
  }

  private get isConnected(): boolean {
    return Boolean(this.prisma.isConnected);
  }

  async getPublicPlatforms(): Promise<PlatformRuleDefinition[]> {
    if (!this.isConnected) {
      return DEFAULT_PLATFORM_CONFIGS.filter((p) => p.active);
    }

    try {
      const records = await this.client.platformConfig.findMany({
        where: { active: true },
        orderBy: { platform: "asc" },
      });

      if (records.length === 0) {
        return DEFAULT_PLATFORM_CONFIGS.filter((p) => p.active);
      }

      return records.map((r: any) => ({
        platform: r.platform,
        displayName: r.displayName,
        handleRegex: r.handleRegex,
        handleMaxLength: r.handleMaxLength,
        hostAllowlist: r.hostAllowlist,
        pathPattern: r.pathPattern,
        mediaKeyExtractor: r.mediaKeyExtractor,
        urlContainsHandle: r.urlContainsHandle,
        eligibleRuleKinds: r.eligibleRuleKinds,
        followersIntervals: r.followersIntervals,
        minGapMinutes: r.minGapMinutes,
        maxRunsPerPost: r.maxRunsPerPost,
        defaultWindowMinutes: r.defaultWindowMinutes,
        limits: (r.limits as any) || {},
        active: r.active,
      }));
    } catch {
      return DEFAULT_PLATFORM_CONFIGS.filter((p) => p.active);
    }
  }

  async getPlatformConfig(platform: string): Promise<PlatformRuleDefinition> {
    const plat = (platform || "").toLowerCase().trim();
    if (this.isConnected) {
      const record = await this.client.platformConfig.findUnique({
        where: { platform: plat },
      });
      if (record) {
        return {
          platform: record.platform,
          displayName: record.displayName,
          handleRegex: record.handleRegex,
          handleMaxLength: record.handleMaxLength,
          hostAllowlist: record.hostAllowlist,
          pathPattern: record.pathPattern,
          mediaKeyExtractor: record.mediaKeyExtractor,
          urlContainsHandle: record.urlContainsHandle,
          eligibleRuleKinds: record.eligibleRuleKinds,
          followersIntervals: record.followersIntervals,
          minGapMinutes: record.minGapMinutes,
          maxRunsPerPost: record.maxRunsPerPost,
          defaultWindowMinutes: record.defaultWindowMinutes,
          limits: (record.limits as any) || {},
          active: record.active,
        };
      }
    }

    const fallback = DEFAULT_PLATFORM_CONFIGS.find((p) => p.platform === plat);
    if (!fallback) {
      throw new ApiError(404, "NOT_FOUND", `Unsupported platform "${platform}".`);
    }
    return fallback;
  }

  async adminListPlatforms() {
    if (!this.isConnected) return DEFAULT_PLATFORM_CONFIGS;
    return this.client.platformConfig.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  async adminGetPlatform(id: string) {
    if (!this.isConnected) {
      const found = DEFAULT_PLATFORM_CONFIGS.find((p) => p.platform === id);
      if (!found) throw new ApiError(404, "NOT_FOUND", "Platform not found.");
      return found;
    }
    const record = await this.client.platformConfig.findFirst({
      where: { OR: [{ id }, { platform: id }] },
    });
    if (!record) throw new ApiError(404, "NOT_FOUND", "Platform not found.");
    return record;
  }

  async adminCreatePlatform(data: any) {
    if (!this.isConnected) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Database service is currently unavailable. Please retry later.");
    }
    const platform = (data.platform || "").toLowerCase().trim();
    const existing = await this.client.platformConfig.findUnique({
      where: { platform },
    });
    if (existing) {
      throw new ApiError(409, "CONFLICT", `Platform "${platform}" already exists.`);
    }

    return this.client.platformConfig.create({
      data: {
        platform,
        displayName: data.displayName,
        handleRegex: data.handleRegex,
        handleMaxLength: Number(data.handleMaxLength) || 64,
        hostAllowlist: data.hostAllowlist || [],
        pathPattern: data.pathPattern,
        mediaKeyExtractor: data.mediaKeyExtractor,
        urlContainsHandle: Boolean(data.urlContainsHandle),
        eligibleRuleKinds: data.eligibleRuleKinds || ["POST_TRIGGERED", "TIME_DRIP"],
        followersIntervals: data.followersIntervals || [1, 2, 4, 8, 12, 24],
        minGapMinutes: Number(data.minGapMinutes) || 15,
        maxRunsPerPost: Number(data.maxRunsPerPost) || 10,
        defaultWindowMinutes: Number(data.defaultWindowMinutes) || 180,
        limits: data.limits || {},
        active: data.active !== undefined ? Boolean(data.active) : true,
      },
    });
  }

  async adminUpdatePlatform(id: string, data: any) {
    if (!this.isConnected) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Database service is currently unavailable. Please retry later.");
    }
    return this.client.platformConfig.update({
      where: { id },
      data: {
        ...(data.displayName && { displayName: data.displayName }),
        ...(data.handleRegex && { handleRegex: data.handleRegex }),
        ...(data.handleMaxLength !== undefined && { handleMaxLength: Number(data.handleMaxLength) }),
        ...(data.hostAllowlist && { hostAllowlist: data.hostAllowlist }),
        ...(data.pathPattern && { pathPattern: data.pathPattern }),
        ...(data.mediaKeyExtractor && { mediaKeyExtractor: data.mediaKeyExtractor }),
        ...(data.urlContainsHandle !== undefined && { urlContainsHandle: Boolean(data.urlContainsHandle) }),
        ...(data.eligibleRuleKinds && { eligibleRuleKinds: data.eligibleRuleKinds }),
        ...(data.followersIntervals && { followersIntervals: data.followersIntervals }),
        ...(data.minGapMinutes !== undefined && { minGapMinutes: Number(data.minGapMinutes) }),
        ...(data.maxRunsPerPost !== undefined && { maxRunsPerPost: Number(data.maxRunsPerPost) }),
        ...(data.defaultWindowMinutes !== undefined && { defaultWindowMinutes: Number(data.defaultWindowMinutes) }),
        ...(data.limits !== undefined && { limits: data.limits }),
        ...(data.active !== undefined && { active: Boolean(data.active) }),
      },
    });
  }

  async isHandleBlocked(platform: string, handle: string): Promise<boolean> {
    if (!this.isConnected) return false;
    const plat = (platform || "").toLowerCase().trim();
    const normalized = normalizeHandle(handle).toLowerCase();

    const blocked = await this.client.platformHandleBlocklist.findFirst({
      where: {
        platform: plat,
        handle: { equals: normalized, mode: "insensitive" },
      },
    });

    return Boolean(blocked);
  }

  async adminListBlocklist(platform?: string) {
    if (!this.isConnected) return [];
    return this.client.platformHandleBlocklist.findMany({
      where: platform ? { platform: platform.toLowerCase() } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  async adminAddBlocklist(platform: string, handle: string, reason?: string) {
    const plat = (platform || "").toLowerCase().trim();
    const normalized = normalizeHandle(handle);
    if (!this.isConnected) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Database service is currently unavailable. Please retry later.");
    }

    return this.client.platformHandleBlocklist.upsert({
      where: {
        platform_handle: {
          platform: plat,
          handle: normalized,
        },
      },
      update: { reason },
      create: {
        platform: plat,
        handle: normalized,
        reason,
      },
    });
  }

  async adminRemoveBlocklist(id: string) {
    if (!this.isConnected) {
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "Database service is currently unavailable. Please retry later.");
    }
    return this.client.platformHandleBlocklist.delete({
      where: { id },
    });
  }
}

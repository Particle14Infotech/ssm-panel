import { Injectable, Logger, OnModuleInit, NotFoundException, ConflictException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import {
  DEFAULT_PLATFORM_CONFIGS,
  PlatformRuleDefinition,
  normalizeHandle,
  validateHandle,
  validatePlatformLink,
} from "./platform-rules.util";

@Injectable()
export class PlatformsService implements OnModuleInit {
  private readonly logger = new Logger(PlatformsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultPlatforms();
  }

  /**
   * Seeds default platform configs for the 6 platforms if database is available.
   */
  async seedDefaultPlatforms() {
    if (!this.prisma.isConnected) return;

    try {
      for (const def of DEFAULT_PLATFORM_CONFIGS) {
        await this.prisma.platformConfig.upsert({
          where: { platform: def.platform },
          update: {
            displayName: def.displayName,
            handleRegex: def.handleRegex,
            handleMaxLength: def.handleMaxLength,
            hostAllowlist: def.hostAllowlist,
            pathPattern: def.pathPattern,
            mediaKeyExtractor: def.mediaKeyExtractor,
            urlContainsHandle: def.urlContainsHandle,
            eligibleRuleKinds: def.eligibleRuleKinds,
            followersIntervals: def.followersIntervals,
            minGapMinutes: def.minGapMinutes,
            maxRunsPerPost: def.maxRunsPerPost,
            defaultWindowMinutes: def.defaultWindowMinutes,
            limits: def.limits,
            active: def.active,
          },
          create: {
            platform: def.platform,
            displayName: def.displayName,
            handleRegex: def.handleRegex,
            handleMaxLength: def.handleMaxLength,
            hostAllowlist: def.hostAllowlist,
            pathPattern: def.pathPattern,
            mediaKeyExtractor: def.mediaKeyExtractor,
            urlContainsHandle: def.urlContainsHandle,
            eligibleRuleKinds: def.eligibleRuleKinds,
            followersIntervals: def.followersIntervals,
            minGapMinutes: def.minGapMinutes,
            maxRunsPerPost: def.maxRunsPerPost,
            defaultWindowMinutes: def.defaultWindowMinutes,
            limits: def.limits,
            active: def.active,
          },
        });
      }
      this.logger.log("Platform configurations successfully seeded.");
    } catch (err: any) {
      this.logger.warn(`Could not seed platform configs: ${err.message}`);
    }
  }

  /**
   * Public list of active platforms with configuration for UI and customer validation.
   * GET /platforms
   */
  async getPublicPlatforms(): Promise<PlatformRuleDefinition[]> {
    if (!this.prisma.isConnected) {
      return DEFAULT_PLATFORM_CONFIGS.filter((p) => p.active);
    }

    try {
      const records = await this.prisma.platformConfig.findMany({
        where: { active: true },
        orderBy: { platform: "asc" },
      });

      if (records.length === 0) {
        return DEFAULT_PLATFORM_CONFIGS.filter((p) => p.active);
      }

      return records.map((r) => ({
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

  /**
   * Retrieves configuration for a specific platform.
   */
  async getPlatformConfig(platform: string): Promise<PlatformRuleDefinition> {
    const plat = (platform || "").toLowerCase().trim();
    if (this.prisma.isConnected) {
      const record = await this.prisma.platformConfig.findUnique({
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
      throw new NotFoundException(`Unsupported platform "${platform}".`);
    }
    return fallback;
  }

  /**
   * Admin: list all platforms
   */
  async adminListPlatforms() {
    if (!this.prisma.isConnected) return DEFAULT_PLATFORM_CONFIGS;
    return this.prisma.platformConfig.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Admin: get single platform
   */
  async adminGetPlatform(id: string) {
    if (!this.prisma.isConnected) {
      const found = DEFAULT_PLATFORM_CONFIGS.find((p) => p.platform === id);
      if (!found) throw new NotFoundException("Platform not found.");
      return found;
    }
    const record = await this.prisma.platformConfig.findFirst({
      where: { OR: [{ id }, { platform: id }] },
    });
    if (!record) throw new NotFoundException("Platform not found.");
    return record;
  }

  /**
   * Admin: create platform
   */
  async adminCreatePlatform(data: any) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }
    const platform = (data.platform || "").toLowerCase().trim();
    const existing = await this.prisma.platformConfig.findUnique({
      where: { platform },
    });
    if (existing) {
      throw new ConflictException(`Platform "${platform}" already exists.`);
    }

    return this.prisma.platformConfig.create({
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

  /**
   * Admin: update platform
   */
  async adminUpdatePlatform(id: string, data: any) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }
    return this.prisma.platformConfig.update({
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

  /**
   * Checks if a handle is blocked for a platform.
   */
  async isHandleBlocked(platform: string, handle: string): Promise<boolean> {
    if (!this.prisma.isConnected) return false;
    const plat = (platform || "").toLowerCase().trim();
    const normalized = normalizeHandle(handle).toLowerCase();

    const blocked = await this.prisma.platformHandleBlocklist.findFirst({
      where: {
        platform: plat,
        handle: { equals: normalized, mode: "insensitive" },
      },
    });

    return Boolean(blocked);
  }

  /**
   * Admin blocklist listing
   */
  async adminListBlocklist(platform?: string) {
    if (!this.prisma.isConnected) return [];
    return this.prisma.platformHandleBlocklist.findMany({
      where: platform ? { platform: platform.toLowerCase() } : undefined,
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Admin add handle to blocklist
   */
  async adminAddBlocklist(platform: string, handle: string, reason?: string) {
    const plat = (platform || "").toLowerCase().trim();
    const normalized = normalizeHandle(handle);
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }

    return this.prisma.platformHandleBlocklist.upsert({
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

  /**
   * Admin remove handle from blocklist
   */
  async adminRemoveBlocklist(id: string) {
    if (!this.prisma.isConnected) {
      throw new ServiceUnavailableException("Database service is currently unavailable. Please retry later.");
    }
    return this.prisma.platformHandleBlocklist.delete({
      where: { id },
    });
  }
}

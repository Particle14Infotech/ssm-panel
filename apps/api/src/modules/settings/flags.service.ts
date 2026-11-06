import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { SMMCacheService } from "../../common/cache.service";

export interface FlagRule {
  enabled: boolean;
  allowlist: string[];
  percentage: number;
}

export type FeatureFlagKey =
  | "new_order_v2"
  | "tab_custom_drip"
  | "tab_combos"
  | "tab_autopilot"
  | "theme_v2"
  | "theme_light"
  | "dashboard_v2"
  | "delivery_window"
  | "auto_detect"
  | "drip_v2"
  | "delivery_pace"
  | "link_preview"
  | "link_preview_youtube"
  | "link_preview_tiktok"
  | "link_preview_instagram"
  | "link_preview_facebook"
  | "link_preview_telegram"
  | "link_preview_x_twitter"
  | "link_preview_spotify";

export const DEFAULT_FEATURE_FLAGS: Record<FeatureFlagKey, FlagRule> = {
  new_order_v2: { enabled: false, allowlist: [], percentage: 0 },
  tab_custom_drip: { enabled: false, allowlist: [], percentage: 0 },
  tab_combos: { enabled: false, allowlist: [], percentage: 0 },
  tab_autopilot: { enabled: false, allowlist: [], percentage: 0 },
  theme_v2: { enabled: false, allowlist: [], percentage: 0 },
  theme_light: { enabled: false, allowlist: [], percentage: 0 },
  dashboard_v2: { enabled: false, allowlist: [], percentage: 0 },
  delivery_window: { enabled: false, allowlist: [], percentage: 0 },
  auto_detect: { enabled: false, allowlist: [], percentage: 0 }, // Permanently off as per SRS §50
  drip_v2: { enabled: false, allowlist: [], percentage: 0 },
  delivery_pace: { enabled: false, allowlist: [], percentage: 0 },
  link_preview: { enabled: true, allowlist: [], percentage: 100 },
  link_preview_youtube: { enabled: true, allowlist: [], percentage: 100 },
  link_preview_tiktok: { enabled: true, allowlist: [], percentage: 100 },
  link_preview_instagram: { enabled: true, allowlist: [], percentage: 100 },
  link_preview_facebook: { enabled: true, allowlist: [], percentage: 100 },
  link_preview_telegram: { enabled: true, allowlist: [], percentage: 100 },
  link_preview_x_twitter: { enabled: true, allowlist: [], percentage: 100 },
  link_preview_spotify: { enabled: true, allowlist: [], percentage: 100 },
};

@Injectable()
export class FeatureFlagsService {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private memoryCache: Record<string, FlagRule> = { ...DEFAULT_FEATURE_FLAGS };

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: SMMCacheService
  ) { }

  async getAllFlags(): Promise<Record<FeatureFlagKey, FlagRule>> {
    const cacheKey = "system:feature_flags";
    const cached = await this.cacheService.get<Record<FeatureFlagKey, FlagRule>>(cacheKey);
    if (cached) return cached;

    if (!this.prisma.isConnected) {
      return this.memoryCache as Record<FeatureFlagKey, FlagRule>;
    }

    try {
      const record = await this.prisma.systemSetting.findUnique({
        where: { key: "feature_flags" },
      });
      if (record && record.value && typeof record.value === "object") {
        const merged = { ...DEFAULT_FEATURE_FLAGS, ...(record.value as any) };
        await this.cacheService.set(cacheKey, merged, { ttlSeconds: 60 });
        this.memoryCache = merged;
        return merged;
      }
    } catch (err: any) {
      this.logger.warn(`Could not load feature_flags from database: ${err.message}`);
    }

    return this.memoryCache as Record<FeatureFlagKey, FlagRule>;
  }

  async isEnabled(
    flagKey: FeatureFlagKey,
    userId?: string,
    isAdmin: boolean = false
  ): Promise<boolean> {
    if (flagKey === "auto_detect") return false; // Enforce rule: auto_detect always disabled
    if (isAdmin) return true;

    const flags = await this.getAllFlags();
    const rule = flags[flagKey] || DEFAULT_FEATURE_FLAGS[flagKey];

    // Kill switch: if not enabled, check allowlist only
    if (!rule.enabled && rule.allowlist.length === 0 && rule.percentage === 0) {
      return false;
    }

    // Admins and explicit allowlist
    if (userId && rule.allowlist && rule.allowlist.includes(userId)) {
      return true;
    }

    // Global enabled check
    if (rule.enabled && rule.percentage >= 100) {
      return true;
    }

    // Percentage rollout via deterministic hash of userId
    if (rule.enabled && rule.percentage > 0 && userId) {
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = (hash << 5) - hash + userId.charCodeAt(i);
        hash |= 0;
      }
      const bucket = Math.abs(hash) % 100;
      return bucket < rule.percentage;
    }

    return rule.enabled && rule.percentage === 0 && (!rule.allowlist || rule.allowlist.length === 0);
  }

  async updateFlag(
    flagKey: FeatureFlagKey,
    updates: Partial<FlagRule>
  ): Promise<Record<FeatureFlagKey, FlagRule>> {
    const current = await this.getAllFlags();
    const existingRule = current[flagKey] || { enabled: false, allowlist: [], percentage: 0 };

    // auto_detect is hard-coded to remain off
    if (flagKey === "auto_detect") {
      updates.enabled = false;
      updates.percentage = 0;
      updates.allowlist = [];
    }

    current[flagKey] = { ...existingRule, ...updates };

    if (this.prisma.isConnected) {
      await this.prisma.systemSetting.upsert({
        where: { key: "feature_flags" },
        create: { key: "feature_flags", value: current as any },
        update: { value: current as any },
      });
    }

    this.memoryCache = current;
    await this.cacheService.invalidate("system:feature_flags");
    await this.cacheService.invalidatePattern("new_order:bootstrap:*");
    return current;
  }

  async killSwitch(flagKey: FeatureFlagKey): Promise<void> {
    await this.updateFlag(flagKey, { enabled: false, percentage: 0, allowlist: [] });
  }

  async resolveUserFlags(userId?: string, isAdmin: boolean = false): Promise<Record<FeatureFlagKey, boolean>> {
    const allFlags = await this.getAllFlags();
    const resolved: Record<string, boolean> = {};
    for (const key of Object.keys(allFlags) as FeatureFlagKey[]) {
      resolved[key] = await this.isEnabled(key, userId, isAdmin);
    }
    return resolved as Record<FeatureFlagKey, boolean>;
  }
}

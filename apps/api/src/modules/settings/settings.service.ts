import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { Decimal } from "decimal.js";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma?: PrismaService) {}

  private settings: Record<string, any> = {
    platformName: "SMM PANEL",
    currency: "INR",
    maintenanceMode: false,
    autoRefillEnabled: true,
    minDepositAmount: 100,
    maxDepositAmount: 200000,
    supportEmail: process.env.SUPPORT_EMAIL || "support@smmpanel.internal",
    telegramBot: "@smm_panel_ops_bot",
    resellerDiscountPct: 15,
    dripFeedEnabled: process.env.DRIPFEED_ENABLED !== undefined ? process.env.DRIPFEED_ENABLED === "true" : true,
    dripFeedMinRuns: process.env.DRIPFEED_MIN_RUNS ? parseInt(process.env.DRIPFEED_MIN_RUNS, 10) : 2,
    dripFeedMaxRuns: process.env.DRIPFEED_MAX_RUNS ? parseInt(process.env.DRIPFEED_MAX_RUNS, 10) : 100,
    dripFeedMinInterval: process.env.DRIPFEED_MIN_INTERVAL ? parseInt(process.env.DRIPFEED_MIN_INTERVAL, 10) : 5,
    dripFeedMaxInterval: process.env.DRIPFEED_MAX_INTERVAL ? parseInt(process.env.DRIPFEED_MAX_INTERVAL, 10) : 1440,
    // Package Engine Admin Settings
    packagesEnabled: true,
    packageEligibleServices: [],
    packageMaxDurationDays: 90,
    packageMaxPosts: 100,
    packageMaxPerDay: 10,
    packageMinSpacingMin: 15,
    packageMaxPauseDays: 14,
    packageMarginFloor: 0.15,
    deliveryWindowEnabled: process.env.DELIVERY_WINDOW_ENABLED === "true" || false,
    allowedWindowPresets: ["ANY_TIME", "DAYTIME", "EVENING", "CUSTOM"],
    packageMaxReschedules: process.env.PACKAGE_MAX_RESCHEDULES ? parseInt(process.env.PACKAGE_MAX_RESCHEDULES, 10) : 3,
  };

  private paceSettings: Record<string, any> = {
    deliveryPaceEnabled: process.env.FLAG_DELIVERY_PACE === "true" || false,
    deliveryPaceKindCaps: {
      LIKES: 150,
      VIEWS: 1000,
      SHARES: 30,
      COMMENTS: 20,
      SAVES: 50,
      FOLLOWERS: 50,
      DEFAULT: 150,
    },
    deliveryPaceTierCaps: {
      STARTER: 100,
      STANDARD: 150,
      PREMIUM: 300,
      VIP: 500,
    },
    deliveryPaceCatchupK: 2,
    deliveryPaceStallTimeoutMs: 12 * 60 * 60 * 1000,
    deliveryPaceRetryScheduleSec: [300, 900, 1800, 3600],
    deliveryPaceServiceOverrides: {},
    deliveryPaceCustomerOverrides: {},
  };

  getPaceSettings() {
    return this.paceSettings;
  }

  updatePaceSettings(updates: Record<string, any>) {
    this.paceSettings = { ...this.paceSettings, ...updates };
    return { success: true, paceSettings: this.paceSettings };
  }

  async getPaceAuditReport() {
    if (!this.prisma || !this.prisma.isConnected) {
      return {
        topLinksByUnits10m: [],
        topLinksByUnits60m: [],
        overlappingOrders: [],
        backlogFlushEvents: [],
        alerts: [],
        metrics: {
          dispatchedPerMinute: 0,
          queueDepth: 0,
          stalledCount: 0,
          retryCounts: 0,
          errorClasses: {},
        },
      };
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

    const recentOrders = await this.prisma.order.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: {
        id: true,
        target: true,
        quantity: true,
        status: true,
        createdAt: true,
        serviceId: true,
        service: { select: { platform: true, kind: true } },
      },
      take: 1000,
    });

    const linkUnits = new Map<string, number>();
    for (const o of recentOrders) {
      const link = (o.target || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").toLowerCase();
      if (!link) continue;
      linkUnits.set(link, (linkUnits.get(link) || 0) + (o.quantity || 0));
    }

    const topLinks = Array.from(linkUnits.entries())
      .map(([link, units]) => ({ link, units }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 20);

    const scheduledCount = await this.prisma.packageExecution.count({
      where: { status: "SCHEDULED" },
    });
    const dispatchedCount = await this.prisma.packageExecution.count({
      where: { status: "DISPATCHED" },
    });
    const stalledExecutions = await this.prisma.packageExecution.findMany({
      where: {
        status: "DISPATCHED",
        executeAt: { lt: new Date(Date.now() - 12 * 3600 * 1000) },
      },
      select: { id: true, skipReason: true, executeAt: true },
    });

    return {
      topLinksByUnits10m: topLinks.slice(0, 10),
      topLinksByUnits60m: topLinks,
      overlappingOrders: [],
      backlogFlushEvents: [],
      alerts: stalledExecutions.length > 0 ? [`${stalledExecutions.length} stalled executions detected`] : [],
      metrics: {
        dispatchedPerMinute: 0,
        queueDepth: scheduledCount,
        inFlightCount: dispatchedCount,
        stalledCount: stalledExecutions.length,
        retryCounts: 0,
        errorClasses: {
          DEFINITE_REJECTION: 0,
          RETRY_LATER: 0,
          AMBIGUOUS: stalledExecutions.length,
        },
      },
    };
  }

  getSettings() {
    return this.settings;
  }

  updateSettings(updates: Record<string, any>) {
    this.settings = { ...this.settings, ...updates };
    return { success: true, settings: this.settings };
  }

  async getPricingSettings() {
    if (this.prisma && typeof (this.prisma as any).pricingSettings?.findFirst === "function") {
      const record = await (this.prisma as any).pricingSettings.findFirst();
      if (record) {
        return {
          id: record.id,
          marginFloor: Number(record.marginFloor),
          defaultMarkup: Number(record.defaultMarkup),
          roundingDecimals: record.roundingDecimals,
          cancellationFee: Number(record.cancellationFee),
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        };
      }
    }
    return {
      marginFloor: 0.15,
      defaultMarkup: 0.30,
      roundingDecimals: 2,
      cancellationFee: 0.00,
    };
  }

  async updatePricingSettings(updates: {
    marginFloor?: number;
    defaultMarkup?: number;
    roundingDecimals?: number;
    cancellationFee?: number;
  }) {
    if (this.prisma && typeof (this.prisma as any).pricingSettings?.findFirst === "function") {
      const existing = await (this.prisma as any).pricingSettings.findFirst();
      if (existing) {
        const updated = await (this.prisma as any).pricingSettings.update({
          where: { id: existing.id },
          data: {
            marginFloor: updates.marginFloor !== undefined ? new Decimal(updates.marginFloor) : undefined,
            defaultMarkup: updates.defaultMarkup !== undefined ? new Decimal(updates.defaultMarkup) : undefined,
            roundingDecimals: updates.roundingDecimals !== undefined ? updates.roundingDecimals : undefined,
            cancellationFee: updates.cancellationFee !== undefined ? new Decimal(updates.cancellationFee) : undefined,
          },
        });
        return {
          success: true,
          pricingSettings: {
            id: updated.id,
            marginFloor: Number(updated.marginFloor),
            defaultMarkup: Number(updated.defaultMarkup),
            roundingDecimals: updated.roundingDecimals,
            cancellationFee: Number(updated.cancellationFee),
          },
        };
      } else {
        const created = await (this.prisma as any).pricingSettings.create({
          data: {
            marginFloor: new Decimal(updates.marginFloor !== undefined ? updates.marginFloor : 0.15),
            defaultMarkup: new Decimal(updates.defaultMarkup !== undefined ? updates.defaultMarkup : 0.30),
            roundingDecimals: updates.roundingDecimals !== undefined ? updates.roundingDecimals : 2,
            cancellationFee: new Decimal(updates.cancellationFee !== undefined ? updates.cancellationFee : 0.00),
          },
        });
        return {
          success: true,
          pricingSettings: {
            id: created.id,
            marginFloor: Number(created.marginFloor),
            defaultMarkup: Number(created.defaultMarkup),
            roundingDecimals: created.roundingDecimals,
            cancellationFee: Number(created.cancellationFee),
          },
        };
      }
    }

    return {
      success: true,
      pricingSettings: {
        marginFloor: updates.marginFloor ?? 0.15,
        defaultMarkup: updates.defaultMarkup ?? 0.30,
        roundingDecimals: updates.roundingDecimals ?? 2,
        cancellationFee: updates.cancellationFee ?? 0.00,
      },
    };
  }
}

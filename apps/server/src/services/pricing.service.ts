import { PrismaLike } from "../prisma";
import {
  calculateCostINR,
  calculateSellingRate,
  calculateCustomerCharge,
  calculateOrderFinancialSnapshot,
  DEFAULT_PRICING_SETTINGS,
  PricingSettingsConfig,
} from "@smm/contracts";
import { Decimal } from "decimal.js";
import { ApiError } from "../errors";

export class PricingService {
  private cachedSettings: PricingSettingsConfig = { ...DEFAULT_PRICING_SETTINGS };
  private settingsLastLoaded = 0;

  constructor(private readonly prisma: PrismaLike) {}

  async getSettings(): Promise<PricingSettingsConfig> {
    const now = Date.now();
    if (now - this.settingsLastLoaded < 60000) {
      return this.cachedSettings;
    }

    const client = this.prisma.client || this.prisma;
    if (!this.prisma.isConnected || !client.systemSetting?.findUnique) {
      return this.cachedSettings;
    }

    try {
      const dbSettings = await client.systemSetting.findUnique({
        where: { key: "PRICING_CONFIG" },
      });

      if (dbSettings && dbSettings.value) {
        this.cachedSettings = {
          ...DEFAULT_PRICING_SETTINGS,
          ...(dbSettings.value as any),
        };
      }
      this.settingsLastLoaded = now;
    } catch {
      // Return cached
    }

    return this.cachedSettings;
  }

  async updateSettings(updates: Partial<PricingSettingsConfig>): Promise<PricingSettingsConfig> {
    const current = await this.getSettings();
    const updated: PricingSettingsConfig = {
      ...current,
      ...updates,
    };

    const client = this.prisma.client || this.prisma;
    if (this.prisma.isConnected && client.systemSetting?.upsert) {
      await client.systemSetting.upsert({
        where: { key: "PRICING_CONFIG" },
        update: { value: updated as any },
        create: { key: "PRICING_CONFIG", value: updated as any },
      });
    }

    this.cachedSettings = updated;
    this.settingsLastLoaded = Date.now();
    return updated;
  }

  async getPendingPriceChanges(): Promise<any[]> {
    const client = this.prisma.client || this.prisma;
    if (!this.prisma.isConnected || !client.service?.findMany) return [];

    return client.service.findMany({
      where: {
        pricePendingApproval: true,
        isDeleted: false,
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        platform: true,
        costINR: true,
        pendingCostINR: true,
        ratePer1000: true,
        pricePendingApproval: true,
        priceFluctuationPercent: true,
        priceLastSyncedAt: true,
        provider: {
          select: { id: true, name: true },
        },
      },
      orderBy: { priceLastSyncedAt: "desc" },
    });
  }

  async approvePendingPriceChange(serviceId: string): Promise<any> {
    const client = this.prisma.client || this.prisma;
    if (!this.prisma.isConnected || !client.service?.findUnique) {
      return { success: true, serviceId, approved: true };
    }

    const svc = await client.service.findUnique({ where: { id: serviceId } });
    if (!svc) throw new ApiError(404, "NOT_FOUND", `Service "${serviceId}" not found.`);

    const newCostINR = svc.pendingCostINR ? Number(svc.pendingCostINR) : Number(svc.costINR || 0);
    const settings = await this.getSettings();

    const pricing = calculateSellingRate(newCostINR, {
      settings,
      marginPercentOverride: svc.marginPercentOverride ? Number(svc.marginPercentOverride) : undefined,
      fixedSellingRateOverride: svc.fixedSellingRateOverride ? Number(svc.fixedSellingRateOverride) : undefined,
    });

    const updated = await client.service.update({
      where: { id: serviceId },
      data: {
        costINR: new Decimal(newCostINR),
        pendingCostINR: null,
        ratePer1000: pricing.sellingRate,
        pricePendingApproval: false,
        priceFluctuationPercent: null,
        active: true,
      },
    });

    return { success: true, service: updated };
  }

  async rejectPendingPriceChange(serviceId: string): Promise<any> {
    const client = this.prisma.client || this.prisma;
    if (!this.prisma.isConnected || !client.service?.findUnique) {
      return { success: true, serviceId, rejected: true };
    }

    const svc = await client.service.findUnique({ where: { id: serviceId } });
    if (!svc) throw new ApiError(404, "NOT_FOUND", `Service "${serviceId}" not found.`);

    const updated = await client.service.update({
      where: { id: serviceId },
      data: {
        pendingCostINR: null,
        pricePendingApproval: false,
        priceFluctuationPercent: null,
      },
    });

    return { success: true, service: updated };
  }

  async previewOrApplyBulkMargin(input: {
    platform?: string;
    categoryId?: string;
    providerId?: string;
    marginPercent: number;
    previewOnly?: boolean;
  }): Promise<any> {
    const client = this.prisma.client || this.prisma;
    if (!this.prisma.isConnected || !client.service?.findMany) {
      return { count: 0, items: [] };
    }

    const where: any = { isDeleted: false };
    if (input.platform) where.platform = input.platform.toUpperCase();
    if (input.categoryId) where.categoryId = input.categoryId;
    if (input.providerId) where.providerId = input.providerId;

    const services = await client.service.findMany({ where });
    const settings = await this.getSettings();

    const changes = services.map((svc: any) => {
      const costINR = svc.costINR ? Number(svc.costINR) : 0;
      const pricing = calculateSellingRate(costINR, {
        settings,
        marginPercentOverride: input.marginPercent,
      });

      return {
        id: svc.id,
        name: svc.displayName || svc.name,
        costINR,
        oldRate: Number(svc.ratePer1000),
        newRate: pricing.sellingRate.toNumber(),
        appliedMarginPercent: pricing.appliedMarginPercent,
      };
    });

    if (!input.previewOnly) {
      for (const item of changes) {
        await client.service.update({
          where: { id: item.id },
          data: {
            ratePer1000: new Decimal(item.newRate),
            marginPercentOverride: new Decimal(input.marginPercent),
          },
        });
      }
    }

    return {
      count: changes.length,
      previewOnly: input.previewOnly !== false,
      marginPercentApplied: input.marginPercent,
      items: changes,
    };
  }

  async backfillMissingCosts(): Promise<any> {
    return { success: true, backfilledCount: 0 };
  }

  async getProfitSummary(startDate?: string, endDate?: string, dripFeedOnly?: boolean): Promise<any> {
    const client = this.prisma.client || this.prisma;
    if (!this.prisma.isConnected || !client.order?.findMany) {
      return {
        totalRevenue: 0,
        providerCost: 0,
        gatewayFees: 0,
        refunds: 0,
        netProfit: 0,
        netMarginPercent: 0,
        orderCount: 0,
        averageOrderValue: 0,
      };
    }

    const where: any = {};
    if (dripFeedOnly) where.isDripFeed = true;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const orders = await client.order.findMany({
      where,
      select: {
        id: true,
        charge: true,
        status: true,
        estimatedProviderCost: true,
        actualProviderCost: true,
        paymentFeeEstimate: true,
        estimatedNetProfit: true,
        actualProfit: true,
        costUnknown: true,
        refunds: { select: { amount: true } },
      },
    });

    let totalRevenue = new Decimal(0);
    let totalProviderCost = new Decimal(0);
    let totalGatewayFees = new Decimal(0);
    let totalRefunds = new Decimal(0);
    let totalNetProfit = new Decimal(0);
    let validCount = 0;

    for (const o of orders) {
      const charge = new Decimal(o.charge.toString());
      const orderRefunds = (o.refunds || []).reduce(
        (sum: any, r: any) => sum.plus(new Decimal(r.amount.toString())),
        new Decimal(0)
      );

      totalRefunds = totalRefunds.plus(orderRefunds);

      if (o.status !== "FAILED") {
        totalRevenue = totalRevenue.plus(charge.minus(orderRefunds));
        validCount++;
      }

      if (!o.costUnknown) {
        const cost = o.actualProviderCost
          ? new Decimal(o.actualProviderCost.toString())
          : new Decimal((o.estimatedProviderCost || 0).toString());
        const fee = new Decimal((o.paymentFeeEstimate || 0).toString());

        totalProviderCost = totalProviderCost.plus(cost);
        totalGatewayFees = totalGatewayFees.plus(fee);

        const netRealized = charge.minus(cost).minus(fee).minus(orderRefunds);
        totalNetProfit = totalNetProfit.plus(netRealized);
      }
    }

    const netMarginPercent = totalRevenue.greaterThan(0)
      ? totalNetProfit.dividedBy(totalRevenue).times(100).toDecimalPlaces(2).toNumber()
      : 0;

    const averageOrderValue = validCount > 0
      ? totalRevenue.dividedBy(validCount).toDecimalPlaces(2).toNumber()
      : 0;

    return {
      totalRevenue: totalRevenue.toNumber(),
      providerCost: totalProviderCost.toNumber(),
      gatewayFees: totalGatewayFees.toNumber(),
      refunds: totalRefunds.toNumber(),
      netProfit: totalNetProfit.toNumber(),
      netMarginPercent,
      orderCount: validCount,
      averageOrderValue,
    };
  }
}

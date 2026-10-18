import { Injectable, Logger, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import {
  calculateCostINR,
  calculateSellingRate,
  calculateCustomerCharge,
  calculateOrderFinancialSnapshot,
  calculateRealizedProfit,
  DEFAULT_PRICING_SETTINGS,
  PricingSettingsConfig,
} from "@smm/contracts";
import { Decimal } from "decimal.js";

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);
  private cachedSettings: PricingSettingsConfig = { ...DEFAULT_PRICING_SETTINGS };
  private settingsLastLoaded = 0;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads global pricing settings from DB with fallback to defaults
   */
  async getSettings(): Promise<PricingSettingsConfig> {
    const now = Date.now();
    // Cache settings in memory for 60 seconds
    if (now - this.settingsLastLoaded < 60000) {
      return this.cachedSettings;
    }

    if (!this.prisma.isConnected) {
      return this.cachedSettings;
    }

    try {
      const dbSettings = await this.prisma.systemSetting.findUnique({
        where: { key: "PRICING_CONFIG" },
      });

      if (dbSettings && dbSettings.value) {
        this.cachedSettings = {
          ...DEFAULT_PRICING_SETTINGS,
          ...(dbSettings.value as any),
        };
      }
      this.settingsLastLoaded = now;
    } catch (err: any) {
      this.logger.warn(`Failed to read PRICING_CONFIG from DB: ${err.message}`);
    }

    return this.cachedSettings;
  }

  /**
   * Updates global pricing configuration in DB and cache
   */
  async updateSettings(updates: Partial<PricingSettingsConfig>): Promise<PricingSettingsConfig> {
    const current = await this.getSettings();
    const updated: PricingSettingsConfig = {
      ...current,
      ...updates,
    };

    if (this.prisma.isConnected) {
      await this.prisma.systemSetting.upsert({
        where: { key: "PRICING_CONFIG" },
        update: { value: updated as any },
        create: { key: "PRICING_CONFIG", value: updated as any },
      });
    }

    this.cachedSettings = updated;
    this.settingsLastLoaded = Date.now();
    return this.cachedSettings;
  }

  /**
   * Recalculates selling rate for a specific service based on provider cost and margin rules
   */
  async calculateServiceRate(
    costRatePer1k: number | string | Decimal,
    currency: string = "USD",
    marginOverride?: number | null,
    fixedRateOverride?: number | null
  ) {
    const settings = await this.getSettings();
    const costINR = calculateCostINR(costRatePer1k, settings.usdInrRate, currency);

    return calculateSellingRate(costINR, {
      settings,
      marginPercentOverride: marginOverride,
      fixedSellingRateOverride: fixedRateOverride,
    });
  }

  /**
   * Evaluates catalog sync price changes, guardrails, and pending change thresholds (>10%)
   */
  async evaluateCatalogPriceChange(
    serviceId: string,
    newCostPer1k: number | string | Decimal,
    currency: string = "USD"
  ) {
    const settings = await this.getSettings();
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException(`Service ${serviceId} not found`);

    const newCostINR = calculateCostINR(newCostPer1k, settings.usdInrRate, currency);
    const oldCostINR = service.costINR ? new Decimal(service.costINR.toString()) : new Decimal(0);
    const oldSellRate = new Decimal(service.ratePer1000.toString());

    // Calculate new proposed selling rate
    const pricingRes = calculateSellingRate(newCostINR, {
      settings,
      marginPercentOverride: service.marginPercentOverride ? Number(service.marginPercentOverride) : null,
      fixedSellingRateOverride: service.fixedSellingRateOverride ? Number(service.fixedSellingRateOverride) : null,
    });

    const proposedSellRate = pricingRes.sellingRate;
    const isBelowCost = pricingRes.isBelowCost;

    // Check percentage change
    let pctChange = 0;
    if (oldSellRate.greaterThan(0)) {
      pctChange = proposedSellRate.minus(oldSellRate).abs().dividedBy(oldSellRate).times(100).toNumber();
    }

    // Guardrail: Auto-deactivate if selling rate is below cost
    if (isBelowCost) {
      await this.prisma.service.update({
        where: { id: serviceId },
        data: {
          active: false,
          priceBelowCost: true,
          priceChangeStatus: "BELOW_COST",
          costINR: newCostINR,
          providerCostPer1k: new Decimal(newCostPer1k.toString()),
        },
      });

      await this.recordPriceHistory(
        serviceId,
        oldCostINR,
        newCostINR,
        oldSellRate,
        oldSellRate,
        "Auto-deactivated: Provider price increase caused selling rate to fall below cost",
        "SYSTEM_GUARDRAIL"
      );

      return { status: "DEACTIVATED_BELOW_COST", newCostINR, proposedSellRate };
    }

    // Check if price change exceeds alert threshold (default 10%)
    if (pctChange > settings.priceChangeAlertPercent) {
      const pending = await this.prisma.pendingPriceChange.create({
        data: {
          serviceId,
          oldCostRate: oldCostINR,
          newCostRate: newCostINR,
          oldSellRate,
          proposedSellRate,
          percentageChange: new Decimal(pctChange.toFixed(2)),
          status: "PENDING",
        },
      });

      await this.prisma.service.update({
        where: { id: serviceId },
        data: {
          priceChangeStatus: "PENDING_APPROVAL",
          costINR: newCostINR,
          providerCostPer1k: new Decimal(newCostPer1k.toString()),
        },
      });

      return { status: "PENDING_APPROVAL", pendingId: pending.id, percentageChange: pctChange };
    }

    // Below threshold: Apply price change directly
    await this.prisma.service.update({
      where: { id: serviceId },
      data: {
        ratePer1000: proposedSellRate,
        costINR: newCostINR,
        providerCostPer1k: new Decimal(newCostPer1k.toString()),
        priceBelowCost: false,
        priceChangeStatus: "NORMAL",
      },
    });

    await this.recordPriceHistory(
      serviceId,
      oldCostINR,
      newCostINR,
      oldSellRate,
      proposedSellRate,
      "Automated catalog sync margin update",
      "CATALOG_SYNC"
    );

    return { status: "APPLIED", newCostINR, newSellRate: proposedSellRate };
  }

  /**
   * Records immutable audit log of a price alteration
   */
  async recordPriceHistory(
    serviceId: string,
    oldCostRate?: Decimal | null,
    newCostRate?: Decimal | null,
    oldSellRate?: Decimal | null,
    newSellRate?: Decimal | null,
    reason?: string,
    changedBy: string = "ADMIN"
  ) {
    if (!this.prisma.isConnected) return;
    try {
      await this.prisma.servicePriceHistory.create({
        data: {
          serviceId,
          oldCostRate,
          newCostRate,
          oldSellRate,
          newSellRate,
          reason,
          changedBy,
        },
      });
    } catch (err: any) {
      this.logger.error(`Error recording price history: ${err.message}`);
    }
  }

  /**
   * Pending Price Change Inbox: List unreviewed price fluctuations
   */
  async getPendingPriceChanges() {
    if (!this.prisma.isConnected) return [];
    return this.prisma.pendingPriceChange.findMany({
      where: { status: "PENDING" },
      include: {
        service: {
          select: { id: true, name: true, displayName: true, platform: true, categoryId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Approve a pending price fluctuation
   */
  async approvePendingPriceChange(id: string, approvedBy: string = "ADMIN") {
    const pending = await this.prisma.pendingPriceChange.findUnique({
      where: { id },
      include: { service: true },
    });

    if (!pending || pending.status !== "PENDING") {
      throw new BadRequestException("Pending price change not found or already processed");
    }

    await this.prisma.$transaction([
      this.prisma.service.update({
        where: { id: pending.serviceId },
        data: {
          ratePer1000: (pending.proposedSellRate ?? pending.oldSellRate ?? new Decimal(0)),
          priceChangeStatus: "NORMAL",
          priceBelowCost: false,
        },
      }),
      this.prisma.pendingPriceChange.update({
        where: { id },
        data: { status: "APPROVED" },
      }),
      this.prisma.servicePriceHistory.create({
        data: {
          serviceId: pending.serviceId,
          oldCostRate: pending.oldCostRate,
          newCostRate: pending.newCostRate,
          oldSellRate: pending.oldSellRate,
          newSellRate: pending.proposedSellRate,
          reason: `Admin approved price change (+${pending.percentageChange}%)`,
          changedBy: approvedBy,
        },
      }),
    ]);

    return { success: true, message: "Price change approved and applied" };
  }

  /**
   * Reject a pending price fluctuation (keeps current selling rate)
   */
  async rejectPendingPriceChange(id: string, rejectedBy: string = "ADMIN") {
    const pending = await this.prisma.pendingPriceChange.findUnique({ where: { id } });
    if (!pending || pending.status !== "PENDING") {
      throw new BadRequestException("Pending price change not found or already processed");
    }

    await this.prisma.$transaction([
      this.prisma.pendingPriceChange.update({
        where: { id },
        data: { status: "REJECTED" },
      }),
      this.prisma.service.update({
        where: { id: pending.serviceId },
        data: { priceChangeStatus: "NORMAL" },
      }),
    ]);

    return { success: true, message: "Price change rejected. Selling rate preserved." };
  }

  /**
   * Bulk Margin Adjustment Tool with Preview Diff capability
   */
  async previewOrApplyBulkMargin(input: {
    platform?: string;
    categoryId?: string;
    marginPercent: number;
    previewOnly?: boolean;
    changedBy?: string;
  }) {
    const where: any = { isDeleted: false };
    if (input.platform && input.platform !== "ALL") where.platform = input.platform;
    if (input.categoryId) where.categoryId = input.categoryId;

    const services = await this.prisma.service.findMany({ where });
    const settings = await this.getSettings();

    const previewDiff = services.map((s) => {
      const costINR = s.costINR ? new Decimal(s.costINR.toString()) : new Decimal(s.ratePer1000.toString()).times(0.5);
      const oldSellRate = new Decimal(s.ratePer1000.toString());

      const pricing = calculateSellingRate(costINR, {
        settings,
        marginPercentOverride: input.marginPercent,
      });

      return {
        serviceId: s.id,
        name: s.name,
        displayName: s.displayName || s.name,
        platform: s.platform,
        costINR: costINR.toNumber(),
        oldSellRate: oldSellRate.toNumber(),
        newSellRate: pricing.sellingRate.toNumber(),
        newMarginPercent: pricing.appliedMarginPercent,
        isBelowCost: pricing.isBelowCost,
      };
    });

    if (input.previewOnly) {
      return { preview: true, count: previewDiff.length, diff: previewDiff };
    }

    // Apply bulk updates atomically
    await this.prisma.$transaction(
      previewDiff.map((item) =>
        this.prisma.service.update({
          where: { id: item.serviceId },
          data: {
            ratePer1000: item.newSellRate,
            marginPercentOverride: input.marginPercent,
            priceBelowCost: item.isBelowCost,
          },
        })
      )
    );

    // Record history for all updated services
    for (const item of previewDiff) {
      await this.recordPriceHistory(
        item.serviceId,
        new Decimal(item.costINR),
        new Decimal(item.costINR),
        new Decimal(item.oldSellRate),
        new Decimal(item.newSellRate),
        `Bulk margin adjustment (+${input.marginPercent}%)`,
        input.changedBy || "ADMIN"
      );
    }

    return { preview: false, appliedCount: previewDiff.length, diff: previewDiff };
  }

  /**
   * Executive Profit Summary calculation for Admin Telemetry
   */
  async getProfitSummary(startDate?: string, endDate?: string, dripFeedOnly?: boolean) {
    if (!this.prisma.isConnected) {
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

    const orders = await this.prisma.order.findMany({
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
      const orderRefunds = o.refunds.reduce(
        (sum, r) => sum.plus(new Decimal(r.amount.toString())),
        new Decimal(0)
      );

      totalRefunds = totalRefunds.plus(orderRefunds);

      // Exclude FAILED orders from revenue
      if (o.status !== "FAILED") {
        totalRevenue = totalRevenue.plus(charge.minus(orderRefunds));
        validCount++;
      }

      if (!o.costUnknown) {
        const cost = o.actualProviderCost
          ? new Decimal(o.actualProviderCost.toString())
          : new Decimal(o.estimatedProviderCost.toString());
        const fee = new Decimal(o.paymentFeeEstimate.toString());

        totalProviderCost = totalProviderCost.plus(cost);
        totalGatewayFees = totalGatewayFees.plus(fee);

        const realized = calculateRealizedProfit(charge, cost, orderRefunds);
        totalNetProfit = totalNetProfit.plus(realized.realizedNetProfit);
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

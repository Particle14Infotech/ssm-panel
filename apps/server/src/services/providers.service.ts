import { PrismaLike } from "../prisma";
import { encryptProviderKey, decryptProviderKey } from "../crypto.util";
import { SmmProviderClient } from "./smm-provider.client";
import { Decimal } from "decimal.js";
import {
  coerceBoolean,
  calculateCostINR,
  calculateSellingRate,
  DEFAULT_PRICING_SETTINGS,
  PricingSettingsConfig,
} from "@smm/contracts";
import { ApiError } from "../errors";

export interface ProviderDto {
  id: string;
  name: string;
  apiUrl: string;
  apiKeyMasked: string;
  balance: number;
  currency: string;
  active: boolean;
  serviceCount: number;
  dripFeedCount?: number;
  refillCount?: number;
  cancelCount?: number;
  healthStatus: "HEALTHY" | "DEGRADED" | "UNKNOWN";
  consecutiveStatusFailures: number;
  lastStatusCheckAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class ProvidersService {
  constructor(
    private readonly prisma: PrismaLike,
    private readonly smmClient: SmmProviderClient = new SmmProviderClient()
  ) {}

  private maskKey(plain: string): string {
    if (!plain || plain.length <= 8) return "••••••••";
    return `${plain.substring(0, 4)}••••${plain.substring(plain.length - 4)}`;
  }

  private getHealthTelemetry(provider: {
    consecutiveStatusFailures: number;
    lastStatusCheckAt: Date | null;
  }): {
    healthStatus: ProviderDto["healthStatus"];
    consecutiveStatusFailures: number;
    lastStatusCheckAt: string | null;
  } {
    const lastStatusCheckAt = provider.lastStatusCheckAt;
    const consecutiveStatusFailures = provider.consecutiveStatusFailures;
    const isStale =
      !lastStatusCheckAt ||
      Date.now() - new Date(lastStatusCheckAt).getTime() > 30 * 60 * 1000;

    return {
      healthStatus: isStale
        ? "UNKNOWN"
        : consecutiveStatusFailures >= 3
          ? "DEGRADED"
          : consecutiveStatusFailures === 0
            ? "HEALTHY"
            : "UNKNOWN",
      consecutiveStatusFailures,
      lastStatusCheckAt: lastStatusCheckAt ? new Date(lastStatusCheckAt).toISOString() : null,
    };
  }

  async findAll(): Promise<ProviderDto[]> {
    if (!this.prisma.isConnected) {
      return [];
    }

    try {
      const providers = await this.prisma.provider.findMany({
        include: {
          _count: {
            select: { services: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return Promise.all(
        providers.map(async (p: any) => {
          let plain = "";
          try {
            plain = decryptProviderKey(p.apiKeyEncrypted);
          } catch {
            plain = "••••••••";
          }

          const [dripFeedCount, refillCount, cancelCount] = await Promise.all([
            this.prisma.service.count({ where: { providerId: p.id, dripFeedSupported: true, isDeleted: false } }).catch(() => 0),
            this.prisma.service.count({ where: { providerId: p.id, refillable: true, isDeleted: false } }).catch(() => 0),
            this.prisma.service.count({ where: { providerId: p.id, cancellable: true, isDeleted: false } }).catch(() => 0),
          ]);
          const health = this.getHealthTelemetry(p);

          return {
            id: p.id,
            name: p.name,
            apiUrl: p.apiUrl,
            apiKeyMasked: this.maskKey(plain),
            balance: Number(p.balance),
            currency: p.currency,
            active: p.active,
            serviceCount: p._count?.services || 0,
            dripFeedCount,
            refillCount,
            cancelCount,
            ...health,
            createdAt: new Date(p.createdAt).toISOString(),
            updatedAt: new Date(p.updatedAt).toISOString(),
          };
        })
      );
    } catch {
      return [];
    }
  }

  async findOne(id: string): Promise<ProviderDto> {
    if (!this.prisma.isConnected) {
      throw new ApiError(404, "NOT_FOUND", `Provider #${id} not found.`);
    }

    const p = await this.prisma.provider.findUnique({
      where: { id },
      include: {
        _count: {
          select: { services: true },
        },
      },
    });

    if (!p) {
      throw new ApiError(404, "NOT_FOUND", `Provider #${id} not found.`);
    }

    let plain = "";
    try {
      plain = decryptProviderKey(p.apiKeyEncrypted);
    } catch {
      plain = "••••••••";
    }

    const [dripFeedCount, refillCount, cancelCount] = await Promise.all([
      this.prisma.service.count({ where: { providerId: p.id, dripFeedSupported: true, isDeleted: false } }).catch(() => 0),
      this.prisma.service.count({ where: { providerId: p.id, refillable: true, isDeleted: false } }).catch(() => 0),
      this.prisma.service.count({ where: { providerId: p.id, cancellable: true, isDeleted: false } }).catch(() => 0),
    ]);
    const health = this.getHealthTelemetry(p);

    return {
      id: p.id,
      name: p.name,
      apiUrl: p.apiUrl,
      apiKeyMasked: this.maskKey(plain),
      balance: Number(p.balance),
      currency: p.currency,
      active: p.active,
      serviceCount: p._count?.services || 0,
      dripFeedCount,
      refillCount,
      cancelCount,
      ...health,
      createdAt: new Date(p.createdAt).toISOString(),
      updatedAt: new Date(p.updatedAt).toISOString(),
    };
  }

  async create(input: { name?: string; apiUrl?: string; apiKey?: string; currency?: string }): Promise<ProviderDto> {
    if (!input.name || !input.apiUrl || !input.apiKey) {
      throw new ApiError(400, "BAD_REQUEST", "Name, apiUrl, and apiKey are required.");
    }

    const encryptedKey = encryptProviderKey(input.apiKey.trim());

    if (!this.prisma.isConnected) {
      const mockId = `prov_${Date.now()}`;
      return {
        id: mockId,
        name: input.name.trim(),
        apiUrl: input.apiUrl.trim(),
        apiKeyMasked: this.maskKey(input.apiKey.trim()),
        balance: 0,
        currency: input.currency || "INR",
        active: true,
        serviceCount: 0,
        healthStatus: "UNKNOWN",
        consecutiveStatusFailures: 0,
        lastStatusCheckAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const created = await this.prisma.provider.create({
      data: {
        name: input.name.trim(),
        apiUrl: input.apiUrl.trim(),
        apiKeyEncrypted: encryptedKey,
        currency: input.currency || "INR",
        balance: 0,
        active: true,
      },
    });

    return {
      id: created.id,
      name: created.name,
      apiUrl: created.apiUrl,
      apiKeyMasked: this.maskKey(input.apiKey.trim()),
      balance: Number(created.balance),
      currency: created.currency,
      active: created.active,
      serviceCount: 0,
      healthStatus: "UNKNOWN",
      consecutiveStatusFailures: 0,
      lastStatusCheckAt: null,
      createdAt: new Date(created.createdAt).toISOString(),
      updatedAt: new Date(created.updatedAt).toISOString(),
    };
  }

  async update(id: string, input: { name?: string; apiUrl?: string; apiKey?: string; active?: boolean }): Promise<ProviderDto> {
    const existing = await this.prisma.provider.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", `Provider #${id} not found.`);
    }

    const data: any = {};
    if (input.name) data.name = input.name.trim();
    if (input.apiUrl) data.apiUrl = input.apiUrl.trim();
    if (typeof input.active === "boolean") data.active = input.active;
    if (input.apiKey && input.apiKey.trim()) {
      data.apiKeyEncrypted = encryptProviderKey(input.apiKey.trim());
    }

    await this.prisma.provider.update({
      where: { id },
      data,
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    const existing = await this.prisma.provider.findUnique({ where: { id } });
    if (!existing) {
      throw new ApiError(404, "NOT_FOUND", `Provider #${id} not found.`);
    }

    await this.prisma.provider.delete({ where: { id } });
    return { success: true, message: `Provider #${id} deleted.` };
  }

  async getBalance(id: string) {
    const p = await this.prisma.provider.findUnique({ where: { id } });
    if (!p) throw new ApiError(404, "NOT_FOUND", `Provider #${id} not found.`);

    let decryptedKey = "";
    try {
      decryptedKey = decryptProviderKey(p.apiKeyEncrypted);
    } catch {
      decryptedKey = p.apiKeyEncrypted || "dummy_api_key";
    }

    try {
      const upstream = await this.smmClient.getBalance(p.apiUrl, decryptedKey);
      const balanceNum = parseFloat(String(upstream.balance || "0"));

      await this.prisma.provider.update({
        where: { id },
        data: { balance: new Decimal(balanceNum) },
      });

      return {
        providerId: p.id,
        name: p.name,
        balance: balanceNum,
        currency: upstream.currency || p.currency,
        status: "CONNECTED",
      };
    } catch (err: any) {
      return {
        providerId: p.id,
        name: p.name,
        balance: Number(p.balance),
        currency: p.currency,
        status: "ERROR",
        error: err.message,
      };
    }
  }

  async sync(id: string) {
    const balanceRes = await this.getBalance(id);

    const [totalActive, dripFeedCount, refillCount, cancelCount] = await Promise.all([
      this.prisma.service.count({ where: { providerId: id, active: true, isDeleted: false } }).catch(() => 0),
      this.prisma.service.count({ where: { providerId: id, dripFeedSupported: true, isDeleted: false } }).catch(() => 0),
      this.prisma.service.count({ where: { providerId: id, refillable: true, isDeleted: false } }).catch(() => 0),
      this.prisma.service.count({ where: { providerId: id, cancellable: true, isDeleted: false } }).catch(() => 0),
    ]);

    return {
      success: true,
      ...balanceRes,
      importedCount: 0,
      updatedCount: 0,
      errorsCount: 0,
      dripFeedCount,
      refillCount,
      cancelCount,
      totalActiveServices: totalActive,
      timestamp: new Date().toISOString(),
    };
  }

  async importServices(id: string, options: { marginPercent?: number }) {
    const p = await this.prisma.provider.findUnique({ where: { id } });
    if (!p) throw new ApiError(404, "NOT_FOUND", `Provider #${id} not found.`);

    const explicitMargin = typeof options.marginPercent === "number" ? options.marginPercent : null;
    let decryptedKey = "";
    try {
      decryptedKey = decryptProviderKey(p.apiKeyEncrypted);
    } catch {
      decryptedKey = p.apiKeyEncrypted || "dummy_api_key";
    }

    let upstreamServices: any[];
    try {
      upstreamServices = await this.smmClient.getServices(p.apiUrl, decryptedKey);
    } catch {
      upstreamServices = await this.smmClient.getServices("mock", decryptedKey);
    }

    if (!Array.isArray(upstreamServices) || upstreamServices.length === 0) {
      upstreamServices = await this.smmClient.getServices("mock", decryptedKey);
    }

    let importedCount = 0;
    let updatedCount = 0;
    let errorsCount = 0;
    let dripFeedCount = 0;
    let refillCount = 0;
    let cancelCount = 0;

    let pricingSettings: PricingSettingsConfig = { ...DEFAULT_PRICING_SETTINGS };
    let usdInrRate = DEFAULT_PRICING_SETTINGS.usdInrRate;
    try {
      const dbSettings = await this.prisma.systemSetting.findUnique({
        where: { key: "PRICING_CONFIG" },
      });
      if (dbSettings?.value) {
        pricingSettings = { ...DEFAULT_PRICING_SETTINGS, ...(dbSettings.value as any) };
        if ((dbSettings.value as any).usdInrRate) {
          usdInrRate = Number((dbSettings.value as any).usdInrRate);
        }
      }
    } catch {}

    for (const item of upstreamServices) {
      try {
        if (!item || !item.service || !item.name) continue;

        const rawCategory = String(item.category || "General").trim();
        const categoryName = rawCategory.length > 0 ? rawCategory.slice(0, 100) : "General";

        const category = await this.prisma.category.upsert({
          where: { name: categoryName },
          update: {},
          create: {
            name: categoryName,
            sortOrder: 10,
          },
        });

        const platform = "OTHER";
        const providerCost = parseFloat(String(item.rate || "0"));
        const costINRNum = calculateCostINR(providerCost, usdInrRate, p.currency || "INR").toNumber();

        const pricing = calculateSellingRate(costINRNum, {
          settings: pricingSettings,
          marginPercentOverride: explicitMargin,
        });
        const sellingRate = pricing.sellingRate.toNumber();
        const appliedMargin = pricing.appliedMarginPercent;

        const minQty = Math.max(1, parseInt(String(item.min || "10"), 10));
        const maxQty = Math.max(minQty, parseInt(String(item.max || "10000"), 10));
        const refillable = Boolean(item.refill);
        const cancellable = Boolean(item.cancel);
        const dripFeedSupported = coerceBoolean(item.dripfeed);

        if (dripFeedSupported) dripFeedCount++;
        if (refillable) refillCount++;
        if (cancellable) cancelCount++;

        const existingService = await this.prisma.service.findFirst({
          where: {
            providerId: p.id,
            providerServiceId: String(item.service),
          },
        });

        if (existingService) {
          await this.prisma.service.update({
            where: { id: existingService.id },
            data: {
              name: item.name.slice(0, 255),
              categoryId: category.id,
              platform,
              ratePer1000: new Decimal(sellingRate),
              providerCostPer1k: new Decimal(providerCost),
              providerCostCurrency: p.currency || "INR",
              costINR: new Decimal(costINRNum),
              minQty,
              maxQty,
              refillable,
              cancellable,
              dripFeedSupported,
              allowManagedDrip: true,
              active: true,
              isDeleted: false,
            },
          });
          updatedCount++;
        } else {
          await this.prisma.service.create({
            data: {
              name: item.name.slice(0, 255),
              categoryId: category.id,
              platform,
              ratePer1000: new Decimal(sellingRate),
              providerCostPer1k: new Decimal(providerCost),
              providerCostCurrency: p.currency || "INR",
              costINR: new Decimal(costINRNum),
              minQty,
              maxQty,
              providerId: p.id,
              providerServiceId: String(item.service),
              refillable,
              cancellable,
              dripFeedSupported,
              allowManagedDrip: true,
              packageEligible: true,
              active: true,
            },
          });
          importedCount++;
        }
      } catch {
        errorsCount++;
      }
    }

    const totalActive = await this.prisma.service.count({
      where: { providerId: p.id, active: true, isDeleted: false },
    }).catch(() => 0);

    return {
      success: true,
      providerId: p.id,
      importedCount,
      updatedCount,
      errorsCount,
      dripFeedCount,
      refillCount,
      cancelCount,
      totalActiveServices: totalActive,
      marginPercent: explicitMargin ?? "tiered",
    };
  }

  async setAllowManagedDrip(serviceId: string, allow: boolean) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new ApiError(404, "NOT_FOUND", `Service #${serviceId} not found.`);
    return this.prisma.service.update({
      where: { id: serviceId },
      data: { allowManagedDrip: allow },
    });
  }

  async bulkSetAllowManagedDripByCategory(categoryId: string, allow: boolean) {
    const res = await this.prisma.service.updateMany({
      where: { categoryId, isDeleted: false },
      data: { allowManagedDrip: allow },
    });
    return { categoryId, updatedCount: res.count, allowManagedDrip: allow };
  }
}

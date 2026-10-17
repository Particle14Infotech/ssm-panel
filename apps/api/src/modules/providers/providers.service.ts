import { Injectable, BadRequestException, NotFoundException, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { encryptProviderKey, decryptProviderKey } from "../../common/crypto.util";
import { SmmProviderClient } from "./smm-provider.client";
import { Decimal } from "decimal.js";

export interface ProviderDto {
  id: string;
  name: string;
  apiUrl: string;
  apiKeyMasked: string;
  balance: number;
  currency: string;
  active: boolean;
  serviceCount: number;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ProvidersService {
  private readonly logger = new Logger(ProvidersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smmClient: SmmProviderClient
  ) {}

  private maskKey(plain: string): string {
    if (!plain || plain.length <= 8) return "••••••••";
    return `${plain.substring(0, 4)}••••${plain.substring(plain.length - 4)}`;
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

      return providers.map((p) => {
        let plain = "";
        try {
          plain = decryptProviderKey(p.apiKeyEncrypted);
        } catch {
          plain = "••••••••";
        }

        return {
          id: p.id,
          name: p.name,
          apiUrl: p.apiUrl,
          apiKeyMasked: this.maskKey(plain),
          balance: Number(p.balance),
          currency: p.currency,
          active: p.active,
          serviceCount: p._count.services,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        };
      });
    } catch (err: any) {
      this.logger.error(`Failed to list providers: ${err.message}`);
      return [];
    }
  }

  async findOne(id: string): Promise<ProviderDto> {
    if (!this.prisma.isConnected) {
      throw new NotFoundException(`Provider #${id} not found.`);
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
      throw new NotFoundException(`Provider #${id} not found.`);
    }

    let plain = "";
    try {
      plain = decryptProviderKey(p.apiKeyEncrypted);
    } catch {
      plain = "••••••••";
    }

    return {
      id: p.id,
      name: p.name,
      apiUrl: p.apiUrl,
      apiKeyMasked: this.maskKey(plain),
      balance: Number(p.balance),
      currency: p.currency,
      active: p.active,
      serviceCount: p._count.services,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  async create(input: { name: string; apiUrl: string; apiKey: string; currency?: string }): Promise<ProviderDto> {
    if (!input.name || !input.apiUrl || !input.apiKey) {
      throw new BadRequestException("Name, apiUrl, and apiKey are required.");
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
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async update(id: string, input: { name?: string; apiUrl?: string; apiKey?: string; active?: boolean }): Promise<ProviderDto> {
    const existing = await this.prisma.provider.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Provider #${id} not found.`);
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
      throw new NotFoundException(`Provider #${id} not found.`);
    }

    await this.prisma.provider.delete({ where: { id } });
    return { success: true, message: `Provider #${id} deleted.` };
  }

  async getBalance(id: string) {
    const p = await this.prisma.provider.findUnique({ where: { id } });
    if (!p) throw new NotFoundException(`Provider #${id} not found.`);

    const decryptedKey = decryptProviderKey(p.apiKeyEncrypted);
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
    // 1. Refresh live provider balance
    const balanceRes = await this.getBalance(id);

    // 2. Perform catalog sync/import with default 20% margin
    let importRes: any = { importedCount: 0, updatedCount: 0, errorsCount: 0 };
    try {
      importRes = await this.importServices(id, { marginPercent: 20 });
    } catch (err: any) {
      this.logger.error(`Catalog auto-sync during provider sync failed: ${err.message}`);
    }

    return {
      success: true,
      ...balanceRes,
      importedCount: importRes.importedCount || 0,
      updatedCount: importRes.updatedCount || 0,
      errorsCount: importRes.errorsCount || 0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Import services from upstream provider, sanitize rates/limits, and apply margin %
   */
  async importServices(id: string, options: { marginPercent?: number }) {
    const p = await this.prisma.provider.findUnique({ where: { id } });
    if (!p) throw new NotFoundException(`Provider #${id} not found.`);

    const margin = typeof options.marginPercent === "number" ? options.marginPercent : 20; // default 20%
    const decryptedKey = decryptProviderKey(p.apiKeyEncrypted);
    const upstreamServices = await this.smmClient.getServices(p.apiUrl, decryptedKey);

    if (!Array.isArray(upstreamServices)) {
      throw new BadRequestException("Upstream provider returned an invalid services format.");
    }

    let importedCount = 0;
    let updatedCount = 0;
    let errorsCount = 0;

    for (const item of upstreamServices) {
      try {
        if (!item || !item.service || !item.name) continue;

        // 1. Sanitize category
        const catName = (item.category || "General").trim().slice(0, 100);
        const catSlug = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "general";
        
        const category = await this.prisma.category.upsert({
          where: { slug: catSlug },
          update: {},
          create: {
            name: catName,
            slug: catSlug,
          },
        });

        // 2. Parse & sanitize financial rate (protect against numeric field overflow < 10^8)
        let providerCost = parseFloat(String(item.rate || "100"));
        if (isNaN(providerCost) || providerCost < 0) {
          providerCost = 100;
        }
        let sellingRate = Number((providerCost * (1 + margin / 100)).toFixed(2));
        if (isNaN(sellingRate) || sellingRate <= 0) {
          sellingRate = 1.0;
        }
        // PostgreSQL Decimal(10, 2) max value is 99999999.99
        if (sellingRate > 9999999.99) {
          sellingRate = 9999999.99;
        }

        // 3. Parse & clamp quantities to 32-bit integer limits (1 to 2,147,483,640)
        let minQty = parseInt(String(item.min || 10), 10);
        if (isNaN(minQty) || minQty < 1) minQty = 1;
        if (minQty > 2147483640) minQty = 2147483640;

        let maxQty = parseInt(String(item.max || 100000), 10);
        if (isNaN(maxQty) || maxQty < minQty) maxQty = Math.max(minQty, 100000);
        if (maxQty > 2147483640) maxQty = 2147483640;

        // 4. Platform detection
        let platform = "OTHER";
        const nameUpper = (item.name + " " + catName).toUpperCase();
        if (nameUpper.includes("INSTAGRAM")) platform = "INSTAGRAM";
        else if (nameUpper.includes("YOUTUBE")) platform = "YOUTUBE";
        else if (nameUpper.includes("TIKTOK")) platform = "TIKTOK";
        else if (nameUpper.includes("TELEGRAM")) platform = "TELEGRAM";
        else if (nameUpper.includes("TWITTER") || nameUpper.includes(" X ")) platform = "X_TWITTER";
        else if (nameUpper.includes("FACEBOOK")) platform = "FACEBOOK";

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
              minQty,
              maxQty,
              refillable: Boolean(item.refill),
              cancellable: Boolean(item.cancel),
              description: item.description || existingService.description || "",
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
              minQty,
              maxQty,
              providerId: p.id,
              providerServiceId: String(item.service),
              refillable: Boolean(item.refill),
              cancellable: Boolean(item.cancel),
              description: item.description || "",
              active: true,
            },
          });
          importedCount++;
        }
      } catch (svcErr: any) {
        errorsCount++;
        this.logger.warn(`Skipping malformed provider service #${item?.service}: ${svcErr.message}`);
      }
    }

    // Update active service count for provider
    const totalActive = await this.prisma.service.count({
      where: { providerId: p.id, active: true, isDeleted: false },
    });

    return {
      success: true,
      providerId: p.id,
      importedCount,
      updatedCount,
      errorsCount,
      totalActiveServices: totalActive,
      marginPercent: margin,
    };
  }
}

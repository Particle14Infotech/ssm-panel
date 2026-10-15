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
    const balanceRes = await this.getBalance(id);
    return {
      success: true,
      ...balanceRes,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Import services from upstream provider and apply margin %
   */
  async importServices(id: string, options: { marginPercent?: number }) {
    const p = await this.prisma.provider.findUnique({ where: { id } });
    if (!p) throw new NotFoundException(`Provider #${id} not found.`);

    const margin = typeof options.marginPercent === "number" ? options.marginPercent : 20; // default 20%
    const decryptedKey = decryptProviderKey(p.apiKeyEncrypted);
    const upstreamServices = await this.smmClient.getServices(p.apiUrl, decryptedKey);

    let importedCount = 0;
    for (const item of upstreamServices) {
      // Find or create category
      const catName = item.category || "General";
      const catSlug = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      
      const category = await this.prisma.category.upsert({
        where: { slug: catSlug },
        update: {},
        create: {
          name: catName,
          slug: catSlug,
        },
      });

      const providerCost = parseFloat(String(item.rate || "100"));
      // Rate = provider cost + margin %
      const sellingRate = Number((providerCost * (1 + margin / 100)).toFixed(2));

      // Platform detection
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
            name: item.name,
            categoryId: category.id,
            ratePer1000: new Decimal(sellingRate),
            minQty: parseInt(String(item.min || 10), 10),
            maxQty: parseInt(String(item.max || 100000), 10),
            refillable: Boolean(item.refill),
            cancellable: Boolean(item.cancel),
            description: item.description || existingService.description,
            active: true,
            isDeleted: false,
          },
        });
      } else {
        await this.prisma.service.create({
          data: {
            name: item.name,
            categoryId: category.id,
            platform,
            ratePer1000: new Decimal(sellingRate),
            minQty: parseInt(String(item.min || 10), 10),
            maxQty: parseInt(String(item.max || 100000), 10),
            providerId: p.id,
            providerServiceId: String(item.service),
            refillable: Boolean(item.refill),
            cancellable: Boolean(item.cancel),
            description: item.description || "",
            active: true,
          },
        });
      }
      importedCount++;
    }

    return {
      success: true,
      providerId: p.id,
      importedCount,
      marginPercent: margin,
    };
  }
}

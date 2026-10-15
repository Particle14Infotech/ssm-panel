import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../common/prisma.service";
import { encryptProviderKey, decryptProviderKey } from "../../common/crypto.util";

export interface ProviderDto {
  id: string;
  name: string;
  apiUrl: string;
  apiKeyMasked: string;
  balance: number;
  currency: string;
  status: string;
  serviceCount: number;
  lastSyncAt: string;
}

@Injectable()
export class ProvidersService {
  // In-memory persistent registry with encrypted keys
  private providers: Array<{
    id: string;
    name: string;
    apiUrl: string;
    encryptedApiKey: string;
    balance: number;
    currency: string;
    status: string;
    serviceCount: number;
    lastSyncAt: string;
  }> = [
    {
      id: "prov_smm_main",
      name: "ApexSMM Global API",
      apiUrl: "https://api.apexsmm.com/v2",
      encryptedApiKey: encryptProviderKey("sk_live_apex_smm_demo_wholesaler_key"),
      balance: 4820.5,
      currency: "USD",
      status: "CONNECTED",
      serviceCount: 420,
      lastSyncAt: new Date().toISOString(),
    },
    {
      id: "prov_speed_router",
      name: "HyperRoute High-Speed Provider",
      apiUrl: "https://router.hyperroute.io/api/v1",
      encryptedApiKey: encryptProviderKey("sk_live_hyper_route_fast_key"),
      balance: 1980.25,
      currency: "USD",
      status: "CONNECTED",
      serviceCount: 154,
      lastSyncAt: new Date().toISOString(),
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  findAll(): ProviderDto[] {
    return this.providers.map((p) => {
      // Decrypt to verify integrity then mask for API response
      const plain = decryptProviderKey(p.encryptedApiKey);
      const masked = `${plain.substring(0, 7)}...${plain.substring(plain.length - 4)}`;
      return {
        id: p.id,
        name: p.name,
        apiUrl: p.apiUrl,
        apiKeyMasked: masked,
        balance: p.balance,
        currency: p.currency,
        status: p.status,
        serviceCount: p.serviceCount,
        lastSyncAt: p.lastSyncAt,
      };
    });
  }

  create(input: { name: string; apiUrl: string; apiKey: string }): ProviderDto {
    if (!input.name || !input.apiUrl || !input.apiKey) {
      throw new BadRequestException("Name, apiUrl, and apiKey are required.");
    }

    const encryptedApiKey = encryptProviderKey(input.apiKey.trim());
    const newProv = {
      id: `prov_${Math.random().toString(36).substring(2, 8)}`,
      name: input.name.trim(),
      apiUrl: input.apiUrl.trim(),
      encryptedApiKey,
      balance: 1000.0,
      currency: "USD",
      status: "CONNECTED",
      serviceCount: 100,
      lastSyncAt: new Date().toISOString(),
    };

    this.providers.unshift(newProv);

    const masked = `${input.apiKey.substring(0, 7)}...${input.apiKey.substring(input.apiKey.length - 4)}`;
    return {
      id: newProv.id,
      name: newProv.name,
      apiUrl: newProv.apiUrl,
      apiKeyMasked: masked,
      balance: newProv.balance,
      currency: newProv.currency,
      status: newProv.status,
      serviceCount: newProv.serviceCount,
      lastSyncAt: newProv.lastSyncAt,
    };
  }

  async sync(id: string) {
    const prov = this.providers.find((p) => p.id === id);
    if (!prov) throw new NotFoundException(`Provider #${id} not found.`);

    // Decrypt key to simulate upstream authentication
    const decryptedKey = decryptProviderKey(prov.encryptedApiKey);
    if (!decryptedKey) {
      throw new BadRequestException("Decryption of provider key failed.");
    }

    prov.lastSyncAt = new Date().toISOString();
    prov.balance = Number((prov.balance + (Math.random() * 50 - 20)).toFixed(2));

    return {
      success: true,
      providerId: prov.id,
      name: prov.name,
      balance: prov.balance,
      currency: prov.currency,
      syncedServices: prov.serviceCount,
      latencyMs: 14.2,
      timestamp: prov.lastSyncAt,
    };
  }

  findOne(id: string): ProviderDto {
    const p = this.providers.find((prov) => prov.id === id);
    if (!p) throw new NotFoundException(`Provider #${id} not found.`);
    const plain = decryptProviderKey(p.encryptedApiKey);
    const masked = `${plain.substring(0, 7)}...${plain.substring(plain.length - 4)}`;
    return {
      id: p.id,
      name: p.name,
      apiUrl: p.apiUrl,
      apiKeyMasked: masked,
      balance: p.balance,
      currency: p.currency,
      status: p.status,
      serviceCount: p.serviceCount,
      lastSyncAt: p.lastSyncAt,
    };
  }

  update(id: string, input: { name?: string; apiUrl?: string; apiKey?: string; status?: string }): ProviderDto {
    const p = this.providers.find((prov) => prov.id === id);
    if (!p) throw new NotFoundException(`Provider #${id} not found.`);
    if (input.name) p.name = input.name;
    if (input.apiUrl) p.apiUrl = input.apiUrl;
    if (input.status) p.status = input.status;
    if (input.apiKey) p.encryptedApiKey = encryptProviderKey(input.apiKey);
    return this.findOne(id);
  }

  remove(id: string) {
    const idx = this.providers.findIndex((prov) => prov.id === id);
    if (idx === -1) throw new NotFoundException(`Provider #${id} not found.`);
    this.providers.splice(idx, 1);
    return { success: true, message: `Provider #${id} deleted.` };
  }

  getBalance(id: string) {
    const p = this.findOne(id);
    return {
      providerId: p.id,
      name: p.name,
      balance: p.balance,
      currency: p.currency,
      status: p.status,
    };
  }
}

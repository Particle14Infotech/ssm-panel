import crypto from "crypto";
import { PrismaLike } from "../prisma";
import { ServicesService } from "./services.service";
import { ApiError } from "../errors";

export class ResellerService {
  constructor(
    private readonly prisma: PrismaLike,
    private readonly servicesService: ServicesService
  ) {}

  getReports() {
    return {
      monthlyVolumeOrders: 4520,
      monthlyVolumeSpent: 184500.0,
      activeClientAccounts: 18,
      avgLatencyMs: 12.8,
      currency: "INR",
    };
  }

  getClients() {
    return [
      { id: "cli_1", name: "ApexMedia Buying LLC", ordersCount: 1420, spent: 54000.0, status: "ACTIVE" },
      { id: "cli_2", name: "SocialFlow Automation", ordersCount: 980, spent: 39500.0, status: "ACTIVE" },
    ];
  }

  async getPricing() {
    const services = await this.servicesService.findAll();
    return services.map((s) => ({
      serviceId: s.id,
      name: s.name,
      platform: s.platform,
      standardRate: s.ratePer1000,
      resellerRate: Number((s.ratePer1000 * 0.85).toFixed(2)),
      discountPct: 15,
    }));
  }

  updatePricing(body: { serviceId: string; customRate: number }) {
    return { success: true, serviceId: body.serviceId, customRate: body.customRate };
  }

  rotateApiKey(userId?: string) {
    const newKey = `smm_live_${crypto.randomBytes(16).toString("hex")}`;
    return {
      success: true,
      apiKey: newKey,
      message: "New API key generated. Update your downstream scripts immediately.",
    };
  }

  async getPublicServices() {
    const services = await this.servicesService.findAll();
    return services.map((s) => ({
      service: s.id,
      name: s.name,
      type: "Default",
      category: s.platform,
      rate: Number((s.ratePer1000 * 0.85).toFixed(2)),
      min: s.minQty,
      max: s.maxQty,
      dripfeed: Boolean(s.dripFeedSupported),
    }));
  }

  async createPublicOrder(body: {
    service?: string;
    link?: string;
    quantity?: number;
    runs?: number;
    interval?: number;
  }) {
    if (!body.service || !body.link || !body.quantity) {
      throw new ApiError(400, "BAD_REQUEST", "service, link, and quantity parameters are required.");
    }
    const isDrip = body.runs !== undefined || body.interval !== undefined;
    const orderId = `ord_reseller_${Date.now()}`;

    if (this.prisma.order?.create) {
      const order = await this.prisma.order.create({
        data: {
          id: orderId,
          serviceId: body.service,
          target: body.link,
          quantity: Number(body.quantity),
          isDripFeed: isDrip,
          runs: body.runs !== undefined ? Number(body.runs) : null,
          interval: body.interval !== undefined ? Number(body.interval) : null,
          charge: (Number(body.quantity) * 0.18).toFixed(2),
          status: "PENDING",
        },
      }).catch(() => ({ id: orderId }));
      return { order: order.id };
    }
    return { order: orderId };
  }

  async getPublicOrderStatus(orderId: string) {
    if (this.prisma.order?.findUnique) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });
      if (order) {
        return {
          charge: Number(order.charge),
          start_count: order.startCount || 0,
          status: order.status,
          remains: order.remains || 0,
          currency: "INR",
        };
      }
    }
    return {
      charge: 18.0,
      start_count: 0,
      status: "PENDING",
      remains: 100,
      currency: "INR",
    };
  }

  async getPublicBalance() {
    return {
      balance: 14500.0,
      currency: "INR",
    };
  }
}

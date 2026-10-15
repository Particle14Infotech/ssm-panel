import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { ServicesService } from "../services/services.service";
import { OrdersService } from "../orders/orders.service";
import { WalletService } from "../wallet/wallet.service";
import crypto from "crypto";

@Injectable()
export class ResellerService {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly ordersService: OrdersService,
    private readonly walletService: WalletService
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

  getPricing() {
    const services = this.servicesService.findAll();
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
    const newKey = `aeth_live_${crypto.randomBytes(16).toString("hex")}`;
    return {
      success: true,
      apiKey: newKey,
      message: "New API key generated. Update your downstream scripts immediately.",
    };
  }

  getPublicServices() {
    const pricing = this.getPricing();
    return pricing.map((p) => ({
      service: p.serviceId,
      name: p.name,
      type: "Default",
      category: p.platform,
      rate: p.resellerRate,
      min: 100,
      max: 500000,
    }));
  }

  async createPublicOrder(body: { service: string; link: string; quantity: number }) {
    if (!body.service || !body.link || !body.quantity) {
      throw new BadRequestException("service, link, and quantity parameters are required.");
    }
    const order = await this.ordersService.create({
      serviceId: body.service,
      target: body.link,
      quantity: Number(body.quantity),
    });
    return { order: order.id };
  }

  async getPublicOrderStatus(orderId: string) {
    const order = await this.ordersService.findOne(orderId);
    return {
      charge: Number(order.charge),
      start_count: order.startCount || 0,
      status: order.status,
      remains: order.remains || 0,
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

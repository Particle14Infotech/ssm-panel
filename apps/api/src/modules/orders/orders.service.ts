import { Injectable, BadRequestException } from "@nestjs/common";
import { OrderItem } from "@smm/contracts";
import { ServicesService } from "../services/services.service";

@Injectable()
export class OrdersService {
  private orders: OrderItem[] = [
    {
      id: "ORD-98421",
      userId: "usr_998124aether",
      serviceId: "1042",
      serviceName: "Instagram High-Retention Followers",
      platform: "instagram",
      target: "https://instagram.com/neural.growth",
      quantity: 5000,
      charge: 900.0,
      startCount: 14200,
      remains: 0,
      status: "COMPLETED",
      createdAt: "2026-10-10T14:20:00Z",
      updatedAt: "2026-10-10T15:05:00Z",
      refillable: true,
      cancellable: false,
    },
  ];

  constructor(private readonly servicesService: ServicesService) {}

  findAll() {
    return this.orders;
  }

  findOne(id: string) {
    return this.orders.find((o) => o.id === id);
  }

  create(input: { serviceId: string; target: string; quantity: number }) {
    const service = this.servicesService.findOne(input.serviceId);
    if (!service) throw new BadRequestException("Invalid service ID provided.");

    const charge = Number(((input.quantity / 1000) * service.ratePer1000).toFixed(2));
    const newOrder: OrderItem = {
      id: `ORD-${Math.floor(10000 + Math.random() * 90000)}`,
      userId: "usr_998124aether",
      serviceId: service.id,
      serviceName: service.name,
      platform: service.platform.toLowerCase(),
      target: input.target,
      quantity: input.quantity,
      charge,
      startCount: 1000,
      remains: input.quantity,
      status: "PROCESSING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      refillable: service.refillable,
      cancellable: service.cancellable,
    };

    this.orders.unshift(newOrder);
    return newOrder;
  }

  refill(id: string) {
    const order = this.findOne(id);
    if (!order) throw new BadRequestException("Order not found.");
    order.status = "IN_PROGRESS";
    order.updatedAt = new Date().toISOString();
    return { success: true, message: `Refill daemon attached to ${id}` };
  }

  cancel(id: string) {
    const order = this.findOne(id);
    if (!order) throw new BadRequestException("Order not found.");
    order.status = "CANCELLED";
    order.updatedAt = new Date().toISOString();
    return { success: true, message: `Order ${id} cancelled and refunded.` };
  }
}

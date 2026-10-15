import { Controller, Get, Post, Body, Param, Put, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { OrdersService } from "./orders.service";

@ApiTags("Orders Dispatch Terminal")
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: "Get User Orders Stream" })
  findAll() {
    return this.ordersService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Inspect Specific Order by ID" })
  async findOne(@Param("id") id: string) {
    const order = await this.ordersService.findOne(id);
    if (!order) throw new NotFoundException(`Order #${id} not found.`);
    return order;
  }

  @Post()
  @ApiOperation({ summary: "Dispatch New Order Vector (Canonical)" })
  async createCanonical(@Body() body: { serviceId: string; target: string; quantity: number }) {
    return await this.ordersService.create(body);
  }

  @Post("create")
  @ApiOperation({ summary: "Dispatch New Order Vector (Legacy)" })
  async create(@Body() body: { serviceId: string; target: string; quantity: number }) {
    return await this.ordersService.create(body);
  }

  @Post(":id/refill")
  @ApiOperation({ summary: "Trigger Auto Refill Daemon" })
  refill(@Param("id") id: string) {
    return this.ordersService.refill(id);
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Cancel and Refund Order" })
  cancel(@Param("id") id: string) {
    return this.ordersService.cancel(id);
  }

  @Put(":id/status")
  @ApiOperation({ summary: "Admin Update Order Status" })
  updateStatus(@Param("id") id: string, @Body("status") status: any) {
    return this.ordersService.updateStatus(id, status);
  }

  @Post(":id/refund")
  @ApiOperation({ summary: "Admin Manual Order Refund" })
  adminRefund(@Param("id") id: string, @Body("amount") amount?: number) {
    return this.ordersService.adminRefund(id, amount);
  }

  @Post(":id/retry")
  @ApiOperation({ summary: "Admin Retry Order Provider Dispatch" })
  retry(@Param("id") id: string) {
    return this.ordersService.retry(id);
  }

  @Put(":id/provider")
  @ApiOperation({ summary: "Admin Change Upstream Provider" })
  changeProvider(@Param("id") id: string, @Body("providerId") providerId: string) {
    return this.ordersService.changeProvider(id, providerId);
  }

  @Put(":id/notes")
  @ApiOperation({ summary: "Admin Update Order Notes" })
  updateNotes(@Param("id") id: string, @Body("notes") notes: string) {
    return this.ordersService.updateNotes(id, notes);
  }
}

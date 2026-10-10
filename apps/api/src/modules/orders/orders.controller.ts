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
  findOne(@Param("id") id: string) {
    const order = this.ordersService.findOne(id);
    if (!order) throw new NotFoundException(`Order #${id} not found.`);
    return order;
  }

  @Post("create")
  @ApiOperation({ summary: "Dispatch New Order Vector" })
  create(@Body() body: { serviceId: string; target: string; quantity: number }) {
    return this.ordersService.create(body);
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
}

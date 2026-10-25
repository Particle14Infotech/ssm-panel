import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Query,
  NotFoundException,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { CurrentUser, CurrentUserData } from "../../common/current-user.decorator";
import { Role } from "@prisma/client";
import { PackageProviderReconciliationInputSchema } from "./orders.service";

@ApiTags("Orders Dispatch Terminal")
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get User Orders Stream" })
  findAll(
    @CurrentUser() user: CurrentUserData,
    @Query("userId") queryUserId?: string,
    @Query("status") status?: string,
    @Query("q") query?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("dripFeedOnly") dripFeedOnly?: string
  ) {
    const targetUserId = user.role === Role.ADMIN ? (queryUserId || undefined) : user.id;
    return this.ordersService.findAll(targetUserId, user.role, {
      status,
      query,
      startDate,
      endDate,
      dripFeedOnly: dripFeedOnly === "true" || dripFeedOnly === "1",
    });
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Inspect Specific Order by ID" })
  async findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    const order = await this.ordersService.findOne(id, user.id, user.role);
    if (!order) throw new NotFoundException(`Order #${id} not found.`);
    return order;
  }

  @Post(":id/report-problem")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Customer Report Problem with Order (One Open Report Limit)" })
  async reportProblem(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
    @Body() body: { issueType?: string; notes?: string }
  ) {
    return this.ordersService.reportProblem(user.id, id, body);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Dispatch New Order Vector (Canonical)" })
  async createCanonical(
    @Body()
    body: {
      serviceId: string;
      target: string;
      quantity: number;
      isDripFeed?: boolean;
      runs?: number;
      interval?: number;
      idempotencyKey?: string;
      expectedRate?: number;
      comments?: string;
    },
    @CurrentUser() user: CurrentUserData
  ) {
    return await this.ordersService.create({
      serviceId: body.serviceId,
      target: body.target,
      quantity: body.quantity,
      isDripFeed: body.isDripFeed,
      runs: body.runs,
      interval: body.interval,
      idempotencyKey: body.idempotencyKey,
      expectedRate: body.expectedRate,
      comments: body.comments,
      userId: user.id,
      requesterRole: user.role,
    });
  }

  @Post("create")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Dispatch New Order Vector (Legacy)" })
  async create(
    @Body()
    body: {
      serviceId: string;
      target: string;
      quantity: number;
      isDripFeed?: boolean;
      runs?: number;
      interval?: number;
      idempotencyKey?: string;
      expectedRate?: number;
      comments?: string;
    },
    @CurrentUser() user: CurrentUserData
  ) {
    return await this.ordersService.create({
      serviceId: body.serviceId,
      target: body.target,
      quantity: body.quantity,
      isDripFeed: body.isDripFeed,
      runs: body.runs,
      interval: body.interval,
      idempotencyKey: body.idempotencyKey,
      expectedRate: body.expectedRate,
      comments: body.comments,
      userId: user.id,
      requesterRole: user.role,
    });
  }

  @Post(":id/refill")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Trigger Auto Refill Daemon" })
  refill(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.ordersService.refill(id, user.id, user.role);
  }

  @Post(":id/cancel")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Cancel and Refund Order" })
  cancel(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.ordersService.cancel(id, user.id, user.role);
  }

  @Put(":id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Update Order Status" })
  updateStatus(@Param("id") id: string, @Body("status") status: any) {
    return this.ordersService.updateStatus(id, status);
  }

  @Post(":id/refund")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Manual Order Refund" })
  adminRefund(@Param("id") id: string, @Body("amount") amount?: number) {
    return this.ordersService.adminRefund(id, amount);
  }

  @Post(":id/retry")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Retry Order Provider Dispatch" })
  retry(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.ordersService.retry(id, user.id);
  }

  @Post(":id/package-provider-reconciliation")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin reconcile an uncertain package provider outcome" })
  reconcilePackageProviderOutcome(
    @Param("id") id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() body: unknown
  ) {
    const parsed = PackageProviderReconciliationInputSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.errors[0]?.message || "Invalid reconciliation details."
      );
    }
    return this.ordersService.reconcilePackageProviderOutcome(
      id,
      user.id,
      parsed.data
    );
  }

  @Put(":id/provider")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Change Upstream Provider" })
  changeProvider(@Param("id") id: string, @Body("providerId") providerId: string) {
    return this.ordersService.changeProvider(id, providerId);
  }

  @Put(":id/notes")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Update Order Notes" })
  updateNotes(@Param("id") id: string, @Body("notes") notes: string) {
    return this.ordersService.updateNotes(id, notes);
  }
}

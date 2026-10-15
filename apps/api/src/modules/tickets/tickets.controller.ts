import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Query,
  Headers,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { TicketsService } from "./tickets.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { CurrentUser, CurrentUserData } from "../../common/current-user.decorator";
import { Role } from "@prisma/client";

@ApiTags("Support & Ticketing")
@Controller("tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get User Support Tickets" })
  findAll(
    @CurrentUser() user?: CurrentUserData | string,
    @Query("userId") queryUserId?: string
  ) {
    const effectiveUserId = typeof user === "string" ? user : (user?.id || queryUserId);
    const role = typeof user === "object" ? user?.role : undefined;
    return this.ticketsService.findAll(effectiveUserId, role);
  }

  @Get("admin/all")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin List All Support Tickets" })
  adminAll() {
    return this.ticketsService.findAll(undefined, "ADMIN");
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get Support Ticket Detail" })
  findOne(@Param("id") id: string, @CurrentUser() user?: CurrentUserData | string) {
    const effectiveUserId = typeof user === "string" ? user : user?.id;
    const role = typeof user === "object" ? user?.role : undefined;
    return this.ticketsService.findOne(id, effectiveUserId, role);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Open New Support Ticket (Canonical)" })
  createCanonical(
    @Body() body: { subject: string; message?: string; priority?: string },
    @CurrentUser() user?: CurrentUserData | string,
    @Headers("x-user-id") headerUserId?: string
  ) {
    const effectiveUserId = typeof user === "string" ? user : (user?.id || headerUserId || (body as any)?.userId);
    return this.ticketsService.create(effectiveUserId || "", {
      subject: body.subject,
      message: body.message || body.subject,
      priority: body.priority,
    });
  }

  @Post("create")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Open New Support Ticket (Legacy)" })
  create(
    @Body() body: { subject: string; message?: string; priority?: string },
    @CurrentUser() user?: CurrentUserData | string,
    @Headers("x-user-id") headerUserId?: string
  ) {
    const effectiveUserId = typeof user === "string" ? user : (user?.id || headerUserId || (body as any)?.userId);
    return this.ticketsService.create(effectiveUserId || "", {
      subject: body.subject,
      message: body.message || body.subject,
      priority: body.priority,
    });
  }

  @Post(":id/reply")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Post Reply to Ticket" })
  reply(
    @Param("id") id: string,
    @Body("message") message: string,
    @CurrentUser() user?: CurrentUserData | string,
    @Headers("x-user-id") headerUserId?: string
  ) {
    const effectiveUserId = typeof user === "string" ? user : (user?.id || headerUserId);
    const role = typeof user === "object" ? user?.role : undefined;
    return this.ticketsService.reply(id, effectiveUserId || "", message, role);
  }

  @Post(":id/close")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Close Support Ticket" })
  close(@Param("id") id: string, @CurrentUser() user?: CurrentUserData | string) {
    const effectiveUserId = typeof user === "string" ? user : user?.id;
    const role = typeof user === "object" ? user?.role : undefined;
    return this.ticketsService.close(id, effectiveUserId, role);
  }

  @Put(":id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Update Ticket Status" })
  updateStatus(@Param("id") id: string, @Body("status") status: string) {
    return this.ticketsService.updateStatus(id, status);
  }
}


import { Controller, Get, Post, Put, Body, Param, Headers, Query } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { TicketsService } from "./tickets.service";

@ApiTags("Support & Ticketing")
@Controller("tickets")
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @ApiOperation({ summary: "Get User Support Tickets" })
  findAll(@Query("userId") userId?: string, @Headers("x-user-id") headerUserId?: string) {
    return this.ticketsService.findAll(userId || headerUserId);
  }

  @Get("admin/all")
  @ApiOperation({ summary: "Admin List All Support Tickets" })
  adminAll() {
    return this.ticketsService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get Support Ticket Detail" })
  findOne(@Param("id") id: string) {
    return this.ticketsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: "Open New Support Ticket (Canonical)" })
  createCanonical(@Body() body: any, @Headers("x-user-id") headerUserId?: string) {
    return this.ticketsService.create(headerUserId || body.userId, body);
  }

  @Post("create")
  @ApiOperation({ summary: "Open New Support Ticket (Legacy)" })
  create(@Body() body: any, @Headers("x-user-id") headerUserId?: string) {
    return this.ticketsService.create(headerUserId || body.userId, body);
  }

  @Post(":id/reply")
  @ApiOperation({ summary: "Post Reply to Ticket" })
  reply(
    @Param("id") id: string,
    @Body("message") message: string,
    @Headers("x-user-id") headerUserId?: string
  ) {
    return this.ticketsService.reply(id, headerUserId || "usr_default_demo", message);
  }

  @Post(":id/close")
  @ApiOperation({ summary: "Close Support Ticket" })
  close(@Param("id") id: string) {
    return this.ticketsService.close(id);
  }

  @Put(":id/status")
  @ApiOperation({ summary: "Admin Update Ticket Status" })
  updateStatus(@Param("id") id: string, @Body("status") status: string) {
    return this.ticketsService.updateStatus(id, status);
  }
}

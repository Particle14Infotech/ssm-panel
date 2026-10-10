import { Controller, Get, Post, Body, Param } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("Support & Ticketing")
@Controller("tickets")
export class TicketsController {
  @Get()
  @ApiOperation({ summary: "Get User Support Tickets" })
  findAll() {
    return [
      {
        id: "TCK-4019",
        subject: "Refill request for order ORD-98421 Instagram High-Retention",
        department: "SERVICE_REFILL",
        priority: "HIGH",
        status: "ANSWERED",
      },
    ];
  }

  @Post("create")
  @ApiOperation({ summary: "Open New Support Ticket" })
  create(@Body() body: any) {
    return {
      success: true,
      ticketId: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
      received: body,
    };
  }
}

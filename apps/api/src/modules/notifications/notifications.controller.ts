import { Controller, Get, Put, Param, Query, Headers } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";

@ApiTags("Notifications Stream")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "Get User Notifications" })
  findAll(@Query("userId") userId?: string, @Headers("x-user-id") headerUserId?: string) {
    return this.notificationsService.findAll(userId || headerUserId);
  }

  @Put(":id/read")
  @ApiOperation({ summary: "Mark Notification as Read" })
  markAsRead(@Param("id") id: string) {
    return this.notificationsService.markAsRead(id);
  }
}

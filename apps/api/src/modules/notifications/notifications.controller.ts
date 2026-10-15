import { Controller, Get, Put, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { CurrentUser, CurrentUserData } from "../../common/current-user.decorator";

@ApiTags("Notifications Stream")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get User Notifications" })
  findAll(@CurrentUser() user: CurrentUserData) {
    return this.notificationsService.findAll(user.id);
  }

  @Put(":id/read")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Mark Notification as Read" })
  markAsRead(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.notificationsService.markAsRead(id, user.id);
  }
}


import { Controller, Get, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AnnouncementsService } from "./announcements.service";

@ApiTags("Platform Announcements")
@Controller("announcements")
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: "Get Active Platform Announcements" })
  findAll() {
    return this.announcementsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: "Admin Publish Announcement" })
  create(@Body() body: any) {
    return this.announcementsService.create(body);
  }
}

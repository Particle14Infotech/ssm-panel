import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { Role } from "@prisma/client";
import { PlatformsService } from "./platforms.service";

@ApiTags("Admin Platform Rules & Blocklist")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("admin/platforms")
export class PlatformsAdminController {
  constructor(private readonly platformsService: PlatformsService) {}

  @Get()
  @ApiOperation({ summary: "Admin List All Platform Configurations" })
  async listPlatforms() {
    return this.platformsService.adminListPlatforms();
  }

  @Get("blocklist")
  @ApiOperation({ summary: "Admin List Blocked Handles" })
  async listBlocklist(@Query("platform") platform?: string) {
    return this.platformsService.adminListBlocklist(platform);
  }

  @Post("blocklist")
  @ApiOperation({ summary: "Admin Add Handle to Blocklist" })
  async addBlocklist(
    @Body() body: { platform: string; handle: string; reason?: string }
  ) {
    return this.platformsService.adminAddBlocklist(body.platform, body.handle, body.reason);
  }

  @Delete("blocklist/:id")
  @ApiOperation({ summary: "Admin Remove Handle from Blocklist" })
  async removeBlocklist(@Param("id") id: string) {
    return this.platformsService.adminRemoveBlocklist(id);
  }

  @Get(":id")
  @ApiOperation({ summary: "Admin Get Specific Platform Configuration" })
  async getPlatform(@Param("id") id: string) {
    return this.platformsService.adminGetPlatform(id);
  }

  @Post()
  @ApiOperation({ summary: "Admin Create New Platform Configuration" })
  async createPlatform(@Body() body: any) {
    return this.platformsService.adminCreatePlatform(body);
  }

  @Put(":id")
  @ApiOperation({ summary: "Admin Update Platform Configuration" })
  async updatePlatform(@Param("id") id: string, @Body() body: any) {
    return this.platformsService.adminUpdatePlatform(id, body);
  }
}

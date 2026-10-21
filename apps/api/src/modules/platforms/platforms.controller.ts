import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PlatformsService } from "./platforms.service";

@ApiTags("Platform Configurations")
@Controller("platforms")
export class PlatformsController {
  constructor(private readonly platformsService: PlatformsService) {}

  @Get()
  @ApiOperation({ summary: "Get Active Platform Configurations and Validation Rules" })
  async getPlatforms() {
    return this.platformsService.getPublicPlatforms();
  }

  @Get(":platform")
  @ApiOperation({ summary: "Get Validation Rules for a Specific Platform" })
  async getPlatformConfig(@Param("platform") platform: string) {
    return this.platformsService.getPlatformConfig(platform);
  }
}

import { Controller, Get, Put, Post, Param, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { SettingsService } from "./settings.service";
import { FeatureFlagsService, FeatureFlagKey, FlagRule } from "./flags.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { Role } from "@prisma/client";

@ApiTags("Platform Settings")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("settings")
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly flagsService: FeatureFlagsService
  ) {}

  @Get()
  @ApiOperation({ summary: "Get System Settings" })
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  @ApiOperation({ summary: "Admin Update System Settings" })
  updateSettings(@Body() body: Record<string, any>) {
    return this.settingsService.updateSettings(body);
  }

  @Get("pace")
  @ApiOperation({ summary: "Admin Get Delivery Pace Settings" })
  getPaceSettings() {
    return this.settingsService.getPaceSettings();
  }

  @Put("pace")
  @ApiOperation({ summary: "Admin Update Delivery Pace Settings" })
  updatePaceSettings(@Body() body: Record<string, any>) {
    return this.settingsService.updatePaceSettings(body);
  }

  @Get("pace/audit")
  @ApiOperation({ summary: "Admin Get Delivery Pace Audit Report (Burst Analysis, Top Links, Metrics)" })
  getPaceAuditReport() {
    return this.settingsService.getPaceAuditReport();
  }

  @Get("pricing")
  @ApiOperation({ summary: "Admin Get Pricing Settings (Margin Floor, Default Markup, Cancellation Fee)" })
  getPricingSettings() {
    return this.settingsService.getPricingSettings();
  }

  @Put("pricing")
  @ApiOperation({ summary: "Admin Update Pricing Settings" })
  updatePricingSettings(@Body() body: {
    marginFloor?: number;
    defaultMarkup?: number;
    roundingDecimals?: number;
    cancellationFee?: number;
  }) {
    return this.settingsService.updatePricingSettings(body);
  }

  @Get("flags")
  @ApiOperation({ summary: "Get All Feature Flags with Rules" })
  getFlags() {
    return this.flagsService.getAllFlags();
  }

  @Put("flags/:flagKey")
  @ApiOperation({ summary: "Admin Update Feature Flag Rule (Allowlist, Percentage)" })
  updateFlag(
    @Param("flagKey") flagKey: FeatureFlagKey,
    @Body() body: Partial<FlagRule>
  ) {
    return this.flagsService.updateFlag(flagKey, body);
  }

  @Post("flags/:flagKey/kill")
  @ApiOperation({ summary: "Admin Instant Kill Switch for Feature Flag" })
  async killFlag(@Param("flagKey") flagKey: FeatureFlagKey) {
    await this.flagsService.killSwitch(flagKey);
    return { success: true, message: `Flag '${flagKey}' has been instantly disabled (kill switch activated).` };
  }
}

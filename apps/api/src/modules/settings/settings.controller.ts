import { Controller, Get, Put, Body } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SettingsService } from "./settings.service";

@ApiTags("Platform Settings")
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

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
}

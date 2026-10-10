import { Controller, Get, Put, Body } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("User Management")
@Controller("users")
export class UsersController {
  @Get("me")
  @ApiOperation({ summary: "Get Current Authenticated Profile" })
  getProfile() {
    return {
      id: "usr_998124aether",
      email: "growth.lead@nexusmedia.io",
      name: "Alex Vance",
      balance: 2450.0,
      currency: "INR",
      tier: "PRO_SCALE",
      apiKey: "aeth_live_9f81a7b3c4d5e6f7a8b9c0d1e2f3a4b5",
      twoFactorEnabled: true,
      totalSpent: 48920.0,
      totalOrders: 125,
    };
  }

  @Put("me")
  @ApiOperation({ summary: "Update Current Profile & Settings" })
  updateProfile(@Body() body: any) {
    return {
      success: true,
      updated: body,
    };
  }
}

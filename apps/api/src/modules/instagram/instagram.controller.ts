import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { InstagramService, ConnectAccountDto } from "./instagram.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { CurrentUser, CurrentUserData } from "../../common/current-user.decorator";
import { InstagramConnectInputSchema } from "@smm/contracts";

@ApiTags("Instagram Integrations")
@Controller("integrations/instagram")
export class InstagramController {
  constructor(private readonly instagramService: InstagramService) {}

  @Get("connect")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get Official Instagram OAuth Authorization URL" })
  getConnectUrl(@CurrentUser() user: CurrentUserData) {
    return this.instagramService.getConnectUrl(user.id);
  }

  @Get("callback")
  @ApiOperation({ summary: "OAuth Callback from Instagram / Facebook Graph API" })
  async handleCallback(
    @Query("code") code: string,
    @Query("state") state: string
  ) {
    if (!code) {
      throw new BadRequestException("Authorization code is required.");
    }
    // Extract userId from state
    const userId = state?.split(":")[1] || "anonymous";
    return {
      success: true,
      message: "Instagram account authorized successfully.",
      code,
      userId,
    };
  }

  @Post("connect")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Directly Connect or Authorize an Instagram Account" })
  async connectAccount(
    @CurrentUser() user: CurrentUserData,
    @Body() body: any
  ) {
    const parseRes = InstagramConnectInputSchema.safeParse(body);
    if (!parseRes.success) {
      const err = parseRes.error.errors[0]?.message || "Invalid connection details";
      throw new BadRequestException(err);
    }
    return this.instagramService.connectAccount(user.id, parseRes.data);
  }

  @Get("status")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get Connected Instagram Accounts & Scopes" })
  async getStatus(@CurrentUser() user: CurrentUserData) {
    return this.instagramService.getStatus(user.id);
  }

  @Post("disconnect")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Disconnect Instagram Account and Revoke Tokens" })
  async disconnect(
    @CurrentUser() user: CurrentUserData,
    @Body("connectionId") connectionId: string
  ) {
    if (!connectionId) {
      throw new BadRequestException("connectionId is required.");
    }
    return this.instagramService.disconnect(user.id, connectionId);
  }

  @Post("poll-now")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Trigger On-Demand Post Detection for Connection" })
  async pollNow(
    @CurrentUser() user: CurrentUserData,
    @Body("connectionId") connectionId: string,
    @Body("packageId") packageId?: string
  ) {
    if (!connectionId) {
      throw new BadRequestException("connectionId is required.");
    }
    await this.instagramService.verifyConnectionEligibility(user.id, connectionId);
    return this.instagramService.detectNewMedia(connectionId, packageId);
  }
}

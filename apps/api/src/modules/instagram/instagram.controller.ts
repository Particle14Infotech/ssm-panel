import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { InstagramService } from "./instagram.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { CurrentUser, CurrentUserData } from "../../common/current-user.decorator";

@ApiTags("Connections Engine (Instagram Graph API)")
@Controller("connections")
export class ConnectionsController {
  constructor(private readonly instagramService: InstagramService) {}

  @Post("instagram/start")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Generate OAuth state and authorization URL (10m TTL)" })
  startInstagramConnect(@CurrentUser() user: CurrentUserData) {
    return this.instagramService.startConnect(user.id);
  }

  @Get("instagram/callback")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Validate OAuth callback, exchange token, save SourceConnection" })
  async handleInstagramCallback(
    @CurrentUser() user: CurrentUserData,
    @Query("code") code: string,
    @Query("state") state: string
  ) {
    if (!code) {
      throw new BadRequestException("Authorization code is required.");
    }
    if (!state) {
      throw new BadRequestException("OAuth state parameter is required.");
    }
    return this.instagramService.handleCallback(user.id, code, state);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List active platform connections for user" })
  async listConnections(@CurrentUser() user: CurrentUserData) {
    return this.instagramService.listConnections(user.id);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Revoke platform connection and pause active packages" })
  async deleteConnection(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string
  ) {
    return this.instagramService.deleteConnection(user.id, id);
  }

  @Post("instagram/deauthorize")
  @ApiOperation({ summary: "Meta deauthorization callback" })
  async handleDeauthorize(@Body("user_id") userId: string) {
    return this.instagramService.handleDeauthorize(userId || "unknown");
  }

  @Post("instagram/data-deletion")
  @ApiOperation({ summary: "Meta user data deletion callback" })
  async handleDataDeletion(@Body("user_id") userId: string) {
    await this.instagramService.handleDeauthorize(userId || "unknown");
    return {
      url: "https://smmpanel.internal/data-deletion-status",
      confirmation_code: `del_${Date.now()}`,
    };
  }
}

@ApiTags("Instagram Integrations (Legacy Alias)")
@Controller("integrations/instagram")
export class InstagramLegacyController {
  constructor(private readonly instagramService: InstagramService) {}

  @Get("connect")
  @UseGuards(JwtAuthGuard)
  getConnectUrl(@CurrentUser() user: CurrentUserData) {
    return this.instagramService.startConnect(user.id);
  }

  @Get("callback")
  @UseGuards(JwtAuthGuard)
  handleCallback(
    @CurrentUser() user: CurrentUserData,
    @Query("code") code: string,
    @Query("state") state: string
  ) {
    return this.instagramService.handleCallback(user.id, code, state);
  }

  @Get("status")
  @UseGuards(JwtAuthGuard)
  getStatus(@CurrentUser() user: CurrentUserData) {
    return this.instagramService.listConnections(user.id);
  }
}

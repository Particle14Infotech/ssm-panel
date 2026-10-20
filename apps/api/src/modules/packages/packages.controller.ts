import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PackagesService } from "./packages.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { CurrentUser, CurrentUserData } from "../../common/current-user.decorator";
import { PackageQuoteInputSchema, PackagePurchaseInputSchema } from "@smm/contracts";

@ApiTags("Scheduled Packages Engine")
@Controller("packages")
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Post("quote")
  @ApiOperation({ summary: "Get Price Quote and Run Allocation Preview" })
  async getQuote(@Body() body: any) {
    const parseRes = PackageQuoteInputSchema.safeParse(body);
    if (!parseRes.success) {
      const err = parseRes.error.errors[0]?.message || "Invalid package configuration";
      throw new BadRequestException(err);
    }
    return this.packagesService.getQuote(parseRes.data);
  }

  @Post("purchase")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Purchase Package with Upfront Wallet Debit" })
  async purchasePackage(
    @CurrentUser() user: CurrentUserData,
    @Body() body: any
  ) {
    const parseRes = PackagePurchaseInputSchema.safeParse(body);
    if (!parseRes.success) {
      const err = parseRes.error.errors[0]?.message || "Invalid package purchase data";
      throw new BadRequestException(err);
    }
    return this.packagesService.purchasePackage(user.id, parseRes.data);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Create & Purchase Package" })
  async createPackage(
    @CurrentUser() user: CurrentUserData,
    @Body() body: any
  ) {
    return this.purchasePackage(user, body);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List User Growth Packages" })
  async listPackages(@CurrentUser() user: CurrentUserData) {
    return this.packagesService.listPackages(user.id);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get Package Details and Run Timeline" })
  async getPackage(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string
  ) {
    return this.packagesService.getPackage(user.id, id);
  }

  @Post(":id/pause")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Pause Auto-Post Package Monitoring" })
  async pausePackage(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string
  ) {
    return this.packagesService.pausePackage(user.id, id);
  }

  @Post(":id/resume")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Resume Paused Auto-Post Package Monitoring" })
  async resumePackage(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string
  ) {
    return this.packagesService.resumePackage(user.id, id);
  }

  @Get(":id/posts")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List Detected Posts for Package" })
  async getPackagePosts(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string
  ) {
    return this.packagesService.getPackagePosts(user.id, id);
  }

  @Get(":id/executions")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List Workflow Execution History for Package" })
  async getPackageExecutions(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string
  ) {
    return this.packagesService.getPackageExecutions(user.id, id);
  }

  @Post(":id/trigger")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Manually trigger post execution via Instagram post/reel link" })
  async triggerManualPost(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
    @Body() body: { url: string; mediaType?: string }
  ) {
    if (!body || !body.url) {
      throw new BadRequestException("url is required to trigger package post execution.");
    }
    return this.packagesService.triggerManualPost(user.id, id, body.url, body.mediaType);
  }

  @Post(":id/cancel")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Cancel Remaining Runs with Instant Wallet Refund" })
  async cancelPackage(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string
  ) {
    return this.packagesService.cancelPackage(user.id, id);
  }
}

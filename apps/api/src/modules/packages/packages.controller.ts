import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  Headers,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PackagesService } from "./packages.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { CurrentUser, CurrentUserData } from "../../common/current-user.decorator";
import {
  PackageQuoteInputSchema,
  PackagePurchaseInputSchema,
  TriggerPreviewInputSchema,
  TriggerExecutionInputSchema,
} from "@smm/contracts";

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

  @Get(":id/triggers")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List Triggers and Posts for Package" })
  async getPackageTriggers(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string
  ) {
    return this.packagesService.getPackageTriggers(user.id, id);
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

  @Post(":id/triggers/preview")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Preview post trigger schedule and per-rule quantity (zero side effects)" })
  async triggerPreview(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
    @Body() body: any
  ) {
    const parseRes = TriggerPreviewInputSchema.safeParse(body);
    if (!parseRes.success) {
      const err = parseRes.error.errors[0]?.message || "Invalid preview payload";
      throw new BadRequestException(err);
    }
    return this.packagesService.triggerPreview(user.id, id, parseRes.data);
  }

  @Post(":id/triggers")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Start post execution with atomic quota and time-interval drip schedule" })
  async triggerStart(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
    @Body() body: any,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    const effectiveKey = idempotencyKey || body.idempotencyKey;
    if (!effectiveKey || effectiveKey.trim() === "") {
      throw new BadRequestException("Idempotency-Key header is required for starting post delivery.");
    }

    const parseRes = TriggerExecutionInputSchema.safeParse(body);
    if (!parseRes.success) {
      const err = parseRes.error.errors[0]?.message || "Invalid trigger execution payload";
      throw new BadRequestException(err);
    }
    return this.packagesService.triggerStart(user.id, id, parseRes.data, effectiveKey);
  }

  @Post(":id/trigger")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Trigger post execution via direct platform link (backward compatibility)" })
  async triggerManualPost(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
    @Body() body: { url: string; mediaType?: string; idempotencyKey?: string },
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    if (!body || !body.url) {
      throw new BadRequestException("url is required to trigger package post execution.");
    }
    const key = idempotencyKey || body.idempotencyKey || `trig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    return this.packagesService.triggerStart(
      user.id,
      id,
      { url: body.url, mediaType: body.mediaType, rules: [] },
      key
    );
  }

  @Post(":id/cancel")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Cancel Remaining Runs with Automated Wallet Refund" })
  async cancelPackage(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string
  ) {
    return this.packagesService.cancelPackage(user.id, id);
  }
}

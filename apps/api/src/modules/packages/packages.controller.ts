import { randomBytes } from "crypto";
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  Headers,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PackagesService } from "./packages.service";
import { PackagesEnabledGuard } from "./packages-enabled.guard";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { Role } from "@prisma/client";
import { CurrentUser, CurrentUserData } from "../../common/current-user.decorator";
import {
  PackageQuoteInputSchema,
  PackagePurchaseInputSchema,
  TriggerPreviewInputSchema,
  TriggerExecutionInputSchema,
  RescheduleExecutionInputSchema,
} from "@smm/contracts";

@ApiTags("Scheduled Packages Engine")
@Controller("packages")
@UseGuards(PackagesEnabledGuard)
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Post("quote")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "Get Price Quote and Run Allocation Preview" })
  async getQuote(
    @Body() body: any,
    @CurrentUser() user?: CurrentUserData,
    @Headers("x-forwarded-for") forwardedFor?: string
  ) {
    const parseRes = PackageQuoteInputSchema.safeParse(body);
    if (!parseRes.success) {
      const err = parseRes.error.errors[0]?.message || "Invalid package configuration";
      throw new BadRequestException(err);
    }
    const clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : undefined;
    if (user?.id || clientIp) {
      return this.packagesService.getQuote(parseRes.data, user?.id, clientIp);
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

  @Get("admin/:id/summary")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Package Overview (Revenue, Cost, and Profit Breakdown)" })
  async getAdminPackageSummary(@Param("id") id: string) {
    return this.packagesService.getAdminPackageSummary(id);
  }

  @Post("admin/executions/:executionId/resolve")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Queue Action: Resolve UNCERTAIN or STALLED Package Execution (retry / mark sent / refund)" })
  async adminResolveExecution(
    @Param("executionId") executionId: string,
    @Body() body: { action: "RETRY" | "MARK_SENT" | "REFUND"; providerOrderId?: string; reason?: string }
  ) {
    if (!body || !body.action) {
      throw new BadRequestException("action is required ('RETRY' | 'MARK_SENT' | 'REFUND').");
    }
    return this.packagesService.adminResolveExecution(executionId, body.action, body);
  }

  @Get("admin/executions/queue")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Queue: List, filter and monitor package executions (safe pagination)" })
  async getAdminExecutionsQueue(
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    return this.packagesService.getAdminExecutionsQueue({
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
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

  @Post(":id/report-problem")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Report Problem with Package (Creates High-Priority Support Ticket)" })
  async reportProblem(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
    @Body() body: { issue: string; description: string }
  ) {
    return this.packagesService.reportProblem(user.id, id, body);
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

  @Post(":id/executions/:executionId/reschedule")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Reschedule an eligible pending package execution" })
  async rescheduleExecution(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
    @Param("executionId") executionId: string,
    @Body() body: unknown
  ) {
    const parseRes = RescheduleExecutionInputSchema.safeParse(body);
    if (!parseRes.success) {
      const err = parseRes.error.errors[0]?.message || "Invalid reschedule payload";
      throw new BadRequestException(err);
    }
    return this.packagesService.rescheduleExecution(user.id, id, executionId, parseRes.data);
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
    const key = idempotencyKey || body.idempotencyKey || `trig_${Date.now()}_${randomBytes(4).toString("hex")}`;
    return this.packagesService.triggerStart(
      user.id,
      id,
      { url: body.url, mediaType: body.mediaType, rules: [] },
      key
    );
  }

  @Post(":id/triggers/:tid/swap-link")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Swap Link for Scheduled Trigger Executions (Max 2)" })
  async swapTriggerLink(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
    @Param("tid") tid: string,
    @Body() body: { newTargetUrl: string }
  ) {
    if (!body?.newTargetUrl) {
      throw new BadRequestException("newTargetUrl is required.");
    }
    return this.packagesService.swapTriggerLink(user.id, id, tid, body);
  }

  @Post(":id/speed-up")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Compress Delivery Interval within Platform Bounds" })
  async speedUpPackage(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
    @Body() body: { speedFactor?: number }
  ) {
    return this.packagesService.speedUpPackage(user.id, id, { speedFactor: body?.speedFactor || 1.2 });
  }

  @Post(":id/comments")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Submit Custom Comments with Content Moderation" })
  async submitCustomComments(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
    @Body() body: { comments: string[]; expectedQuantity: number }
  ) {
    const moderation = this.packagesService.moderateComments(body.comments, body.expectedQuantity);
    if (!moderation.isValid) {
      throw new BadRequestException(moderation.errors.join("; "));
    }
    return { success: true, count: moderation.sanitizedComments.length };
  }

  @Get("bundle/templates")
  @ApiOperation({ summary: "Get Active Admin Preset Bundle Templates" })
  getBundleTemplates() {
    return this.packagesService.getBundleTemplates();
  }

  @Post("bundle/purchase")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Purchase Preset Bundle Template" })
  async purchaseBundle(
    @CurrentUser() user: CurrentUserData,
    @Body() body: { templateId: string; handle: string },
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    if (!body?.templateId || !body?.handle) {
      throw new BadRequestException("templateId and handle are required.");
    }
    return this.packagesService.purchaseBundle(user.id, {
      templateId: body.templateId,
      handle: body.handle,
      idempotencyKey,
    });
  }

  @Post(":id/renew")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Renew Monthly Retainer Package with Explicit Consent" })
  async renewPackage(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
    @Body() body: { explicitConsent: boolean }
  ) {
    return this.packagesService.renewPackage(user.id, id, { explicitConsent: body?.explicitConsent === true });
  }

  @Post(":id/auto-renew")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Configure Auto-Renew Consent for Package Retainer" })
  async setAutoRenew(
    @CurrentUser() user: CurrentUserData,
    @Param("id") id: string,
    @Body() body: { enabled: boolean }
  ) {
    return this.packagesService.setAutoRenew(user.id, id, body?.enabled === true);
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

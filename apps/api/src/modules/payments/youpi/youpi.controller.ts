import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Headers,
  Req,
  UseGuards,
  ForbiddenException,
  BadRequestException
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { YoupiService } from "./youpi.service";
import { CurrentUser, CurrentUserData } from "../../../common/current-user.decorator";
import { JwtAuthGuard } from "../../../common/jwt-auth.guard";
import { PrismaService } from "../../../common/prisma.service";
import { YoupiPilotSettings, maskUtr } from "./youpi.types";

@ApiTags("YouPI UPI Pilot Gateway")
@Controller()
export class YoupiController {
  constructor(
    private readonly youpiService: YoupiService,
    private readonly prisma: PrismaService
  ) {}

  /**
   * Public Webhook Receiver for YouPI Gateway.
   * Preserves raw bytes and verifies timing-safe HMAC-SHA256 signatures.
   */
  @Post("payments/youpi/webhook")
  @ApiOperation({ summary: "Handle authoritative HMAC-signed YouPI payment gateway webhook" })
  async handleWebhook(@Req() req: any, @Headers() headers: Record<string, string>, @Body() body: any) {
    let rawBody: Buffer;
    if (req.rawBody && Buffer.isBuffer(req.rawBody)) {
      rawBody = req.rawBody;
    } else if (typeof req.body === "string") {
      rawBody = Buffer.from(req.body, "utf8");
    } else {
      rawBody = Buffer.from(JSON.stringify(body), "utf8");
    }

    return await this.youpiService.handleWebhookDelivery(rawBody, headers, body);
  }

  /**
   * Check if current user is eligible for YouPI UPI pilot
   */
  @Get("payments/youpi/eligibility")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Check if authenticated user is eligible for YouPI pilot" })
  async checkUserEligibility(@CurrentUser() user: CurrentUserData) {
    if (!user?.id) {
      return { eligible: false, reason: "Authentication required" };
    }
    const settings = await this.youpiService.getSettings();
    const eligibility = await this.youpiService.checkEligibility(user.id);
    return {
      eligible: eligibility.eligible,
      reason: eligibility.reason,
      minAmountRupees: settings.minAmountPaise / 100,
      maxAmountRupees: settings.maxAmountPaise / 100,
      receivingUpiId: settings.receivingUpiIds[0] || "merchant@upi"
    };
  }

  /**
   * User Initiates YouPI Top-up
   */
  @Post("payments/youpi/initiate")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Initiate UPI pilot wallet top-up (Flag-Gated)" })
  async initiateTopUp(
    @CurrentUser() user: CurrentUserData,
    @Body() body: { amount: number }
  ) {
    if (!user?.id) {
      throw new BadRequestException("Authenticated user ID is required.");
    }
    return await this.youpiService.createTopUp(user.id, body.amount);
  }

  /**
   * User Queries Status of their own Top-up
   */
  @Get("payments/youpi/status/:orderRef")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get status timeline and queue position for top-up" })
  async getTopUpStatus(
    @CurrentUser() user: CurrentUserData,
    @Param("orderRef") orderRef: string
  ) {
    const topUp = await this.prisma.youpiTopUp.findUnique({
      where: { orderRef }
    });
    if (!topUp) {
      throw new BadRequestException("Top-up reference not found.");
    }
    // Prevent User B from reading User A's top-up
    if (topUp.userId !== user?.id && user?.role !== "ADMIN") {
      throw new ForbiddenException("Access denied.");
    }

    return {
      orderRef: topUp.orderRef,
      amountRupees: topUp.amountPaise / 100,
      currency: topUp.currency,
      status: topUp.status,
      queuePosition: topUp.queuePosition || 0,
      maskedUtr: maskUtr(topUp.normalizedUtr),
      expiresAt: topUp.expiresAt?.toISOString() || null,
      createdAt: topUp.createdAt.toISOString(),
      creditedAt: topUp.creditedAt?.toISOString() || null
    };
  }

  /**
   * ADMIN: Confirm top-up after bank verification
   */
  @Post("admin/youpi/topups/:id/confirm")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Admin confirm top-up after bank app/statement check" })
  async confirmTopUp(
    @CurrentUser() admin: CurrentUserData,
    @Param("id") id: string,
    @Body() body: { reason: string; idempotencyKey?: string }
  ) {
    if (admin?.role !== "ADMIN") {
      throw new ForbiddenException("Administrative privileges required.");
    }
    return await this.youpiService.confirmTopUp(id, admin.id, body.reason, body.idempotencyKey);
  }

  /**
   * ADMIN: Reject top-up
   */
  @Post("admin/youpi/topups/:id/reject")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Admin reject top-up with reason" })
  async rejectTopUp(
    @CurrentUser() admin: CurrentUserData,
    @Param("id") id: string,
    @Body() body: { reason: string }
  ) {
    if (admin?.role !== "ADMIN") {
      throw new ForbiddenException("Administrative privileges required.");
    }
    return await this.youpiService.rejectTopUp(id, admin.id, body.reason);
  }

  /**
   * ADMIN: Bank Statement CSV Import
   */
  @Post("admin/youpi/statements/import")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Import bank statement CSV and auto-match observed payments" })
  async importStatement(
    @CurrentUser() admin: CurrentUserData,
    @Body() body: { csv: string }
  ) {
    if (admin?.role !== "ADMIN") {
      throw new ForbiddenException("Administrative privileges required.");
    }
    return await this.youpiService.importBankStatement(admin.id, body.csv);
  }

  /**
   * ADMIN: Review Queue & Top-up List
   */
  @Get("admin/youpi/topups")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List YouPI pilot top-ups for review queue" })
  async listTopUps(@CurrentUser() admin: CurrentUserData) {
    if (admin?.role !== "ADMIN") {
      throw new ForbiddenException("Administrative privileges required.");
    }
    const topUps = await this.prisma.youpiTopUp.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        reviews: true,
        observations: true
      }
    });

    return topUps.map(t => ({
      id: t.id,
      userId: t.userId,
      orderRef: t.orderRef,
      amountRupees: t.amountPaise / 100,
      currency: t.currency,
      status: t.status,
      maskedUtr: maskUtr(t.normalizedUtr),
      queuePosition: t.queuePosition,
      expiresAt: t.expiresAt,
      createdAt: t.createdAt,
      creditedAt: t.creditedAt,
      reviews: t.reviews,
      observationCount: t.observations.length
    }));
  }

  /**
   * ADMIN: Daily Reconciliation Report
   */
  @Get("admin/youpi/reports/daily")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Daily payment reconciliation report" })
  async getDailyReport(@CurrentUser() admin: CurrentUserData) {
    if (admin?.role !== "ADMIN") {
      throw new ForbiddenException("Administrative privileges required.");
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [initiated, observed, credited, suspicious, expired] = await Promise.all([
      this.prisma.youpiTopUp.count({ where: { status: "INITIATED", createdAt: { gte: todayStart } } }),
      this.prisma.youpiTopUp.count({ where: { status: "OBSERVED", createdAt: { gte: todayStart } } }),
      this.prisma.youpiTopUp.count({ where: { status: "CREDITED", createdAt: { gte: todayStart } } }),
      this.prisma.youpiTopUp.count({ where: { status: "SUSPICIOUS", createdAt: { gte: todayStart } } }),
      this.prisma.youpiTopUp.count({ where: { status: "EXPIRED", createdAt: { gte: todayStart } } })
    ]);

    const creditedVolume = await this.prisma.youpiTopUp.aggregate({
      where: { status: "CREDITED", createdAt: { gte: todayStart } },
      _sum: { amountPaise: true }
    });

    return {
      date: todayStart.toISOString().slice(0, 10),
      summary: {
        initiated,
        observed,
        credited,
        suspicious,
        expired,
        creditedRupees: (creditedVolume._sum.amountPaise || 0) / 100
      }
    };
  }

  /**
   * ADMIN: Get Settings
   */
  @Get("admin/youpi/settings")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get YouPI pilot settings and caps" })
  async getSettings(@CurrentUser() admin: CurrentUserData) {
    if (admin?.role !== "ADMIN") {
      throw new ForbiddenException("Administrative privileges required.");
    }
    return await this.youpiService.getSettings();
  }

  /**
   * ADMIN: Update Settings
   */
  @Put("admin/youpi/settings")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Update YouPI pilot settings and caps" })
  async updateSettings(
    @CurrentUser() admin: CurrentUserData,
    @Body() body: Partial<YoupiPilotSettings>
  ) {
    if (admin?.role !== "ADMIN") {
      throw new ForbiddenException("Administrative privileges required.");
    }
    return await this.youpiService.updateSettings(body, admin.id);
  }

  /**
   * ADMIN: Record Pilot Acknowledgement
   */
  @Post("admin/youpi/acknowledge")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Record compliance and bank review pilot acknowledgement" })
  async acknowledge(
    @CurrentUser() admin: CurrentUserData,
    @Body() body: { statement: string }
  ) {
    if (admin?.role !== "ADMIN") {
      throw new ForbiddenException("Administrative privileges required.");
    }
    return await this.youpiService.recordAcknowledgement(admin.id, body.statement);
  }
}


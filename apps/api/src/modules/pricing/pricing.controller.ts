import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PricingService } from "./pricing.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { Role } from "@prisma/client";
import {
  calculateSellingRate,
  calculateOrderFinancialSnapshot,
  DEFAULT_PRICING_SETTINGS,
} from "@smm/contracts";
import { Decimal } from "decimal.js";

@ApiTags("Admin Pricing & Profit Engine")
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get("pricing/settings")
  @ApiOperation({ summary: "Get Global Pricing Engine Settings" })
  async getSettings() {
    return this.pricingService.getSettings();
  }

  @Put("pricing/settings")
  @ApiOperation({ summary: "Update Global Pricing Engine Settings" })
  async updateSettings(@Body() body: any) {
    return this.pricingService.updateSettings(body);
  }

  @Post("pricing/what-if")
  @ApiOperation({ summary: "Interactive Pricing What-If Simulator" })
  async whatIfSimulator(
    @Body()
    body: {
      costINR: number;
      quantity?: number;
      marginOverride?: number;
      fixedSellingRate?: number;
    }
  ) {
    const settings = await this.pricingService.getSettings();
    const qty = body.quantity || 1000;

    const pricing = calculateSellingRate(body.costINR, {
      settings,
      marginPercentOverride: body.marginOverride,
      fixedSellingRateOverride: body.fixedSellingRate,
    });

    const snapshot = calculateOrderFinancialSnapshot(
      pricing.sellingRate,
      body.costINR,
      qty,
      1,
      0,
      settings.paymentFeePercent
    );

    return {
      costINR: body.costINR,
      quantity: qty,
      sellingRatePer1k: pricing.sellingRate.toNumber(),
      appliedMarginPercent: pricing.appliedMarginPercent,
      isBelowCost: pricing.isBelowCost,
      warning: pricing.warning,
      customerCharge: snapshot.customerCharge.toNumber(),
      estimatedProviderCost: snapshot.estimatedProviderCost.toNumber(),
      estimatedGrossProfit: snapshot.estimatedGrossProfit.toNumber(),
      paymentFeeEstimate: snapshot.paymentFeeEstimate.toNumber(),
      estimatedNetProfit: snapshot.estimatedNetProfit.toNumber(),
      netMarginPercent: snapshot.netMarginPercent,
    };
  }

  @Get("pricing/pending")
  @ApiOperation({ summary: "List Pending Price Changes Awaiting Approval" })
  async getPendingChanges() {
    return this.pricingService.getPendingPriceChanges();
  }

  @Post("pricing/pending/:id/approve")
  @ApiOperation({ summary: "Approve a Pending Price Fluctuated Service" })
  async approvePending(@Param("id") id: string) {
    return this.pricingService.approvePendingPriceChange(id);
  }

  @Post("pricing/pending/:id/reject")
  @ApiOperation({ summary: "Reject a Pending Price Fluctuated Service" })
  async rejectPending(@Param("id") id: string) {
    return this.pricingService.rejectPendingPriceChange(id);
  }

  @Post("pricing/bulk-margin")
  @ApiOperation({ summary: "Preview or Apply Bulk Margin Rules" })
  async bulkMargin(
    @Body()
    body: {
      platform?: string;
      categoryId?: string;
      marginPercent: number;
      previewOnly?: boolean;
    }
  ) {
    return this.pricingService.previewOrApplyBulkMargin(body);
  }

  @Get("profit/summary")
  @ApiOperation({ summary: "Get Executive Profit and Financial Telemetry" })
  async getProfitSummary(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("dripFeedOnly") dripFeedOnly?: string
  ) {
    return this.pricingService.getProfitSummary(
      startDate,
      endDate,
      dripFeedOnly === "true" || dripFeedOnly === "1"
    );
  }
}

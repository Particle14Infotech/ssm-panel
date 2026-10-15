import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { WalletService } from "./wallet.service";
import { Decimal } from "decimal.js";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { CurrentUser, CurrentUserData } from "../../common/current-user.decorator";
import { Role } from "@prisma/client";

@ApiTags("Wallet & Billing")
@Controller("wallet")
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get("balance")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get Live Liquid Balance" })
  async getBalance(
    @CurrentUser() user?: CurrentUserData | string,
    @Query("userId") queryUserId?: string
  ) {
    const targetUserId = typeof user === "string" ? user : (user?.role === "ADMIN" && queryUserId ? queryUserId : (user?.id || queryUserId || "none"));
    const tier = typeof user === "object" ? user?.tier : "PRO_SCALE";
    try {
      const live = await this.walletService.getBalance(targetUserId);
      return {
        ...live,
        tier: tier || "PRO_SCALE",
        threshold: 500.0,
        autoRefill: false,
      };
    } catch {
      return {
        userId: targetUserId,
        balance: 0,
        currency: "INR",
        tier: tier || "PRO_SCALE",
        threshold: 500.0,
        autoRefill: false,
      };
    }
  }

  @Get("ledger")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get Double-Entry Ledger History" })
  async getLedger(
    @CurrentUser() user?: CurrentUserData | string,
    @Query("userId") queryUserId?: string
  ) {
    const targetUserId = typeof user === "string" ? user : (user?.role === "ADMIN" && queryUserId ? queryUserId : (user?.id || queryUserId || "none"));
    return await this.walletService.getLedger(targetUserId);
  }

  @Post("adjust")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Admin Balance Adjustment (Mandatory Reason Required)" })
  async adjustBalance(
    @Body() body: { userId: string; amount: number; reason: string }
  ) {
    if (!body.userId) {
      throw new BadRequestException("Target userId is required.");
    }
    if (!body.reason || body.reason.trim().length === 0) {
      throw new BadRequestException("A valid non-empty reason is mandatory for administrative balance adjustments.");
    }
    return await this.walletService.adjustBalance(
      body.userId,
      new Decimal(body.amount),
      body.reason
    );
  }

  @Post("deposit")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Initialize Liquidity Deposit (Sandbox Only, Disabled in Production)" })
  deposit(
    @Body() body: { amount: number; method: string; userId?: string },
    @CurrentUser() user?: CurrentUserData
  ) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_SIMULATED_PAYMENTS !== "true") {
      throw new NotFoundException("POST /wallet/deposit is disabled in production. Use /payments/initiate with verified webhooks.");
    }

    const { amount, method } = body;
    let bonus = 0;
    if (amount >= 5000) bonus = amount * 0.15;
    else if (amount >= 1000) bonus = amount * 0.1;
    else if (amount >= 500) bonus = amount * 0.05;

    return {
      success: true,
      depositId: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
      userId: user?.id || body.userId || "usr_default_demo",
      amount,
      bonus,
      creditedTotal: amount + bonus,
      method,
      status: "SUCCESS",
      referenceId: `REF-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      timestamp: new Date().toISOString(),
    };
  }
}


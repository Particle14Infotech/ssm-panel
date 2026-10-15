import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { WalletService } from "./wallet.service";
import { Decimal } from "decimal.js";

@ApiTags("Wallet & Billing")
@Controller("wallet")
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get("balance")
  @ApiOperation({ summary: "Get Live Liquid Balance" })
  async getBalance(@Query("userId") userId?: string) {
    const targetUserId = userId || "usr_default_demo";
    try {
      const live = await this.walletService.getBalance(targetUserId);
      return {
        ...live,
        tier: "PRO_SCALE",
        threshold: 500.0,
        autoRefill: true,
      };
    } catch {
      return {
        balance: 2450.0,
        currency: "INR",
        tier: "PRO_SCALE",
        threshold: 500.0,
        autoRefill: true,
      };
    }
  }

  @Get("ledger")
  @ApiOperation({ summary: "Get Double-Entry Ledger History" })
  async getLedger(@Query("userId") userId?: string) {
    const targetUserId = userId || "usr_default_demo";
    return await this.walletService.getLedger(targetUserId);
  }

  @Post("adjust")
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
  @ApiOperation({ summary: "Initialize Liquidity Deposit (Sandbox Only, Disabled in Production)" })
  deposit(@Body() body: { amount: number; method: string; userId?: string }) {
    if (process.env.NODE_ENV === "production") {
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

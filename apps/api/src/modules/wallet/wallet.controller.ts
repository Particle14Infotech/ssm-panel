import { Controller, Get, Post, Body } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";

@ApiTags("Wallet & Billing")
@Controller("wallet")
export class WalletController {
  @Get("balance")
  @ApiOperation({ summary: "Get Live Liquid Balance" })
  getBalance() {
    return {
      balance: 2450.0,
      currency: "INR",
      tier: "PRO_SCALE",
      threshold: 500.0,
      autoRefill: true,
    };
  }

  @Post("deposit")
  @ApiOperation({ summary: "Initialize Liquidity Deposit" })
  deposit(@Body() body: { amount: number; method: string }) {
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

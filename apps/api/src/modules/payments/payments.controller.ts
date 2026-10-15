import { Controller, Get, Post, Body, Headers, Query, NotFoundException } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";

@ApiTags("Payments & Webhooks")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("initiate")
  @ApiOperation({ summary: "Initiate Liquidity Deposit Session" })
  async initiate(
    @Body() body: { userId: string; amount: number; method?: string; couponCode?: string }
  ) {
    return await this.paymentsService.initiate(body);
  }

  @Post("webhook")
  @ApiOperation({ summary: "Process Verified Payment Gateway Webhook" })
  async webhook(
    @Headers("x-razorpay-signature") razorpaySignature: string,
    @Headers("x-webhook-signature") genericSignature: string,
    @Body() payload: any
  ) {
    const signature = razorpaySignature || genericSignature || payload?.signature;
    return await this.paymentsService.handleWebhook(signature, payload);
  }

  @Post("sandbox-complete")
  @ApiOperation({ summary: "Simulate Payment Completion (Sandbox Only, Disabled in Production)" })
  async sandboxComplete(@Body() body: { gatewayOrderId: string }) {
    if (process.env.NODE_ENV === "production") {
      throw new NotFoundException("Sandbox completion endpoint is disabled in production.");
    }
    return await this.paymentsService.sandboxComplete(body.gatewayOrderId);
  }

  @Get()
  @ApiOperation({ summary: "List User or System Payments" })
  async findAll(@Query("userId") userId?: string) {
    return await this.paymentsService.findAll(userId);
  }
}

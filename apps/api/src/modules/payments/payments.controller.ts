import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PaymentsService } from "./payments.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { CurrentUser, CurrentUserData } from "../../common/current-user.decorator";

@ApiTags("Payments & Webhooks")
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("create-order")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Create Payment Order (paise/rupees)" })
  async createOrder(
    @Body() body: { amount: number; idempotencyKey?: string },
    @CurrentUser() user: CurrentUserData
  ) {
    if (!user?.id) {
      throw new BadRequestException("Authenticated user ID is required.");
    }
    return await this.paymentsService.createPaymentOrder({
      userId: user.id,
      amount: body.amount,
      idempotencyKey: body.idempotencyKey,
    });
  }

  @Post("initiate")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Initiate Liquidity Deposit Session (Canonical/Legacy)" })
  async initiate(
    @Body() body: { amount: number; method?: string; couponCode?: string; userId?: string },
    @CurrentUser() user?: CurrentUserData
  ) {
    const effectiveUserId = user?.id || body.userId;
    if (!effectiveUserId) {
      throw new BadRequestException("Authenticated user ID is required.");
    }
    return await this.paymentsService.createPaymentOrder({
      userId: effectiveUserId,
      amount: body.amount,
    });
  }

  @Post("verify")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Server-Side Verify Payment and Credit Wallet" })
  async verifyPayment(
    @Body()
    body: {
      orderId: string;
      paymentId: string;
      signature?: string;
      method?: string;
      testOutcome?: "success" | "failure";
    },
    @CurrentUser() user: CurrentUserData
  ) {
    if (!user?.id) {
      throw new BadRequestException("Authenticated user ID is required.");
    }
    return await this.paymentsService.verifyPayment({
      ...body,
      userId: user.id,
    });
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
  @ApiOperation({ summary: "Simulate Payment Completion" })
  async sandboxComplete(@Body() body: { gatewayOrderId: string }) {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_SIMULATED_PAYMENTS !== "true") {
      throw new NotFoundException("Sandbox completion endpoint is disabled in production.");
    }
    return await this.paymentsService.sandboxComplete(body.gatewayOrderId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "List User or System Payments" })
  async findAll(
    @CurrentUser() user?: CurrentUserData | string,
    @Query("userId") queryUserId?: string
  ) {
    const effectiveUserId = typeof user === "string" ? user : (user?.id || queryUserId);
    const role = typeof user === "object" ? user?.role : undefined;
    return await this.paymentsService.findAll(effectiveUserId, role);
  }
}

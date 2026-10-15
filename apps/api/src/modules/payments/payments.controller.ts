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

  @Post("initiate")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Initiate Liquidity Deposit Session" })
  async initiate(
    @Body() body: { amount: number; method?: string; couponCode?: string; userId?: string },
    @CurrentUser() user?: CurrentUserData
  ) {
    const effectiveUserId = user?.id || body.userId;
    if (!effectiveUserId) {
      throw new BadRequestException("Authenticated user ID is required.");
    }
    return await this.paymentsService.initiate({
      ...body,
      userId: effectiveUserId,
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
  @ApiOperation({ summary: "Simulate Payment Completion (Sandbox Only, Disabled in Production)" })
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


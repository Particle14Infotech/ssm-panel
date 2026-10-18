import {
  Controller,
  Post,
  Get,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
  Headers,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { EmailService } from "./email.service";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { RolesGuard, Roles } from "../../common/roles.guard";
import { Role } from "@prisma/client";
import { Request, Response } from "express";

@ApiTags("Email Webhooks & Admin Telemetry")
@Controller()
export class EmailController {
  constructor(private emailService: EmailService) {}

  @Post("webhooks/resend")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Resend Inbound Webhook Listener (Delivered, Bounced, Complained)" })
  @ApiResponse({ status: 200, description: "Webhook event processed" })
  @ApiResponse({ status: 400, description: "Invalid webhook signature or expired timestamp" })
  async handleResendWebhook(
    @Req() req: Request,
    @Res() res: Response,
    @Headers() headers: Record<string, string>
  ) {
    // In express, if body-parser has already parsed json, reconstruct or use raw body
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    const isValid = this.emailService.verifyWebhookSignature(rawBody, headers);
    if (!isValid) {
      throw new BadRequestException("Invalid webhook signature or timestamp expired.");
    }

    const event = req.body;
    const result = await this.emailService.handleWebhookEvent(event);

    return res.status(HttpStatus.OK).json({
      success: true,
      result,
    });
  }

  @Get("admin/email/telemetry")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: "Get Email Service Telemetry & Quota Status" })
  @ApiResponse({ status: 200, description: "Email telemetry returned" })
  async getEmailTelemetry() {
    return this.emailService.getEmailTelemetry();
  }
}

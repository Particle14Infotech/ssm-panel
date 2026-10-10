import { Controller, Post, Body, Get, Headers, UnauthorizedException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

@ApiTags("Authentication & Security")
@Controller("auth")
export class AuthController {
  @Post("login")
  @ApiOperation({ summary: "Customer & Admin Login" })
  async login(@Body() body: any) {
    const { email, password } = body;
    if (!email || !password) {
      throw new UnauthorizedException("Invalid credentials provided.");
    }
    return {
      success: true,
      token: "jwt_aether_" + Buffer.from(email).toString("base64"),
      user: {
        id: "usr_998124aether",
        email,
        name: "Alex Vance",
        tier: "PRO_SCALE",
        balance: 2450.0,
      },
    };
  }

  @Post("register")
  @ApiOperation({ summary: "Register New Account" })
  async register(@Body() body: any) {
    const { email, name } = body;
    return {
      success: true,
      message: "Account provisioned. Verification OTP dispatched via AP-S1 node.",
      userId: `usr_${Math.floor(100000 + Math.random() * 900000)}`,
    };
  }

  @Get("verify-key")
  @ApiOperation({ summary: "Verify Bearer API Token" })
  async verifyKey(@Headers("authorization") authHeader?: string) {
    if (!authHeader || !authHeader.startsWith("Bearer aeth_")) {
      throw new UnauthorizedException("Invalid or revoked API Key.");
    }
    return {
      valid: true,
      nodeZone: "AP-S1_MUMBAI",
      rateLimitPerSec: 150,
      clusterHealth: "OPTIMAL",
    };
  }
}

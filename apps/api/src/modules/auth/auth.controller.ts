import { Controller, Post, Body, Get, Headers } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AuthService } from "./auth.service";

@ApiTags("Authentication & Security")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @ApiOperation({ summary: "Customer & Admin Login" })
  async login(@Body() body: any) {
    return this.authService.login(body);
  }

  @Post("register")
  @ApiOperation({ summary: "Register New Account" })
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post("refresh")
  @ApiOperation({ summary: "Rotate Session Token" })
  async refresh(@Body("refreshToken") refreshToken: string) {
    return this.authService.refreshSession(refreshToken);
  }

  @Post("logout")
  @ApiOperation({ summary: "Revoke Current Session or User Sessions" })
  async logout(@Body("refreshToken") refreshToken?: string, @Body("userId") userId?: string) {
    return this.authService.logout(refreshToken, userId);
  }

  @Post("forgot-password")
  @ApiOperation({ summary: "Request Password Reset" })
  async forgotPassword(@Body("email") email: string) {
    return this.authService.forgotPassword(email);
  }

  @Post("reset-password")
  @ApiOperation({ summary: "Reset Password via Verified Token" })
  async resetPassword(@Body() body: { token: string; newPassword: string; email?: string }) {
    return this.authService.resetPassword(body);
  }

  @Post("verify-email")
  @ApiOperation({ summary: "Verify Email via Single-Use Token" })
  async verifyEmail(@Body() body: { token: string; email: string }) {
    return this.authService.verifyEmail(body.token, body.email);
  }

  @Post("resend-verification")
  @ApiOperation({ summary: "Resend Email Verification Link" })
  async resendVerification(@Body("email") email: string) {
    return this.authService.resendVerification(email);
  }

  @Post("2fa/setup")
  @ApiOperation({ summary: "Initiate Two-Factor Authentication Setup" })
  async setup2fa(@Body("userId") userId: string) {
    return this.authService.setup2fa(userId);
  }

  @Post("2fa/verify")
  @ApiOperation({ summary: "Verify and Enable Two-Factor Authentication" })
  async verify2fa(@Body() body: { userId: string; code: string }) {
    return this.authService.verify2fa(body.userId, body.code);
  }

  @Get("sessions")
  @ApiOperation({ summary: "List User Active Sessions" })
  async listSessions(@Headers("x-user-id") headerUserId?: string) {
    const userId = headerUserId || "usr_default_demo";
    return this.authService.listSessions(userId);
  }

  @Post("sessions/revoke")
  @ApiOperation({ summary: "Revoke Specific Session" })
  async revokeSession(@Body("sessionId") sessionId: string) {
    return this.authService.revokeSession(sessionId);
  }

  @Get("verify-key")
  @ApiOperation({ summary: "Verify Bearer API Token" })
  async verifyKey(@Headers("authorization") authHeader?: string) {
    return this.authService.verifyKey(authHeader);
  }
}

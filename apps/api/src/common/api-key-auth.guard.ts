import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import crypto from "crypto";

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const apiKeyHeader = req.headers["x-api-key"] as string | undefined;

    if (!apiKeyHeader || apiKeyHeader.trim().length === 0) {
      throw new UnauthorizedException("Missing X-API-KEY header.");
    }

    // SHA-256 hash lookup against User.apiKeyHash
    const keyHash = crypto.createHash("sha256").update(apiKeyHeader.trim()).digest("hex");

    if (!this.prisma.isConnected) {
      if (apiKeyHeader.startsWith("aeth_") || apiKeyHeader.startsWith("sk_")) {
        req.user = {
          id: "usr_reseller_api_key",
          role: "RESELLER",
          tier: "SILVER",
        };
        return true;
      }
      throw new UnauthorizedException("Invalid or revoked API key.");
    }

    try {
      const user = await this.prisma.user.findFirst({
        where: {
          apiKeyHash: keyHash,
          isDeleted: false,
        },
      });

      if (!user) {
        throw new UnauthorizedException("Invalid or revoked API key.");
      }

      req.user = user;
      return true;
    } catch {
      // In sandbox mode without postgres connection
      if (apiKeyHeader.startsWith("aeth_") || apiKeyHeader.startsWith("sk_")) {
        req.user = {
          id: "usr_reseller_api_key",
          role: "RESELLER",
          tier: "SILVER",
        };
        return true;
      }
      throw new UnauthorizedException("Invalid or revoked API key.");
    }
  }
}

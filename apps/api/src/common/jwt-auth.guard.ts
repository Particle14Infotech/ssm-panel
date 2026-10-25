import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import * as jwt from "jsonwebtoken";

import * as crypto from "crypto";

let ephemeralGuardJwtSecret: string | null = null;

function resolveJwtSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new UnauthorizedException("JWT_ACCESS_SECRET must be configured in production.");
    }
    if (!ephemeralGuardJwtSecret) {
      ephemeralGuardJwtSecret = crypto.randomBytes(32).toString("hex");
    }
    return ephemeralGuardJwtSecret;
  }
  return secret;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing or malformed Authorization header.");
    }

    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, resolveJwtSecret()) as any;
      req.user = decoded;
      return true;
    } catch (err: any) {
      throw new UnauthorizedException("Invalid or expired JWT token.");
    }
  }
}

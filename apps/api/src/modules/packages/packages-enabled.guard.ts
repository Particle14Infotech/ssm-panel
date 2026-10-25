import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  ForbiddenException,
} from "@nestjs/common";
import * as jwt from "jsonwebtoken";

import * as crypto from "crypto";

let ephemeralPackagesGuardJwtSecret: string | null = null;

function resolveGuardJwtSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new ServiceUnavailableException("JWT_ACCESS_SECRET must be configured in production.");
    }
    if (!ephemeralPackagesGuardJwtSecret) {
      ephemeralPackagesGuardJwtSecret = crypto.randomBytes(32).toString("hex");
    }
    return ephemeralPackagesGuardJwtSecret;
  }
  return secret;
}

@Injectable()
export class PackagesEnabledGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.PACKAGES_ENABLED !== "true"
    ) {
      throw new ServiceUnavailableException("Package functionality is disabled.");
    }

    const allowlistEnv = process.env.PACKAGES_ALLOWED_USER_IDS;
    if (allowlistEnv && allowlistEnv.trim() !== "" && allowlistEnv.trim() !== "*") {
      const allowedUserIds = allowlistEnv
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      const req = context.switchToHttp().getRequest();
      let userId = req.user?.id || req.user?.sub;

      if (!userId && req.headers?.authorization?.startsWith("Bearer ")) {
        const token = req.headers.authorization.split(" ")[1];
        try {
          const decoded = (jwt.verify(token, resolveGuardJwtSecret()) as any) || (jwt.decode(token) as any);
          userId = decoded?.id || decoded?.sub;
        } catch {
          // Unverified token
        }
      }

      if (!userId || !allowedUserIds.includes(userId)) {
        throw new ForbiddenException(
          "Access to packages is restricted to allowlisted beta users during this rollout phase."
        );
      }
    }

    return true;
  }
}

import { createHash, randomBytes } from "node:crypto";
import { FastifyInstance, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { ApiError } from "./errors";

export interface JwtClaims {
  id?: string;
  sub?: string;
  email?: string;
  role?: string;
  [claim: string]: unknown;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: JwtClaims;
  }
  interface FastifyInstance {
    authenticate(request: FastifyRequest): Promise<JwtClaims>;
    authorize(...roles: string[]): (request: FastifyRequest) => Promise<void>;
  }
}

let developmentSecret: string | undefined;

function jwtSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new ApiError(401, "UNAUTHORIZED", "JWT_ACCESS_SECRET must be configured in production.");
  }
  developmentSecret ??= randomBytes(32).toString("hex");
  return developmentSecret;
}

export function tokenFingerprint(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return createHash("sha256").update(authorization.slice(7)).digest("hex").slice(0, 16);
}

export function registerAuth(app: FastifyInstance): void {
  app.decorate("authenticate", async (request) => {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ")) {
      throw new ApiError(401, "UNAUTHORIZED", "Missing or malformed Authorization header.");
    }
    try {
      const user = jwt.verify(authorization.slice(7), jwtSecret()) as JwtClaims;
      request.user = user;
      return user;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(401, "UNAUTHORIZED", "Invalid or expired JWT token.");
    }
  });

  app.decorate("authorize", (...roles) => async (request) => {
    const user = await app.authenticate(request);
    if (!user.role || !roles.includes(user.role)) {
      throw new ApiError(403, "FORBIDDEN", "Forbidden resource");
    }
  });
}

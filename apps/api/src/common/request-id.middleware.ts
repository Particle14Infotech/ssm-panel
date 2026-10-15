import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const headerId = req.headers["x-request-id"];
    const requestId =
      typeof headerId === "string" && headerId.trim().length > 0
        ? headerId
        : `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;

    req.headers["x-request-id"] = requestId;
    (req as any).id = requestId;
    res.setHeader("X-Request-Id", requestId);

    // Timeout protection header (default 30 seconds)
    const timeoutMs = parseInt(process.env.REQUEST_TIMEOUT_MS || "30000", 10);
    req.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(504).json({
          code: "GATEWAY_TIMEOUT",
          message: "Request processing timed out.",
          requestId,
          timestamp: new Date().toISOString(),
          path: req.url,
        });
      }
    });

    next();
  }
}

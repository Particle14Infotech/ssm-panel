import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: any;
  requestId: string;
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers["x-request-id"] as string) ||
      (request as any).id ||
      `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = "INTERNAL_SERVER_ERROR";
    let message = "An internal server error occurred.";
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
        code = this.statusCodeToCode(status);
      } else if (typeof res === "object" && res !== null) {
        const obj = res as Record<string, any>;
        message = obj.message || exception.message;
        code = obj.code || this.statusCodeToCode(status);
        details = obj.details || (Array.isArray(obj.message) ? obj.message : undefined);
      }
    } else if (exception instanceof Error) {
      // Unhandled server error: redact internal details in production
      this.logger.error(`[${requestId}] Unhandled exception: ${exception.message}`, exception.stack);
      message = process.env.NODE_ENV === "production" ? "Internal server error" : exception.message;
    }

    const errorPayload: ApiErrorResponse = {
      code,
      message: Array.isArray(message) ? message.join(", ") : message,
      details,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorPayload);
  }

  private statusCodeToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return "BAD_REQUEST";
      case HttpStatus.UNAUTHORIZED:
        return "UNAUTHORIZED";
      case HttpStatus.FORBIDDEN:
        return "FORBIDDEN";
      case HttpStatus.NOT_FOUND:
        return "NOT_FOUND";
      case HttpStatus.PAYMENT_REQUIRED:
        return "PAYMENT_REQUIRED";
      case HttpStatus.CONFLICT:
        return "CONFLICT";
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return "UNPROCESSABLE_ENTITY";
      case HttpStatus.TOO_MANY_REQUESTS:
        return "TOO_MANY_REQUESTS";
      case HttpStatus.SERVICE_UNAVAILABLE:
        return "SERVICE_UNAVAILABLE";
      case HttpStatus.GATEWAY_TIMEOUT:
        return "GATEWAY_TIMEOUT";
      default:
        return "INTERNAL_SERVER_ERROR";
    }
  }
}

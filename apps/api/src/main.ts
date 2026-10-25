import * as dotenv from "dotenv";
dotenv.config();

import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { GlobalHttpExceptionFilter } from "./common/http-exception.filter";
import { smmLogger } from "./common/logger";
import { validateEnvironment } from "./config/env.validation";

async function bootstrap() {
  validateEnvironment();

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.WEB_URL,
    "http://localhost:3000",
  ].filter(Boolean) as string[];

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
      credentials: true,
    },
    logger: ["error", "warn", "log"],
  });

  // Enable graceful shutdown hooks for clean process termination
  app.enableShutdownHooks();

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set("trust proxy", 1);
  expressApp.get("/", (_req: any, res: any) => {
    res.status(200).json({
      status: "ok",
      service: "smm-api",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });
  expressApp.get("/health", (_req: any, res: any) => {
    res.status(200).json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.use(helmet());
  app.setGlobalPrefix("api/v1");

  // Global Exception Envelope
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  // Strict Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  // OpenAPI Swagger Documentation Generator
  const config = new DocumentBuilder()
    .setTitle("SMM Panel API")
    .setDescription("Modular Monolith REST API for SMM Services, Orders, Ledger & Resellers")
    .setVersion("1.0.0")
    .addBearerAuth()
    .addApiKey({ type: "apiKey", name: "X-API-KEY", in: "header" }, "reseller-api-key")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port, "0.0.0.0");
  smmLogger.info(`[API] SMM Panel API running on: http://0.0.0.0:${port}/api/v1`);
  smmLogger.info(`[Docs] OpenAPI Spec available at: http://0.0.0.0:${port}/api/docs`);
}

bootstrap();

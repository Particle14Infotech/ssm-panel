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

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: process.env.WEB_URL || "http://localhost:3000",
      credentials: true,
    },
    logger: ["error", "warn", "log"],
  });

  // Enable graceful shutdown hooks for clean process termination
  app.enableShutdownHooks();

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
    .setTitle("AETHER SMM Platform API")
    .setDescription("Modular Monolith REST API for SMM Services, Orders, Ledger & Resellers")
    .setVersion("1.0.0")
    .addBearerAuth()
    .addApiKey({ type: "apiKey", name: "X-API-KEY", in: "header" }, "reseller-api-key")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  smmLogger.info(`🚀 AETHER API running on: http://localhost:${port}/api/v1`);
  smmLogger.info(`📚 OpenAPI Spec available at: http://localhost:${port}/api/docs`);
}

bootstrap();

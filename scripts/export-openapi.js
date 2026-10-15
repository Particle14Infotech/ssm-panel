const { NestFactory } = require("@nestjs/core");
const { SwaggerModule, DocumentBuilder } = require("@nestjs/swagger");
const fs = require("fs");
const path = require("path");

async function exportOpenApi() {
  process.env.NODE_ENV = "test";
  const { AppModule } = require("../apps/api/dist/app.module");

  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix("api/v1");

  const config = new DocumentBuilder()
    .setTitle("SMM PANEL Platform API")
    .setDescription("Modular Monolith REST API for SMM Services, Orders, Ledger & Resellers")
    .setVersion("1.0.0")
    .addBearerAuth()
    .addApiKey({ type: "apiKey", name: "X-API-KEY", in: "header" }, "reseller-api-key")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const outPath = path.resolve(__dirname, "../docs/openapi.json");
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2), "utf8");
  console.log(`[PASS] Exported OpenAPI specification to ${outPath}`);
  await app.close();
}

exportOpenApi().catch((err) => {
  console.error("Failed to export OpenAPI:", err);
  process.exit(1);
});

const path = require("path");
const fs = require("fs");

process.env.NODE_ENV = "test";

const { NestFactory } = require("@nestjs/core");
const { SwaggerModule, DocumentBuilder } = require("@nestjs/swagger");
const appModulePath = fs.existsSync(path.resolve(__dirname, "../dist/src/app.module.js"))
  ? "../dist/src/app.module"
  : "../dist/app.module";
const { AppModule } = require(appModulePath);

async function run() {
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
  const outPath = path.resolve(__dirname, "../../../docs/openapi.json");
  fs.writeFileSync(outPath, JSON.stringify(document, null, 2), "utf8");
  console.log(`[PASS] Exported OpenAPI specification to ${outPath}`);
  console.log(`Paths count: ${Object.keys(document.paths).length}`);
  for (const [p, methods] of Object.entries(document.paths)) {
    for (const m of Object.keys(methods)) {
      console.log(`  ${m.toUpperCase()} ${p}`);
    }
  }
  await app.close();
}

run().catch((err) => {
  console.error("OpenAPI Export Error:", err);
  process.exit(1);
});

import "dotenv/config";
import { buildServer } from "./app";

async function start(): Promise<void> {
  const app = await buildServer();
  const port = Number(process.env.PORT) || 4100;
  const close = async () => {
    await app.close();
    process.exit(0);
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  await app.listen({ host: "0.0.0.0", port });
}

start().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : error}\n`);
  process.exit(1);
});

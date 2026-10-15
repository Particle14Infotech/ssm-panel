import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120000,
  reporter: [
    ["list"],
    ["json", { outputFile: "docs/evidence/playwright-report.json" }],
  ],
  use: {
    baseURL: "http://localhost:3000",
    trace: "on",
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      args: [
        "--enable-webgl",
        "--use-gl=angle",
        "--use-gl=swiftshader",
        "--ignore-gpu-blocklist",
      ],
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
});

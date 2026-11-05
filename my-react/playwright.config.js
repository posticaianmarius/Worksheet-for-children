import { defineConfig } from "@playwright/test";
import process from "node:process";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: process.env.E2E_LIVE_BACKEND ? [] : ["**/live-backend.spec.js"],
  snapshotPathTemplate: "{testDir}/snapshots/{testFilePath}/{arg}{ext}",
  timeout: 45_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --host localhost",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
      },
});

import { defineConfig } from "@playwright/test";
import process from "node:process";
import { shared, liveSpecs } from "./playwright.shared.js";
export default defineConfig({
  ...shared,
  projects: [
    { name: "mocked", testIgnore: liveSpecs, grepInvert: /visual regression/ },
    {
      name: "visual",
      testMatch: "**/redesign.spec.js",
      grep: /visual regression/,
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --host localhost --port 5173 --strictPort",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
      },
});

import { defineConfig } from "@playwright/test";
import { shared, liveSpecs } from "./playwright.shared.js";
import process from "node:process";

if (!process.env.E2E_BASE_URL)
  throw new Error("Use npm run test:live to provision the disposable stack.");
export default defineConfig({
  ...shared,
  workers: 1,
  projects: [{ name: "live", testMatch: liveSpecs }],
});

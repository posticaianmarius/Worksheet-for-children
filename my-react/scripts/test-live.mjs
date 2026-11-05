import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["playwright", "test", "e2e/live-backend.spec.js", "--workers=1"],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, E2E_LIVE_BACKEND: "1" },
  },
);
process.exit(result.status ?? 1);

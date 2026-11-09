import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

for (const script of [
  "test",
  "lint",
  "typecheck",
  "build",
  "check:bundle",
  "test:e2e",
  "test:backend",
  "test:live",
]) {
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", script],
    {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

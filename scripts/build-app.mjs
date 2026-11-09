import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
for (const [command, args, directory] of [
  [
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build"],
    "my-react",
  ],
  [
    process.platform === "win32" ? "mvnw.cmd" : "bash",
    [
      ...(process.platform === "win32" ? [] : ["./mvnw"]),
      "-B",
      "-ntp",
      "-Pwith-frontend",
      "clean",
      "package",
      ...process.argv.slice(2),
    ],
    "backend",
  ],
]) {
  const result = spawnSync(command, args, {
    cwd: root + directory,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

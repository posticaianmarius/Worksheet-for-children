import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const windows = process.platform === "win32";
const result = spawnSync(
  windows ? "mvnw.cmd" : "bash",
  [...(windows ? [] : ["./mvnw"]), "-B", "-ntp", ...process.argv.slice(2)],
  {
    cwd: fileURLToPath(new URL("../backend", import.meta.url)),
    stdio: "inherit",
    shell: windows,
  },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);

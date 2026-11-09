import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = fileURLToPath(new URL("../..", import.meta.url));
const project = "playsheets-qa-" + randomUUID().slice(0, 8);
const env = { ...process.env, PLAY_SHEETS_TEST_IMAGE: process.env.PLAY_SHEETS_TEST_IMAGE || project + "-app" };
const compose = ["compose", "-f", "compose.test.yml", "-p", project];
let child;
function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let output = "";
    child = spawn(command, args, {
      cwd: root,
      env,
      stdio: options.capture ? ["ignore", "pipe", "inherit"] : "inherit",
      ...options,
    });
    child.stdout?.on("data", (chunk) => {
      output += chunk;
    });
    child.once("error", reject);
    child.once("exit", (code, signal) =>
      code === 0
        ? resolve(output.trim())
        : reject(new Error(`${command} exited with ${signal ?? code}`)),
    );
  });
}
const interrupt = () => child?.kill("SIGINT");
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);
try {
  await run("docker", [
    ...compose,
    "up",
    process.env.PLAY_SHEETS_TEST_IMAGE ? "--no-build" : "--build",
    "--detach",
    "--wait",
    "--wait-timeout",
    "300",
  ]);
  const address = await run("docker", [...compose, "port", "app", "8080"], {
    capture: true,
  });
  const baseURL = "http://" + address;
  const response = await fetch(baseURL + "/");
  if (!response.ok || !(await response.text()).includes('id="root"'))
    throw new Error("Packaged frontend is missing.");
  await run(
    process.execPath,
    [
      "my-react/node_modules/@playwright/test/cli.js",
      "test",
      "--config",
      "my-react/playwright.live.config.js",
    ],
    {
      env: { ...process.env, E2E_BASE_URL: baseURL },
    },
  );
} catch (error) {
  console.error(error.message);
  await run("docker", [
    ...compose,
    "logs",
    "--no-color",
    "--tail",
    "100",
  ]).catch(() => {});
  process.exitCode = 1;
} finally {
  // Only this randomly named project's containers and volumes are removed.
  await run("docker", [
    ...compose,
    "down",
    "--volumes",
    "--remove-orphans",
  ]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  process.off("SIGINT", interrupt);
  process.off("SIGTERM", interrupt);
}

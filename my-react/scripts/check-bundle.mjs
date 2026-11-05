import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gzipSync } from "node:zlib";
const directory = resolve(
  process.argv[2] ?? "../backend/src/main/resources/static",
);
const manifest = JSON.parse(
  readFileSync(resolve(directory, ".vite/manifest.json"), "utf8"),
);
const visited = new Set();
function add(key) {
  if (visited.has(key)) return;
  visited.add(key);
  for (const dependency of manifest[key]?.imports ?? []) add(dependency);
}
const entry = Object.keys(manifest).find((key) => manifest[key].isEntry);
const publicPage = Object.keys(manifest).find((key) =>
  key.endsWith("features/auth/PublicEntry.tsx"),
);
if (!entry || !publicPage)
  throw new Error("Missing public build entry in the Vite manifest.");
add(entry);
add(publicPage);
const files = new Set(
  [...visited]
    .map((key) => manifest[key].file)
    .filter((file) => file.endsWith(".js")),
);
const bytes = [...files].reduce(
  (sum, file) => sum + gzipSync(readFileSync(resolve(directory, file))).length,
  0,
);
if (
  [...files].some((file) =>
    /Editor-|SettingsInspector|LetterEditor|MatchingEditor/.test(file),
  )
)
  throw new Error("Teacher authoring code leaked into public entry.");
console.log(
  "Public entry JavaScript: " +
    (bytes / 1024).toFixed(1) +
    " KiB gzip across " +
    files.size +
    " chunks (budget: 180 KiB).",
);
if (bytes > 180 * 1024)
  throw new Error("The public entry exceeds its JavaScript budget.");

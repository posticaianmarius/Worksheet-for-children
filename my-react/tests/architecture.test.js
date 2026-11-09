import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../src", import.meta.url));
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(resolve(directory, entry.name))
      : [resolve(directory, entry.name)],
  );
}
// These are deliberate feature contracts, not catch-all export barrels.
const publicEntries = new Set([
  "assignments/Sharing",
  "assignments/TeacherAssignments",
  "assignments/Results",
  "assignments/AssignmentLauncher",
  "spaces/SpaceContext",
  "spaces/StudentAccess",
  "spaces/StudentPicker",
  "spaces/invitation-state",
  "catalog/Photos",
]);
test("source modules respect ownership and use declared feature entrypoints", () => {
  const failures = [];
  for (const file of files(root).filter((path) =>
    /\.(ts|tsx|js)$/.test(path),
  )) {
    const owner = relative(root, file).split(sep);
    if (file.endsWith(".js"))
      failures.push(`${file}: active source must be typed`);
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    function inspect(node) {
      const specifier =
        ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) &&
              node.expression.kind === ts.SyntaxKind.ImportKeyword
            ? node.arguments[0]
            : null;
      if (
        specifier &&
        ts.isStringLiteral(specifier) &&
        specifier.text.startsWith(".")
      ) {
        const target = relative(
          root,
          resolve(dirname(file), specifier.text),
        ).split(sep);
        if (
          (owner[0] === "shared" || owner[0] === "games") &&
          ["app", "features"].includes(target[0])
        )
          failures.push(`${file}: lower module imports ${specifier.text}`);
        if (owner[0] === "features" && target[0] === "app")
          failures.push(`${file}: feature imports application composition`);
        if (
          owner[0] === "games" &&
          target[0] === "shared" &&
          /^(http|query|mutations|resource)$/.test(target[1])
        )
          failures.push(`${file}: game imports persistence`);
        if (
          owner[0] === "features" &&
          target[0] === "features" &&
          owner[1] !== target[1]
        ) {
          const entry = target
            .slice(1)
            .join("/")
            .replace(/\.(ts|tsx)$/, "");
          if (!entry.endsWith("/api") && !publicEntries.has(entry))
            failures.push(`${file}: undeclared feature entry ${entry}`);
        }
      }
      ts.forEachChild(node, inspect);
    }
    inspect(source);
  }
  assert.deepEqual(failures, []);
});

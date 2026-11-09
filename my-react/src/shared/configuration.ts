import type { Configuration } from "./types.ts";
type Container = { [key: string]: unknown } | unknown[];
export function imagePaths(configuration: Configuration, pointer: string) {
  const parts = pointer.split("/").slice(1);
  const matches: { path: (string | number)[]; value: unknown }[] = [];
  function visit(
    value: unknown,
    index: number,
    actualPath: (string | number)[],
  ) {
    if (index === parts.length) {
      matches.push({ path: actualPath, value });
      return;
    }
    const part = parts[index];
    if (part === "*") {
      if (Array.isArray(value))
        value.forEach((entry, entryIndex) =>
          visit(entry, index + 1, [...actualPath, entryIndex]),
        );
    } else {
      visit(
        value && typeof value === "object"
          ? (value as Record<string, unknown>)[part]
          : undefined,
        index + 1,
        [...actualPath, part],
      );
    }
  }
  visit(configuration, 0, []);
  return matches;
}
export function setAtPath(
  configuration: Configuration,
  path: (string | number)[],
  value: unknown,
) {
  const next = structuredClone(configuration);
  let cursor: Container = next;
  path.slice(0, -1).forEach((key, index) => {
    const object = cursor as Record<string | number, unknown>;
    object[key] ??= typeof path[index + 1] === "number" ? [] : {};
    cursor = object[key] as Container;
  });
  (cursor as Record<string | number, unknown>)[path.at(-1)!] = value;
  return next;
}

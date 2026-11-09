import { useState } from "react";
import { sortRows } from "./sorting-model";
export function useSort<T>(
  initial: string,
  values: Record<string, (row: T) => unknown>,
  language: string,
  initialDirection: "asc" | "desc" = "asc",
) {
  const [key, setKey] = useState(initial),
    [direction, setDirection] = useState<"asc" | "desc">(initialDirection);
  return {
    key,
    direction,
    toggle: (next: string) => {
      setDirection((current) =>
        next === key ? (current === "asc" ? "desc" : "asc") : "asc",
      );
      setKey(next);
    },
    rows: (rows: T[]) =>
      sortRows(rows, values[key], direction, language, (row: T) =>
        "id" in (row as object)
          ? (row as { id: number }).id
          : JSON.stringify(row),
      ) as T[],
  };
}
export function percentage(score?: number | null, max?: number | null) {
  return score == null || !max ? null : (score / max) * 100;
}
export function timestamp(value?: string | null) {
  return value ? Date.parse(value) : null;
}

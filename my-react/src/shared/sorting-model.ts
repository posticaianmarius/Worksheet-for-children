export function scorePercent(
  score: number | null | undefined,
  maximum: number | null | undefined,
) {
  if (score == null || maximum == null) return null;
  return maximum > 0 ? (100 * score) / maximum : 0;
}

export function dateValue(value: string) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

// Missing results stay last in either direction. Copy before sorting resource data.
export function sortRows<T>(
  rows: T[],
  value: (row: T) => unknown,
  direction = "asc",
  language = "ro",
  key: (row: T) => unknown = (row) => (row as { id?: number | string }).id,
) {
  const collator = new Intl.Collator(language, {
    numeric: true,
    sensitivity: "base",
  });
  const compare = (a: unknown, b: unknown) =>
    typeof a === "number" && typeof b === "number"
      ? a - b
      : collator.compare(String(a), String(b));
  return [...rows].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    const missingLeft = left == null;
    const missingRight = right == null;
    if (missingLeft !== missingRight) return missingLeft ? 1 : -1;
    const result = missingLeft ? 0 : compare(left, right);
    return (direction === "desc" ? -result : result) || compare(key(a), key(b));
  });
}

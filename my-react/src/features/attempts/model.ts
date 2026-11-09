export function remainingItems<
  T extends { id: number; orderIndex: number },
>(attempt: { items: T[]; results: { revisionItemId: number }[] }) {
  const saved = new Set(attempt.results.map((result) => result.revisionItemId));
  return [...attempt.items]
    .sort((first, second) => first.orderIndex - second.orderIndex)
    .filter((item) => !saved.has(item.id));
}

import type { ReportRow } from "../../shared/types";
export interface Delivery {
  id: string;
  rows: ReportRow[];
  first: ReportRow;
  completed: number;
  removed: boolean;
}
export function deliveries(rows: ReportRow[]): Delivery[] {
  const groups = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const id = row.batchId ?? `legacy-${row.classroomId}-${row.revisionId}`;
    groups.set(id, [...(groups.get(id) ?? []), row]);
  }
  return [...groups.entries()].map(([id, entries]) => ({
    id,
    rows: entries,
    first: entries[0],
    completed: entries.filter((row) => row.completedAt).length,
    removed: entries.every((row) => row.removedAt),
  }));
}

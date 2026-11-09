import type { Worksheet } from "../../shared/types";

export type LibraryFilter = "all" | "with-activities" | "empty";
export interface WorksheetAction {
  kind: "rename" | "delete";
  sheet: Worksheet;
  returnFocus: HTMLElement | null;
}
export type WorksheetManagementResult =
  | { kind: "rename"; sheet: Worksheet; message: string }
  | { kind: "delete"; id: number; message: string };
export function libraryFilter(value: string | null): LibraryFilter {
  return value === "empty" || value === "with-activities" ? value : "all";
}
export function activityCount(sheet: Worksheet) {
  return sheet.items?.length ?? 0;
}
export function worksheetDate(sheet: Worksheet) {
  const value = Date.parse(sheet.updatedAt ?? "");
  return Number.isFinite(value) ? value : null;
}
function searchable(value: string, language: string) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase(language)
    .trim();
}
export function visibleWorksheets(
  sheets: Worksheet[],
  search: string,
  filter: LibraryFilter,
  sort: string,
  language: string,
) {
  const phrase = searchable(search, language);
  const collator = new Intl.Collator(language, {
    numeric: true,
    sensitivity: "base",
  });
  return sheets
    .filter(
      (sheet) =>
        searchable(sheet.name, language).includes(phrase) &&
        (filter === "all" ||
          (activityCount(sheet) > 0
            ? filter === "with-activities"
            : filter === "empty")),
    )
    .sort((a, b) => {
      const names = collator.compare(a.name, b.name) || a.id - b.id;
      if (sort === "name") return names;
      const left = worksheetDate(a),
        right = worksheetDate(b);
      if ((left === null) !== (right === null)) return left === null ? 1 : -1;
      return (right ?? 0) - (left ?? 0) || names;
    });
}

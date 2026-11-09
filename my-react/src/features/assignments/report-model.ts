import type { Classroom, ReportRow } from "../../shared/types";
interface WorksheetRows extends ReportRow {
  id: string;
  rows: ReportRow[];
}
interface ClassRows {
  id: string;
  name: string;
  worksheets: Map<string, WorksheetRows>;
}
export function groupAssignmentReport(classes: Classroom[], rows: ReportRow[]) {
  const groups = new Map<string, ClassRows>(
    classes.map((classroom) => [
      String(classroom.id),
      { id: String(classroom.id), name: classroom.name, worksheets: new Map() },
    ]),
  );
  for (const row of rows) {
    const classId =
      row.classroomId == null ? "direct" : String(row.classroomId);
    if (!groups.has(classId))
      groups.set(classId, {
        id: classId,
        name: row.classroomName,
        worksheets: new Map(),
      });
    const classroom = groups.get(classId)!;
    const revisionId = String(row.revisionId);
    if (!classroom.worksheets.has(revisionId))
      classroom.worksheets.set(revisionId, {
        ...row,
        id: revisionId,
        rows: [],
      });
    classroom.worksheets.get(revisionId)!.rows.push(row);
  }
  return [...groups.values()].map((classroom) => ({
    ...classroom,
    worksheets: [...classroom.worksheets.values()]
      .map((worksheet) => {
        const students = new Map<number, ReportRow[]>();
        for (const row of worksheet.rows) {
          if (!students.has(row.userId)) students.set(row.userId, []);
          students.get(row.userId)!.push(row);
        }
        const recipients = [...students.values()].map((entries) => {
          const active = entries.filter((entry) => !entry.revokedAt);
          const relevant = active.length ? active : entries;
          const latest = [...relevant].sort(
            (a, b) =>
              Date.parse(b.assignedAt) - Date.parse(a.assignedAt) ||
              b.assignmentId - a.assignmentId,
          )[0];
          const completed = relevant
            .filter((entry) => entry.completedAt)
            .sort(
              (a, b) =>
                Date.parse(b.completedAt!) - Date.parse(a.completedAt!) ||
                (b.attemptId ?? b.assignmentId) -
                  (a.attemptId ?? a.assignmentId),
            )[0];
          return {
            ...latest,
            status: !active.length
              ? "REVOKED"
              : completed
                ? "COMPLETED"
                : relevant.some((entry) => entry.status === "IN_PROGRESS")
                  ? "IN_PROGRESS"
                  : latest.status,
            totalScore: completed?.totalScore ?? null,
            maxScore: completed?.maxScore ?? null,
            completedAt: completed?.completedAt ?? null,
            attemptId: completed?.attemptId ?? null,
            assignmentId: completed?.assignmentId ?? latest.assignmentId,
          };
        });
        return {
          ...worksheet,
          removed: worksheet.rows.every((row) => row.removedAt != null),
          recipients,
          completedCount: recipients.filter((entry) => entry.completedAt)
            .length,
        };
      })
      .sort((a, b) => Date.parse(b.assignedAt) - Date.parse(a.assignedAt)),
  }));
}

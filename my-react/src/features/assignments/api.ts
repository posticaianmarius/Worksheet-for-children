import { request } from "../../shared/http";
import { mutationSender } from "../../shared/mutations";
import type { Assignment, Id, ReportRow, Worksheet } from "../../shared/types";
const send = mutationSender([
  "assignments",
  "assignment-detail",
  "deliveries",
  "delivery",
  "results",
  "assignment-report",
  "class-report",
  "student-work",
  "worksheet-choices",
  "student",
  "dashboard",
  "legacy-worksheet",
]);
export const assignmentsApi = {
  share: (id: Id, rotate = false) =>
    send<{ shareCode?: string; code?: string }>(
      "/api/worksheets/" + id + "/share" + (rotate ? "/rotate" : ""),
    ),
  enterGame: (studentCode: string, worksheetCode: string) =>
    send<{ assignmentId: number }>("/api/play/join", "POST", {
      studentCode: studentCode.trim().toUpperCase(),
      worksheetCode: worksheetCode.trim().toUpperCase(),
    }),
  assignments: () => request<Assignment[]>("/api/assignments"),
  assignment: (id: Id) => request<Assignment>("/api/assignments/" + id),
  report: (history = false, classroomId?: string) =>
    request<ReportRow[]>(
      "/api/assignments/report?includeRemoved=" +
        history +
        (classroomId ? "&classroomId=" + classroomId : ""),
    ),
  removeAssignmentGroup: (classId: string, revisionId: Id) =>
    send<void>(
      "/api/assignments/" +
        (classId === "direct" ? "direct" : "classes/" + classId) +
        "/revisions/" +
        revisionId,
      "DELETE",
    ),
  removeAssignmentBatch: (batchId: string) =>
    send<void>("/api/assignments/batches/" + batchId, "DELETE"),
  assignmentPreview: (id: Id) =>
    send<{ revisionId: number; worksheet: Worksheet }>(
      "/api/worksheets/" + id + "/assignments/preview",
    ),
  assign: (
    id: Id,
    body: {
      classroomId?: number;
      userId?: number;
      userIds?: number[];
      title?: string;
      revisionId?: number;
    },
  ) =>
    send<Assignment[]>("/api/worksheets/" + id + "/assignments", "POST", body),
  joinWorksheet: (code: string) =>
    send<{ assignmentId: number }>("/api/worksheets/join", "POST", {
      code: code.trim().toUpperCase(),
    }),
  worksheetChoices: (code: string) =>
    send<
      {
        assignmentId: number;
        batchId: string;
        classroomName: string | null;
        title: string | null;
        worksheetName: string;
        assignedAt: string;
      }[]
    >("/api/worksheets/join/choices", "POST", { code }),
  delivery: (id: string) =>
    request<Assignment[]>("/api/assignments/batches/" + id),
};

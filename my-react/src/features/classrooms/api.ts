import { request } from "../../shared/http";
import { mutationSender } from "../../shared/mutations";
import type { Classroom, Id, Member, StudentTest } from "../../shared/types";
const send = mutationSender([
  "classes",
  "class",
  "class-members",
  "assignment-members",
  "student",
  "legacy-class",
  "dashboard",
  "directory",
  "class-teachers",
  "class-report",
  "student-work",
  "deliveries",
  "results",
  "assignment-report",
  "assignments",
]);
export const classroomsApi = {
  classes: () => request<Classroom[]>("/api/classes"),
  classroom: (id: Id) => request<Classroom>("/api/classes/" + id),
  createClass: (name: string) =>
    send<Classroom>("/api/classes", "POST", { name }),
  joinClass: (joinCode: string) =>
    send<Classroom>("/api/classes/join", "POST", {
      joinCode: joinCode.trim().toUpperCase(),
    }),
  deleteClass: (id: Id) => send<void>("/api/classes/" + id, "DELETE"),
  rotateClass: (id: Id) =>
    send<Classroom>("/api/classes/" + id + "/join-code/rotate"),
  members: (id: Id) => request<Member[]>("/api/classes/" + id + "/members"),
  addStudent: (id: Id, name: string, allowDuplicate = false) =>
    send<Member>("/api/classes/" + id + "/members", "POST", {
      name,
      allowDuplicate,
    }),
  addExistingStudent: (id: Id, studentId: number) =>
    send<Member>("/api/classes/" + id + "/members", "POST", { studentId }),
  student: (id: Id, user: Id) =>
    request<Member>("/api/classes/" + id + "/members/" + user),
  renameStudent: (id: Id, user: Id, name: string) =>
    send<Member>("/api/classes/" + id + "/members/" + user, "PATCH", { name }),
  issueCode: (id: Id, user: Id) =>
    send<Member>("/api/classes/" + id + "/members/" + user + "/code"),
  resetStudentCode: (id: Id, user: Id) =>
    send<Member>("/api/classes/" + id + "/members/" + user + "/code/rotate"),
  removeMember: (id: Id, user: Id) =>
    send<void>("/api/classes/" + id + "/members/" + user, "DELETE"),
  studentTests: (id: Id, user: Id) =>
    request<StudentTest[]>(
      "/api/classes/" + id + "/members/" + user + "/tests",
    ),
  startClassTest: (id: Id, worksheetId: number) =>
    send<{ code: string }>("/api/classes/" + id + "/tests", "POST", {
      worksheetId,
    }),
};

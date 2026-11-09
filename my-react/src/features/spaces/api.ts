import { request } from "../../shared/http";
import { mutationSender } from "../../shared/mutations";
import type {
  AccessCard,
  Invitation,
  SpaceContext,
  SpaceStudent,
  TeamMember,
} from "../../shared/types";
const send = mutationSender(
  [
    "directory",
    "space-team",
    "space-invitations",
    "class-teachers",
    "class-members",
    "assignment-members",
    "classes",
    "class",
    "student",
    "class-report",
    "results",
    "assignment-report",
    "deliveries",
    "student-work",
    "dashboard",
  ],
  true,
);
const path = (space: number) => "/api/spaces/" + space;
export const spacesApi = {
  context: () => request<SpaceContext>("/api/auth/context"),
  select: (spaceId: number) => send("/api/auth/context", "POST", { spaceId }),
  rename: (id: number, name: string) => send(path(id), "PATCH", { name }),
  team: (id: number) => request<TeamMember[]>(path(id) + "/members"),
  permission: (id: number, user: number, manageStudentAccess: boolean) =>
    send(path(id) + "/members/" + user, "PATCH", { manageStudentAccess }),
  removeTeacher: (id: number, user: number) =>
    send(path(id) + "/members/" + user, "DELETE"),
  transfer: (id: number, user: number) => send(path(id) + "/owner/" + user),
  invitations: (id: number) => request<Invitation[]>(path(id) + "/invitations"),
  invite: (id: number) =>
    send<{ id: number; token: string; expiresAt: string }>(
      path(id) + "/invitations",
    ),
  revoke: (id: number, invite: number) =>
    send(path(id) + "/invitations/" + invite, "DELETE"),
  accept: (token: string) =>
    send<{ spaceId: number }>("/api/spaces/invitations/accept", "POST", {
      token,
    }),
  bulk: (
    id: number,
    rows: { name?: string; studentId?: number; allowDuplicate?: boolean }[],
    classroomId?: number,
  ) =>
    send<SpaceStudent[]>(path(id) + "/students/bulk", "POST", {
      rows,
      classroomId,
    }),
  students: (id: number) => request<SpaceStudent[]>(path(id) + "/students"),
  createStudent: (id: number, name: string, allowDuplicate = false) =>
    send<SpaceStudent>(path(id) + "/students", "POST", {
      name,
      allowDuplicate,
    }),
  updateStudent: (
    id: number,
    student: number,
    name?: string,
    archive = false,
  ) =>
    send<SpaceStudent>(path(id) + "/students/" + student, "PATCH", {
      name,
      archive,
    }),
  credential: (id: number, student: number, rotate = false) =>
    send<AccessCard>(
      path(id) +
        "/students/" +
        student +
        "/credential" +
        (rotate ? "/rotate" : ""),
    ),
  classTeachers: (id: string) =>
    request<TeamMember[]>("/api/classes/" + id + "/teachers"),
  classTeacher: (id: string, userId: number, lead = false) =>
    send("/api/classes/" + id + "/teachers", "POST", { userId, lead }),
  removeClassTeacher: (id: string, userId: number) =>
    send("/api/classes/" + id + "/teachers/" + userId, "DELETE"),
};

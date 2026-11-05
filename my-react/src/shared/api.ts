import { apiRequest, ApiError } from "../api/client.js";
import type {
  Assignment,
  Asset,
  AssetPage,
  Attempt,
  Classroom,
  Definition,
  DraftItem,
  GameResult,
  Id,
  ImageSlot,
  ItemResult,
  Member,
  ReportRow,
  StudentTest,
  User,
  Worksheet,
  WorksheetItem,
} from "./types";
export { ApiError };
export const request = async <T>(
  url: string,
  options: RequestInit = {},
): Promise<T> => {
  const value = (await apiRequest(url, options)) as T;
  if (
    options.method &&
    !["GET", "HEAD", "OPTIONS"].includes(options.method.toUpperCase()) &&
    !url.startsWith("/api/auth/")
  )
    window.dispatchEvent(new Event("platform-mutated"));
  return value;
};
const send = <T>(url: string, method = "POST", body?: unknown) =>
  request<T>(url, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
export const api = {
  me: () => request<User>("/api/auth/me"),
  login: (email: string, password: string) =>
    send<User>("/api/auth/login", "POST", { email, password }),
  signup: (name: string, email: string, password: string) =>
    send<User>("/api/auth/signup", "POST", {
      name,
      email,
      password,
      role: "TEACHER",
    }),
  logout: () => send<void>("/api/auth/logout"),
  worksheets: () => request<Worksheet[]>("/api/worksheets"),
  worksheet: (id: Id) => request<Worksheet>("/api/worksheets/" + id),
  createWorksheet: (name: string) =>
    send<Worksheet>("/api/worksheets", "POST", { name }),
  renameWorksheet: (id: Id, name: string) =>
    send<Worksheet>("/api/worksheets/" + id, "PUT", { name }),
  deleteWorksheet: (id: Id) => send<void>("/api/worksheets/" + id, "DELETE"),
  saveItem: (id: Id, item: DraftItem) =>
    send<WorksheetItem>(
      "/api/worksheets/" + id + "/items" + (item.id ? "/" + item.id : ""),
      item.id ? "PUT" : "POST",
      {
        miniGameId: item.miniGameId,
        orderIndex: item.orderIndex,
        configuration: item.configuration,
      },
    ),
  deleteItem: (id: Id, item: Id) =>
    send<void>("/api/worksheets/" + id + "/items/" + item, "DELETE"),
  definitions: () => request<Definition[]>("/api/minigames"),
  share: (id: Id, rotate = false) =>
    send<{ shareCode?: string; code?: string }>(
      "/api/worksheets/" + id + "/share" + (rotate ? "/rotate" : ""),
    ),
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
  addStudent: (id: Id, name: string) =>
    send<Member>("/api/classes/" + id + "/members", "POST", { name }),
  renameStudent: (id: Id, user: Id, name: string) =>
    send<Member>("/api/classes/" + id + "/members/" + user, "PATCH", { name }),
  issueCode: (id: Id, user: Id) =>
    send<Member>("/api/classes/" + id + "/members/" + user + "/code"),
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
  enterGame: (studentCode: string, worksheetCode: string) =>
    send<{ assignmentId: number }>("/api/play/join", "POST", {
      studentCode: studentCode.trim().toUpperCase(),
      worksheetCode: worksheetCode.trim().toUpperCase(),
    }),
  assignments: () => request<Assignment[]>("/api/assignments"),
  assignment: (id: Id) => request<Assignment>("/api/assignments/" + id),
  report: (history = false) =>
    request<ReportRow[]>(
      "/api/assignments/report" + (history ? "?includeRemoved=true" : ""),
    ),
  removeAssignmentGroup: (classId: string, revisionId: Id) =>
    send<void>(
      "/api/assignments/" +
        (classId === "direct" ? "direct" : "classes/" + classId) +
        "/revisions/" +
        revisionId,
      "DELETE",
    ),
  assign: (id: Id, body: { classroomId?: number; userId?: number }) =>
    send<Assignment[]>("/api/worksheets/" + id + "/assignments", "POST", body),
  joinWorksheet: (code: string) =>
    send<{ assignmentId: number }>("/api/worksheets/join", "POST", {
      code: code.trim().toUpperCase(),
    }),
  history: (id: Id, personal = false) =>
    request<Attempt[]>(
      "/api/" +
        (personal ? "worksheets" : "assignments") +
        "/" +
        id +
        "/attempts",
    ),
  start: (id: Id, personal = false) =>
    send<Attempt>(
      "/api/" +
        (personal ? "worksheets" : "assignments") +
        "/" +
        id +
        "/attempts",
    ),
  attempt: (id: Id) => request<Attempt>("/api/attempts/" + id),
  result: (id: Id, item: Id, result: GameResult) =>
    send<ItemResult>(
      "/api/attempts/" + id + "/items/" + item + "/result",
      "PUT",
      result,
    ),
  complete: (id: Id) => send<Attempt>("/api/attempts/" + id + "/complete"),
  slots: (id: Id) =>
    request<ImageSlot[]>("/api/minigames/" + id + "/image-slots"),
  images: (page = 0) =>
    request<AssetPage>("/api/minigame-assets?page=" + page + "&size=20"),
  upload: (definition: Id, slot: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return request<Asset>(
      "/api/minigames/" + definition + "/image-slots/" + slot + "/uploads",
      { method: "POST", body },
    );
  },
};
export const canTeach = (user?: User | null) =>
  user?.role === "TEACHER" || user?.role === "ADMIN";
export const photoUrl = (asset?: number | null, fallback?: string) =>
  asset ? "/api/minigame-assets/" + asset + "/content" : fallback;

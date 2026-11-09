import { request } from "../../shared/http";
import { mutationSender } from "../../shared/mutations";
import type { Attempt, GameResult, Id, ItemResult } from "../../shared/types";
const send = mutationSender([
  "attempt",
  "assignment-detail",
  "assignments",
  "student-work",
  "results",
  "assignment-report",
  "class-report",
  "student",
  "dashboard",
]);
export const attemptsApi = {
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
};

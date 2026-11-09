import { request } from "../../shared/http";
import { mutationSender } from "../../shared/mutations";
import type {
  DraftItem,
  Id,
  Worksheet,
  WorksheetItem,
} from "../../shared/types";
const send = mutationSender([
  "worksheets",
  "editor",
  "dashboard",
  "assign-worksheets",
]);
export const worksheetsApi = {
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
};

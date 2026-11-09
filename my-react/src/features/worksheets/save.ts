import type {
  DraftItem,
  Id,
  Worksheet,
  WorksheetItem,
} from "../../shared/types.ts";
export type PersistedItem = Pick<WorksheetItem, "id" | "orderIndex">;
interface DraftApi {
  renameWorksheet: (id: Id, name: string) => Promise<Worksheet>;
  deleteItem: (id: Id, item: Id) => Promise<void>;
  saveItem: (id: Id, item: DraftItem) => Promise<PersistedItem>;
}
export async function saveDraft(
  api: DraftApi,
  worksheetId: Id,
  draft: { name: string; items: DraftItem[] },
  removed: number[],
  onItemSaved: (key: string, item: PersistedItem) => void,
  onItemDeleted: (id: number) => void,
) {
  const current = await api.renameWorksheet(worksheetId, draft.name.trim());
  for (const id of removed) {
    await api.deleteItem(worksheetId, id);
    onItemDeleted(id);
  }
  const reordering = draft.items.some(
    (item, index) => item.id && item.orderIndex !== index,
  );
  if (reordering) {
    const temporaryStart =
      Math.max(
        draft.items.length,
        ...(current?.items || draft.items).map((item) => item.orderIndex || 0),
      ) + 1;
    for (let index = 0; index < draft.items.length; index += 1) {
      const item = draft.items[index];
      if (!item.id) continue;
      const saved = await api.saveItem(worksheetId, {
        ...item,
        orderIndex: temporaryStart + index,
      });
      onItemSaved(item.key, saved);
    }
  }
  for (let index = 0; index < draft.items.length; index += 1) {
    const item = draft.items[index];
    const saved = await api.saveItem(worksheetId, {
      ...item,
      orderIndex: index,
    });
    onItemSaved(item.key, saved);
  }
}

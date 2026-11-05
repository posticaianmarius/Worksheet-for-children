import type { DraftItem, Worksheet } from "../../shared/types.ts";
export interface Draft {
  name: string;
  items: DraftItem[];
  removed: number[];
  selected: string | null;
  dirty: boolean;
  undo: { item: DraftItem; index: number }[];
}
export function fromWorksheet(sheet: Worksheet): Draft {
  const items = [...sheet.items]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((item) => ({ ...structuredClone(item), key: "item-" + item.id }));
  return {
    name: sheet.name,
    items,
    removed: [],
    selected: items[0]?.key ?? null,
    dirty: false,
    undo: [],
  };
}
export type DraftAction =
  | { type: "name"; name: string }
  | { type: "select"; key: string }
  | { type: "add"; item: DraftItem }
  | { type: "update"; key: string; patch: Partial<DraftItem> }
  | { type: "duplicate"; key: string; newKey: string }
  | { type: "remove"; key: string }
  | { type: "undo" }
  | { type: "move"; key: string; index: number }
  | { type: "savedItem"; key: string; id: number; orderIndex: number }
  | { type: "deleted"; id: number }
  | { type: "saved" }
  | { type: "restore"; draft: Draft };
export function draftReducer(state: Draft, action: DraftAction): Draft {
  switch (action.type) {
    case "restore":
      return { ...action.draft, dirty: true };
    case "name":
      return { ...state, name: action.name, dirty: true };
    case "select":
      return { ...state, selected: action.key };
    case "add": {
      const index = state.items.findIndex(
          (item) => item.key === state.selected,
        ),
        items = [...state.items];
      items.splice(index < 0 ? items.length : index + 1, 0, action.item);
      return { ...state, items, selected: action.item.key, dirty: true };
    }
    case "update":
      return {
        ...state,
        items: state.items.map((item) =>
          item.key === action.key ? { ...item, ...action.patch } : item,
        ),
        dirty: true,
      };
    case "duplicate": {
      const index = state.items.findIndex((item) => item.key === action.key);
      if (index < 0) return state;
      const items = [...state.items],
        item = {
          ...structuredClone(items[index]),
          id: undefined,
          key: action.newKey,
        };
      items.splice(index + 1, 0, item);
      return { ...state, items, selected: item.key, dirty: true };
    }
    case "remove": {
      const index = state.items.findIndex((item) => item.key === action.key),
        item = state.items[index];
      if (!item) return state;
      const items = state.items.filter((entry) => entry.key !== action.key);
      return {
        ...state,
        items,
        removed: item.id ? [...state.removed, item.id] : state.removed,
        undo: [...state.undo, { item, index }],
        selected:
          state.selected === action.key
            ? (items[Math.min(index, items.length - 1)]?.key ?? null)
            : state.selected,
        dirty: true,
      };
    }
    case "undo": {
      const entry = state.undo.at(-1);
      if (!entry) return state;
      const items = [...state.items];
      items.splice(entry.index, 0, entry.item);
      return {
        ...state,
        items,
        removed: state.removed.filter((id) => id !== entry.item.id),
        undo: state.undo.slice(0, -1),
        selected: entry.item.key,
        dirty: true,
      };
    }
    case "move": {
      const index = state.items.findIndex((item) => item.key === action.key);
      if (index < 0 || action.index < 0 || action.index >= state.items.length)
        return state;
      const items = [...state.items];
      items.splice(action.index, 0, items.splice(index, 1)[0]);
      return { ...state, items, dirty: true };
    }
    case "savedItem":
      return {
        ...state,
        items: state.items.map((item) =>
          item.key === action.key
            ? { ...item, id: action.id, orderIndex: action.orderIndex }
            : item,
        ),
      };
    case "deleted":
      return {
        ...state,
        removed: state.removed.filter((id) => id !== action.id),
        undo: state.undo.filter((entry) => entry.item.id !== action.id),
      };
    case "saved":
      return { ...state, name: state.name.trim(), dirty: false, undo: [] };
  }
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
export function fingerprint(sheet: Worksheet) {
  return JSON.stringify(
    canonical({
      name: sheet.name,
      items: [...sheet.items]
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(({ id, miniGameId, configuration, orderIndex }) => ({
          id,
          miniGameId,
          configuration,
          orderIndex,
        })),
    }),
  );
}
export interface Recovery {
  version: 1;
  updated: number;
  base: string;
  draft: Draft;
}
export const recoveryKey = (user: number, worksheet: number) =>
  "practica.draft.v1." + user + "." + worksheet;
export function readRecovery(
  storage: Pick<Storage, "getItem">,
  key: string,
): Recovery | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Recovery;
    return value.version === 1 &&
      value.draft?.dirty === true &&
      typeof value.draft.name === "string" &&
      Array.isArray(value.draft.removed) &&
      value.draft.removed.every((id) => Number.isInteger(id) && id > 0) &&
      Array.isArray(value.draft.undo) &&
      (value.draft.selected === null ||
        typeof value.draft.selected === "string") &&
      Array.isArray(value.draft.items) &&
      value.draft.items.every(
        (item) =>
          item &&
          typeof item.key === "string" &&
          Number.isInteger(item.miniGameId) &&
          item.configuration &&
          typeof item.configuration === "object" &&
          !Array.isArray(item.configuration),
      ) &&
      Number.isFinite(value.updated) &&
      typeof value.base === "string" &&
      Date.now() - value.updated < 7 * 86400_000
      ? value
      : null;
  } catch {
    return null;
  }
}

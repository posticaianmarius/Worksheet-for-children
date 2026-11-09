import test from "node:test";
import assert from "node:assert/strict";
import { saveDraft } from "../src/features/worksheets/save.ts";
import { translate } from "../src/shared/i18n/legacy.ts";

test("a failed save can retry without repeating successful removals or creating duplicate items", async () => {
  const draft = { name: "Retry", items: [{ key: "a" }, { key: "b" }] };
  let removed = [8, 9];
  const deleted = [];
  const created = [];
  let fail = true;
  const api = {
    renameWorksheet: async () => ({ items: draft.items }),
    deleteItem: async (_id, itemId) => deleted.push(itemId),
    saveItem: async (_id, item) => {
      if (item.key === "b" && fail) throw new Error("Connection lost");
      if (!item.id) created.push(item.key);
      return { ...item, id: item.id || (item.key === "a" ? 30 : 31) };
    },
  };
  const saved = (key, item) => {
    draft.items = draft.items.map((entry) =>
      entry.key === key
        ? { ...entry, id: item.id, orderIndex: item.orderIndex }
        : entry,
    );
  };
  const deletedItem = (id) => {
    removed = removed.filter((entry) => entry !== id);
  };
  await assert.rejects(
    saveDraft(api, 1, draft, removed, saved, deletedItem),
    /Connection lost/,
  );
  fail = false;
  await saveDraft(api, 1, draft, removed, saved, deletedItem);
  assert.deepEqual(deleted, [8, 9]);
  assert.deepEqual(created, ["a", "b"]);
  assert.deepEqual(
    draft.items.map((item) => item.id),
    [30, 31],
  );
});

test("deleting an earlier activity compacts order without violating occupied positions", async () => {
  const positions = new Map([
    [10, 0],
    [11, 1],
    [12, 2],
  ]);
  const api = {
    renameWorksheet: async () => ({
      items: [...positions].map(([id, orderIndex]) => ({ id, orderIndex })),
    }),
    deleteItem: async (_id, itemId) => positions.delete(itemId),
    saveItem: async (_id, item) => {
      assert.equal(
        [...positions].some(
          ([id, index]) => id !== item.id && index === item.orderIndex,
        ),
        false,
      );
      positions.set(item.id, item.orderIndex);
      return item;
    },
  };
  await saveDraft(
    api,
    1,
    {
      name: "Remove first",
      items: [
        { id: 11, key: "b", orderIndex: 1 },
        { id: 12, key: "c", orderIndex: 2 },
      ],
    },
    [10],
    () => {},
    () => {},
  );
  assert.deepEqual(
    [...positions],
    [
      [11, 0],
      [12, 1],
    ],
  );
});

test("all activities can be removed and saved without creating replacements", async () => {
  const removed = [];
  await saveDraft(
    {
      renameWorksheet: async () => ({ items: [{ id: 10 }] }),
      deleteItem: async (_id, id) => removed.push(id),
      saveItem: async () => assert.fail("No items should be created"),
    },
    1,
    { name: "Empty draft", items: [] },
    [10],
    () => {},
    () => {},
  );
  assert.deepEqual(removed, [10]);
});

test("translation interpolates values and falls back safely for server messages", () => {
  assert.equal(
    translate("ro", "Activity {current} of {total}", { current: 2, total: 6 }),
    "Activitatea 2 din 6",
  );
  assert.equal(
    translate("en", "Activitatea {current} din {total}", {
      current: 2,
      total: 6,
    }),
    "Activity 2 of 6",
  );
  assert.equal(
    translate("ro", "Service is temporarily unavailable."),
    "Service is temporarily unavailable.",
  );
});

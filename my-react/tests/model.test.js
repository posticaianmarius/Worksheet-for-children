import test from "node:test";
import assert from "node:assert/strict";
import { generateQuestions, isCorrect } from "../src/games/model.ts";
import { remainingItems } from "../src/features/attempts/model.ts";
import { saveDraft } from "../src/features/worksheets/save.ts";
import { imagePaths, setAtPath } from "../src/shared/configuration.ts";

test("all arithmetic operations produce finite, nonnegative, exact answers", () => {
  for (const operation of ["+", "-", "*", "/"]) {
    const questions = generateQuestions("math-game", {
      maxNumber: 20,
      exerciseCount: 30,
      operations: [operation],
    });
    for (const question of questions) {
      assert.equal(Number.isFinite(question.answer), true);
      assert.equal(question.answer >= 0, true);
      assert.equal(isCorrect(question, question.answer), true);
    }
  }
});

test("letter scoring requires every matching position and rejects extras", () => {
  const [question] = generateQuestions("color-game", {
    letter: "a",
    animals: [{ name: "banana", img: "/banana.webp" }],
  });
  assert.deepEqual(question.answer, [1, 3, 5]);
  assert.equal(isCorrect(question, [1, 3, 5]), true);
  assert.equal(isCorrect(question, [1, 3]), false);
  assert.equal(isCorrect(question, [1, 3, 5, 0]), false);
});

test("attempt progress uses frozen revision item IDs and preserves order", () => {
  const attempt = {
    items: [
      { id: 9, orderIndex: 1 },
      { id: 8, orderIndex: 0 },
    ],
    results: [{ revisionItemId: 8 }],
  };
  assert.deepEqual(
    remainingItems(attempt).map((item) => item.id),
    [9],
  );
});

test("image slots resolve nested array paths without changing siblings", () => {
  const configuration = {
    animals: [
      { id: "bear", img: 1 },
      { id: "fox", img: 2 },
    ],
  };
  const matches = imagePaths(configuration, "/animals/*/img");
  assert.deepEqual(
    matches.map((entry) => entry.value),
    [1, 2],
  );
  const changed = setAtPath(configuration, matches[1].path, 7);
  assert.equal(changed.animals[0].img, 1);
  assert.equal(changed.animals[1].img, 7);
  assert.equal(configuration.animals[1].img, 2);
});

test("worksheet swaps use temporary free positions before final ordering", async () => {
  const calls = [];
  const api = {
    renameWorksheet: async () => ({
      items: [{ orderIndex: 0 }, { orderIndex: 1 }],
    }),
    deleteItem: async () => {},
    saveItem: async (_worksheetId, item) => {
      calls.push([item.id, item.orderIndex]);
      return item;
    },
  };
  const draft = {
    name: "Swap",
    items: [
      { id: 2, key: "two", orderIndex: 1 },
      { id: 1, key: "one", orderIndex: 0 },
    ],
  };
  await saveDraft(
    api,
    4,
    draft,
    [],
    () => {},
    () => {},
  );
  assert.deepEqual(calls, [
    [2, 3],
    [1, 4],
    [2, 0],
    [1, 1],
  ]);
});

test("retry callbacks receive successful IDs so new items are not duplicated", async () => {
  let nextId = 30;
  const saved = [];
  const api = {
    renameWorksheet: async () => ({ items: [] }),
    deleteItem: async () => {},
    saveItem: async (_worksheetId, item) => ({
      ...item,
      id: item.id || nextId++,
    }),
  };
  await saveDraft(
    api,
    1,
    { name: "Draft", items: [{ key: "new", configuration: {} }] },
    [],
    (key, item) => saved.push([key, item.id]),
    () => {},
  );
  assert.deepEqual(saved, [["new", 30]]);
});

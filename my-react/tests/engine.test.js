import test from "node:test";
import assert from "node:assert/strict";
import {
  createQuestion,
  exerciseCount,
  maximumScore,
} from "../src/games/engine.ts";
import {
  draftReducer,
  fingerprint,
  fromWorksheet,
  readRecovery,
} from "../src/features/worksheets/draft.ts";

function randomSeed(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
test("the live arithmetic engine creates exact, unique, selectable answers for all operations", () => {
  for (const maxNumber of [1, 2, 10, 73, 100])
    for (const operation of ["+", "-", "*", "/"]) {
      const random = randomSeed(23);
      for (let i = 0; i < 100; i++) {
        const question = createQuestion(
          "math-game",
          { maxNumber, operations: [operation] },
          random,
        );
        assert.equal(Number.isInteger(question.correct), true);
        assert.equal(question.correct >= 0, true);
        assert.equal(new Set(question.choices).size, 4);
        assert.ok(question.choices.includes(question.correct));
        const [a, b] = question.values;
        assert.equal(
          question.correct,
          operation === "+"
            ? a + b
            : operation === "-"
              ? a - b
              : operation === "*"
                ? a * b
                : a / b,
        );
      }
    }
});
test("comparison remains unequal and generators terminate even with a constant random source", () => {
  for (const maxNumber of [1, 2, 100]) {
    const question = createQuestion(
      "higher-lower-game",
      { maxNumber },
      () => 0,
    );
    assert.notEqual(question.values[0], question.values[1]);
    assert.equal(
      question.correct,
      question.values[0] > question.values[1] ? "bigger" : "smaller",
    );
  }
  assert.equal(
    createQuestion("math-game", { maxNumber: 1, operations: ["+"] }, () => 0)
      .choices.length,
    4,
  );
});
test("the player and maximum score use ten exercises for historical configurations", () => {
  assert.equal(exerciseCount({}), 10);
  assert.equal(maximumScore("math-game", {}), 10);
  assert.equal(exerciseCount({ exerciseCount: 1 }), 1);
  assert.equal(exerciseCount({ exerciseCount: 100 }), 100);
  assert.equal(
    maximumScore("color-game", {
      letter: "ș",
      animals: [{ id: "1", name: "Șarpe și șoarece", img: "" }],
    }),
    3,
  );
  assert.equal(
    maximumScore("matching-game", {
      pairs: [
        { id: "1", number: 1, emoji: "🍎" },
        { id: "2", number: 2, emoji: "🍊" },
      ],
    }),
    2,
  );
});
const worksheet = {
  id: 20,
  name: "Practice",
  items: [
    {
      id: 30,
      miniGameId: 1,
      orderIndex: 0,
      definition: { id: 1, type: "math-game", version: 1 },
      configuration: {
        maxNumber: 73,
        exerciseCount: 37,
        operations: ["*", "/"],
      },
    },
  ],
};
test("draft operations preserve configuration and persistent identities through undo and duplication", () => {
  const initial = fromWorksheet(worksheet);
  const copy = draftReducer(initial, {
    type: "duplicate",
    key: "item-30",
    newKey: "copy",
  });
  assert.equal(copy.items[0].id, 30);
  assert.equal(copy.items[1].id, undefined);
  assert.deepEqual(copy.items[1].configuration, initial.items[0].configuration);
  const removed = draftReducer(copy, { type: "remove", key: "item-30" });
  const restored = draftReducer(removed, { type: "undo" });
  assert.deepEqual(restored.items[0], initial.items[0]);
  assert.deepEqual(restored.removed, []);
  assert.equal(worksheet.items.length, 1);
});
test("acknowledged saves retain IDs and acknowledged deletions cannot be undone as stale IDs", () => {
  const initial = fromWorksheet(worksheet),
    removed = draftReducer(initial, { type: "remove", key: "item-30" });
  const deleted = draftReducer(removed, { type: "deleted", id: 30 });
  assert.deepEqual(deleted.removed, []);
  assert.deepEqual(deleted.undo, []);
  const added = draftReducer(initial, {
    type: "duplicate",
    key: "item-30",
    newKey: "copy",
  });
  const acknowledged = draftReducer(added, {
    type: "savedItem",
    key: "copy",
    id: 40,
    orderIndex: 1,
  });
  assert.equal(acknowledged.items[1].id, 40);
  assert.equal(acknowledged.dirty, true);
});
test("recovery fingerprints compare content, ignore object-key order, and reject invalid or expired records", () => {
  const equivalent = structuredClone(worksheet);
  equivalent.items[0].configuration = {
    operations: ["*", "/"],
    exerciseCount: 37,
    maxNumber: 73,
  };
  assert.equal(fingerprint(worksheet), fingerprint(equivalent));
  equivalent.items[0].configuration.exerciseCount = 38;
  assert.notEqual(fingerprint(worksheet), fingerprint(equivalent));
  assert.equal(readRecovery({ getItem: () => "{broken" }, "key"), null);
  const record = {
    version: 1,
    base: fingerprint(worksheet),
    updated: Date.now(),
    draft: { ...fromWorksheet(worksheet), dirty: true },
  };
  assert.deepEqual(
    readRecovery({ getItem: () => JSON.stringify(record) }, "key"),
    record,
  );
  assert.equal(
    readRecovery(
      { getItem: () => JSON.stringify({ ...record, updated: 0 }) },
      "key",
    ),
    null,
  );
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dateValue,
  scorePercent,
  sortRows,
} from "../src/shared/sorting-model.ts";

test("results compare numerically, normalize different maximums and keep zero before missing", () => {
  const rows = [
    { id: 1, score: null, max: null },
    { id: 2, score: 10, max: 20 },
    { id: 3, score: 2, max: 2 },
    { id: 4, score: 0, max: 10 },
  ];
  const value = (row) => scorePercent(row.score, row.max);
  assert.deepEqual(
    sortRows(rows, value).map((r) => r.id),
    [4, 2, 3, 1],
  );
  assert.deepEqual(
    sortRows(rows, value, "desc").map((r) => r.id),
    [3, 2, 4, 1],
  );
  assert.deepEqual(
    rows.map((r) => r.id),
    [1, 2, 3, 4],
  );
  assert.equal(scorePercent(0, 0), 0);
});

test("dates compare timestamps rather than display strings and missing dates stay last", () => {
  const rows = [
    { id: 1, date: "2026-02-01" },
    { id: 2, date: "2026-01-20" },
    { id: 3, date: null },
  ];
  assert.deepEqual(
    sortRows(rows, (row) => dateValue(row.date)).map((row) => row.id),
    [2, 1, 3],
  );
  assert.deepEqual(
    sortRows(rows, (row) => dateValue(row.date), "desc").map((row) => row.id),
    [1, 2, 3],
  );
  assert.equal(dateValue("invalid"), null);
});

test("Romanian names and tied metrics have a stable order in both directions", () => {
  const rows = [
    { id: 3, name: "Ștefan", score: 10 },
    { id: 2, name: "Ana", score: 10 },
    { id: 1, name: "Țepeș", score: 5 },
  ];
  assert.deepEqual(
    sortRows(rows, (row) => row.name).map((row) => row.name),
    ["Ana", "Ștefan", "Țepeș"],
  );
  assert.deepEqual(
    sortRows(rows, (row) => row.score, "desc").map((row) => row.id),
    [2, 3, 1],
  );
});

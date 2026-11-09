import test from "node:test";
import assert from "node:assert/strict";
import { visibleWorksheets } from "../src/features/worksheets/library-model.ts";

test("worksheet discovery finds Romanian names without accents and keeps unknown activities", () => {
  const sheets = [
    {
      id: 1,
      name: "Știință și natură",
      items: [{ definition: { type: "future-game", version: 99 } }],
    },
    { id: 2, name: "Împreună numărăm", items: [] },
  ];
  assert.deepEqual(
    visibleWorksheets(
      sheets,
      "  stiinta  ",
      "with-activities",
      "name",
      "ro",
    ).map((sheet) => sheet.id),
    [1],
  );
  assert.deepEqual(
    visibleWorksheets(sheets, "impreuna", "empty", "name", "ro").map(
      (sheet) => sheet.id,
    ),
    [2],
  );
  assert.equal(sheets[0].items[0].definition.version, 99);
});

test("recent worksheet sorting puts invalid dates last and resolves ties without changing cached order", () => {
  const sheets = [
    { id: 1, name: "Worksheet 10", updatedAt: "not-a-date", items: [] },
    {
      id: 2,
      name: "Worksheet 2",
      updatedAt: "2026-11-08T10:00:00Z",
      items: [],
    },
    {
      id: 3,
      name: "Worksheet 1",
      updatedAt: "2026-11-08T10:00:00Z",
      items: [],
    },
    { id: 4, name: "Worksheet 3", items: [] },
  ];
  assert.deepEqual(
    visibleWorksheets(sheets, "", "all", "recent", "en").map(
      (sheet) => sheet.id,
    ),
    [3, 2, 4, 1],
  );
  assert.deepEqual(
    visibleWorksheets(sheets, "", "all", "name", "en").map((sheet) => sheet.id),
    [3, 2, 4, 1],
  );
  assert.deepEqual(
    sheets.map((sheet) => sheet.id),
    [1, 2, 3, 4],
  );
});

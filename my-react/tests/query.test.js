import test from "node:test";
import assert from "node:assert/strict";
import {
  queryClient,
  resourceKey,
  invalidateResources,
} from "../src/shared/query.ts";
import { setActiveSpace } from "../src/shared/http.ts";

test("mutations invalidate declared read models only for the current identity and space", async () => {
  queryClient.setQueryData(["session"], { id: 1 });
  const keys = [
    [1, 2, "classes"],
    [1, 3, "classes"],
    [9, 2, "classes"],
    [1, 2, "share", 8],
  ];
  for (const key of keys) queryClient.setQueryData(key, []);
  setActiveSpace(2);
  try {
    assert.deepEqual(resourceKey(1, 2, ["classes"]), keys[0]);
    await invalidateResources(["classes"]);
    assert.deepEqual(
      keys.map((key) => queryClient.getQueryState(key).isInvalidated),
      [true, false, false, false],
    );
  } finally {
    queryClient.clear();
    setActiveSpace(null);
  }
});

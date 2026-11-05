import test from "node:test";
import assert from "node:assert/strict";
import { validateConfiguration } from "../src/features/worksheets/validation.ts";
const definition = {
  id: 1,
  type: "math-game",
  version: 3,
  configurationSchema: {
    type: "object",
    additionalProperties: false,
    required: ["maxNumber", "operations"],
    properties: {
      maxNumber: { type: "integer", minimum: 1, maximum: 100 },
      exerciseCount: { type: "integer", minimum: 1, maximum: 100, default: 10 },
      operations: {
        type: "array",
        minItems: 1,
        items: { enum: ["+", "-", "*", "/"] },
      },
      imageAssetId: { type: ["integer", "null"] },
    },
  },
};
test("configuration validation rejects unsupported fields, fractional counts, and out-of-range counts", () => {
  for (const exerciseCount of [0, 101, 1.5])
    assert.ok(
      validateConfiguration(definition, {
        maxNumber: 73,
        exerciseCount,
        operations: ["*", "/"],
      }),
    );
  assert.ok(
    validateConfiguration(definition, {
      maxNumber: 73,
      exerciseCount: 37,
      operations: ["*"],
      undeclared: true,
    }),
  );
  assert.equal(
    validateConfiguration(definition, {
      maxNumber: 73,
      exerciseCount: 37,
      operations: ["*", "/"],
      imageAssetId: null,
    }),
    null,
  );
});
test("schema validation preserves historical omissions and never materializes or drops values", () => {
  const configuration = { maxNumber: 73, operations: ["/"] },
    before = structuredClone(configuration);
  assert.equal(validateConfiguration(definition, configuration), null);
  assert.deepEqual(configuration, before);
  assert.equal(Object.hasOwn(configuration, "exerciseCount"), false);
});
test("a malformed schema blocks saving without mutating teacher configuration", () => {
  const configuration = { maxNumber: 73, exerciseCount: 37, operations: ["+"] };
  const before = structuredClone(configuration);
  assert.ok(
    validateConfiguration(
      {
        ...definition,
        configurationSchema: { $ref: "https://example.test/remote-schema" },
      },
      configuration,
    ),
  );
  assert.deepEqual(configuration, before);
});

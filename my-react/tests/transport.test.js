import test from "node:test";
import assert from "node:assert/strict";
import { request, setActiveSpace, ApiError } from "../src/shared/http.ts";

test("writes retain CSRF, cookies and scoped headers while public login excludes space selection", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push({ url, options });
    return url.endsWith("/csrf")
      ? Response.json({ headerName: "X-CSRF-TOKEN", token: "test-token" })
      : Response.json({ id: 1 });
  });
  setActiveSpace(4);
  try {
    await request("/api/classes", { method: "POST", body: "{}" });
    assert.equal(calls[1].options.headers.get("X-Space-Id"), "4");
    assert.equal(calls[1].options.headers.get("X-CSRF-TOKEN"), "test-token");
    assert.equal(calls[1].options.credentials, "include");
    await request("/api/play/login", { method: "POST" });
    assert.equal(calls[3].options.headers.has("X-Space-Id"), false);
  } finally {
    setActiveSpace(null);
  }
});

test("session expiry keeps structured errors and notifies the session owner", async (t) => {
  const previous = globalThis.window;
  globalThis.window = new EventTarget();
  let expired = 0;
  window.addEventListener("session-expired", () => {
    expired++;
  });
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { message: "Expired", code: "UNAUTHORIZED", requestId: "request-1" },
      { status: 401 },
    ),
  );
  try {
    await assert.rejects(
      request("/api/classes"),
      (error) =>
        error instanceof ApiError &&
        error.status === 401 &&
        error.requestId === "request-1",
    );
    assert.equal(expired, 1);
    await assert.rejects(request("/api/auth/me"));
    assert.equal(expired, 1);
  } finally {
    globalThis.window = previous;
  }
});

import { expectRoutesFit } from "./fixtures/layout.js";
import { spaceContextFor } from "./space-fixtures.js";
import { test, expect } from "@playwright/test";
const schema = {
  type: "object",
  required: ["maxNumber", "operations"],
  additionalProperties: false,
  properties: {
    maxNumber: { type: "integer", minimum: 1, maximum: 100 },
    exerciseCount: { type: "integer", minimum: 1, maximum: 100 },
    operations: {
      type: "array",
      minItems: 1,
      items: { enum: ["+", "-", "*", "/"] },
    },
  },
};
async function setup(page, { role = "TEACHER", unknown = false } = {}) {
  await page.addInitScript(() => {
    localStorage.setItem("worksheet-language", "en");
    let seed = 17;
    window.resetWorksheetRandom = () => {
      seed = 17;
    };
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    window.feedbackPlayed = [];
    window.Audio = class {
      constructor(src) {
        this.src = src;
      }
      play() {
        window.feedbackPlayed.push(this.src);
        return Promise.resolve();
      }
      pause() {}
    };
  });
  const definition = {
    id: 1,
    type: "math-game",
    name: "Easy Math",
    version: 1,
    active: true,
    configurationSchema: schema,
    defaultConfiguration: {
      maxNumber: 10,
      exerciseCount: 10,
      operations: ["+"],
    },
  };
  const worksheet = {
    id: 20,
    name: "Little number discoveries",
    updatedAt: "2026-11-01T08:00:00Z",
    items: [
      {
        id: 30,
        miniGameId: 1,
        orderIndex: 0,
        definition,
        configuration: { maxNumber: 10, exerciseCount: 10, operations: ["+"] },
      },
      ...(unknown
        ? [
            {
              id: 31,
              miniGameId: 99,
              orderIndex: 1,
              definition: {
                id: 99,
                type: "future-game",
                version: 8,
                name: "Future activity",
              },
              configuration: { custom: [1, 2, 3] },
            },
          ]
        : []),
    ],
  };
  const writes = [];
  let user = role
    ? {
        id: role === "USER" ? 2 : 1,
        role,
        name: role === "USER" ? "Alex" : "Ana",
        email: "ana@example.test",
      }
    : null;
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request(),
        path = new URL(request.url()).pathname,
        method = request.method(),
        reply = (json) => route.fulfill({ json });
      if (path === "/api/auth/context") {
        const reply = (json, status = 200) =>
          route.fulfill({ json: spaceContextFor(json), status });
        const contextRoute = {
          fulfill: (options) =>
            route.fulfill({ ...options, json: spaceContextFor(options.json) }),
        };
        return user
          ? reply(user)
          : contextRoute.fulfill({
              status: 401,
              json: { message: "Please log in." },
            });
      }
      if (path === "/api/auth/me")
        return user
          ? reply(user)
          : route.fulfill({ status: 401, json: { message: "Please log in." } });
      if (path === "/api/auth/csrf")
        return reply({ headerName: "X-XSRF-TOKEN", token: "test" });
      if (path === "/api/auth/logout") {
        user = null;
        return route.fulfill({ status: 204 });
      }
      if (path === "/api/minigames") return reply([definition]);
      if (path === "/api/worksheets")
        return reply([
          worksheet,
          {
            id: 21,
            name: "Animal discoveries",
            updatedAt: "2026-10-01T08:00:00Z",
            items: [],
          },
        ]);
      if (path === "/api/worksheets/20") {
        if (method === "PUT") {
          worksheet.name = request.postDataJSON().name;
          writes.push(request.postDataJSON());
        }
        return reply(worksheet);
      }
      if (path === "/api/worksheets/20/items/30") {
        const body = request.postDataJSON();
        Object.assign(worksheet.items[0], body);
        writes.push(body);
        return reply(worksheet.items[0]);
      }
      if (path === "/api/worksheets/20/items/31") {
        writes.push(request.postDataJSON());
        return reply(worksheet.items[1]);
      }
      if (path === "/api/classes")
        return reply([{ id: 2, name: "Little explorers" }]);
      if (path === "/api/assignments" || path === "/api/assignments/report")
        return reply([]);
      if (path === "/api/attempts/40")
        return reply({
          id: 40,
          worksheetId: 20,
          assignmentId: 50,
          status: "IN_PROGRESS",
          items: [
            {
              ...worksheet.items[0],
              configuration: {
                maxNumber: 1,
                exerciseCount: 1,
                operations: ["+"],
              },
            },
          ],
          results: [],
        });
      if (path === "/api/attempts/40/items/30/result") {
        writes.push(request.postDataJSON());
        return reply({ ...request.postDataJSON(), revisionItemId: 30 });
      }
      return route.fulfill({ status: 404, json: { message: path } });
    },
  );
  return { worksheet, writes };
}
test("admins use the same teacher capabilities as teachers", async ({
  page,
}) => {
  await setup(page, { role: "ADMIN" });
  await page.goto("/teacher/20");
  await expect(page.getByLabel("Worksheet name", { exact: true })).toHaveValue(
    "Little number discoveries",
  );
  await page.getByLabel("Worksheet name", { exact: true }).fill("Admin draft");
  await page
    .getByRole("button", { name: "Save worksheet", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
});
test("an interrupted draft restores unsaved settings and stable item IDs", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/teacher/20");
  await page
    .getByLabel("Worksheet name", { exact: true })
    .fill("Recovered discovery");
  await page.getByLabel("Number of exercises:", { exact: true }).fill("37");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("practica.draft.v1.1.20")),
    )
    .toContain("Recovered discovery");
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "You have an unfinished draft" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Restore draft", exact: true })
    .click();
  await expect(page.getByLabel("Worksheet name", { exact: true })).toHaveValue(
    "Recovered discovery",
  );
  await expect(
    page.getByLabel("Number of exercises:", { exact: true }),
  ).toHaveValue("37");
  await page
    .getByRole("button", { name: "Save worksheet", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  expect(state.worksheet.items[0].id).toBe(30);
  expect(state.worksheet.items[0].configuration.exerciseCount).toBe(37);
  expect(
    await page.evaluate(() => localStorage.getItem("practica.draft.v1.1.20")),
  ).toBeNull();
});
test("recovery detects changed server content and never overwrites it silently", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/teacher/20");
  await page.getByLabel("Worksheet name", { exact: true }).fill("Local draft");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("practica.draft.v1.1.20")),
    )
    .toContain("Local draft");
  state.worksheet.name = "Changed on another device";
  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await expect(
    page.getByRole("dialog", { name: "The saved worksheet has changed" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Use saved version", exact: true })
    .click();
  await expect(page.getByLabel("Worksheet name", { exact: true })).toHaveValue(
    "Changed on another device",
  );
  expect(state.writes).toHaveLength(0);
});
test("unknown activities are retained while known activities remain editable", async ({
  page,
}) => {
  const state = await setup(page, { unknown: true });
  await page.goto("/teacher/20");
  await page
    .getByLabel("Worksheet name", { exact: true })
    .fill("Preserve future activity");
  await page
    .getByRole("button", { name: "Save worksheet", exact: true })
    .click();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  expect(state.worksheet.items[1]).toMatchObject({
    id: 31,
    miniGameId: 99,
    configuration: { custom: [1, 2, 3] },
  });
  await page
    .getByRole("button", { name: "Unavailable activity", exact: true })
    .click();
  await expect(
    page
      .getByText(
        "This activity is unavailable. Its saved content is preserved.",
      )
      .first(),
  ).toBeVisible();
});
test("worksheet discovery keeps search and ordering in the URL", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/sheets");
  await page
    .getByRole("searchbox", { name: "Search worksheets" })
    .fill("Animal");
  await expect(page).toHaveURL(/q=Animal/);
  await expect(page.locator(".worksheet-card")).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("searchbox")).toHaveValue("Animal");
  await page.getByRole("searchbox").fill("");
  await expect(page.locator(".worksheet-card")).toHaveCount(2);
  await page
    .getByRole("combobox", { name: "Sort worksheets" })
    .selectOption("name");
  await expect(page.locator(".worksheet-title h2")).toHaveText([
    "Animal discoveries",
    "Little number discoveries",
  ]);
});
test("sound and motion preferences are functional and persist on this device", async ({
  page,
}) => {
  await setup(page, { role: "USER" });
  await page.goto("/account");
  await page.getByRole("switch", { name: "Game sounds" }).uncheck();
  await page.getByRole("switch", { name: "Gentle motion" }).uncheck();
  await page.reload();
  await expect(
    page.getByRole("switch", { name: "Game sounds" }),
  ).not.toBeChecked();
  await expect(page.locator("html")).toHaveAttribute(
    "data-reduced-motion",
    "true",
  );
  await page.goto("/attempts/40");
  await page.locator(".answer").filter({ hasText: /^2$/ }).click();
  expect(await page.evaluate(() => window.feedbackPlayed)).toEqual([]);
});
for (const width of [320, 390, 768, 1024, 1440]) {
  test(`primary layouts fit at ${width}px`, async ({ page }) => {
    await setup(page);
    await expectRoutesFit(
      page,
      [
        "/",
        "/login",
        "/signup",
        "/home",
        "/sheets",
        "/teacher/20",
        "/classes",
        "/assignments",
        "/account",
      ],
      width,
      900,
    );
  });
}
test.describe("visual regression", () => {
  test.use({ reducedMotion: "reduce" });
  for (const entry of [
    { name: "entry-desktop", route: "/", width: 1440, role: null },
    { name: "entry-phone", route: "/", width: 390, role: null },
    { name: "teacher-dashboard", route: "/home", width: 1440, role: "TEACHER" },
    {
      name: "worksheet-library",
      route: "/sheets",
      width: 1440,
      role: "TEACHER",
    },
    {
      name: "worksheet-library-phone",
      route: "/sheets",
      width: 390,
      role: "TEACHER",
    },
    {
      name: "create-worksheet-phone",
      route: "/sheets",
      width: 390,
      role: "TEACHER",
      create: true,
    },
    {
      name: "worksheet-editor",
      route: "/teacher/20",
      width: 1440,
      role: "TEACHER",
    },
    { name: "child-phone", route: "/attempts/40", width: 390, role: "USER" },
  ]) {
    test(entry.name, async ({ page }) => {
      await setup(page, { role: entry.role });
      await page.setViewportSize({ width: entry.width, height: 1000 });
      // The lab must also stay unchanged after the collection's CSS has loaded.
      if (entry.route === "/teacher/20") {
        await page.goto("/sheets");
        await expect(page.locator(".worksheet-card")).toHaveCount(2);
        await page.route("**/api/worksheets/20", async (route) => {
          await page.evaluate(() => window.resetWorksheetRandom());
          await route.fallback();
        });
        await page.locator('.worksheetOpenButton[href="/teacher/20"]').click();
      } else {
        await page.goto(entry.route);
      }
      if (entry.route === "/sheets")
        await expect(page.locator(".worksheet-card")).toHaveCount(2);
      if (entry.create) {
        await page
          .getByRole("button", { name: "New worksheet", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toBeVisible();
      }
      if (entry.route === "/teacher/20")
        await expect(page.getByLabel("Number of exercises:")).toHaveValue("10");
      if (entry.route === "/home")
        await expect(
          page.getByText("Recent worksheets", { exact: true }),
        ).toBeVisible();
      if (entry.route.startsWith("/attempts/"))
        await expect(page.locator(".answer")).toHaveCount(4);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: test.info().outputPath(entry.name + ".png"),
        fullPage: true,
        animations: "disabled",
      });
      await expect(page).toHaveScreenshot(entry.name + ".png", {
        fullPage: true,
        animations: "disabled",
        maxDiffPixelRatio: 0.025,
      });
    });
  }
});

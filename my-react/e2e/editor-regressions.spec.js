import { spaceContextFor } from "./space-fixtures.js";
import { test, expect } from "@playwright/test";

async function mockPlatform(
  page,
  { empty = false, failSecondCreate = false, many = false } = {},
) {
  await page.addInitScript(() => {
    if (!localStorage.getItem("worksheet-language"))
      localStorage.setItem("worksheet-language", "en");
  });
  const definitions = [1, 2].map((id) => ({
    id,
    type: "math-game",
    name: "Easy Math",
    version: id,
    active: true,
    defaultConfiguration: {
      maxNumber: 10,
      exerciseCount: 1,
      operations: ["+"],
    },
  }));
  const worksheet = {
    id: 20,
    name: "Practice",
    items: empty
      ? []
      : [
          {
            id: 30,
            miniGameId: 1,
            orderIndex: 0,
            definition: definitions[0],
            configuration: definitions[0].defaultConfiguration,
          },
        ],
  };
  const changes = [];
  if (many)
    worksheet.items = Array.from({ length: 5 }, (_, index) => ({
      ...worksheet.items[0],
      id: 30 + index,
      orderIndex: index,
    }));
  let nextId = 40;
  let fail = failSecondCreate;
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      const method = request.method();
      if (path === "/api/auth/context") {
        const contextRoute = {
          fulfill: (options) =>
            route.fulfill({ ...options, json: spaceContextFor(options.json) }),
        };
        return contextRoute.fulfill({
          json: {
            id: 1,
            role: "TEACHER",
            name: "Teacher",
            email: "teacher@example.com",
          },
        });
      }
      if (path === "/api/auth/me")
        return route.fulfill({
          json: {
            id: 1,
            role: "TEACHER",
            name: "Teacher",
            email: "teacher@example.com",
          },
        });
      if (path === "/api/auth/csrf")
        return route.fulfill({
          json: { headerName: "X-XSRF-TOKEN", token: "test" },
        });
      if (path === "/api/minigames")
        return route.fulfill({ json: definitions });
      if (path === "/api/worksheets")
        return route.fulfill({ json: [worksheet] });
      if (path === "/api/classes" || path === "/api/assignments")
        return route.fulfill({ json: [] });
      if (path === "/api/worksheets/20" && method === "GET")
        return route.fulfill({ json: worksheet });
      if (path === "/api/worksheets/20" && method === "PUT") {
        worksheet.name = request.postDataJSON().name;
        changes.push({ method, path });
        return route.fulfill({ json: worksheet });
      }
      if (path.startsWith("/api/worksheets/20/items")) {
        if (method === "POST" && nextId === 41 && fail) {
          fail = false;
          return route.fulfill({
            status: 503,
            json: { message: "Connection lost" },
          });
        }
        const id =
          method === "POST" ? nextId++ : Number(path.split("/").at(-1));
        changes.push({
          method,
          path,
          id,
          ...(method === "DELETE" ? {} : { body: request.postDataJSON() }),
        });
        if (method === "DELETE") {
          worksheet.items = worksheet.items.filter((item) => item.id !== id);
          return route.fulfill({ status: 204 });
        }
        const item = { id, ...request.postDataJSON() };
        worksheet.items = [
          ...worksheet.items.filter((entry) => entry.id !== id),
          item,
        ];
        return route.fulfill({ json: item });
      }
      if (path === "/api/worksheets/20/share")
        return route.fulfill({ json: { code: "ORIGINAL" } });
      if (path === "/api/worksheets/20/share/rotate") {
        changes.push({ method, path });
        return route.fulfill({ json: { code: "FRESHCODE" } });
      }
      return route.fulfill({
        status: 404,
        json: { message: `Unexpected request: ${path}` },
      });
    },
  );
  return { worksheet, changes };
}

async function addMath(page) {
  if (await page.locator(".game-stage").count())
    await page.locator(".game-stage").first().hover();
  await page
    .getByRole("button", { name: "Add activity", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Easy math", exact: true }),
  ).toHaveCount(1);
  await dialog.getByRole("button", { name: "Easy math", exact: true }).click();
}

test("activity controls support keyboard access", async ({ page }) => {
  await mockPlatform(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/teacher/20");
  const list = page.getByRole("navigation", { name: "Worksheet activities" });
  const add = list.getByRole("button", { name: "Add activity", exact: true });
  await expect(list).toBeVisible();
  await expect(
    list.getByRole("button", { name: "Remove activity" }),
  ).toBeVisible();

  await add.focus();
  await expect(add).toBeFocused();

  await add.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .first()
    .click();
});

test("preview switching preserves unsaved worksheet settings on desktop and phone", async ({
  page,
}) => {
  const state = await mockPlatform(page);
  await page.goto("/teacher/20");
  const name = page.getByLabel("Worksheet name", { exact: true });
  const game = page.locator(".editor-settings");
  await name.fill("Unsaved preview draft");
  await game.getByRole("spinbutton").first().fill("7");
  await game.getByRole("spinbutton").first().blur();
  async function switchView(label) {
    const direct = page.getByRole("button", { name: label, exact: true });
    if (await direct.isVisible()) await direct.click();
    else {
      await page
        .getByRole("button", { name: "More actions", exact: true })
        .click();
      await page.getByRole("menuitem", { name: label, exact: true }).click();
    }
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    if (width < 1024)
      await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(game.getByRole("spinbutton").first()).toHaveValue("7");
    await switchView("Preview as child");
    await expect(name).toBeDisabled();
    await expect(
      page.locator(".full-preview .math-answers button"),
    ).toHaveCount(4);
    await expect(
      page.locator(".full-preview").getByRole("spinbutton"),
    ).toHaveCount(0);
    await switchView("Back to editor");
    await expect(name).toBeEnabled();
    await expect(name).toHaveValue("Unsaved preview draft");
    await expect(game.getByRole("spinbutton").first()).toHaveValue("7");
  }
  expect(state.changes).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Save worksheet", exact: true }),
  ).toBeEnabled();
});

test("dashboard sharing opens the correct code without navigating to the editor", async ({
  page,
}) => {
  await mockPlatform(page);
  await page.goto("/home");
  await page.getByRole("button", { name: "Share worksheet: Practice" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(
    page.getByRole("dialog").getByText("ORIGINAL", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByRole("link", { name: "Practice" }).click();
  await expect(page).toHaveURL(/\/teacher\/20$/);
});

test("teacher editor shares saved worksheets from its tools panel", async ({
  page,
}) => {
  await mockPlatform(page);
  await page.goto("/teacher/20");
  const share = page
    .locator(".editor-toolbar")
    .getByRole("button", { name: "Share worksheet", exact: true });
  await share.click();
  await expect(
    page.getByRole("dialog").getByText("ORIGINAL", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/teacher\/20$/);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByLabel("Worksheet name", { exact: true })
    .fill("Updated practice");
  await share.click();
  await expect(
    page.getByRole("heading", { name: "Save your changes first" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Save worksheet", exact: true })
    .click();
  await expect(share).toBeEnabled();
  await share.click();
  await expect(
    page.getByRole("dialog").getByText("ORIGINAL", { exact: true }),
  ).toBeVisible();
});

test("worksheet card opens from its background while share and delete stay on the list", async ({
  page,
}) => {
  await mockPlatform(page);
  await page.goto("/sheets");
  const name = page.locator(".worksheetOpenButton");
  await name.waitFor();
  await page.mouse.move(0, 0);

  await name.hover();

  await page
    .locator(".worksheet-card")
    .getByText("1 activity", { exact: true })
    .click();
  await expect(page).toHaveURL(/\/teacher\/20$/);
  await page.goto("/sheets");
  await page.getByRole("button", { name: "Share worksheet: Practice" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/\/sheets$/);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Delete worksheet: Practice" })
    .click();
  await expect(
    page.getByText("Delete this worksheet?", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/sheets$/);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("removal stays in the draft, supports undo and can save an empty worksheet", async ({
  page,
}) => {
  const state = await mockPlatform(page);
  await page.goto("/teacher/20");
  await page.getByRole("heading", { name: "Easy math", exact: true }).click();
  await page.getByRole("button", { name: "Remove activity" }).click();
  await expect(
    page.getByRole("button", { name: "Save worksheet", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".save-status")).toHaveText("Unsaved changes");
  expect(state.changes).toHaveLength(0);
  await page.getByRole("button", { name: "Undo removal" }).click();
  await expect(page.getByRole("heading", { name: "Easy math" })).toBeVisible();
  expect(state.changes).toHaveLength(0);
  await page.locator(".game-stage").hover();
  await page.getByRole("button", { name: "Remove activity" }).click();
  await page
    .getByRole("button", { name: "Save worksheet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save worksheet", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  expect(state.worksheet.items).toEqual([]);
  expect(
    state.changes.filter((entry) => entry.method === "DELETE"),
  ).toHaveLength(1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Add activity", exact: true }).last(),
  ).toBeVisible();
});

test("leaving without saving preserves server activities", async ({ page }) => {
  const state = await mockPlatform(page);
  await page.goto("/teacher/20");
  await page.getByRole("heading", { name: "Easy math" }).click();
  await page.getByRole("button", { name: "Remove activity" }).click();

  await page.getByRole("link", { name: "Account" }).click();
  await page
    .getByRole("button", { name: "Leave without saving", exact: true })
    .click();
  await expect(page).toHaveURL(/\/account$/);
  expect(state.worksheet.items).toHaveLength(1);
  expect(state.changes).toHaveLength(0);
});

test("retry after a partial save keeps IDs and selects the latest catalog version for new activities", async ({
  page,
}) => {
  const state = await mockPlatform(page, {
    empty: true,
    failSecondCreate: true,
  });
  await page.goto("/teacher/20");
  await addMath(page);
  await addMath(page);
  await page
    .getByRole("button", { name: "Save worksheet", exact: true })
    .click();
  await expect(
    page.getByText("Connection lost", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save worksheet", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save worksheet", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  expect(state.changes.filter((entry) => entry.method === "POST")).toHaveLength(
    2,
  );
  expect(state.worksheet.items.map((item) => item.id)).toEqual([40, 41]);
  expect(state.worksheet.items.map((item) => item.miniGameId)).toEqual([2, 2]);
});

test("saving an existing activity keeps its original catalog version", async ({
  page,
}) => {
  const state = await mockPlatform(page);
  await page.goto("/teacher/20");
  await page
    .getByLabel("Worksheet name", { exact: true })
    .fill("Renamed practice");
  await page
    .getByRole("button", { name: "Save worksheet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save worksheet", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  expect(state.worksheet.items[0].miniGameId).toBe(1);
});

test("language switching translates game and navigation without losing unsaved edits", async ({
  page,
}) => {
  await mockPlatform(page);
  await page.goto("/teacher/20");
  await page
    .getByLabel("Worksheet name", { exact: true })
    .fill("Keep this draft");
  await page.getByLabel("Language", { exact: true }).click();
  await page.getByText("Română", { exact: true }).click();
  await expect(page.getByLabel("Numele fișei", { exact: true })).toHaveValue(
    "Keep this draft",
  );
  await expect(
    page.getByRole("heading", { name: "Matematică simplă" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Salvează fișa", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText("Modificări nesalvate", { exact: true }),
  ).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("lang", "ro");
});

test("share dialog explains saved versions and confirms before replacing a code", async ({
  page,
}) => {
  const state = await mockPlatform(page);
  await page.goto("/sheets");
  await page
    .getByRole("button", { name: "Share worksheet: Practice", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "ORIGINAL", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This code opens a saved version. Later edits do not change what children receive.",
    ),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Publish latest and replace code" })
    .click();
  expect(state.changes).toHaveLength(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(state.changes).toHaveLength(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Publish latest and replace code" })
    .click();
  await page
    .getByRole("dialog", { name: "Replace the worksheet code?", exact: true })
    .getByRole("button", { name: "Publish latest and replace code" })
    .click();
  await expect(
    page.getByRole("heading", { name: "FRESHCODE", exact: true }),
  ).toBeVisible();
  expect(state.changes).toHaveLength(1);
});

test("worksheet saving, sharing and preview work on desktop and phone", async ({
  page,
}) => {
  await mockPlatform(page, { many: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/teacher/20");
  const name = page.getByLabel("Worksheet name", { exact: true });
  const save = page.getByRole("button", {
    name: "Save worksheet",
    exact: true,
  });
  await expect(name).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(page.locator(".save-status")).toHaveText("Saved");

  await name.fill("Updated worksheet");
  await expect(save).toBeEnabled();
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(
    1,
  );
  await page.keyboard.press("Control+s");
  await expect(save).toBeDisabled();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await name.fill(`Worksheet ${width}`);
    await expect(save).toBeEnabled();
    await save.click();
    await expect(save).toBeDisabled();
    await expect(page.locator(".save-status")).toHaveText("Saved");
    await expect(name).toHaveValue(`Worksheet ${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "Share worksheet" }),
  ).toBeVisible();

  await page.getByRole("menuitem", { name: "Share worksheet" }).click();
  await expect(
    page.getByRole("dialog").getByText("ORIGINAL", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Preview as child" }).click();
  await expect(name).toBeDisabled();
  await page.getByRole("button", { name: "More actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Back to editor" }).click();
  await expect(name).toBeEnabled();
});

test("phone navigation supports opening, closing, Escape and links", async ({
  page,
}) => {
  await mockPlatform(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/teacher/20");
  await expect(
    page.getByLabel("Worksheet name", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(
    page.getByRole("link", { name: "Worksheets", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Open navigation" }).click();

  await page
    .locator("nav")
    .getByRole("link", { name: "Worksheets", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sheets$/);
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toHaveAttribute("aria-expanded", "false");
});

test("desktop navigation opens, closes, persists its state and follows links", async ({
  page,
}) => {
  await mockPlatform(page);
  await page.goto("/teacher/20");
  const close = page.getByRole("button", {
    name: "Close navigation",
    exact: true,
  });
  const open = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  await expect(close).toHaveAttribute("aria-expanded", "true");
  await close.click();
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await open.click();
  await expect(close).toHaveAttribute("aria-expanded", "true");
  await page
    .locator("nav")
    .getByRole("link", { name: "Worksheets", exact: true })
    .click();
  await expect(page).toHaveURL(/\/sheets$/);
  await expect(close).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("link", { name: "Account" }).click();
  await expect(page).toHaveURL(/\/account$/);
});

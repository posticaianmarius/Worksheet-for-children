import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=",
  "base64",
);
async function setup(page, { failUpload = false } = {}) {
  await page.addInitScript(() =>
    localStorage.setItem("worksheet-language", "en"),
  );
  const types = ["math-game", "sequence-game", "color-game", "matching-game"];
  const definitions = types.flatMap((type, index) =>
    [1, 3].map((version) => ({
      id: index + 1 + (version === 3 ? 100 : 0),
      type,
      version,
      active: true,
      defaultConfiguration:
        type === "color-game"
          ? {
              letter: "u",
              animals: [{ id: "bear", name: "Urs", img: "/img/BearImg.webp" }],
            }
          : type === "matching-game"
            ? { pairs: [{ id: "one", number: 1, emoji: "🍎" }] }
            : {
                maxNumber: 73,
                exerciseCount: 37,
                ...(type === "math-game" ? { operations: ["*", "/"] } : {}),
              },
      configurationSchema:
        version === 3
          ? {
              "x-image-slots": {
                "activity-photo": { path: "/imageAssetId", allowUpload: true },
                ...(["color-game", "matching-game"].includes(type)
                  ? { "object-photo": { allowUpload: true } }
                  : {}),
              },
            }
          : {},
    })),
  );
  const worksheet = {
    id: 20,
    name: "Learning with photos",
    items: types.map((type, index) => {
      const definition = definitions.find(
        (item) => item.type === type && item.version === 1,
      );
      return {
        id: 30 + index,
        miniGameId: definition.id,
        definition,
        orderIndex: index,
        configuration: structuredClone(definition.defaultConfiguration),
      };
    }),
  };
  const state = { worksheet, writes: [], uploads: 0, failUpload, images: [] };
  let nextId = 40;
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      const reply = (json) => route.fulfill({ json });
      if (path === "/api/auth/me")
        return reply({ id: 1, role: "TEACHER", name: "Teacher" });
      if (path === "/api/auth/csrf")
        return reply({ headerName: "X-XSRF-TOKEN", token: "test" });
      if (path === "/api/minigames") return reply(definitions);
      if (path === "/api/minigame-assets")
        return reply({
          items: state.images,
          totalElements: state.images.length,
        });
      if (/^\/api\/minigame-assets\/\d+\/content$/.test(path))
        return route.fulfill({ contentType: "image/png", body: png });
      if (path.endsWith("/uploads")) {
        state.uploads++;
        if (state.failUpload)
          return route.fulfill({
            status: 500,
            json: { message: "Upload failed" },
          });
        const image = {
          id: 500 + state.images.length,
          url: `/api/minigame-assets/${500 + state.images.length}/content`,
          originalFilename: "my-photo.png",
        };
        state.images.push(image);
        return reply(image);
      }
      if (path === "/api/worksheets/20") {
        if (method === "PUT") {
          worksheet.name = route.request().postDataJSON().name;
          state.writes.push({ path, method });
        }
        return reply(worksheet);
      }
      if (path.startsWith("/api/worksheets/20/items")) {
        const id =
          method === "POST" ? nextId++ : Number(path.split("/").at(-1));
        if (method === "DELETE") {
          worksheet.items = worksheet.items.filter((item) => item.id !== id);
          state.writes.push({ id, method });
          return route.fulfill({ status: 204 });
        }
        const payload = route.request().postDataJSON();
        if (
          worksheet.items.some(
            (item) => item.id !== id && item.orderIndex === payload.orderIndex,
          )
        )
          return route.fulfill({
            status: 409,
            json: { message: "Position already occupied" },
          });
        const item = {
          ...payload,
          id,
          definition: definitions.find((def) => def.id === payload.miniGameId),
        };
        worksheet.items = [
          ...worksheet.items.filter((item) => item.id !== id),
          item,
        ];
        state.writes.push({ id, method, payload });
        return reply(item);
      }
      return route.fulfill({ status: 404, json: { message: path } });
    },
  );
  await page.goto("/teacher/20");
  await expect(
    page.getByLabel("Worksheet name", { exact: true }),
  ).toBeVisible();
  return state;
}

function sidebar(page) {
  return page.locator(".worksheetActivitySidebar");
}
async function save(page) {
  await page
    .getByRole("button", { name: "Save worksheet", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Save worksheet", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".save-status")).toHaveText("Saved");
}
async function choose(page, name) {
  await sidebar(page).getByRole("button", { name, exact: true }).click();
}
async function holdAndMove(page, source, target, after = false) {
  const start = await source.boundingBox();
  const end = await target.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + 30);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 12, start.y + 30);
  await expect(page.locator(".activityDragPreview")).toBeVisible();
  await page.mouse.move(
    end.x + end.width / 2,
    end.y + (after ? end.height - 5 : 5),
    {
      steps: 8,
    },
  );
  await expect(page.locator(".activityDragPreview")).toBeVisible();

  await page.mouse.up();
  await expect(page.locator(".activityDragPreview")).toHaveCount(0);
}
async function upload(page, field) {
  await field.locator('input[type="file"]').last().setInputFiles({
    name: "my-photo.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(
    field.getByRole("button", { name: "Replace photo", exact: true }),
  ).toBeVisible();
}

test("one selected activity, duplicate, drag, remove, undo, and save with stable IDs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = await setup(page);
  await expect(page.locator(".worksheetCanvas .worksheetGame")).toHaveCount(1);

  await choose(page, "Number sequence");
  await expect(
    page.locator(".worksheetCanvas .sequence-minigame"),
  ).toBeVisible();
  await sidebar(page)
    .getByRole("button", { name: "Duplicate activity" })
    .click();
  await expect(sidebar(page).locator("li")).toHaveCount(5);

  await holdAndMove(
    page,
    sidebar(page).locator("li").nth(2).locator(".activityThumbnail"),
    sidebar(page).locator("li").nth(1),
  );
  await save(page);
  const ordered = [...state.worksheet.items].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  expect(ordered.map((item) => item.id)).toEqual([30, 40, 31, 32, 33]);
  expect(ordered[1].configuration).toEqual(ordered[2].configuration);
  expect(ordered[0].miniGameId).toBe(1);
  await holdAndMove(
    page,
    sidebar(page).locator("li.activitySelected .activityThumbnail"),
    sidebar(page).locator("li").last(),
    true,
  );
  await expect(
    sidebar(page)
      .locator("li")
      .last()
      .getByRole("button", { name: "Number sequence", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".editor-announcement")).toContainText("position");
  await sidebar(page).getByRole("button", { name: "Remove activity" }).click();
  await expect(sidebar(page).locator("li")).toHaveCount(4);
  await page.getByRole("button", { name: "Undo removal" }).click();
  await expect(sidebar(page).locator("li")).toHaveCount(5);
  await save(page);
  await page.reload();
  await expect(sidebar(page).locator("li")).toHaveCount(5);
  expect(
    state.worksheet.items.map((item) => item.id).sort((a, b) => a - b),
  ).toEqual([30, 31, 32, 33, 40]);
});

test("cancelling a drag preserves activity order, selection and saved data", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const state = await setup(page);
  const rows = sidebar(page).locator("li");
  const originalIds = await rows.evaluateAll((elements) =>
    elements.map((element) => element.dataset.activityId),
  );
  const start = await rows.first().locator(".activityThumbnail").boundingBox();
  const target = await rows.nth(2).boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + 30);
  await page.mouse.down();
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height - 5,
    { steps: 6 },
  );
  await expect(page.locator(".activityDragPreview")).toBeVisible();
  await expect(rows.first().locator(".activityThumbnail")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Save worksheet", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".activityDragPreview")).toHaveCount(0);
  expect(
    await rows.evaluateAll((elements) =>
      elements.map((element) => element.dataset.activityId),
    ),
  ).toEqual(originalIds);
  await expect(rows.first().locator(".activityThumbnail")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(state.writes).toHaveLength(0);
  await expect(
    page.getByRole("button", { name: "Save worksheet", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".save-status")).toHaveText("Saved");
});

test("moving immediately after pressing reorders without selecting another activity", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const rows = sidebar(page).locator("li");

  const card = await rows.first().locator(".activityThumbnail").boundingBox();
  const last = await rows.last().boundingBox();
  const x = card.x + card.width / 2;
  const y = card.y + 30;
  const destinationY = last.y + last.height - 5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.clock.runFor(20);
  await page.mouse.move(x + 6, y + 40);
  await page.clock.runFor(20);
  await page.mouse.move(x + 12, destinationY);
  await page.clock.runFor(10);
  const floating = page.locator(".activityDragPreview");
  await expect(floating).toBeVisible();

  await page.mouse.move(x + 20, destinationY - 8);

  await page.mouse.up();
  await expect(floating).toHaveCount(0);
  await expect(rows.last().locator(".activityThumbnail")).toHaveText(
    /Easy math/,
  );
  await expect(rows.last().locator(".activityThumbnail")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("dropping an activity updates its order before pending timers run", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const rows = sidebar(page).locator("li");
  const start = await rows.first().locator(".activityThumbnail").boundingBox();
  const end = await rows.last().boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + 30);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height - 5);
  await page.mouse.up();
  await expect(page.locator(".activityDragPreview")).toHaveCount(0);
  await expect(rows.last().locator(".activityThumbnail")).toHaveText(
    /Easy math/,
  );
  await expect(rows.last().locator(".activityThumbnail")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", { name: "Save worksheet", exact: true }),
  ).toBeEnabled();
  const ids = await rows.evaluateAll((elements) =>
    elements.map((element) => element.dataset.activityId),
  );
  await page.clock.runFor(300);
  expect(
    await rows.evaluateAll((elements) =>
      elements.map((element) => element.dataset.activityId),
    ),
  ).toEqual(ids);
});

test("stationary presses and small movements select; deliberate dragging can be cancelled", async ({
  page,
}) => {
  await setup(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const sequence = sidebar(page).getByRole("button", {
    name: "Number sequence",
    exact: true,
  });
  await sequence.click();
  await expect(sequence).toHaveAttribute("aria-pressed", "true");
  const easy = sidebar(page).getByRole("button", {
    name: "Easy math",
    exact: true,
  });
  const box = await easy.boundingBox();
  for (const [duration, movement] of [
    [100, 0],
    [500, 0],
    [100, 5],
    [500, 5],
  ]) {
    await sequence.click();
    await page.mouse.move(box.x + box.width / 2, box.y + 30);
    await page.mouse.down();
    await page.clock.runFor(duration);
    await page.mouse.move(box.x + box.width / 2 + movement, box.y + 30);
    await expect(sidebar(page).locator(".activityDragging")).toHaveCount(0);
    await expect(page.locator(".activityDragPreview")).toHaveCount(0);
    await page.mouse.up();
    await expect(easy).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByLabel("Worksheet name", { exact: true }),
    ).toBeVisible();
  }

  const sequenceBox = await sequence.boundingBox();
  await page.mouse.move(
    sequenceBox.x + sequenceBox.width / 2,
    sequenceBox.y + 30,
  );
  await page.mouse.down();
  await page.clock.runFor(50);
  await expect(sidebar(page).locator(".activityDragging")).toHaveCount(0);
  await page.mouse.move(
    sequenceBox.x + sequenceBox.width / 2,
    sequenceBox.y + 42,
  );
  await expect(sidebar(page).locator(".activityDragging")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(sidebar(page).locator(".activityDragging")).toHaveCount(0);
  await expect(easy).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Save worksheet", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  await sequence.focus();
  await sequence.press("Enter");
  await expect(sequence).toHaveAttribute("aria-pressed", "true");
  await sequence.press("Alt+ArrowUp");
  await expect(
    sidebar(page).locator("li").first().locator(".activityThumbnail"),
  ).toHaveText(/Number sequence/);
});

test("the whole activity box selects and drags while action buttons stay independent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page);
  const rows = sidebar(page).locator("li");
  const sequenceRow = rows.nth(1);
  const sequence = sequenceRow.locator(".activityThumbnail");
  for (const area of ["padding", "number", "gap"]) {
    await choose(page, "Easy math");
    const row = await sequenceRow.boundingBox();
    const card = await sequence.boundingBox();
    if (area === "number") {
      await sequenceRow.locator(".activityIndex").click();
    } else {
      await page.mouse.click(
        area === "padding" ? row.x + 4 : card.x - 4,
        row.y + 30,
      );
    }
    await expect(sequence).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator(".worksheetCanvas .sequence-minigame"),
    ).toBeVisible();
    await expect(sequence).toBeFocused();
  }

  await choose(page, "Easy math");
  const source = await sequenceRow.boundingBox();
  const last = await rows.last().boundingBox();
  await page.mouse.move(source.x + 4, source.y + 30);
  await page.mouse.down();
  await page.mouse.move(source.x + 4, last.y + last.height - 5);
  await expect(page.locator(".activityDragPreview")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator(".activityDragPreview")).toHaveCount(0);
  await expect(rows.last().locator(".activityThumbnail")).toHaveText(
    /Number sequence/,
  );
  await expect(
    sidebar(page).getByRole("button", { name: "Easy math", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  const duplicate = sidebar(page).getByRole("button", {
    name: "Duplicate activity",
  });
  const action = await duplicate.boundingBox();
  await page.mouse.move(action.x + 10, action.y + 20);
  await page.mouse.down();
  await page.mouse.move(action.x + 22, action.y + 20);
  await expect(page.locator(".activityDragPreview")).toHaveCount(0);
  await page.mouse.up();
  await expect(rows).toHaveCount(5);
  await sidebar(page).getByRole("button", { name: "Remove activity" }).click();
  await expect(rows).toHaveCount(4);
});

test("touch hold reorders without selecting and a quick swipe scrolls the drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 560 });
  const state = await setup(page);
  await page.getByRole("button", { name: /Activities ·/ }).click();
  const drawer = page.getByRole("dialog", { name: "Activities", exact: true });
  const sequence = drawer.getByRole("button", {
    name: "Number sequence",
    exact: true,
  });
  const first = drawer.locator("li").first();
  await sequence.click({ trial: true });
  const start = await sequence.boundingBox();
  const end = await first.boundingBox();
  const session = await page.context().newCDPSession(page);
  const touch = async (type, x, y) =>
    session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    });
  await touch("touchStart", start.x + start.width / 2, start.y + 30);
  await expect(drawer.locator(".activityDragging")).toHaveCount(1);
  await touch("touchMove", end.x + end.width / 2, end.y + 5);
  await expect(page.locator(".activityDragPreview")).toBeVisible();

  await touch("touchEnd");
  await expect(page.locator(".activityDragPreview")).toHaveCount(0);
  await expect(
    drawer.locator("li").first().locator(".activityThumbnail"),
  ).toHaveText(/Number sequence/);
  await expect(
    drawer.getByRole("button", { name: "Easy math", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const scroller = drawer;
  const before = await scroller.evaluate((element) => element.scrollTop);
  const card = drawer.locator("li").nth(1).locator(".activityThumbnail");
  const box = await card.boundingBox();
  await touch("touchStart", box.x + box.width / 2, box.y + 35);
  await touch("touchMove", box.x + box.width / 2, box.y - 20);
  await touch("touchEnd");
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(before);
  await expect(drawer.locator(".activityDragging")).toHaveCount(0);
  await drawer.getByRole("button", { name: "Close", exact: true }).click();
  await page.keyboard.press("Control+s");
  await expect(
    page.getByRole("button", { name: "Save worksheet", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  expect(
    [...state.worksheet.items].sort((a, b) => a.orderIndex - b.orderIndex)[0]
      .id,
  ).toBe(31);
  await session.detach();
});

test("touch dragging near the drawer edge scrolls to later activities", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 400 });
  await setup(page);
  await page.getByRole("button", { name: /Activities ·/ }).click();
  const drawer = page.getByRole("dialog", { name: "Activities", exact: true });
  const sequence = drawer.getByRole("button", {
    name: "Number sequence",
    exact: true,
  });
  await sequence.click({ trial: true });
  const start = await sequence.boundingBox();
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: start.x + start.width / 2, y: start.y + 30 }],
  });
  await expect(page.locator(".activityDragPreview")).toBeVisible();
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: start.x + start.width / 2, y: 385 }],
  });
  await expect
    .poll(() => drawer.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(180);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(page.locator(".activityDragPreview")).toHaveCount(0);
  await expect(
    drawer.locator("li").last().locator(".activityThumbnail"),
  ).toHaveText(/Number sequence/);
  await session.detach();
});

test("photo upload, library reuse, replacement and removal persist and appear in preview", async ({
  page,
}) => {
  const state = await setup(page);
  const field = page.getByRole("region", {
    name: "Activity photo",
    exact: true,
  });
  await upload(page, field);
  expect(state.uploads).toBe(1);
  await save(page);
  expect(state.worksheet.items.find((item) => item.id === 30)).toMatchObject({
    miniGameId: 101,
    configuration: {
      imageAssetId: 500,
      exerciseCount: 37,
      maxNumber: 73,
      operations: ["*", "/"],
    },
  });
  await page.reload();
  await expect(field.locator(".photoFieldPreview")).toHaveAttribute(
    "src",
    "/api/minigame-assets/500/content",
  );
  await field.getByRole("button", { name: "My photos", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "my-photo.png", exact: true })
    .click();
  expect(state.uploads).toBe(1);
  await upload(page, field);
  await save(page);
  expect(
    state.worksheet.items.find((item) => item.id === 30).configuration
      .imageAssetId,
  ).toBe(501);
  await page
    .getByRole("button", { name: "Preview as child", exact: true })
    .click();
  await expect(page.locator(".activityPhoto img")).toHaveAttribute(
    "src",
    "/api/minigame-assets/501/content",
  );
  await page
    .getByRole("button", { name: "Back to editor", exact: true })
    .click();
  await field
    .getByRole("button", { name: "Remove photo", exact: true })
    .click();
  await choose(page, "Letters & pictures");
  await upload(page, page.getByRole("region", { name: "Urs", exact: true }));
  await expect(page.locator(".widget img")).toHaveAttribute(
    "src",
    "/api/minigame-assets/502/content",
  );
  await choose(page, "Match the Amounts");
  await page
    .getByRole("region", { name: "Pair 1", exact: true })
    .getByRole("button", { name: "My photos", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "my-photo.png", exact: true })
    .first()
    .click();
  await save(page);
  expect(
    state.worksheet.items.find((item) => item.id === 30).configuration
      .imageAssetId,
  ).toBeNull();
  expect(
    state.worksheet.items.find((item) => item.id === 32).configuration
      .animals[0].imageAssetId,
  ).toBe(502);
  expect(
    state.worksheet.items.find((item) => item.id === 33).configuration.pairs[0]
      .imageAssetId,
  ).toBe(500);
});

test("a failed upload retains the existing photo and settings", async ({
  page,
}) => {
  const state = await setup(page);
  const field = page.getByRole("region", {
    name: "Activity photo",
    exact: true,
  });
  await upload(page, field);
  await save(page);
  state.failUpload = true;
  await field
    .locator('input[type="file"]')
    .last()
    .setInputFiles({ name: "other.png", mimeType: "image/png", buffer: png });
  await expect(field.getByText("Upload failed", { exact: true })).toBeVisible();
  await expect(field.locator(".photoFieldPreview")).toHaveAttribute(
    "src",
    "/api/minigame-assets/500/content",
  );
  await expect(
    page.getByRole("button", { name: "Save worksheet", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".save-status")).toHaveText("Saved");
});

test("phone activity drawer supports switching without losing edited settings", async ({
  page,
}) => {
  const state = await setup(page);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });

    await page.getByRole("button", { name: /Activities ·/ }).click();
    const drawer = page.getByRole("dialog", {
      name: "Activities",
      exact: true,
    });
    await expect(drawer).toBeVisible();

    await drawer
      .getByRole("button", { name: "Number sequence", exact: true })
      .click();
    await expect(drawer).toBeHidden();
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(
      page.locator(".worksheetCanvas .sequence-minigame"),
    ).toBeVisible();
    await page.getByRole("button", { name: /Activities ·/ }).click();

    await drawer
      .getByRole("button", { name: "Easy math", exact: true })
      .click();
  }
  await page.keyboard.press("Control+s");
  await expect(
    page.getByRole("button", { name: "Save worksheet", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".save-status")).toHaveText("Saved");
  expect(
    state.worksheet.items.find((item) => item.id === 30).configuration
      .exerciseCount,
  ).toBe(37);
});

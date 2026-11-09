import { test, expect } from "@playwright/test";

// Run only against a disposable backend/database. No API mocking is used here.
test("real backend: all six editors persist non-default settings and a class completes a worksheet", async ({
  browser,
  page,
}) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(20_000);
  const illustration = await page.request.get(
    "/img/illustrations/v1/apple.svg",
  );
  expect(illustration.ok()).toBe(true);
  expect(illustration.headers()["content-type"]).toContain("svg");
  await page.addInitScript(() =>
    localStorage.setItem("worksheet-language", "en"),
  );
  await page.goto("/signup");
  await page.getByLabel("Username", { exact: true }).fill("Redesign teacher");
  await page
    .getByLabel("Email", { exact: true })
    .fill("redesign-" + Date.now() + "@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("A-strong-test-password-2026");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("A-strong-test-password-2026");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/sheets");
  async function create(name) {
    await page
      .getByRole("button", { name: "New worksheet", exact: true })
      .first()
      .click();
    await page.getByLabel("Worksheet name", { exact: true }).fill(name);
    await page
      .getByRole("button", { name: "Create worksheet", exact: true })
      .click();
    await expect(
      page.getByLabel("Worksheet name", { exact: true }),
    ).toHaveValue(name);
  }
  async function add(title) {
    await page
      .locator(".worksheetActivitySidebar")
      .getByRole("button", { name: "Add activity", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Add activity", exact: true })
      .getByRole("button", { name: title, exact: true })
      .click();
  }
  async function save() {
    await page
      .getByRole("button", { name: "Save worksheet", exact: true })
      .click();
    await expect(page.locator(".save-status")).toHaveText("Saved");
  }
  await create("A temporary worksheet");
  await page.goto("/sheets");
  await page
    .getByRole("button", {
      name: "More actions: A temporary worksheet",
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", { name: "Rename worksheet", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Worksheet name", { exact: true })
    .fill("A renamed worksheet");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(
    page.getByRole("link", {
      name: "Open worksheet: A renamed worksheet",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "More actions: A renamed worksheet",
      exact: true,
    })
    .click();
  await page
    .getByRole("menuitem", {
      name: "Delete worksheet: A renamed worksheet",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete worksheet", exact: true })
    .click();
  await expect(page.locator(".worksheet-card")).toHaveCount(0);
  await create("All six real editors");
  for (const title of [
    "Easy math",
    "Number sequence",
    "Higher or lower",
    "Odd or even",
  ]) {
    await add(title);
    const settings = page.locator(".editor-settings");
    await settings.getByRole("spinbutton").nth(0).fill("73");
    await settings.getByRole("spinbutton").nth(1).fill("37");
    if (title === "Easy math") {
      await page.getByLabel("Addition (+)", { exact: true }).uncheck();
      await page.getByLabel("Subtraction (-)", { exact: true }).uncheck();
    }
  }
  await add("Letters & pictures");
  await page.getByLabel("Target letter", { exact: true }).fill("u");
  await page.getByLabel("Name 1", { exact: true }).fill("Ursul");
  await add("Match the Amounts");
  await page.getByLabel("Number", { exact: true }).first().fill("5");
  await page.getByRole("tab", { name: "Visuals", exact: true }).click();
  await page
    .locator(".editor-settings .visual-picker")
    .first()
    .getByRole("button", { name: "Pear", exact: true })
    .click();
  await page.getByText("Activity image (optional)", { exact: true }).click();
  const photo = await page.screenshot({
    clip: { x: 0, y: 0, width: 20, height: 20 },
  });
  await page
    .getByRole("region", { name: "Activity photo", exact: true })
    .locator('input[type="file"]')
    .setInputFiles({
      name: "demo-photo.png",
      mimeType: "image/png",
      buffer: photo,
    });
  await expect(
    page
      .getByRole("region", { name: "Activity photo", exact: true })
      .getByRole("button", { name: "Replace photo", exact: true }),
  ).toBeVisible();
  await save();
  const id = new URL(page.url()).pathname.split("/").at(-1);
  let response = await page.request.get("/api/worksheets/" + id);
  expect(response.ok()).toBe(true);
  const saved = await response.json();
  expect(saved.items).toHaveLength(6);
  for (const item of saved.items.filter(
    (item) => !["color-game", "matching-game"].includes(item.definition.type),
  ))
    expect(item.configuration).toMatchObject({
      maxNumber: 73,
      exerciseCount: 37,
    });
  expect(
    saved.items.find((item) => item.definition.type === "math-game")
      .configuration.operations,
  ).toEqual(["*", "/"]);
  expect(
    saved.items.find((item) => item.definition.type === "color-game")
      .configuration.animals[0].name,
  ).toBe("Ursul");
  expect(
    saved.items.find((item) => item.definition.type === "matching-game")
      .configuration,
  ).toMatchObject({
    pairs: [{ number: 5, emoji: "🍐" }, { number: 2 }, { number: 3 }],
    imageAssetId: expect.any(Number),
  });
  await page.reload();
  await page.getByRole("button", { name: "Easy math", exact: true }).click();
  await page.getByLabel("Number of exercises:", { exact: true }).fill("23");
  await save();
  response = await page.request.get("/api/worksheets/" + id);
  const updated = await response.json();
  expect(updated.items.map((item) => item.id)).toEqual(
    saved.items.map((item) => item.id),
  );
  expect(updated.items[0].configuration.exerciseCount).toBe(23);

  await page.goto("/sheets");
  await create("One little discovery");
  await add("Odd or even");
  await page.getByLabel("Maximum number:", { exact: true }).fill("1");
  await page.getByLabel("Number of exercises:", { exact: true }).fill("1");
  await save();
  await page.goto("/classes");
  await page.getByRole("button", { name: "New class", exact: true }).click();
  await page
    .getByLabel("Class name", { exact: true })
    .fill("Redesign explorers");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "New class", exact: true })
    .click();
  await expect(page).toHaveURL(/\/classes\/\d+$/);
  const classroomPath = new URL(page.url()).pathname;
  await page.getByRole("button", { name: "Add students", exact: true }).click();
  await page.getByLabel("Student names, one per line").fill("Alex\nMaria");
  await page
    .getByRole("button", { name: "Review students", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add students", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const roster = await (
    await page.request.get("/api" + classroomPath + "/members")
  ).json();
  const alexIdentity = roster.find((s) => s.name === "Alex");
  await page.goto(classroomPath + "?tab=students");
  await page
    .locator("tr")
    .filter({ hasText: "Alex" })
    .locator("summary")
    .click();
  await page.getByRole("button", { name: "Login card", exact: true }).click();
  const studentCode = await page.locator(".student-login-code").innerText();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto(classroomPath);
  await page
    .getByRole("button", { name: "Assign worksheet", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /One little discovery/ })
    .click();
  await page
    .getByRole("button", { name: "Review assignment", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Assign worksheet", exact: true })
    .click();
  await expect(page.locator(".delivery-card")).toHaveCount(1);

  const child = await browser.newContext();
  const childPage = await child.newPage();
  childPage.setDefaultTimeout(20_000);
  try {
    await childPage.addInitScript(() =>
      localStorage.setItem("worksheet-language", "en"),
    );
    await childPage.goto(new URL("/", page.url()).href);
    await childPage
      .getByLabel("Student code", { exact: true })
      .fill(studentCode);

    await childPage
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(childPage).toHaveURL(/\/student$/);
    expect(
      (await childPage.request.get("/api/assignments/report")).status(),
    ).toBe(403);
    await childPage.screenshot({
      path: test.info().outputPath("student-work.png"),
      fullPage: true,
    });
    await childPage.getByRole("button", { name: "Start", exact: true }).click();
    await childPage.getByRole("link", { name: "Back", exact: true }).click();
    await childPage
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(childPage).toHaveURL(/\/attempts\/\d+$/);
    await childPage.reload();
    await childPage.getByRole("button", { name: "Odd", exact: true }).click();
    await childPage
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await childPage
      .getByRole("button", { name: "Finish worksheet", exact: true })
      .click();
    await expect(
      childPage.getByRole("heading", { name: "Well done!", exact: true }),
    ).toBeVisible();
  } finally {
    await child.close();
  }
  await page.goto(classroomPath + "/children/" + alexIdentity.userId);
  await page
    .getByRole("link", { name: "One little discovery", exact: true })
    .click();
  await expect(page.getByRole("row", { name: /Activity 1/ })).toContainText(
    "1 / 1",
  );
  const savedAttempt = new URL(page.url()).pathname.split("/").at(-1);
  await page.goto(classroomPath + "?tab=students");
  await page
    .locator("tr")
    .filter({ hasText: "Alex" })
    .locator("summary")
    .click();
  await page.getByRole("button", { name: "Login card", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Replace login code", exact: true })
    .click();
  await expect(page.locator(".student-login-code")).not.toHaveText(studentCode);
  const replacement = await page.locator(".student-login-code").innerText();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  const checkContext = await browser.newContext();
  try {
    const checkPage = await checkContext.newPage();
    await checkPage.addInitScript(() =>
      localStorage.setItem("worksheet-language", "en"),
    );
    await checkPage.goto(new URL("/", page.url()).href);
    await checkPage
      .getByLabel("Student code", { exact: true })
      .fill(studentCode);
    await checkPage
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(checkPage.getByRole("alert")).toContainText(
      "Student code not found",
    );
    await checkPage
      .getByLabel("Student code", { exact: true })
      .fill(replacement);
    await checkPage
      .getByRole("button", { name: "Continue", exact: true })
      .click();
    await expect(checkPage).toHaveURL(/\/student$/);
    await checkPage
      .getByRole("link", { name: "Finished work", exact: true })
      .click();
    await expect(
      checkPage.getByRole("heading", {
        name: "One little discovery",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await checkContext.close();
  }
  await page
    .getByRole("link", { name: "Student access cards", exact: true })
    .click();
  await expect(page.locator(".student-login-card")).toHaveCount(2);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).not.toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("access-cards.png"),
    fullPage: true,
  });
  await page.emulateMedia({ media: "screen" });
  await page.goto(classroomPath + "?tab=assignments");
  await expect(page.locator(".delivery-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Assign worksheet", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "One little discovery", exact: true })
    .click();
  await page.getByLabel("Recipients", { exact: true }).selectOption("selected");
  await page.getByLabel("Maria", { exact: true }).check();
  await page
    .getByRole("button", { name: "Review assignment", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Assign worksheet", exact: true })
    .click();
  await expect(page.locator(".delivery-card")).toHaveCount(2);
  await page.screenshot({
    path: test.info().outputPath("teacher-assignments.png"),
    fullPage: true,
  });
  const delivered = await page.request.get("/api/assignments");
  const batches = await delivered.json();
  expect(new Set(batches.map((item) => item.batchId)).size).toBe(2);
  const second = batches.find(
    (item) =>
      item.userName === "Maria" &&
      !batches.some(
        (other) => other.batchId === item.batchId && other.userName === "Alex",
      ),
  );
  expect(second).toBeTruthy();
  const wholeClass = page
    .locator(".delivery-card")
    .filter({ hasText: "1 / 2" });
  await wholeClass
    .getByRole("button", { name: "Close assignment", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close assignment", exact: true })
    .click();
  await expect(page.locator(".delivery-card")).toHaveCount(1);
  const preserved = await page.request.get("/api/attempts/" + savedAttempt);
  expect((await preserved.json()).totalScore).toBe(1);
  await page.goto("/results");
  await expect(
    page.getByRole("link", { name: "View Alex's result", exact: true }),
  ).toHaveText("1 / 1");
  await page.screenshot({
    path: test.info().outputPath("teacher-results.png"),
    fullPage: true,
  });
});

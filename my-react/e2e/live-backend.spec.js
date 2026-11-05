import { test, expect } from "@playwright/test";

// Run only against a disposable backend/database. No API mocking is used here.
test("real backend: all six editors persist non-default settings and a class completes a worksheet", async ({
  browser,
  page,
}) => {
  test.setTimeout(150_000);
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
  await expect(page).toHaveURL(/\/sheets$/);
  async function create(name) {
    await page
      .getByRole("button", { name: "New worksheet", exact: true })
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
  await page.getByLabel("Picture or emoji", { exact: true }).first().fill("🍐");
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
  await page.getByRole("button", { name: "Add student", exact: true }).click();
  await page.getByLabel("Student name", { exact: true }).fill("Alex");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const studentCode = await page
    .locator(".student-access-code code")
    .innerText();
  await page.getByRole("button", { name: "Start a test", exact: true }).click();
  await page
    .getByRole("button", { name: "One little discovery", exact: true })
    .click();
  const worksheetCode = await page
    .locator(".test-code-banner strong")
    .innerText();

  const child = await browser.newContext();
  const childPage = await child.newPage();
  try {
    await childPage.addInitScript(() =>
      localStorage.setItem("worksheet-language", "en"),
    );
    await childPage.goto(new URL("/", page.url()).href);
    await childPage
      .getByLabel("Student code", { exact: true })
      .fill(studentCode);
    await childPage
      .getByLabel("Worksheet code", { exact: true })
      .fill(worksheetCode);
    await childPage
      .getByRole("button", { name: "Check and start", exact: true })
      .click();
    await childPage.getByRole("button", { name: "Odd", exact: true }).click();
    await childPage
      .getByRole("button", { name: "Finish worksheet", exact: true })
      .click();
    await expect(
      childPage.getByRole("heading", { name: "Well done!", exact: true }),
    ).toBeVisible();
  } finally {
    await child.close();
  }
  await page.reload();
  await expect(
    page.locator(".student-block").getByText("100%", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Alex", exact: true }).click();
  await page
    .getByRole("link", { name: "One little discovery", exact: true })
    .click();
  await expect(page.getByRole("row", { name: /Activity 1/ })).toContainText(
    "1 / 1",
  );
});

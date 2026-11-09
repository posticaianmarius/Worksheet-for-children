import { test, expect } from "@playwright/test";
import { setupLibrary } from "./fixtures/library.js";
import process from "node:process";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

for (const [label, width, language] of [
  ["desktop", 1440, "en"],
  ["phone", 390, "en"],
  ["phone-ro", 390, "ro"],
]) {
  test(`library review screenshots: ${label}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await setupLibrary(page, { language });
    await page.goto("/sheets");
    await expect(page.locator(".worksheet-card")).toHaveCount(6);
    await page.evaluate(() => document.fonts.ready);
    const directory =
      process.env.WORKSHEET_LIBRARY_CAPTURE_DIR ??
      test.info().outputPath("review");
    await mkdir(directory, { recursive: true });
    await page.screenshot({
      path: join(directory, `${label}.png`),
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByRole("button", {
        name: language === "ro" ? "Fișă nouă" : "New worksheet",
        exact: true,
      })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({
      path: join(directory, `create-${label}.png`),
      fullPage: false,
      animations: "disabled",
    });
  });
}

async function manage(page, name, action) {
  await page
    .getByRole("button", { name: "More actions: " + name, exact: true })
    .click();
  await page
    .getByRole("menuitem", {
      name:
        action === "rename" ? "Rename worksheet" : "Delete worksheet: " + name,
      exact: true,
    })
    .click();
  return page.getByRole("dialog");
}

test("search, content filters, view and ordering persist together and reset predictably", async ({
  page,
}) => {
  await setupLibrary(page);
  await page.goto("/sheets");
  await page.getByRole("tab", { name: /With activities/ }).click();
  await expect(page.locator(".worksheet-card")).toHaveCount(5);
  const search = page.getByRole("searchbox", { name: "Search worksheets" });
  await search.fill("letters");
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Sort worksheets" })
    .selectOption("name");
  await page.reload();
  await expect(search).toHaveValue("letters");
  await expect(page.locator(".worksheet-card")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "List view", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("tab", { name: /With activities/ }),
  ).toHaveAttribute("aria-selected", "true");
  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(page.locator(".worksheet-card")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.locator(".worksheet-card")).toHaveCount(6);
  await expect(search).toBeFocused();
  await expect(page).toHaveURL(/view=list/);
  await expect(
    page.getByRole("combobox", { name: "Sort worksheets" }),
  ).toHaveValue("name");
  await search.fill("no such worksheet");
  await expect(
    page.getByRole("heading", { name: "No worksheets found" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .click();
  await expect(page.locator(".worksheet-card")).toHaveCount(6);
});

test("rename retries preserve the name and activity content, then return focus to search", async ({
  page,
}) => {
  const state = await setupLibrary(page, { failRenameOnce: true });
  const content = structuredClone(state.sheets[0].items);
  await page.goto("/sheets");
  const dialog = await manage(page, "Little number discoveries", "rename");
  await expect(
    dialog.getByRole("button", { name: "Save name" }),
  ).toBeDisabled();
  await dialog
    .getByLabel("Worksheet name", { exact: true })
    .fill("  A renamed discovery  ");
  await dialog.getByRole("button", { name: "Save name" }).click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Could not rename worksheet.",
  );
  await expect(
    dialog.getByLabel("Worksheet name", { exact: true }),
  ).toHaveValue("  A renamed discovery  ");
  await dialog.getByRole("button", { name: "Save name" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("searchbox")).toBeFocused();
  await expect(
    page.getByRole("link", {
      name: "Open worksheet: A renamed discovery",
      exact: true,
    }),
  ).toBeVisible();
  expect(state.sheets.find((sheet) => sheet.id === 20).items).toEqual(content);
  expect(state.renames).toEqual([
    { id: 20, name: "A renamed discovery" },
    { id: 20, name: "A renamed discovery" },
  ]);
  await page.reload();
  await expect(
    page.getByRole("link", {
      name: "Open worksheet: A renamed discovery",
      exact: true,
    }),
  ).toBeVisible();
});

test("delete supports cancel, error recovery and focus after removing a card", async ({
  page,
}) => {
  const state = await setupLibrary(page, { failDeleteOnce: true });
  await page.goto("/sheets");
  let dialog = await manage(page, "Our next little adventure", "delete");
  await expect(
    dialog.getByText("Our next little adventure", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: "More actions: Our next little adventure",
      exact: true,
    }),
  ).toBeFocused();
  expect(state.deletes).toEqual([]);
  dialog = await manage(page, "Our next little adventure", "delete");
  await dialog
    .getByRole("button", { name: "Delete worksheet", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "Could not delete worksheet.",
  );
  await expect(page.locator(".worksheet-card")).toHaveCount(6);
  await dialog
    .getByRole("button", { name: "Delete worksheet", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".worksheet-card")).toHaveCount(5);
  await expect(page.getByRole("searchbox")).toBeFocused();
  await page.reload();
  await expect(page.locator(".worksheet-card")).toHaveCount(5);
});

test("published worksheet deletion explains the restriction and keeps the worksheet", async ({
  page,
}) => {
  const state = await setupLibrary(page, { published: true });
  await page.goto("/sheets");
  const dialog = await manage(page, "Little number discoveries", "delete");
  await dialog
    .getByRole("button", { name: "Delete worksheet", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "has been shared or assigned",
  );
  await expect(
    dialog.getByRole("button", { name: "Delete worksheet", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".worksheet-card")).toHaveCount(6);
  expect(state.deletes).toHaveLength(1);
});

for (const language of ["en", "ro"]) {
  test(`empty library and creation fit a 320px phone in ${language}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    const state = await setupLibrary(page, {
      empty: true,
      language,
      failCreateOnce: true,
    });
    await page.goto("/sheets");
    const trigger = page
      .getByRole("button", {
        name: language === "en" ? "New worksheet" : "Fișă nouă",
        exact: true,
      })
      .first();
    await trigger.click();
    const dialog = page.getByRole("dialog");
    const input = dialog.getByRole("textbox");
    const submit = dialog.getByRole("button", {
      name: language === "en" ? "Create worksheet" : "Creează fișa",
      exact: true,
    });
    await expect(input).toBeFocused();
    await input.fill("   ");
    await expect(submit).toBeDisabled();
    await input.fill("  Our new discoveries  ");
    await submit.click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(input).toHaveValue("  Our new discoveries  ");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(state.creates).toEqual([{ name: "Our new discoveries" }]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
  });
}

test("native worksheet links and share controls remain independent", async ({
  page,
}) => {
  await setupLibrary(page);
  await page.goto("/sheets");
  const link = page.getByRole("link", {
    name: "Open worksheet: Little number discoveries",
    exact: true,
  });
  await expect(link).toHaveAttribute("href", "/teacher/20");
  await page
    .getByRole("button", {
      name: "Share worksheet: Little number discoveries",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("dialog").getByText("ABC23456", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/sheets$/);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Share worksheet: Our next little adventure",
      exact: true,
    }),
  ).toBeDisabled();
  await link.focus();
  await link.press("Enter");
  await expect(page).toHaveURL(/\/teacher\/20$/);
});

test("creating once stays locked while saving and opens the lab after acknowledgement", async ({
  page,
}) => {
  const state = await setupLibrary(page, { holdCreate: true });
  await page.goto("/sheets");
  await page
    .getByRole("button", { name: "New worksheet", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox").fill("A new discovery");
  const create = dialog.getByRole("button", {
    name: "Create worksheet",
    exact: true,
  });
  await create.evaluate((button) => {
    button.click();
    button.click();
  });
  await expect.poll(() => state.creates.length).toBe(1);
  await expect(create).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  state.releaseCreate();
  await expect(page).toHaveURL(/\/teacher\/26$/);
  await expect(page.getByLabel("Worksheet name", { exact: true })).toHaveValue(
    "A new discovery",
  );
  expect(state.creates).toHaveLength(1);
});

for (const language of ["en", "ro"]) {
  test(`phone sorting, compact list and keyboard filters work in ${language}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await setupLibrary(page, { language });
    await page.goto("/sheets");
    const options = page.getByRole("button", {
      name:
        language === "en"
          ? "Sort and view options"
          : "Opțiuni de sortare și afișare",
      exact: true,
    });
    await expect(options).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await options.click();
    await page.getByRole("combobox").selectOption("name");
    await page
      .getByRole("button", {
        name: language === "en" ? "List view" : "Afișare în listă",
        exact: true,
      })
      .click();
    await expect(
      page.locator(".library-grid--list .worksheet-card"),
    ).toHaveCount(6);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(320);
    await page.screenshot({
      path: test.info().outputPath(`list-${language}-phone.png`),
      fullPage: true,
    });
    const all = page.getByRole("tab", {
      name: language === "en" ? /All worksheets/ : /Toate fișele/,
    });
    await all.focus();
    await all.press("End");
    await expect(page.locator(".worksheet-card")).toHaveCount(1);
    await expect(
      page.getByRole("tab", {
        name: language === "en" ? /Empty worksheets/ : /Fișe goale/,
      }),
    ).toHaveAttribute("aria-selected", "true");
  });
}

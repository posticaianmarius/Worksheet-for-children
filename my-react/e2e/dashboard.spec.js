import { test, expect } from "@playwright/test";
import { setupDashboard } from "./fixtures/dashboard.js";

test("a worksheet starts directly from home and a failed creation keeps its name for retry", async ({
  page,
}) => {
  const state = await setupDashboard(page, { failCreateOnce: true });
  await page.goto("/home");
  await page
    .getByRole("button", { name: "New worksheet", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Create worksheet",
    exact: true,
  });
  const name = dialog.getByRole("textbox", {
    name: "Worksheet name",
    exact: true,
  });
  await expect(name).toBeFocused();
  await name.fill("  Morning practice  ");
  await dialog
    .getByRole("button", { name: "Create worksheet", exact: true })
    .click();
  await expect(
    dialog.getByText("Could not create worksheet.", { exact: true }),
  ).toBeVisible();
  await expect(name).toHaveValue("  Morning practice  ");
  await dialog
    .getByRole("button", { name: "Create worksheet", exact: true })
    .click();
  await expect(page).toHaveURL(/\/teacher\/24$/);
  await expect(
    page.getByRole("textbox", { name: "Worksheet name", exact: true }),
  ).toHaveValue("Morning practice");
  expect(state.created).toEqual([
    { name: "Morning practice" },
    { name: "Morning practice" },
  ]);
});

test("home counts deliveries rather than recipients and links directly to results", async ({
  page,
}) => {
  await setupDashboard(page, {
    assignments: [
      { id: 1, batchId: "batch-a" },
      { id: 2, batchId: "batch-a" },
      { id: 3, batchId: "batch-b" },
    ],
  });
  await page.goto("/home");
  await expect(
    page.getByRole("link", { name: /^Assignments\s*2$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Set up your teaching space" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "View results", exact: true }).click();
  await expect(page).toHaveURL(/\/results$/);
  await expect(
    page.getByRole("heading", { name: "Results", exact: true }),
  ).toBeVisible();
});

for (const language of ["en", "ro"]) {
  test(`empty home is usable on a narrow phone in ${language}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await setupDashboard(page, { empty: true, language });
    await page.goto("/home");
    await expect(
      page.getByRole("heading", {
        name:
          language === "en"
            ? "Your next worksheet starts here"
            : "Următoarea fișă începe aici",
        exact: true,
      }),
    ).toBeVisible();
    const create = page.getByRole("button", {
      name: language === "en" ? "New worksheet" : "Fișă nouă",
      exact: true,
    });
    await create.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(create).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
}

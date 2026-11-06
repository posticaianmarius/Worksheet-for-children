import { spaceContextFor } from "./space-fixtures.js";
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("worksheet-language", "ro"),
  );
});

const configuration = {
  letter: "u",
  animals: [
    { id: "bear", name: "Urs", img: "/img/BearImg.webp" },
    { id: "fox", name: "Vulpe", img: "/img/FoxImg.webp" },
    { id: "wolf", name: "Lup", img: "/img/WolfImg.webp" },
  ],
};

test("child preview does not save results and child gameplay saves its score", async ({
  page,
}) => {
  let role = "TEACHER";
  let saved;
  const definition = { id: 1, type: "color-game", name: "Color Game" };
  const item = {
    id: 30,
    miniGameId: 1,
    orderIndex: 0,
    definition,
    configuration,
  };
  const attempt = {
    id: 40,
    assignmentId: 50,
    status: "IN_PROGRESS",
    items: [item],
    results: [],
  };
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      const reply = (json) => route.fulfill({ json });
      if (path === "/api/auth/context") {
        const reply = (json, status = 200) =>
          route.fulfill({ json: spaceContextFor(json), status });
        return reply({ id: 2, name: "Ana", role });
      }
      if (path === "/api/auth/me") return reply({ id: 2, name: "Ana", role });
      if (path === "/api/auth/csrf")
        return reply({ headerName: "X-XSRF-TOKEN", token: "test" });
      if (path === "/api/minigames") return reply([definition]);
      if (path === "/api/worksheets/20")
        return reply({ id: 20, name: "Animale", items: [item] });
      if (path === "/api/attempts/40") return reply(attempt);
      if (path === "/api/attempts/40/items/30/result") {
        saved = route.request().postDataJSON();
        return reply({ ...saved, revisionItemId: 30 });
      }
      return route.fulfill({ status: 404, json: { message: path } });
    },
  );
  await page.setViewportSize({ width: 1582, height: 1000 });
  await page.goto("/teacher/20");
  await page.getByRole("button", { name: "Previzualizează ca elev" }).click();
  const game = page.locator('[data-game-type="color-game"]');
  await expect(game.locator(".widget")).toHaveCount(3);
  await expect(game.locator("input")).toHaveCount(0);
  await expect(
    game.getByRole("img", { name: "Urs", exact: true }),
  ).toBeVisible();
  await expect(game.locator(".bubles button")).toHaveCount(11);

  await game
    .getByRole("button", { name: "Litera 1 din Urs", exact: true })
    .click();
  await game.getByRole("button", { name: "Am terminat", exact: true }).click();
  await game.getByRole("button", { name: "Continuă", exact: true }).click();
  await expect(
    page.getByText("Ai terminat toate activitățile!", { exact: true }),
  ).toBeVisible();
  expect(saved).toBeUndefined();
  role = "USER";
  await page.goto("/attempts/40");
  await expect(game.locator(".widget")).toHaveCount(3);
  await expect(game.locator("input")).toHaveCount(0);

  await game
    .getByRole("button", { name: "Litera 2 din Urs", exact: true })
    .click();
  await expect(
    game.getByRole("button", { name: "Litera 2 din Urs", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  for (const label of [
    "Litera 1 din Urs",
    "Litera 2 din Vulpe",
    "Litera 2 din Lup",
  ]) {
    await game.getByRole("button", { name: label, exact: true }).click();
  }
  await game.getByRole("button", { name: "Am terminat", exact: true }).click();
  await game.getByRole("button", { name: "Continuă", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Finalizează fișa" }),
  ).toBeVisible();
  expect(saved).toMatchObject({ score: 3, maxScore: 3, outcome: "COMPLETED" });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(game.locator(".widget")).toHaveCount(3);
});

for (const type of [
  "math-game",
  "sequence-game",
  "higher-lower-game",
  "matching-game",
]) {
  test(`${type} uses the original child game and persists results`, async ({
    page,
  }) => {
    let saved;
    const item = {
      id: 30,
      definition: { type },
      configuration: {
        exerciseCount: 1,
        maxNumber: 1,
        operations: ["+"],
        pairs: [{ id: "apple", number: 1, emoji: "🍎" }],
      },
    };
    await page.route(
      (url) => url.pathname.startsWith("/api/"),
      async (route) => {
        const path = new URL(route.request().url()).pathname;
        const reply = (json) => route.fulfill({ json });
        if (path === "/api/auth/context") {
          const reply = (json, status = 200) =>
            route.fulfill({ json: spaceContextFor(json), status });
          return reply({ id: 2, name: "Ana", role: "USER" });
        }
        if (path === "/api/auth/me")
          return reply({ id: 2, name: "Ana", role: "USER" });
        if (path === "/api/auth/csrf")
          return reply({ headerName: "X-XSRF-TOKEN", token: "test" });
        if (path === "/api/attempts/40")
          return reply({
            id: 40,
            assignmentId: 50,
            status: "IN_PROGRESS",
            items: [item],
            results: [],
          });
        if (path === "/api/attempts/40/items/30/result") {
          saved = route.request().postDataJSON();
          return reply({ ...saved, revisionItemId: 30 });
        }
        return route.fulfill({ status: 404, json: { message: path } });
      },
    );
    await page.goto("/attempts/40");
    const game = page.locator(`[data-game-type="${type}"]`);
    await expect(game.getByRole("heading").first()).not.toBeEmpty();

    if (type === "matching-game") {
      await game
        .locator(".matching-number-card")
        .dragTo(game.locator(".matching-target-card"));
      await game.getByRole("button", { name: /Verifică răspunsul/ }).click();
      await expect(
        game.getByRole("button", { name: "Continuă", exact: true }),
      ).toBeVisible();
      await expect(game.getByRole("button", { name: /Reia/ })).toHaveCount(0);
      await expect(
        game.getByRole("button", { name: /Verifică răspunsul/ }),
      ).toBeDisabled();
    } else {
      let answer;
      if (type === "math-game") answer = "2";
      if (type === "sequence-game") {
        const values = await game
          .locator(".sequence-question span")
          .allTextContents();
        const numbers = values.slice(0, -1).map(Number);
        answer = String(numbers.at(-1) + numbers.at(-1) - numbers.at(-2));
      }
      if (type === "higher-lower-game") {
        const numbers = (
          await game.locator(".higher-lower-question strong").innerText()
        )
          .match(/\d+/g)
          .map(Number);
        answer = numbers[0] > numbers[1] ? "Mai mare" : "Mai mic";
      }
      await game.getByRole("button", { name: answer, exact: true }).click();
    }
    if (type === "matching-game")
      await game.getByRole("button", { name: "Continuă", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Finalizează fișa" }),
    ).toBeVisible();
    expect(saved).toMatchObject({
      score: 1,
      maxScore: 1,
      outcome: "COMPLETED",
    });
  });
}

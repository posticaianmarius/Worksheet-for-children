import { test, expect } from "@playwright/test";

test.use({ hasTouch: true });

const soundPaths = {
  correct: "/sounds/correct-answer-tone.wav",
  incorrect: "/sounds/wrong-answer-fail-notification.wav",
  complete: "/sounds/correct-answer-reward.wav",
};

async function openGame(
  page,
  type,
  {
    blockedAudio = false,
    exerciseCount = 1,
    failFirstSave = false,
    nextGame = false,
    holdSave = false,
  } = {},
) {
  await page.addInitScript(
    ({ blockedAudio }) => {
      localStorage.setItem("worksheet-language", "ro");
      window.feedbackPlayed = [];
      window.feedbackPaused = [];
      window.Audio = class {
        constructor(src) {
          this.src = src;
        }
        play() {
          window.feedbackPlayed.push(this.src);
          return blockedAudio
            ? Promise.reject(new Error("Audio blocked"))
            : Promise.resolve();
        }
        pause() {
          window.feedbackPaused.push(this.src);
        }
      };
    },
    { blockedAudio },
  );
  const item = {
    id: 30,
    definition: { type },
    configuration: {
      exerciseCount,
      maxNumber: 1,
      operations: ["+"],
      letter: "u",
      animals: [{ id: "bear", name: "Urs", img: "/img/BearImg.webp" }],
      pairs: [
        { id: "one", number: 1, emoji: "🍎" },
        { id: "two", number: 2, emoji: "🍊" },
      ],
    },
  };
  let saved;
  const requests = [];
  let releaseSave;
  const saveGate = new Promise((resolve) => {
    releaseSave = resolve;
  });
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === "/api/auth/me")
        return route.fulfill({ json: { id: 2, name: "Ana", role: "USER" } });
      if (path === "/api/auth/csrf")
        return route.fulfill({
          json: { headerName: "X-XSRF-TOKEN", token: "test" },
        });
      if (path === "/api/attempts/40")
        return route.fulfill({
          json: {
            id: 40,
            assignmentId: 50,
            status: "IN_PROGRESS",
            items: nextGame
              ? [
                  item,
                  {
                    id: 31,
                    definition: { type: "color-game" },
                    configuration: item.configuration,
                  },
                ]
              : [item],
            results: [],
          },
        });
      if (path === "/api/attempts/40/items/30/result") {
        const payload = route.request().postDataJSON();
        requests.push(payload);
        if (holdSave) await saveGate;
        if (failFirstSave && requests.length === 1)
          return route.fulfill({
            status: 500,
            json: { message: "Connection lost" },
          });
        saved = payload;
        return route.fulfill({ json: { ...saved, revisionItemId: 30 } });
      }
      return route.fulfill({ status: 404, json: { message: path } });
    },
  );
  await page.goto("/attempts/40");
  const game = page.locator(`[data-game-type="${type}"]`);
  await expect(game).toBeVisible();
  return { game, saved: () => saved, requests, releaseSave };
}

async function sounds(page) {
  return page.evaluate(() => window.feedbackPlayed);
}

async function correctAnswer(game, type) {
  if (type === "math-game") return "2";
  if (type === "sequence-game") {
    const values = (
      await game.locator(".sequence-question span").allTextContents()
    )
      .slice(0, -1)
      .map(Number);
    return String(values.at(-1) * 2 - values.at(-2));
  }
  if (type === "higher-lower-game") {
    const numbers = (
      await game.locator(".higher-lower-question strong").innerText()
    )
      .match(/\d+/g)
      .map(Number);
    return numbers[0] > numbers[1] ? "Mai mare" : "Mai mic";
  }
  return "Impar";
}

for (const type of [
  "math-game",
  "sequence-game",
  "higher-lower-game",
  "odd-even-game",
]) {
  test(`${type}: first answers count, two-second advance and automatic save`, async ({
    page,
  }) => {
    await page.clock.install();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const { game, saved, requests } = await openGame(page, type, {
      exerciseCount: 2,
      blockedAudio: type === "odd-even-game",
      nextGame: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });

    await page.clock.pauseAt(new Date(Date.now() + 60_000));

    if (type === "higher-lower-game")
      await page.setViewportSize({ width: 1280, height: 900 });

    let correct = await correctAnswer(game, type);
    const answers = game.locator(".answer-grid button");
    const labels = (await answers.allTextContents()).map((value) =>
      value.trim().replace(/^[<>]\s*/, ""),
    );
    await game
      .getByRole("button", {
        name: labels.find((value) => value !== correct),
        exact: true,
      })
      .tap();
    await expect(game.locator('[data-answer-state="incorrect"]')).toHaveCount(
      1,
    );
    await expect(game.locator("[data-feedback-state]")).toHaveCount(0);
    if (type === "higher-lower-game") {
      await expect(
        game.locator(".higher-lower-question strong span").nth(1),
      ).toHaveText(correct === "Mai mare" ? "<" : ">");
    }
    await expect(game.getByText(/Încearcă din nou/)).toHaveCount(0);
    expect(
      await answers.evaluateAll((buttons) =>
        buttons.every((button) => button.disabled),
      ),
    ).toBe(true);
    // Attempt a second answer within the feedback interval.
    await game
      .getByRole("button", { name: correct, exact: true })
      .evaluate((button) => button.click());
    expect(await sounds(page)).toEqual([soundPaths.incorrect]);
    await page.clock.runFor(1999);
    await expect(game.locator('[data-answer-state="incorrect"]')).toHaveCount(
      1,
    );
    expect(requests).toHaveLength(0);
    await page.clock.runFor(1);
    await expect(game.locator("[data-answer-state]")).toHaveCount(0);
    await expect(game.locator(".game-step")).toContainText("2 / 2");
    if (type === "higher-lower-game")
      await expect(
        game.locator(".higher-lower-question strong span").nth(1),
      ).toHaveText("?");
    correct = await correctAnswer(game, type);
    if (type === "higher-lower-game")
      await page.setViewportSize({ width: 390, height: 844 });

    // Dispatch two rapid clicks to catch duplicate scoring before a rerender.
    await game
      .getByRole("button", { name: correct, exact: true })
      .evaluate((button) => {
        button.click();
        button.click();
      });
    await expect(game.locator('[data-answer-state="correct"]')).toHaveCount(1);
    expect(await sounds(page)).toEqual([
      soundPaths.incorrect,
      soundPaths.correct,
    ]);
    if (type === "higher-lower-game") {
      await expect(
        game.locator(".higher-lower-question strong span").nth(1),
      ).toHaveText(correct === "Mai mare" ? ">" : "<");
    }
    await page.clock.runFor(2000);
    await expect(page.locator('[data-game-type="color-game"]')).toBeVisible();
    expect(saved()).toMatchObject({
      score: 1,
      maxScore: 2,
      outcome: "COMPLETED",
    });
    expect(requests).toHaveLength(1);
    expect(await sounds(page)).toEqual([
      soundPaths.incorrect,
      soundPaths.correct,
      soundPaths.complete,
    ]);
    expect(await page.evaluate(() => window.feedbackPaused)).not.toContain(
      soundPaths.complete,
    );
    expect(errors).toEqual([]);
  });
}

test("a failed automatic save retains the scored result and only retries saving", async ({
  page,
}) => {
  await page.clock.install();
  const { game, saved, requests } = await openGame(page, "math-game", {
    failFirstSave: true,
  });
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  await game.getByRole("button", { name: "2", exact: true }).tap();
  await page.clock.runFor(2000);
  await expect(
    page.getByText("Connection lost", { exact: true }),
  ).toBeVisible();
  await expect(game.getByText("1 / 1", { exact: false }).last()).toBeVisible();
  await expect(game.getByText(/Încearcă din nou/)).toHaveCount(0);
  expect(saved()).toBeUndefined();
  await game
    .getByRole("button", { name: "Salvează rezultatul", exact: true })
    .tap();
  await expect(
    page.getByRole("button", { name: "Finalizează fișa" }),
  ).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(saved()).toMatchObject({ score: 1, maxScore: 1 });
  expect(await sounds(page)).toEqual([soundPaths.correct, soundPaths.complete]);
});

test("skipping during feedback cancels the pending answer timer", async ({
  page,
}) => {
  await page.clock.install();
  const { game, requests } = await openGame(page, "math-game", {
    exerciseCount: 2,
    nextGame: true,
  });
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  await game.getByRole("button", { name: "2", exact: true }).tap();
  await page
    .getByRole("button", { name: "Sari peste activitate", exact: true })
    .tap();
  await expect(page.locator('[data-game-type="color-game"]')).toBeVisible();
  await page.clock.runFor(3000);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ score: 0, outcome: "SKIPPED" });
  expect(await sounds(page)).toEqual([soundPaths.correct]);
});

test("the final wrong answer scores zero and the next game waits for a successful save", async ({
  page,
}) => {
  await page.clock.install();
  const { game, saved, requests, releaseSave } = await openGame(
    page,
    "math-game",
    {
      nextGame: true,
      holdSave: true,
    },
  );
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  const wrong = (await game.locator(".math-answers button").allTextContents())
    .map((text) => text.trim())
    .find((text) => text !== "2");
  await game.getByRole("button", { name: wrong, exact: true }).tap();
  await page.clock.runFor(2000);
  await expect.poll(() => requests.length).toBe(1);
  await expect(game.getByText("Se salvează…", { exact: true })).toBeVisible();
  await expect(page.locator('[data-game-type="color-game"]')).toHaveCount(0);
  expect(saved()).toBeUndefined();
  releaseSave();
  await expect(page.locator('[data-game-type="color-game"]')).toBeVisible();
  expect(saved()).toMatchObject({
    score: 0,
    maxScore: 1,
    outcome: "COMPLETED",
  });
  expect(await sounds(page)).toEqual([
    soundPaths.incorrect,
    soundPaths.complete,
  ]);
});

test("a slow skip save cannot race the answer timer and submit two results", async ({
  page,
}) => {
  await page.clock.install();
  const { game, requests, releaseSave } = await openGame(page, "math-game", {
    nextGame: true,
    holdSave: true,
  });
  await page.clock.pauseAt(new Date(Date.now() + 60_000));
  await game.getByRole("button", { name: "2", exact: true }).tap();
  await page
    .getByRole("button", { name: "Sari peste activitate", exact: true })
    .tap();
  await expect.poll(() => requests.length).toBe(1);
  await page.clock.runFor(2000);
  expect(requests).toHaveLength(1);
  releaseSave();
  await expect(page.locator('[data-game-type="color-game"]')).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ score: 0, outcome: "SKIPPED" });
});

test("letter game: answers can be corrected, sounds do not repeat and blocked audio is harmless", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { game, saved } = await openGame(page, "color-game", {
    blockedAudio: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });

  await game
    .getByRole("button", { name: "Litera 2 din Urs", exact: true })
    .click();
  await expect(game.locator('[data-answer-state="incorrect"]')).toHaveCount(1);
  await game
    .getByRole("button", { name: "Litera 1 din Urs", exact: true })
    .click();
  await expect(game.locator('[data-answer-state="incorrect"]')).toHaveCount(0);
  await expect(game.locator('[data-answer-state="correct"]')).toHaveCount(1);
  await game
    .getByRole("button", { name: "Litera 1 din Urs", exact: true })
    .click();
  expect(await sounds(page)).toEqual([
    soundPaths.incorrect,
    soundPaths.correct,
  ]);
  await game.getByRole("button", { name: "Am terminat", exact: true }).click();
  await game.getByRole("button", { name: "Continuă", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Finalizează fișa" }),
  ).toBeVisible();
  expect(saved()).toMatchObject({ score: 1, maxScore: 1 });
  expect(await sounds(page)).toEqual([
    soundPaths.incorrect,
    soundPaths.correct,
    soundPaths.complete,
  ]);
  expect(errors).toEqual([]);
});

test("matching: tap, correct a mismatch, keyboard placement, check and save", async ({
  page,
}) => {
  const { game, saved } = await openGame(page, "matching-game");
  await page.setViewportSize({ width: 390, height: 844 });

  const one = game.locator(".matching-number-card").filter({ hasText: /^1$/ });
  const two = game.locator(".matching-number-card").filter({ hasText: /^2$/ });
  const groupOne = game.locator('[data-pair-id="one"]');
  const groupTwo = game.locator('[data-pair-id="two"]');
  await one.tap();
  await expect(one).toHaveAttribute("aria-pressed", "true");
  await groupTwo.tap();
  await expect(groupTwo.locator(".matching-placed-number")).toHaveText("1");
  expect(await sounds(page)).toEqual([]);
  await groupTwo.tap();
  await expect(groupTwo.locator(".matching-placed-number")).toHaveCount(0);
  await one.tap();
  await groupOne.tap();
  await two.focus();
  await two.press("Enter");
  await groupTwo.focus();
  await groupTwo.press("Space");
  expect(await sounds(page)).toEqual([]);
  await expect(
    game.locator(".matching-status-correct, .matching-status-incorrect"),
  ).toHaveCount(0);
  await expect(game.getByRole("button", { name: /Reia|Amestecă/ })).toHaveCount(
    0,
  );
  await game.getByRole("button", { name: /Verifică răspunsul/ }).click();
  await expect(
    game.getByRole("button", { name: /Verifică răspunsul/ }),
  ).toBeDisabled();
  expect(await sounds(page)).toHaveLength(1);
  expect((await sounds(page)).at(-1)).toBe(soundPaths.complete);
  await groupTwo.tap({ force: true });
  await expect(groupTwo.locator(".matching-placed-number")).toHaveText("2");
  await game.getByRole("button", { name: "Continuă", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Finalizează fișa" }),
  ).toBeVisible();
  expect(saved()).toMatchObject({ score: 2, maxScore: 2 });
});

test("matching locks an incorrect submission and a failed save retries the same score", async ({
  page,
}) => {
  const { game, saved, requests } = await openGame(page, "matching-game", {
    failFirstSave: true,
  });
  const groupOne = game.locator('[data-pair-id="one"]');
  const groupTwo = game.locator('[data-pair-id="two"]');
  await game
    .locator(".matching-number-card")
    .filter({ hasText: /^1$/ })
    .click();
  await groupTwo.click();
  await game
    .locator(".matching-number-card")
    .filter({ hasText: /^2$/ })
    .click();
  await groupOne.click();
  expect(await sounds(page)).toEqual([]);
  await expect(game.locator(".matching-status-incorrect")).toHaveCount(0);
  await game
    .getByRole("button", { name: /Verifică răspunsul/ })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await expect(groupOne).toHaveAttribute("aria-disabled", "true");
  await groupOne.dispatchEvent("click");
  await groupTwo.dispatchEvent("keydown", { key: "Enter" });
  await expect(groupOne.locator(".matching-placed-number")).toHaveText("2");
  await expect(groupTwo.locator(".matching-placed-number")).toHaveText("1");
  await game.getByRole("button", { name: "Continuă", exact: true }).click();
  await expect(
    page.getByText("Connection lost", { exact: true }),
  ).toBeVisible();
  await expect(
    game.getByRole("button", { name: /Verifică răspunsul/ }),
  ).toBeDisabled();
  await game.getByRole("button", { name: "Continuă", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Finalizează fișa" }),
  ).toBeVisible();
  expect(saved()).toMatchObject({ score: 0, maxScore: 2 });
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(await sounds(page)).toEqual([soundPaths.complete]);
});

test("children cannot open the worksheet editor", async ({ page }) => {
  await openGame(page, "math-game");
  await page.goto("/teacher/20");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".worksheetToolbar")).toHaveCount(0);
});

test("all selected audio assets load and decode", async ({ page }) => {
  await page.goto("/");
  const durations = await page.evaluate(async (paths) => {
    const context = new AudioContext();
    try {
      return await Promise.all(
        paths.map(async (path) => {
          const response = await fetch(path);
          if (!response.ok) throw new Error(`Missing sound: ${path}`);
          return (await context.decodeAudioData(await response.arrayBuffer()))
            .duration;
        }),
      );
    } finally {
      await context.close();
    }
  }, Object.values(soundPaths));
  expect(durations.every((duration) => duration > 0 && duration < 4)).toBe(
    true,
  );
});

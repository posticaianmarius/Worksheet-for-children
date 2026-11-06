import { test, expect } from "@playwright/test";
import process from "node:process";
import path from "node:path";
// Uses only a disposable PostgreSQL-backed application. No API mocking.
async function change(context, url, data = {}, method = "POST") {
  const csrf = await (await context.request.get("/api/auth/csrf")).json();
  const response = await context.request.fetch(url, {
    method,
    data,
    headers: { "X-Auth-Request": "1", [csrf.headerName]: csrf.token },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.status() === 204
    ? null
    : response.headers()["content-type"]?.includes("json")
      ? response.json()
      : null;
}
async function signup(context, name, invitationToken) {
  return change(context, "/api/auth/signup", {
    name,
    email: "space-" + crypto.randomUUID() + "@example.test",
    password: "A-strong-test-password-2026",
    invitationToken,
  });
}
async function english(page) {
  await page.addInitScript(() => {
    if (!localStorage.getItem("worksheet-language"))
      localStorage.setItem("worksheet-language", "en");
  });
}
test("real teaching team: shared students, frozen deliveries, delegated cards, login and history", async ({
  browser,
  page,
}) => {
  test.setTimeout(180000);
  page.setDefaultTimeout(15000);
  await english(page);
  const owner = await signup(page.context(), "Space owner");
  const context = await (await page.request.get("/api/auth/context")).json(),
    space = context.spaceId;
  await page.goto("/classes");
  await page.getByRole("button", { name: "New class", exact: true }).click();
  await page.getByLabel("Class name", { exact: true }).fill("Math explorers");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "New class", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Math explorers", exact: true }),
  ).toBeVisible();
  const classA = Number(new URL(page.url()).pathname.split("/").at(-1));
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
  const directory = await (
    await page.request.get("/api/spaces/" + space + "/students")
  ).json();
  const alex = directory.find((s) => s.name === "Alex");
  const classB = await change(page.context(), "/api/classes", {
    name: "Reading explorers",
  });
  await page.goto("/classes/" + classB.id);
  await page.getByRole("button", { name: "Add students", exact: true }).click();
  await page.getByLabel("Student names, one per line").fill("Alex");
  await page
    .getByRole("button", { name: "Review students", exact: true })
    .click();
  await expect(page.getByLabel("Profile for Alex")).toHaveValue(
    String(alex.id),
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Add students", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    (
      await (
        await page.request.get("/api/spaces/" + space + "/students")
      ).json()
    ).length,
  ).toBe(2);
  const sheet = await change(page.context(), "/api/worksheets", {
    name: "Quick practice",
  });
  const games = await (await page.request.get("/api/minigames")).json();
  const game = games
    .filter((g) => g.type === "odd-even-game" && g.active)
    .sort((a, b) => b.version - a.version)[0];
  await change(page.context(), "/api/worksheets/" + sheet.id + "/items", {
    miniGameId: game.id,
    orderIndex: 1,
    configuration: { maxNumber: 10, exerciseCount: 1 },
  });
  await page.goto("/classes/" + classA);
  await page
    .getByRole("button", { name: "Assign worksheet", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Quick practice/ })
    .click();
  await page
    .getByRole("button", { name: "Review assignment", exact: true })
    .click();
  await page.getByLabel("Assignment title (optional)").fill("Monday practice");
  await expect(
    page.getByText(
      "This saved version will be assigned. Later edits will not change it.",
    ),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Assign worksheet", exact: true })
    .click();
  await expect(
    page
      .locator(".delivery-card")
      .getByRole("heading", { name: "Monday practice" }),
  ).toBeVisible();
  const rows = await (await page.request.get("/api/assignments/report")).json();
  const first = rows.find((r) => r.userId === alex.userId);
  await change(page.context(), "/api/worksheets/" + sheet.id + "/assignments", {
    classroomId: classB.id,
    title: "Reading practice",
  });
  const coContext = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL,
  });
  const co = await signup(coContext, "Co teacher");
  const personal = (
    await (await coContext.request.get("/api/auth/context")).json()
  ).spaceId;
  const personalClass = await change(coContext, "/api/classes", {
    name: "Personal class",
  });
  const coPage = await coContext.newPage();
  await english(coPage);
  await page.goto("/space");
  await page
    .getByRole("button", { name: "Invite teacher", exact: true })
    .click();
  const invitation = await page
    .getByLabel("Single-use invitation · expires in 7 days")
    .inputValue();
  await coPage.goto(invitation);
  await coPage
    .getByRole("button", { name: "Join teaching space", exact: true })
    .click();
  await expect(coPage).toHaveURL(/\/home$/);
  await expect(
    coPage.getByLabel("Teaching space", { exact: true }).locator("option"),
  ).toHaveCount(2);
  expect(
    (
      await (
        await coContext.request.get("/api/classes", {
          headers: { "X-Space-Id": String(personal) },
        })
      ).json()
    )[0].id,
  ).toBe(personalClass.id);
  await page.goto("/classes/" + classA);
  await page.getByLabel("Choose co-teacher").selectOption(String(co.id));
  await page
    .getByRole("button", { name: "Add co-teacher", exact: true })
    .click();
  await expect(
    page.locator(".class-teachers").getByText("Co teacher", { exact: true }),
  ).toBeVisible();
  await coPage.goto("/classes/" + classA + "?tab=students");
  await coPage
    .locator("tr")
    .filter({ hasText: "Alex" })
    .locator("summary")
    .click();
  await expect(
    coPage.getByRole("button", { name: "Login card", exact: true }),
  ).toHaveCount(0);
  const coCsrf = await (await coContext.request.get("/api/auth/csrf")).json();
  const denied = await coContext.request.post(
    "/api/spaces/" + space + "/students/" + alex.id + "/credential",
    { headers: { [coCsrf.headerName]: coCsrf.token } },
  );
  expect([403, 404]).toContain(denied.status());
  expect(
    (await coContext.request.get("/api/worksheets/" + sheet.id)).status(),
  ).toBe(404);
  await page.goto("/space");
  await page
    .locator(".directory-row")
    .filter({ hasText: "Co teacher" })
    .getByRole("checkbox")
    .click();
  await expect(
    page
      .locator(".directory-row")
      .filter({ hasText: "Co teacher" })
      .getByRole("checkbox"),
  ).toBeChecked();
  await coPage.reload();
  await coPage
    .locator("tr")
    .filter({ hasText: "Alex" })
    .locator("summary")
    .click();
  await coPage.getByRole("button", { name: "Login card", exact: true }).click();
  const code = await coPage.locator(".student-login-code").innerText();
  await expect(
    coPage.getByRole("img", { name: "Scan to sign in" }),
  ).toHaveAttribute("src", /^data:image\/png/);
  await coPage.emulateMedia({ media: "print" });
  const printed = await coPage.locator(".student-login-card").boundingBox();
  expect(printed.y).toBeLessThan(80);
  await coPage.screenshot({
    path: path.join(process.env.TEMP, "playsheets-card-print.png"),
  });
  await coPage.emulateMedia({ media: "screen" });
  await coPage.screenshot({
    path: path.join(process.env.TEMP, "playsheets-student-card.png"),
  });
  const childContext = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL,
    viewport: { width: 390, height: 844 },
  });
  const child = await childContext.newPage();
  await english(child);
  await child.goto("/work/" + first.batchId);
  await child.getByRole("link", { name: "Student login", exact: true }).click();
  await child.getByLabel("Student code", { exact: true }).fill(code);
  await child.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(child).toHaveURL(
    new RegExp("/assignments/" + first.assignmentId + "$"),
  );
  await child
    .getByRole("button", { name: "Start learning", exact: true })
    .click();
  await expect(child).toHaveURL(/\/attempts\/\d+$/);
  const attemptId = Number(new URL(child.url()).pathname.split("/").at(-1));
  await child.reload();
  await expect(child).toHaveURL(new RegExp("/attempts/" + attemptId + "$"));
  const attempt = await (
    await childContext.request.get("/api/attempts/" + attemptId)
  ).json();
  await change(
    childContext,
    "/api/attempts/" + attemptId + "/items/" + attempt.items[0].id + "/result",
    {
      outcome: "COMPLETED",
      score: 0,
      maxScore: 1,
      timeSeconds: 1,
      details: {},
    },
    "PUT",
  );
  await change(childContext, "/api/attempts/" + attemptId + "/complete");
  await child.goto("/student");
  await expect(
    child.getByRole("heading", { name: "Reading practice", exact: true }),
  ).toBeVisible();
  await child.screenshot({
    path: path.join(process.env.TEMP, "playsheets-student-phone.png"),
  });
  await change(
    page.context(),
    "/api/classes/" + classA + "/members/" + alex.userId,
    {},
    "DELETE",
  );
  await child.goto("/student/finished");
  await expect(
    child.getByRole("heading", { name: "Monday practice", exact: true }),
  ).toBeVisible();
  expect(
    (await (await childContext.request.get("/api/classes")).json()).length,
  ).toBe(1);
  const replaced = await change(
    page.context(),
    "/api/spaces/" + space + "/students/" + alex.id + "/credential/rotate",
  );
  await child.goto("/student");
  await expect(child).toHaveURL(/\/$/);
  expect(replaced.code).not.toBe(code);
  await child.getByLabel("Student code", { exact: true }).fill(replaced.code);
  await child.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(child).toHaveURL(/\/student$/);
  await page.goto("/classes/" + classA + "?tab=students");
  await expect(
    page.locator(".roster-desktop").getByText("Maria", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(process.env.TEMP, "playsheets-class-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.join(process.env.TEMP, "playsheets-class-phone.png"),
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await change(
    page.context(),
    "/api/spaces/" + space + "/members/" + co.id,
    {},
    "DELETE",
  );
  await coPage.goto("/classes/" + classA);
  await expect(
    coPage.getByText(/Resource not found in this teaching space/),
  ).toBeVisible();
  await coContext.close();
  await childContext.close();
  expect(owner.id).toBeTruthy();
});
test("an invited signup joins the team directly and QR login opens the scoped student", async ({
  browser,
  page,
}) => {
  test.setTimeout(60000);
  await english(page);
  await signup(page.context(), "Owner");
  const space = (await (await page.request.get("/api/auth/context")).json())
    .spaceId;
  const invitation = await change(
    page.context(),
    "/api/spaces/" + space + "/invitations",
  );
  const teacher = await browser.newContext({
    baseURL: process.env.E2E_BASE_URL,
  });
  await signup(teacher, "Invited teacher", invitation.token);
  const context = await (await teacher.request.get("/api/auth/context")).json();
  expect(context.spaces.map((s) => s.id)).toEqual([space]);
  const student = await change(
    page.context(),
    "/api/spaces/" + space + "/students",
    { name: "QR child" },
  );
  const card = await change(
    page.context(),
    "/api/spaces/" + space + "/students/" + student.id + "/credential",
  );
  const child = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
  const childPage = await child.newPage();
  await english(childPage);
  await childPage.goto("/#student-code=" + card.code);
  await expect(childPage).toHaveURL(/\/student$/);
  await expect(childPage.locator(".student-name")).toHaveText("QR child");
  expect(new URL(childPage.url()).hash).toBe("");
  await page.goto("/space");
  for (const language of ["en", "ro"]) {
    await page.evaluate(
      (language) => localStorage.setItem("worksheet-language", language),
      language,
    );
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of ["/space", "/students", "/classes"]) {
        await page.goto(route);
        const headings =
          language === "ro"
            ? {
                "/space": "Spațiu de predare",
                "/students": "Elevi",
                "/classes": "Clase",
              }
            : {
                "/space": "Teaching space",
                "/students": "Students",
                "/classes": "Classes",
              };
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          headings[route],
        );
        if (route !== "/classes")
          await expect(page.locator(".directory-row").first()).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth + 1,
          ),
        ).toBeTruthy();
      }
    }
  }
  await teacher.close();
  await child.close();
});

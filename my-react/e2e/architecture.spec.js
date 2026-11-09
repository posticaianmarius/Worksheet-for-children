import { expectRoutesFit } from "./fixtures/layout.js";
import { spaceContextFor } from "./space-fixtures.js";
import { test, expect } from "@playwright/test";
const teacher = { id: 1, name: "Ana", role: "TEACHER" };
const child = { id: 2, name: "Alex", role: "USER" };
const sheet = { id: 20, name: "Number journey", items: [{ id: 30 }] };
const batchA = "00000000-0000-0000-0000-000000000001",
  batchB = "00000000-0000-0000-0000-000000000002";
async function setup(page, role = "TEACHER") {
  await page.addInitScript(() =>
    localStorage.setItem("worksheet-language", "en"),
  );
  let user = role === "TEACHER" ? teacher : role === "USER" ? child : null;
  const classroom = { id: 10, name: "Explorers", teacherName: "Ana" };
  const students = [
    { userId: 2, name: "Alex", studentCode: "ABCD2345" },
    { userId: 3, name: "Maria", studentCode: "BCDE3456" },
  ];
  const assignments = [
    {
      id: 51,
      userId: 2,
      worksheet: sheet,
      teacherName: "Ana",
      status: "IN_PROGRESS",
    },
    {
      id: 52,
      userId: 2,
      worksheet: { ...sheet, name: "Letter practice" },
      teacherName: "Ana",
      status: "COMPLETED",
    },
  ];
  const base = {
    classroomId: 10,
    classroomName: "Explorers",
    worksheetId: 20,
    revisionId: 30,
    revisionNumber: 1,
    worksheetName: sheet.name,
    assignedAt: "2026-11-01T10:00:00Z",
    revokedAt: null,
    removedAt: null,
  };
  const rows = [
    {
      ...base,
      assignmentId: 51,
      batchId: batchA,
      userId: 2,
      userName: "Alex",
      status: "IN_PROGRESS",
    },
    {
      ...base,
      assignmentId: 52,
      batchId: batchA,
      userId: 3,
      userName: "Maria",
      status: "COMPLETED",
      totalScore: 0,
      maxScore: 1,
      completedAt: "2026-11-01T11:00:00Z",
      attemptId: 41,
    },
    {
      ...base,
      assignmentId: 53,
      batchId: batchB,
      userId: 2,
      userName: "Alex",
      status: "NOT_STARTED",
    },
  ];
  const attempt = {
    id: 40,
    assignmentId: 51,
    worksheetId: 20,
    status: "IN_PROGRESS",
    items: [
      {
        id: 30,
        orderIndex: 0,
        definition: { type: "odd-even-game", version: 1 },
        configuration: { maxNumber: 1, exerciseCount: 1 },
      },
    ],
    results: [],
  };
  const state = { starts: 0, reports: 0, closed: [], assigned: null };
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request(),
        url = new URL(request.url()),
        path = url.pathname,
        method = request.method();
      const reply = (json, status = 200) => route.fulfill({ json, status });
      if (path === "/api/auth/csrf")
        return reply({ headerName: "X-XSRF-TOKEN", token: "test" });
      if (path === "/api/auth/context") {
        const reply = (json, status = 200) =>
          route.fulfill({ json: spaceContextFor(json), status });
        return user ? reply(user) : reply({ message: "Please log in." }, 401);
      }
      if (path === "/api/auth/me")
        return user ? reply(user) : reply({ message: "Please log in." }, 401);
      if (path === "/api/auth/logout") {
        user = null;
        return route.fulfill({ status: 204 });
      }
      if (path === "/api/play/login") {
        expect(request.postDataJSON()).toEqual({ studentCode: "ABCD2345" });
        user = child;
        return reply(child);
      }
      if (path === "/api/assignments") return reply(assignments);
      if (path === "/api/classes") return reply([classroom]);
      if (path === "/api/classes/10") return reply(classroom);
      if (path === "/api/classes/10/members") return reply(students);
      if (path === "/api/worksheets/20/assignments/preview")
        return reply({ revisionId: 30, worksheet: sheet });
      if (path === "/api/worksheets") return reply([sheet]);
      if (path === "/api/assignments/report") {
        state.reports++;
        return reply(
          url.searchParams.get("includeRemoved") === "true"
            ? rows
            : rows.filter((row) => !row.removedAt),
        );
      }
      if (path.startsWith("/api/assignments/batches/") && method === "DELETE") {
        const id = path.split("/").at(-1);
        state.closed.push(id);
        rows
          .filter((row) => row.batchId === id)
          .forEach((row) => {
            row.removedAt = "2026-11-02T10:00:00Z";
            row.revokedAt = row.removedAt;
            row.status = "REVOKED";
          });
        return route.fulfill({ status: 204 });
      }
      if (path === "/api/worksheets/20/assignments") {
        state.assigned = request.postDataJSON();
        rows.push({
          ...base,
          assignmentId: 54,
          batchId: "00000000-0000-0000-0000-000000000003",
          userId: 3,
          userName: "Maria",
          status: "NOT_STARTED",
        });
        return reply([], 201);
      }
      if (path === "/api/assignments/51/attempts") {
        if (method === "POST") state.starts++;
        return reply(method === "POST" ? attempt : [attempt]);
      }
      if (path === "/api/attempts/40") return reply(attempt);
      if (path === "/api/attempts/40/items/30/result") {
        const result = { ...request.postDataJSON(), revisionItemId: 30 };
        attempt.results = [result];
        return reply(result);
      }
      if (path === "/api/attempts/40/complete") {
        attempt.status = "COMPLETED";
        attempt.totalScore = 1;
        attempt.maxScore = 1;
        assignments[0].status = "COMPLETED";
        return reply(attempt);
      }
      return reply({ message: path }, 404);
    },
  );
  return state;
}
test("a personal code opens only the student's work and resumes the saved attempt", async ({
  page,
}) => {
  const state = await setup(page, null);
  await page.goto("/");
  await page.getByLabel("Student code", { exact: true }).fill("abcd2345");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/student$/);
  await expect(
    page.getByRole("heading", { name: "My work", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Classes", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Worksheets", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/attempts\/40$/);
  expect(state.starts).toBe(0);
  await page.getByRole("button", { name: "Odd", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Finish worksheet", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Well done!" })).toBeVisible();
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await page.getByRole("link", { name: "Finished work", exact: true }).click();
  await expect(page.locator(".student-work-card")).toHaveCount(2);
  expect(state.reports).toBe(0);
  await page
    .getByRole("button", { name: "Another child", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
});
test("teachers close one delivery while its saved zero score stays in results", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/assignments");
  await expect(page.locator(".delivery-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Close assignment", exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close assignment", exact: true })
    .click();
  await expect(page.locator(".delivery-card")).toHaveCount(1);
  expect(state.closed).toEqual([batchA]);
  await page.goto("/results");
  await expect(
    page.getByRole("link", { name: "View Maria's result" }),
  ).toHaveText("0 / 1");
  await page.getByLabel("Search students", { exact: true }).fill("Maria");
  await page.getByLabel("Status", { exact: true }).selectOption("COMPLETED");
  await expect(page.locator("tbody tr")).toHaveCount(1);
});
test("class assignments support explicitly selected recipients", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/classes/10?tab=assignments");
  await page
    .getByRole("button", { name: "Assign worksheet", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Number journey", exact: true })
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
  await expect(page.locator(".delivery-card")).toHaveCount(3);
  expect(state.assigned).toEqual({
    classroomId: 10,
    userIds: [3],
    revisionId: 30,
  });
  await page.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "View Maria's result" }),
  ).toBeVisible();
});
for (const width of [320, 390, 768, 1440]) {
  for (const role of ["TEACHER", "USER"]) {
    test(`new ${role} screens fit at ${width}px`, async ({ page }) => {
      await setup(page, role);
      await expectRoutesFit(
        page,
        role === "TEACHER"
          ? [
              "/assignments",
              "/results",
              "/classes/10?tab=students",
              "/classes/10?tab=assignments",
              "/classes/10/access-cards",
            ]
          : ["/student", "/student/finished", "/student/settings"],
        width,
      );
    });
  }
}

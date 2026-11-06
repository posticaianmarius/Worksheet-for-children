import { spaceContextFor } from "./space-fixtures.js";
import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("worksheet-language", "ro"),
  );
});

const teacher = {
  id: 1,
  name: "Teacher",
  role: "TEACHER",
  email: "teacher@example.com",
};
const child = { id: 2, name: "Ana", role: "USER", email: null };
const classroom = {
  id: 10,
  name: "Clasa A",
  teacherId: 1,
  teacherName: "Teacher",
};
const worksheet = { id: 20, name: "Odd or even", items: [{ id: 30 }] };
const item = {
  id: 30,
  orderIndex: 0,
  definition: { type: "odd-even-game", name: "Odd or even" },
  configuration: { exerciseCount: 1, maxNumber: 1 },
};

test("children enter codes, resume unfinished work and finish without signup", async ({
  page,
}) => {
  let user = null;
  let starts = 0;
  const attempt = {
    id: 40,
    assignmentId: 50,
    status: "IN_PROGRESS",
    totalScore: 0,
    maxScore: 0,
    items: [item],
    results: [],
  };
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      const reply = (json, status = 200) => route.fulfill({ status, json });
      if (path === "/api/auth/csrf")
        return reply({ headerName: "X-XSRF-TOKEN", token: "test" });
      if (path === "/api/auth/context") {
        const reply = (json, status = 200) =>
          route.fulfill({ json: spaceContextFor(json), status });
        return user ? reply(user) : reply({ message: "Please log in." }, 401);
      }
      if (path === "/api/auth/me")
        return user ? reply(user) : reply({ message: "Please log in." }, 401);
      if (path === "/api/play/join") {
        expect(route.request().postDataJSON()).toEqual({
          studentCode: "ABCD2345",
          worksheetCode: "EFGH6789",
        });
        user = child;
        return reply({ user, assignmentId: 50 });
      }
      if (path === "/api/assignments/50/attempts") {
        if (method === "POST") starts++;
        return reply(method === "POST" ? attempt : [attempt]);
      }
      if (path === "/api/attempts/40/items/30/result") {
        const result = {
          ...route.request().postDataJSON(),
          revisionItemId: 30,
        };
        attempt.results = [result];
        return reply(result);
      }
      if (path === "/api/attempts/40/complete") {
        attempt.status = "COMPLETED";
        attempt.totalScore = 1;
        attempt.maxScore = 1;
        return reply(attempt);
      }
      if (path === "/api/attempts/40") return reply(attempt);
      return reply({ message: `Unexpected API request: ${path}` }, 404);
    },
  );
  await page.goto("/");
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByLabel("Codul elevului").fill("abcd2345");
  await page.getByText("Deschide direct o fișă", { exact: true }).click();
  await page.getByLabel("Codul fișei").fill("efgh6789");
  await page.getByRole("button", { name: "Verifică și începe" }).click();
  await expect(page).toHaveURL(/\/attempts\/40$/);
  expect(starts).toBe(0);
  await expect(
    page.getByText("Exercițiul 1 / 1", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Impar", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Finalizează fișa" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Finalizează fișa" }).click();
  await expect(page.getByRole("heading", { name: "Bravo!" })).toBeVisible();
  await expect(page.getByText("1 / 1", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Bravo!" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
});

test("teachers view results, print private cards and keep former students in history", async ({
  page,
}) => {
  let students = [
    { userId: 2, studentId: 2, name: "Ana Maria", studentCode: "ABCD2345" },
  ];
  const tests = [
    {
      attemptId: 40,
      assignmentId: 50,
      name: "Odd or even",
      status: "COMPLETED",
      totalScore: 1,
      maxScore: 1,
      startedAt: "2026-10-01T08:00:00Z",
      completedAt: "2026-10-01T08:01:00Z",
    },
  ];
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      const method = route.request().method();
      const reply = (json, status = 200) => route.fulfill({ status, json });
      if (path === "/api/auth/csrf")
        return reply({ headerName: "X-XSRF-TOKEN", token: "test" });
      if (path === "/api/auth/context") {
        const reply = (json, status = 200) =>
          route.fulfill({ json: spaceContextFor(json), status });
        return reply(teacher);
      }
      if (path === "/api/auth/me") return reply(teacher);
      if (path === "/api/classes/10") return reply(classroom);
      if (path === "/api/spaces/1/students/2/credential")
        return reply({ studentId: 2, name: "Ana Maria", code: "ABCD2345" });
      if (path === "/api/worksheets") return reply([worksheet]);
      if (path === "/api/classes/10/members") {
        if (method === "POST") {
          students = [
            {
              userId: 2,
              name: route.request().postDataJSON().name,
              studentCode: "ABCD2345",
              lastTestPercent: 100,
              averagePercent: 100,
              worstTest: "Odd or even",
            },
          ];
          return reply(students[0], 201);
        }
        return reply(students);
      }
      if (path === "/api/classes/10/members/2") {
        if (method === "DELETE") {
          students[0].leftAt = "2026-11-01T12:00:00Z";
          return route.fulfill({ status: 204 });
        }
        if (method === "GET") return reply(students[0]);
        students[0].name = route.request().postDataJSON().name;
        return reply(students[0]);
      }
      if (path === "/api/classes/10/tests") {
        expect(route.request().postDataJSON()).toEqual({ worksheetId: 20 });
        return reply({ code: "EFGH6789" }, 201);
      }
      if (path === "/api/classes/10/members/2/tests") return reply(tests);
      if (path === "/api/attempts/40")
        return reply({
          id: 40,
          status: "COMPLETED",
          totalScore: 1,
          maxScore: 1,
          items: [item],
          results: [
            { revisionItemId: 30, score: 1, maxScore: 1, outcome: "COMPLETED" },
          ],
        });
      return reply({ message: `Unexpected API request: ${path}` }, 404);
    },
  );
  await page.goto("/classes/10?tab=students");
  await expect(
    page.getByRole("link", { name: "Ana Maria", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("ABCD2345", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Ana Maria", exact: true }).click();
  await page.getByRole("link", { name: "Odd or even", exact: true }).click();
  await expect(page.getByText("1 / 1", { exact: true }).last()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/classes/10?tab=students");
  await page.locator(".roster-mobile summary").click();
  await page
    .locator(".roster-mobile")
    .getByRole("button", { name: "Card de acces", exact: true })
    .click();
  await expect(page.getByText("ABCD2345", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Scanează pentru autentificare" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Închide", exact: true }).click();
  await page
    .locator(".roster-mobile")
    .getByRole("button", { name: "Elimină din clasă", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Elimină din clasă", exact: true })
    .click();
  await expect(
    page.locator(".roster-mobile").getByText("Ana Maria", { exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Arată foștii elevi").check();
  await expect(
    page.locator(".roster-mobile").getByText("Ana Maria", { exact: true }),
  ).toBeVisible();
});

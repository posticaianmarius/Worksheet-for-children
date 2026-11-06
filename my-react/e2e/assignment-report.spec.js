import { spaceContextFor } from "./space-fixtures.js";
import { test, expect } from "@playwright/test";

const teacher = {
  id: 1,
  name: "Teacher",
  role: "TEACHER",
  email: "teacher@example.com",
};
const classes = [
  { id: 10, name: "Clasa A" },
  { id: 11, name: "Clasa B" },
];
const base = {
  classroomId: 10,
  classroomName: "Clasa A",
  worksheetId: 20,
  revisionId: 30,
  revisionNumber: 1,
  worksheetName: "Numbers",
  worksheetCode: "ABCD2345",
  codeStatus: "ACTIVE",
  assignedAt: "2026-10-05T10:00:00Z",
  revokedAt: null,
  attemptId: null,
  totalScore: null,
  maxScore: null,
  completedAt: null,
};
const rows = [
  {
    ...base,
    assignmentId: 49,
    userId: 2,
    userName: "Ana",
    status: "COMPLETED",
    totalScore: 8,
    maxScore: 10,
    attemptId: 39,
    completedAt: "2026-10-05T12:00:00Z",
  },
  {
    ...base,
    assignmentId: 51,
    userId: 2,
    userName: "Ana",
    status: "COMPLETED",
    totalScore: 0,
    maxScore: 10,
    attemptId: 40,
    completedAt: "2026-10-05T12:00:00Z",
  },
  {
    ...base,
    assignmentId: 52,
    userId: 3,
    userName: "Dan",
    status: "NOT_STARTED",
  },
  {
    ...base,
    assignmentId: 53,
    userId: 4,
    userName: "Mara",
    status: "IN_PROGRESS",
  },
  // Reassigning the same version must not double-count a child or lose a completed result.
  {
    ...base,
    assignmentId: 54,
    userId: 2,
    userName: "Ana",
    status: "NOT_STARTED",
    assignedAt: "2026-10-06T10:00:00Z",
  },
  {
    ...base,
    assignmentId: 55,
    revisionId: 31,
    revisionNumber: 2,
    userId: 3,
    userName: "Dan",
    status: "NOT_STARTED",
    worksheetCode: null,
    codeStatus: "VERSION_CHANGED",
  },
  {
    ...base,
    assignmentId: 56,
    classroomId: null,
    classroomName: null,
    userId: 5,
    userName: "Paul",
    status: "NOT_STARTED",
  },
];

async function mockApi(page, { student = false, fail = false } = {}) {
  let reports = 0;
  let unavailable = fail;
  await page.addInitScript(() => {
    localStorage.setItem("worksheet-language", "en");
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text) => {
          window.copiedCode = text;
        },
      },
    });
  });
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      const reply = (json, status = 200) => route.fulfill({ json, status });
      if (path === "/api/auth/context") {
        const reply = (json, status = 200) =>
          route.fulfill({ json: spaceContextFor(json), status });
        return reply(
          student ? { ...teacher, id: 2, role: "USER", name: "Ana" } : teacher,
        );
      }
      if (path === "/api/auth/me")
        return reply(
          student ? { ...teacher, id: 2, role: "USER", name: "Ana" } : teacher,
        );
      if (path === "/api/classes") return reply(classes);
      if (path === "/api/worksheets") return reply([]);
      if (path === "/api/assignments/report") {
        reports++;
        if (unavailable) return reply({ message: "Connection lost" }, 503);
        return reply(rows);
      }
      if (path === "/api/assignments")
        return reply([
          {
            id: 51,
            worksheet: { id: 20, name: "Numbers" },
            userName: "Ana",
            teacherName: "Teacher",
            status: "NOT_STARTED",
          },
        ]);
      return reply({ message: `Unexpected API request: ${path}` }, 404);
    },
  );
  return {
    recover() {
      unavailable = false;
    },
    get reports() {
      return reports;
    },
  };
}

test("teachers browse classes, worksheet versions and student completion with zero scores", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/assignments/classes/10");
  await expect(page.getByRole("heading", { name: "Clasa A" })).toBeVisible();
  await expect(page).toHaveURL(/\/assignments\/classes\/10$/);
  await expect(page.getByText("ABCD2345", { exact: true })).toBeVisible();
  await expect(page.getByText("Code replaced", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Copy Numbers's worksheet code" })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.copiedCode))
    .toBe("ABCD2345");
  await expect(page).toHaveURL(/\/assignments\/classes\/10$/);
  await page.locator('a[href="/assignments/classes/10/worksheets/30"]').click();
  await expect(
    page.getByText("1 / 3 completed", { exact: true }),
  ).toBeVisible();
  const ana = page.getByRole("row", { name: /^Ana / });
  await expect(ana.getByText("Completed", { exact: true })).toBeVisible();
  await expect(ana.getByRole("link", { name: "View Ana's result" })).toHaveText(
    "0 / 10",
  );
  await expect(
    ana.getByRole("link", { name: "View Ana's result" }),
  ).toHaveAttribute("href", "/attempts/40");
  await expect(
    page
      .getByRole("row", { name: /^Dan / })
      .getByText("Not started", { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row", { name: /^Mara / })
      .getByText("In progress", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(3);

  await page.setViewportSize({ width: 390, height: 844 });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Numbers" })).toBeVisible();
  await page.getByLabel("Language").click();
  await page.getByText("Română", { exact: true }).click();
  await expect(
    page.getByText("1 / 3 finalizate", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Scor", exact: true }),
  ).toBeVisible();
});

test("empty classes and direct assignments remain accessible", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/assignments/classes/11");
  await expect(
    page.getByText("No assignments yet.", { exact: true }),
  ).toBeVisible();
  await page.goto("/assignments/classes/direct");
  await expect(
    page.getByRole("heading", { name: "Direct assignments" }),
  ).toBeVisible();
  await page
    .locator('a[href="/assignments/classes/direct/worksheets/30"]')
    .click();
  await expect(page.getByRole("row", { name: /^Paul / })).toBeVisible();
});

test("failed reports can be retried and students keep their own assignment list", async ({
  page,
}) => {
  const outage = await mockApi(page, { fail: true });
  await page.goto("/assignments");
  await expect(
    page.getByText("Connection lost", { exact: true }),
  ).toBeVisible();
  outage.recover();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Numbers" }).first(),
  ).toBeVisible();
  await page.unrouteAll();
  const state = await mockApi(page, { student: true });
  await page.goto("/assignments");
  await expect(page.getByRole("link", { name: /Numbers/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Join worksheet" }),
  ).toBeVisible();
  expect(state.reports).toBe(0);
});

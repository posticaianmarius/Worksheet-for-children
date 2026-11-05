import { test, expect } from "@playwright/test";

async function setup(page, { student = false } = {}) {
  await page.addInitScript(() =>
    localStorage.setItem("worksheet-language", "en"),
  );
  let classes = [
    { id: 2, name: "Class A", teacherName: "Teacher" },
    { id: 3, name: "Class B", teacherName: "Teacher" },
  ];
  const students = [
    { userId: 6, name: "Ana", lastTestPercent: 0, averagePercent: 80 },
    { userId: 7, name: "Ștefan", lastTestPercent: 10, averagePercent: 0 },
    { userId: 8, name: "Dan", lastTestPercent: null, averagePercent: null },
  ];
  const tests = [
    {
      attemptId: 10,
      name: "Zebra",
      totalScore: 2,
      maxScore: 2,
      completedAt: "2026-01-20T10:00:00Z",
      status: "COMPLETED",
    },
    {
      attemptId: 11,
      name: "Apple",
      totalScore: 10,
      maxScore: 20,
      completedAt: "2026-02-01T10:00:00Z",
      status: "COMPLETED",
    },
    {
      attemptId: 12,
      name: "Middle",
      totalScore: 0,
      maxScore: 0,
      startedAt: "2026-03-01T10:00:00Z",
      status: "IN_PROGRESS",
    },
  ];
  const base = {
    classroomId: 2,
    classroomName: "Class A",
    worksheetId: 1,
    revisionId: 3,
    revisionNumber: 1,
    worksheetName: "Numbers",
    worksheetCode: "ABCD2345",
    codeStatus: "ACTIVE",
    revokedAt: null,
    removedAt: null,
  };
  let rows = [
    {
      ...base,
      assignmentId: 50,
      userId: 6,
      userName: "Ana",
      totalScore: 2,
      maxScore: 2,
      attemptId: 10,
      status: "COMPLETED",
      assignedAt: "2026-01-20T10:00:00Z",
      completedAt: "2026-02-10T10:00:00Z",
    },
    {
      ...base,
      assignmentId: 51,
      userId: 7,
      userName: "Ștefan",
      totalScore: 10,
      maxScore: 20,
      attemptId: 11,
      status: "COMPLETED",
      assignedAt: "2026-02-01T10:00:00Z",
      completedAt: "2026-01-20T10:00:00Z",
    },
    {
      ...base,
      assignmentId: 52,
      userId: 8,
      userName: "Dan",
      totalScore: null,
      maxScore: null,
      status: "NOT_STARTED",
      assignedAt: "2026-03-01T10:00:00Z",
      completedAt: null,
    },
    {
      ...base,
      revisionId: 4,
      revisionNumber: 2,
      assignmentId: 53,
      userId: 6,
      userName: "Ana",
      status: "NOT_STARTED",
      assignedAt: "2026-03-01T10:00:00Z",
    },
  ];
  const mutations = [];
  let fail = false;
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const path = url.pathname;
      const reply = (json, status = 200) => route.fulfill({ json, status });
      if (path === "/api/auth/me")
        return reply({
          id: student ? 6 : 1,
          name: "Teacher",
          role: student ? "USER" : "TEACHER",
        });
      if (path === "/api/auth/csrf")
        return reply({ headerName: "X-XSRF-TOKEN", token: "test" });
      if (request.method() === "DELETE") {
        mutations.push(path);
        if (fail) return reply({ message: "Deletion failed" }, 503);
        if (path === "/api/classes/2")
          classes = classes.filter((row) => row.id !== 2);
        else if (path === "/api/assignments/classes/2/revisions/3")
          rows = rows.map((row) =>
            row.revisionId === 3
              ? {
                  ...row,
                  removedAt: "2026-10-13T10:00:00Z",
                  revokedAt: "2026-10-13T10:00:00Z",
                  status: "REVOKED",
                }
              : row,
          );
        else return reply({ message: path }, 404);
        return route.fulfill({ status: 204 });
      }
      if (path === "/api/classes") return reply(classes);
      if (path === "/api/classes/2") return reply(classes[0]);
      if (path === "/api/classes/2/members") return reply(students);
      if (path === "/api/classes/2/members/6/tests") return reply(tests);
      if (path === "/api/worksheets") return reply([]);
      if (path === "/api/assignments/report")
        return reply(
          rows.filter(
            (row) => url.searchParams.has("includeRemoved") || !row.removedAt,
          ),
        );
      return reply({ message: `Unexpected request: ${path}` }, 404);
    },
  );
  return {
    mutations,
    fail(value) {
      fail = value;
    },
    reassign() {
      rows.push({
        ...rows[0],
        assignmentId: 99,
        removedAt: null,
        revokedAt: null,
        status: "NOT_STARTED",
        assignedAt: "2026-10-13T12:00:00Z",
        completedAt: null,
        totalScore: null,
        maxScore: null,
        attemptId: null,
      });
    },
  };
}

test("class roster sorts names and numeric metrics, keeping missing results last", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/classes/2");
  const names = page.locator(".student-name-button");
  await expect(names).toHaveText(["Ana", "Dan", "Ștefan"]);
  await page.getByRole("button", { name: /^Name \/ code/ }).click();
  await expect(names).toHaveText(["Ștefan", "Dan", "Ana"]);
  await page.getByRole("button", { name: /^Last test/ }).click();
  await expect(names).toHaveText(["Ana", "Ștefan", "Dan"]);
  await page.getByRole("button", { name: /^Last test/ }).click();
  await expect(names).toHaveText(["Ștefan", "Ana", "Dan"]);
  await page.getByRole("button", { name: /^Average/ }).click();
  await expect(names).toHaveText(["Ștefan", "Ana", "Dan"]);
  await page.getByRole("button", { name: /^Average/ }).click();
  await expect(names).toHaveText(["Ana", "Ștefan", "Dan"]);
  await expect(
    page.getByRole("columnheader", { name: /^Average/ }),
  ).toHaveAttribute("aria-sort", "descending");
});

test("a child's tests sort by name, normalized result and timestamp", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/classes/2/children/6");
  const names = page.locator(".test-grid a");
  await page.getByRole("button", { name: "Test", exact: true }).click();
  await expect(names).toHaveText(["Apple", "Middle", "Zebra"]);
  await page.getByRole("button", { name: "Test", exact: true }).click();
  await expect(names).toHaveText(["Zebra", "Middle", "Apple"]);
  await page.getByRole("button", { name: "Result", exact: true }).click();
  await expect(names).toHaveText(["Apple", "Zebra", "Middle"]);
  await page.getByRole("button", { name: "Result", exact: true }).click();
  await expect(names).toHaveText(["Zebra", "Apple", "Middle"]);
  await page.getByRole("button", { name: "Date", exact: true }).click();
  await expect(names).toHaveText(["Zebra", "Apple", "Middle"]);
  await page.getByRole("button", { name: "Date", exact: true }).click();
  await expect(names).toHaveText(["Middle", "Apple", "Zebra"]);
});

test("homework results sort columns numerically and keep history links", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/assignments/classes/2/worksheets/3");
  const names = page.locator("tbody th");
  await expect(names).toHaveText(["Ana", "Dan", "Ștefan"]);
  await page.getByRole("button", { name: "Student", exact: true }).click();
  await expect(names).toHaveText(["Ștefan", "Dan", "Ana"]);
  await page.getByRole("button", { name: "Score", exact: true }).click();
  await expect(names).toHaveText(["Ștefan", "Ana", "Dan"]);
  await page.getByRole("button", { name: "Score", exact: true }).click();
  await expect(names).toHaveText(["Ana", "Ștefan", "Dan"]);
  await page.getByRole("button", { name: "Assigned", exact: true }).click();
  await expect(names).toHaveText(["Ana", "Ștefan", "Dan"]);
  await page.getByRole("button", { name: "Assigned", exact: true }).click();
  await expect(names).toHaveText(["Dan", "Ștefan", "Ana"]);
  await page.getByRole("button", { name: "Completed on", exact: true }).click();
  await expect(names).toHaveText(["Ștefan", "Ana", "Dan"]);
  await page.getByRole("button", { name: "Completed on", exact: true }).click();
  await expect(names).toHaveText(["Ana", "Ștefan", "Dan"]);
  await expect(
    page.getByRole("link", { name: "View Ana's history" }),
  ).toHaveAttribute("href", "/assignments/50");
});

test("class deletion supports cancel, error recovery and persists after reload", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/classes");
  await page
    .getByRole("button", { name: "Delete class Class A", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(state.mutations).toHaveLength(0);
  state.fail(true);
  await page
    .getByRole("button", { name: "Delete class Class A", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete", exact: true })
    .last()
    .click();
  await expect(
    page.getByText("Deletion failed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Class A", exact: true }),
  ).toBeVisible();
  state.fail(false);
  await page
    .getByRole("button", { name: "Delete class Class A", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Delete", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Class A", exact: true }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Class B", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Class A", exact: true }),
  ).toHaveCount(0);
});

test("homework deletion removes only its revision and deleted scores remain browsable", async ({
  page,
}) => {
  const state = await setup(page);
  await page.goto("/assignments/classes/2");
  const remove = page.getByRole("button", {
    name: "Delete homework Numbers, version 1",
    exact: true,
  });
  await remove.click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(state.mutations).toHaveLength(0);
  state.fail(true);
  await remove.click();
  await page
    .getByRole("button", { name: "Delete", exact: true })
    .last()
    .click();
  await expect(
    page.getByText("Deletion failed", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Delete", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  state.fail(false);
  await remove.click();
  await page
    .getByRole("button", { name: "Delete", exact: true })
    .last()
    .click();
  await expect(page.getByText("Version 1", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Version 2", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Version 1", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Show deleted homework" }).click();
  await expect(page.getByText("Deleted", { exact: true })).toBeVisible();
  await page
    .locator('a[href="/assignments/classes/2/worksheets/3?history=1"]')
    .click();
  await expect(
    page.getByRole("link", { name: "View Ana's result" }),
  ).toHaveText("2 / 2");
  await expect(
    page.getByRole("button", {
      name: "Delete homework Numbers, version 1",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "View Ana's result" }),
  ).toBeVisible();
  state.reassign();
  await page.goto("/assignments/classes/2/worksheets/3");
  await expect(page.getByText("Not started", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View Ana's result" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Show deleted homework" }).click();
  await expect(
    page.getByRole("link", { name: "View Ana's result" }),
  ).toHaveText("2 / 2");
});

test("students never receive class deletion controls", async ({ page }) => {
  await setup(page, { student: true });
  await page.goto("/classes");
  await expect(
    page.getByRole("heading", { name: "Class A", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Delete class/ })).toHaveCount(
    0,
  );
});

test("sorting controls remain usable on phones", async ({ page }, testInfo) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, column] of [
    ["/classes/2", "Average"],
    ["/classes/2/children/6", "Result"],
    ["/assignments/classes/2/worksheets/3", "Score"],
  ]) {
    await page.goto(path);
    await page.getByRole("button", { name: column, exact: true }).click();
    await expect(
      page.getByRole("columnheader", { name: column, exact: true }),
    ).toHaveAttribute("aria-sort", "ascending");
    await page.getByRole("button", { name: column, exact: true }).click();
    await expect(
      page.getByRole("columnheader", { name: column, exact: true }),
    ).toHaveAttribute("aria-sort", "descending");
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: testInfo.outputPath("sorted-results-phone.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: testInfo.outputPath("sorted-results-desktop.png"),
    fullPage: true,
  });
});

export const user = {
  id: 1,
  role: "TEACHER",
  name: "Ana Popescu",
  email: "ana@example.test",
};
export const definition = {
  id: 1,
  type: "math-game",
  version: 1,
  name: "Easy math",
  active: true,
  configurationSchema: { type: "object" },
  defaultConfiguration: { maxNumber: 10, operations: ["+"] },
};
export const dashboardWorksheets = [
  {
    id: 20,
    name: "Little number discoveries",
    updatedAt: "2026-11-08T10:00:00Z",
    items: [
      {
        id: 30,
        miniGameId: 1,
        orderIndex: 0,
        definition,
        configuration: { maxNumber: 10, operations: ["+"] },
      },
    ],
  },
  {
    id: 21,
    name: "Letters and animal friends",
    updatedAt: "2026-11-07T10:00:00Z",
    items: [
      { id: 31, miniGameId: 1, orderIndex: 0, definition, configuration: {} },
      { id: 32, miniGameId: 1, orderIndex: 1, definition, configuration: {} },
    ],
  },
  {
    id: 22,
    name: "Patterns all around us",
    updatedAt: "2026-11-05T10:00:00Z",
    items: [],
  },
  {
    id: 23,
    name: "Our first counting adventure",
    updatedAt: "2026-11-03T10:00:00Z",
    items: [
      { id: 33, miniGameId: 1, orderIndex: 0, definition, configuration: {} },
    ],
  },
];
export async function setupDashboard(
  page,
  {
    empty = false,
    language = "en",
    assignments = [],
    failCreateOnce = false,
  } = {},
) {
  const sheets = structuredClone(empty ? [] : dashboardWorksheets);
  const created = [];
  let failed = false;
  await page.addInitScript((lang) => {
    localStorage.setItem("worksheet-language", lang);
    localStorage.setItem("practica.sidebar.collapsed", "false");
  }, language);
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: user });
    if (path === "/api/auth/context")
      return route.fulfill({
        json: {
          spaceId: 1,
          spaces: [
            {
              id: 1,
              name: "Little explorers",
              owner: true,
              manageStudentAccess: true,
            },
          ],
          student: null,
          owner: true,
          manageStudentAccess: true,
        },
      });
    if (path === "/api/auth/csrf")
      return route.fulfill({
        json: { headerName: "X-CSRF-TOKEN", token: "test" },
      });
    if (path === "/api/worksheets" && route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      created.push(body);
      if (failCreateOnce && !failed) {
        failed = true;
        return route.fulfill({
          status: 500,
          json: { message: "Could not create worksheet." },
        });
      }
      const sheet = {
        id: 24,
        name: body.name,
        updatedAt: "2026-11-09T10:00:00Z",
        items: [],
      };
      sheets.push(sheet);
      return route.fulfill({ status: 201, json: sheet });
    }
    if (path === "/api/worksheets") return route.fulfill({ json: sheets });
    if (/^\/api\/worksheets\/\d+$/.test(path))
      return route.fulfill({
        json: sheets.find(
          (sheet) => sheet.id === Number(path.split("/").at(-1)),
        ),
      });
    if (path === "/api/minigames") return route.fulfill({ json: [definition] });
    if (path === "/api/assignments/report") return route.fulfill({ json: [] });
    if (path === "/api/classes")
      return route.fulfill({
        json: empty
          ? []
          : [
              { id: 2, name: "Little explorers" },
              { id: 3, name: "Reading together" },
            ],
      });
    if (path === "/api/assignments")
      return route.fulfill({ json: assignments });
    return route.fulfill({
      status: 404,
      json: { message: "Unexpected screenshot request: " + path },
    });
  });
  return { created };
}

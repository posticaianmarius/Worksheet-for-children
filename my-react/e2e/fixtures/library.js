import { spaceContextFor } from "../space-fixtures.js";

const game = (id, type) => ({
  id,
  type,
  version: 3,
  active: true,
  configurationSchema: {},
  defaultConfiguration: {},
});
const definitions = [
  game(1, "math-game"),
  game(2, "sequence-game"),
  game(3, "color-game"),
  game(4, "matching-game"),
];
const item = (id, definition) => ({
  id,
  miniGameId: definition.id,
  orderIndex: id,
  definition,
  configuration: {},
});
export const libraryWorksheets = [
  {
    id: 20,
    name: "Little number discoveries",
    updatedAt: "2026-11-08T10:00:00Z",
    items: [
      item(30, definitions[0]),
      item(31, definitions[3]),
      item(32, definitions[1]),
    ],
  },
  {
    id: 21,
    name: "Letters and animal friends",
    updatedAt: "2026-11-07T10:00:00Z",
    items: [item(33, definitions[2]), item(34, definitions[2])],
  },
  {
    id: 22,
    name: "Our next little adventure",
    updatedAt: "2026-11-06T10:00:00Z",
    items: [],
  },
  {
    id: 23,
    name: "A little of everything",
    updatedAt: "2026-11-05T10:00:00Z",
    items: [
      item(35, definitions[0]),
      item(36, definitions[2]),
      item(37, definitions[3]),
      item(38, definitions[1]),
    ],
  },
  {
    id: 24,
    name: "Counting together",
    updatedAt: "2026-11-04T10:00:00Z",
    items: [item(39, definitions[3])],
  },
  {
    id: 25,
    name: "A very long worksheet name for curious little explorers learning something new together",
    updatedAt: "2026-11-03T10:00:00Z",
    items: [item(40, { id: 99, type: "future-game", version: 99 })],
  },
];

/** Library-only API fixture: management, sharing and the destination editor read. */
export async function setupLibrary(
  page,
  {
    empty = false,
    language = "en",
    failCreateOnce = false,
    failRenameOnce = false,
    failDeleteOnce = false,
    published = false,
    holdCreate = false,
  } = {},
) {
  const state = {
    sheets: structuredClone(empty ? [] : libraryWorksheets),
    creates: [],
    renames: [],
    deletes: [],
    failCreateOnce,
    failRenameOnce,
    failDeleteOnce,
  };
  const createGate = new Promise((resolve) => {
    state.releaseCreate = resolve;
  });
  await page.addInitScript((lang) => {
    localStorage.setItem("worksheet-language", lang);
    localStorage.setItem("practica.sidebar.collapsed", "false");
  }, language);
  const user = {
    id: 1,
    role: "TEACHER",
    name: "Ana Popescu",
    email: "ana@example.test",
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname,
      method = route.request().method();
    const reply = (json, status = 200) => route.fulfill({ json, status });
    if (path === "/api/auth/me") return reply(user);
    if (path === "/api/auth/context") return reply(spaceContextFor(user));
    if (path === "/api/auth/csrf")
      return reply({ headerName: "X-XSRF-TOKEN", token: "test" });
    if (path === "/api/minigames") return reply(definitions);
    if (path === "/api/worksheets" && method === "POST") {
      const body = route.request().postDataJSON();
      state.creates.push(body);
      if (holdCreate) await createGate;
      if (state.failCreateOnce) {
        state.failCreateOnce = false;
        return reply({ message: "Could not create worksheet." }, 500);
      }
      const sheet = {
        id: 26,
        name: body.name,
        items: [],
        updatedAt: "2026-11-09T10:00:00Z",
      };
      state.sheets.push(sheet);
      return reply(sheet, 201);
    }
    if (path === "/api/worksheets") return reply(state.sheets);
    if (/^\/api\/worksheets\/\d+\/share$/.test(path))
      return reply({ shareCode: "ABC23456" });
    if (/^\/api\/worksheets\/\d+$/.test(path)) {
      const id = Number(path.split("/").at(-1)),
        sheet = state.sheets.find((entry) => entry.id === id);
      if (method === "DELETE") {
        state.deletes.push(id);
        if (published)
          return reply(
            { message: "Published worksheets cannot be deleted." },
            409,
          );
        if (state.failDeleteOnce) {
          state.failDeleteOnce = false;
          return reply({ message: "Could not delete worksheet." }, 500);
        }
        state.sheets = state.sheets.filter((entry) => entry.id !== id);
        return route.fulfill({ status: 204 });
      }
      if (method === "PUT") {
        const body = route.request().postDataJSON();
        state.renames.push({ id, ...body });
        if (state.failRenameOnce) {
          state.failRenameOnce = false;
          return reply({ message: "Could not rename worksheet." }, 500);
        }
        sheet.name = body.name;
      }
      return reply(sheet);
    }
    return reply({ message: "Unexpected library request: " + path }, 404);
  });
  return state;
}

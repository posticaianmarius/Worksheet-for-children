# PlaySheets frontend

A responsive teacher workspace and child learning experience built with React,
Vite and strict TypeScript. All six game types use shared engines and a common
player host. Romanian and English are supported throughout.

## Development

Use Node.js 24. Start the Spring Boot API on port 8080, then:

```bash
npm ci
npm run dev
```

Vite serves the application at http://localhost:5173 and proxies /api to the backend.
The root repository also provides forwarding commands such as `npm run dev`.

## Checks

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run check:bundle
npm run test:e2e
```

The production build writes to ignored `dist`; the backend's explicit
`with-frontend` packaging profile includes that output in the application JAR. The bundle check
enforces a 180 KiB gzip public-entry JavaScript budget.

Install the browser once with `npx playwright install chromium`. The ordinary
browser suite mocks API responses and does not modify a database. It includes
visual snapshots, responsive checks, scoring, authoring and recovery regressions.

To test mocked workflows against an existing frontend, set `E2E_BASE_URL`.
`npm run test:browser` and `npm run test:visual` select those suites separately.
`npm run test:live` automatically provisions a disposable production stack, runs
both live suites, and removes its own containers and data. It never uses the normal
local database. Docker is required. From the repository root, `npm run build:app`
packages the frontend and backend together; `npm run verify` runs every check.

See [FRONTEND.md](FRONTEND.md) for module boundaries, game contracts, saving,
recovery, visual conventions and test maintenance.

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

The production build writes to the backend's static resources. The bundle check
enforces a 180 KiB gzip public-entry JavaScript budget.

Install the browser once with `npx playwright install chromium`. The ordinary
browser suite mocks API responses and does not modify a database. It includes
visual snapshots, responsive checks, scoring, authoring and recovery regressions.

To test against an existing frontend, set `E2E_BASE_URL`. For a full browser/backend
contract check, point the backend at a **disposable PostgreSQL database** and run
`npm run test:live`. That test creates real accounts, uploads, worksheets, a class,
assignments and saved results; do not use a shared or production database.

See [FRONTEND.md](FRONTEND.md) for module boundaries, game contracts, saving,
recovery, visual conventions and test maintenance.

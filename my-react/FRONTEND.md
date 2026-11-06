# PlaySheets frontend

The application uses React, Vite, strict TypeScript, React Router data routes,
TanStack Query, Base UI, Tailwind and semantic CSS tokens. The Spring Boot API and
deployment model are unchanged.

## Ownership and dependencies

- **app** owns providers, capabilities, layouts and lazy routes.
- **shared** owns accessible primitives, API transport, DTOs, photos and translations.
- **features** owns worksheets, classrooms, assignments, reports and attempts.
- **games** owns module metadata, pure engines, editors and players. Game modules
  cannot import product features. Players never save results themselves.

Active React code is TypeScript. A few plain JavaScript compatibility/domain helpers
remain under `platform`, and the existing CSRF-aware transport remains under `api`.
Their entrypoints stay available for the original model regression tests.

## Adding a game

Register a stable type with supported catalog versions, localized title and help
keys, group, symbol, lazy Editor and lazy Player. Editors receive configuration and
the backend JSON Schema; they emit a new configuration without mutating existing
values. An optional image-field renderer lets authoring supply uploads without
making a game depend on persistence.

Players receive configuration and a single completion callback with score and
maximum score. The host owns timing, feedback, save retries and the attempt
lifecycle. Teacher preview uses this same player without a result API callback.
Question generation and maximum-score calculations must be pure and independently
tested. Inject randomness into engines for deterministic regression coverage.

The backend JSON Schema/default configuration is authoritative. Keep all
teacher-editable fields aligned with the editor, player and scoring.
`exerciseCount` remains optional for historical number games, defaults to 10, and
must be an integer between 1 and 100. Do not silently drop fields or rewrite stored
configuration while displaying a fallback. A new contract requires a versioned
upgrade plan and real-backend non-default create/update/reload tests, as documented
in the backend README. Preserve draft IDs, immutable revisions and saved results.

Unknown game types/versions are displayed without deleting their saved content.
A legacy draft changes to a photo-enabled definition only after its author selects
a photo; replacing or removing a photo retains the remaining configuration.

## Saving and recovery

Save is explicit. The reducer owns unsaved edits, selection, ordering, duplication
and deletion undo. A save coordinator remembers acknowledged IDs and successful
deletions, so retries do not recreate acknowledged activities. The existing
multi-request save API is not transactional.

Recovery snapshots are versioned, scoped by account and worksheet, and expire
after seven days. They contain configuration and asset references, not uploaded
binary data or child access codes. On reopening, compare the full server-content
fingerprint. Offer restoration when it matches, or recovery into a separate
worksheet when it differs. Never overwrite a newer server draft automatically.
Storage failure leaves server saving available and displays a recovery notice.

User-specific query data is cleared on identity changes. Mutations mark cached
read models stale; screens with immediate edits update/refetch their own data.
Publication is an explicit action, never a background query on ordinary navigation.

## Visual rules

Tokens and common primitives live in `shared/styles.css`; application layouts,
feature screens and the scoped game playfield each own separate CSS files loaded
with their modules. Keep game content centered,
use consistent purple action states, and pair feedback colors with text/icons.
Child answer controls are at least 56 px high. Respect system reduced motion and
the device-local sound/motion preferences.

Authoring has outline, preview and settings columns from 1280 px; an outline drawer
plus two columns from 1024 px; and Settings/Preview modes below 1024 px. The child
layout keeps progress and support controls at the edges. Drag operations also have
tap/keyboard alternatives. Reports show activity totals, not invented question data.

## Verification

Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`,
`npm run check:bundle` and `npm run test:e2e`.
The build creates a Vite manifest; the bundle check enforces a 180 KiB gzip public
entry budget including its static dependencies and initial public route.

Browser tests include stable visual baselines under `e2e/snapshots`. Review actual
screens before updating them with `npx playwright test e2e/redesign.spec.js --update-snapshots`.

For the real browser/backend contract test, start the app against a **disposable**
PostgreSQL database and run `npm run test:live`. It creates an account, worksheets,
a class, a child, uploads and saved results. It uses no API mocks. Never point it
at a shared or production database. `E2E_BASE_URL` can select an existing frontend;
otherwise Playwright starts Vite with the usual backend proxy.

Backend verification uses `mvnw clean verify` with Docker available, including
populated-database upgrades. The real-backend browser test and backend suite
complement the fast mocked UI regressions.

## Teacher and student architecture

`features/student` owns the learner layout, My work, Finished work and preferences.
`app/guards.tsx` owns route session/role checks, with backend ownership checks still
required. `shared/Brand.tsx` and `shared/LanguageMenu.tsx` are shared by both layouts.
Teacher Home gives setup guidance and counts assignment deliveries, not recipients.
Class pages reuse TeacherAssignments and Results in their tabs. Assignments are
managed using batch UUIDs; legacy revision-group report routes remain compatible.
The personal-code entry point keeps the two-code shortcut in an optional disclosure.
Auth, students and teachers have separate layouts while the game registry, editors,
players, configuration schemas and scoring contracts remain shared and unchanged.

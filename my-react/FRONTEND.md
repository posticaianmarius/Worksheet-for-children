# PlaySheets frontend

The application uses React, Vite, strict TypeScript, React Router data routes,
TanStack Query, Base UI, Tailwind and semantic CSS tokens. It shares the Spring Boot
session/CSRF transport and keeps the existing static-build deployment model.
See the [architecture](../ARCHITECTURE.md) for the teaching-space API and permissions.

## Ownership and dependencies

- **app** owns providers, capabilities, layouts and lazy routes.
- **shared** owns accessible primitives, API transport, DTOs, photos and translations.
- **features** owns teaching spaces, student directory/access, classrooms, worksheets,
  deliveries, reports, attempts and student workspaces.
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

Resource query keys are `[userId, spaceId, ...resourceKey]`. Switching identity or
space clears previous resource data and unmounts the old view while selection is
pending. Mutations mark read models stale; screens with immediate edits
update/refetch their own data. Private codes stay out of routine caches and draft recovery.
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

`npm run test:live` runs the original real-backend game/editor workflow only. To
include teaching teams, shared students, login cards, invitations and EN/RO mobile
checks, run both live specs against a **disposable** database/backend:

```powershell
# From my-react; QA backend uses its own database on host port 55441.
$env:E2E_BASE_URL = 'http://localhost:8081'
$env:E2E_LIVE_BACKEND = 'true'
npm run test:e2e -- live-backend.spec.js teaching-spaces-live.spec.js --workers=1
Remove-Item Env:E2E_BASE_URL, Env:E2E_LIVE_BACKEND
```

These tests create accounts, classes, uploads and results. Never point them at the
normal local or shared database. Without an explicit base URL, Playwright starts
Vite with its configured backend proxy; confirm that target before any live run.
Use separate `--output` directories for concurrent suites.

Backend verification uses `mvnw clean verify` with Docker available, including
populated-database upgrades. The real-backend browser test and backend suite
complement the fast mocked UI regressions.

## Teacher, student and teaching-space modules

- `features/spaces` owns the context provider, team settings, invitation acceptance,
  shared directory, reviewed bulk student picker and dedicated private access cards.
- `features/classrooms` owns Overview / Students / Assignments / Progress, mobile
  roster cards, co-teacher management, archived classes and former-student lookup.
- `features/assignments` owns deliveries, exact links, result views and shared class/global
  components. `worksheets/Sharing.tsx` owns recipient selection and frozen-version review.
- `features/student` owns My work, Finished work, class filters, preferences and the
  legacy-code chooser. Student views never request teacher reports.
- `app/guards.tsx` owns entrance/role routing. Backend policy remains authoritative;
  hiding an action is not permission enforcement. Brand, language and UI primitives
  are shared, and game contracts remain independent of product modules.

Class header and tabs have independent queries. A worksheet-library error cannot
block the roster. Reports request the selected class on the server rather than
loading every class and filtering only in the browser.

Student profile IDs differ from authentication user IDs. Reuse the directory's
`studentId` when adding an existing child; keep `userId` for legacy member and
history paths. Duplicate display names do not imply the same identity. Owners edit
shared names; owner/delegated staff manage login codes. Never expose credentials
in list rows, reports, URLs with query strings, analytics or draft recovery.

A login card requests the primary code in its authorized view and renders a QR
fragment link. Scanning clears the fragment before login. Reprinting preserves the
code; rotation invalidates aliases and old code sessions. Code-authenticated children
cannot switch space. Legacy email students choose a space when needed.

Assignment review publishes a frozen revision and submits that `revisionId` on
confirmation. It shows recipients and accepts an optional delivery title. Recipient
lists stay fixed after creation. New links select the exact batch and existing
recipient assignment; legacy selectors show labeled choices when ambiguous.

Completed work stays visible in Finished work after class removal or delivery
closure. Unfinished closed work cannot resume. Archived classes are read-only,
and former-student pages use direct authorized member/history lookup.

Keep English/Romanian headings, form labels, empty/error/loading states and print
styles aligned. The completed run covered 320/390/1440px EN/RO teaching-space,
directory and class-list pages, plus class tabs, game flows and printed QR cards.
See [session handoff](../docs/teaching-spaces-handoff.md) for the final counts,
local restart and backup notes. The accepted plan has no pending implementation work.

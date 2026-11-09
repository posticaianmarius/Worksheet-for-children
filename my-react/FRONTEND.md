# PlaySheets frontend

The application uses React, Vite, strict TypeScript, React Router data routes,
TanStack Query, Base UI, Tailwind and semantic CSS tokens. It shares the Spring Boot
session/CSRF transport and keeps the existing static-build deployment model.
See the [architecture](../ARCHITECTURE.md) for the teaching-space API and permissions.

## Ownership and dependencies

- **app** composes providers, capabilities, layouts and lazy routes.
- **shared** owns accessible primitives, typed HTTP transport, DTOs, runtime contexts and translations. Catalog photos belong to the catalog feature.
- **features** owns teaching spaces, student directory/access, classrooms, worksheets,
  deliveries, reports, attempts and student workspaces.
- **games** owns module metadata, pure engines, editors and players. Game modules
  cannot import product features. Players never save results themselves.

All active source is strict TypeScript. Shared runtime contexts expose language,
preferences, session and space contracts independently of application composition.
Feature providers perform authentication/context loading. Feature API clients use
one CSRF/session transport and explicitly invalidate declared query resources.
Scoped invalidation preserves other identities/spaces and never republishes shares.
There is no global mutation browser event or parallel legacy API/model layer.

The architecture test parses imports and re-exports, including lazy imports. It
rejects upward dependencies and undeclared cross-feature entrypoints. Keep public
feature contracts narrow and avoid eager page/component export barrels. Assignment
publication UI owns its scoped sharing CSS. Catalog photos and feedback own their
feature/game modules.

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
The build writes ignored `dist` and creates a Vite manifest; the bundle check enforces a 180 KiB gzip public
entry budget including its static dependencies and initial public route.

Browser tests include stable visual baselines under `e2e/snapshots`. Review actual
screens before updating them with `npx playwright test e2e/redesign.spec.js --update-snapshots`.

`npm run test:browser` runs mocked workflows; `npm run test:visual` runs the five
unchanged visual baselines. Responsive cases are separate by persona and viewport,
so a failure identifies the affected layout instead of timing out a large loop.

`npm run test:live` provisions the production application and PostgreSQL using a
random Compose project and dynamic local port. It runs **both** live specs, covering
all editors, frozen work, teaching teams, credentials, invitations and history, then
removes only that project's containers and volume. It ignores an existing base URL
and never mounts the normal database or uploads. `PLAY_SHEETS_TEST_IMAGE` optionally
selects an already-built production image; otherwise the runner builds from source.

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
- `shared/RequireSession.tsx` provides the entrance/role gate composed by layouts. Backend policy remains authoritative;
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

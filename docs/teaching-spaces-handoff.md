# PlaySheets — final session handoff

Last verified: **2026-11-06**. Branch: **redesign**.

The accepted teaching-space/classroom plan is implemented and verified. There is
no pending implementation task from that plan. In the next session, read this
file, inspect the branch/worktree and runtime, then follow the user's next request.

## Checkpoints and preserved work

| Commit | Checkpoint |
| --- | --- |
| b97d7b0 | Previous student workspace and classroom deliveries |
| 57e60fe | Teaching-space schema, shared identities and authorization |
| 14e2498 | Teaching teams, student directory and classroom workflow UI |
| dddb9e8 | Completed rollout, responsive/language verification and data preservation |

Documentation-only commits may follow these; use `git log -5 --oneline` for the
latest checkpoint. No changes have been pushed or deployed remotely.

The tracked worktree was clean before these final notes. Pre-existing untracked
`backend-preview.log`, `backend-verification.log`, `production-preview.log` and
root `test-results/` were preserved. Do not delete them as cleanup. AGENTS.md was
deliberately removed at the user's request; do not recreate it or restore the
previous "Change the file" approval requirement.

## Implemented product decisions

- A teaching space can represent one teacher, a team or a school. Owners oversee
  the space; ordinary teachers see assigned classes and a minimal shared directory.
- Leads and co-teachers manage their class rosters, assignments and progress.
  Owners explicitly delegate permission to print/reset student credentials across
  the space. Platform ADMIN is a separate role and has no classroom bypass.
- One scoped student profile and private code/QR login work across the child's
  classes in that space. New managed children need no email, password or signup.
- Teachers search/reuse directory profiles before creation. Duplicate names require
  a choice. Pasted lists have a preview and transactional bulk creation.
- Personal classes stay separate when joining a team. Invited signup joins directly.
  Invitations are hashed, revocable, single-use and valid for seven days.
- Worksheet libraries stay private. Assigned frozen snapshots and results can be
  reviewed by authorized co-teachers/owners without accessing editable drafts.
- Classes use Overview / Students / Assignments / Progress. Rosters have mobile
  cards and former-student history; tabs load independently.
- Assignment review pins the exact revision. Each fixed-recipient delivery has its
  own existing batch UUID, optional title and exact link. Legacy worksheet codes
  show labeled choices when several eligible deliveries match.
- Membership removal affects that class; the profile login still works elsewhere.
  Closing work stops unfinished attempts and retains completed history. Rotating
  a profile code revokes every alias and old code session. Profile archive disables
  login. Archived classes remain read-only; there is no restore flow in this release.
- English/Romanian UI, QR-card print styles, existing games, schemas, frozen
  configurations and scoring contracts are retained.

Shared worksheet libraries, parent accounts, cross-space identity linking,
automatic duplicate merging, class transfers, attendance, billing and broader
school administration remain outside this release. Do not expand that scope
without a new user request.

## Verification record

| Check | Result at completion |
| --- | --- |
| Frontend lint, TypeScript, production build | Passed |
| Public-entry bundle budget | 168.5 KiB gzip; budget 180 KiB |
| Frontend unit tests | 22 passed |
| Backend tests | 72 passed |
| PostgreSQL upgrade/schema integration tests | 7 passed; none skipped |
| Mocked browser regression tests | 74 passed |
| Real PostgreSQL-backed browser scenarios | 3 passed |

The real scenarios cover all six game editors with non-default saved settings and
a completed worksheet; shared students, co-teachers, delegated cards, exact links,
credential rotation and saved history; and invited signup/QR login. Added checks
cover teaching-space/directory/class-list pages at 320, 390 and 1440px in both
English and Romanian, asserting translated headings. The class-tab/roster/assignment
narrow-screen regression also passed. Desktop/mobile and printed QR-card screenshots
were inspected.

The final language test setup opens an application page before reading localStorage
and preserves the selected language on navigation. The latest local preview also
passed a read-only browser check for student entrance, teacher login, phone layout
and protected-route redirection. Counts above are a dated verification record,
not permanent test-count expectations.

## Database and backup state

The ordinary `worksheets-postgres` container uses:

- Host port **55440**, database `worksheets`, local user/password `postgres`.
- Bind-mounted data: `database/postgres-data` → `/var/lib/postgresql`.
- Flyway schema **V25**, applied successfully after backing up V24.
- Rollout snapshot before and after migration: 10 authentication users, 2 classes,
  0 assignments, 0 canonical attempts and 0 legacy worksheet results.
- Post-upgrade validation: **0 invalid student/class/space membership links**.

These are rollout counts, not a reason to reset later data if the user adds work.
Existing IDs/accounts were retained. Valid membership codes became scoped
credential aliases; previously invalid codes remain invalid. No names were merged.

Verified PostgreSQL custom-format pre-migration backups, 66,592 bytes each:

- `C:/Users/posti/AppData/Local/Temp/playsheets-before-spaces-20261106.dump`
- `C:/Users/posti/AppData/Local/Temp/playsheets-before-spaces-resume-20261106.dump`

Backups are local files, not Git contents. Confirm they still exist before a
rollback. An older application also needs its matching database backup; do not
rewrite migration history or manually downgrade V25.

## Restart this checkout after shutdown

At the last check, the normal preview was left running at
[localhost:5173](http://localhost:5173) with the API at localhost:8080.
The disposable QA runtime was stopped. A laptop shutdown stops the local Java/Vite
processes, so inspect before restarting:

```powershell
# Repository root; start Docker Desktop in Linux-containers mode first.
git status --short --branch
git log -5 --oneline
docker ps -a
docker port worksheets-postgres 5432
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 5173,8080,8081 } |
  Select-Object LocalPort,OwningProcess
```

Do not start duplicate servers on occupied ports. Check a process's command line
before stopping it; do not reuse old PIDs. Do not stop unrelated gigahack/municipal
services or recreate the existing database to resolve a port mismatch.

For this saved setup, resume the existing container with `docker start`.
The committed Compose file instead publishes host port **5433**, and the backend's
standalone fallback is **5432**. Do not create another PostgreSQL container against
the same data folder. The root README's Compose workflow is for the portable setup;
the commands below use the existing **55440** container.

Terminal 1, from the repository root, after confirming ports are free:

```powershell
docker start worksheets-postgres
docker exec worksheets-postgres pg_isready -U postgres -d worksheets
docker port worksheets-postgres 5432

cd backend
$env:DB_URL = 'jdbc:postgresql://localhost:55440/worksheets'
$env:DB_USERNAME = 'postgres'
$env:DB_PASSWORD = 'postgres'
$env:SERVER_PORT = '8080'
.\mvnw.cmd -DskipTests package
$previewJar = Join-Path $env:TEMP 'playsheets-teaching-spaces-preview.jar'
Copy-Item -LiteralPath 'target/backend-0.0.1-SNAPSHOT.jar' -Destination $previewJar -Force
java -jar $previewJar
```

This is a startup build, not a replacement for verification. Running the TEMP copy
keeps Maven output unlocked on Windows. If frontend sources change, build them
before packaging the jar to update the committed static bundle.

Terminal 2, from the repository root:

```powershell
cd my-react
# Run npm ci if dependencies are missing or package-lock.json has changed.
npm run dev -- --host localhost
```

Open http://localhost:5173 and use the existing teacher account. New foreground
servers can be stopped with Ctrl+C. Preview logs from this session are under TEMP,
with `playsheets-teaching-spaces-preview` and `playsheets-teaching-spaces-vite`
prefixes; new foreground runs print to their terminal.

## Future verification

Fast frontend checks, from `my-react`:

```powershell
npm test
npm run lint
npm run typecheck
npm run build
npm run check:bundle
npm run test:e2e
```

Clear stale `E2E_BASE_URL` / `E2E_LIVE_BACKEND` variables before ordinary mocked
regressions. The frontend build writes tracked static assets under the backend.
Backend verification is `.\mvnw.cmd verify` from `backend`, with Docker running
so the PostgreSQL suites execute rather than skip.

Live browser tests create accounts, classes, uploads and results. Never target the
ordinary local database. Use `playsheets-spaces-qa` on host port **55441**, an
application copy on **8081**, and the QA database URL. The existing QA container
can be resumed with `docker start playsheets-spaces-qa`. If recreating a disposable
QA container, keep its data separate from `database/postgres-data`.

From `my-react`, with that disposable application running:

```powershell
$env:E2E_BASE_URL = 'http://localhost:8081'
$env:E2E_LIVE_BACKEND = 'true'
npm run test:e2e -- live-backend.spec.js teaching-spaces-live.spec.js --workers=1
Remove-Item Env:E2E_BASE_URL, Env:E2E_LIVE_BACKEND
```

Use distinct `--output` directories for concurrent suites. `npm run test:live`
runs only the original game/editor live spec, so use both files above for team and
login coverage. Stop only the disposable QA runtime after testing.

## Where to continue

- [Architecture](../ARCHITECTURE.md): model, permissions and lifecycle boundaries.
- [Backend guide](../backend/README.md): API reference, migration and verification.
- [Frontend guide](../my-react/FRONTEND.md): module ownership, caching and game contracts.
- Backend `space` package: authorization, team/invitations, directory and credentials.
- Frontend `features/spaces`, `classrooms`, `assignments` and `student`: product flows.
- `V25__teaching_spaces.sql`, `TeachingSpaceTests` and
  `PopulatedV24SpaceUpgradeIT`: migration and permission regression coverage.

No messages or invitations were sent externally. No production deployment was
performed. Continue with the user's next request; the accepted implementation is complete.

# Redesign cleanup handoff

Baseline: `20559c9`. All work is local on `redesign`; the independent `work`
checkout stays at `7dc7301` with its earlier uncommitted cleanup preserved.
Nothing has been pushed or deployed.

## Checkpoints

| Commit | Change |
| --- | --- |
| `eacf9d9` | Freeze 103 API routes; separate mocked, visual and live browser suites; split responsive cases |
| `706f97e` | Remove generated output; explicit frontend packaging; disposable production test stack |
| `c0177b7` | Typed feature clients, shared runtime contracts, editor hooks, scoped cache invalidation and frontend boundaries |
| `5747bf7` | Backend modules, owner facades, transactional workflows, rollback tests and six ArchUnit rules |

The final documentation/test-portability checkpoint follows these. Use
`git log -5 --oneline` for its identifier.

## Ownership and extension rules

- App composes frontend providers and routes. Features own clients, screens and
  models; shared and games cannot depend on features/app. Cross-feature entrypoints
  are explicit in the import-graph test, including lazy imports and re-exports.
- Feature writes declare the read-model keys they invalidate. Keys contain both
  identity and space; writes do not invalidate another scope or republish shares.
- The editor separates rendering, coordination, save/retry, recovery persistence
  and navigation protection. All active source is strict TypeScript.
- Auth owns accounts; teaching owns spaces/rosters/credentials; content owns
  drafts/revisions/catalog/assets; learning owns deliveries/attempts/results.
  Application workflows coordinate multi-module changes in one transaction.
- Call owner facades rather than another module's repository. Existing mapped
  entities/associations remain the explicit persistence exception; public HTTP
  responses stay DTOs. Entity state is encapsulated. Add architecture checks when
  adding a new boundary, rather than adding a blanket exclusion.
- Catalog usage queries go through `ContentReferences`. Historic item-result
  references go through `ItemResultUsage`, implemented in learning. Applied V23
  and its `com.worksheet.minigame.BuiltinPhotoConfiguration` helper retain their
  exact contents and qualified name.

## Builds and checks

Use Node 24, Java 25, and Docker. After `npm --prefix my-react ci`, install Chromium
with `npx --prefix my-react playwright install chromium`.

| Command from repository root | Purpose |
| --- | --- |
| `npm run build` | Frontend to ignored `my-react/dist` |
| `npm run build:app` | Clean application JAR including frontend; profile validates missing output |
| `npm test` | Frontend model, transport, cache and import-boundary checks |
| `npm run test:e2e` | Mocked workflows and unchanged visual baselines |
| `npm run test:backend` | Backend/API/ArchUnit and mandatory PostgreSQL checks |
| `npm run test:live` | Provision private production stack; run both live suites; remove its data |
| `npm run verify` | Run the complete verification sequence |

For Docker-free backend checks, run `bash backend/mvnw -f backend/pom.xml test`
(or `mvnw.cmd test` from backend on Windows). `verify` requires Docker and never
silently skips PostgreSQL integration tests.

`test:live` always provisions its own random Compose project, dynamic local port
and volume. It never mounts normal database/uploads or trusts an external base URL.
`PLAY_SHEETS_TEST_IMAGE` can select a prebuilt production image. Live screenshots
use Playwright's per-test output paths on every OS. Tests explicitly await modal
closure before reopening confirmations. Responsive cases keep the original route
and width assertions while avoiding compound-test timeouts.

## Verification record

The complete `npm run verify` sequence passed on **2026-11-09**:

| Check | Result |
| --- | --- |
| Frontend unit/architecture tests | 26 passed |
| TypeScript, lint, production build | Passed |
| Public-entry JavaScript | 169.1 KiB gzip; budget 180 KiB |
| Mocked/visual browser cases | 85 passed; five original baselines unchanged |
| Backend/API/architecture checks | 81 passed |
| PostgreSQL migration/schema integrations | 7 passed; none skipped |
| Real production-stack browser scenarios | 3 passed across both live specs |
| Missing-frontend packaging guard | Correctly rejected absent output |
| API routes, applied migrations and historical helper | Preserved |

The combined run used the system Chromium executable and the prebuilt production
image described below. Its QA containers, network and database volume were removed
by the runner. No ordinary development service or database was used.

The 103-route baseline is checked against Spring's actual registered handlers.
Existing response/permission assertions remain. All 12 teacher workflow scenarios
were retained and grouped into access, delivery and history suites sharing fixtures.
Nontransactional HTTP tests prove failed invited signup leaves no account behind,
and a learning failure rolls back both class archive and roster changes.

Production packaging and missing-frontend validation passed. Docker source build
stages and the runtime image passed separately: the managed environment's 8 GiB VFS
limit prevented holding all intermediate layers through the final multi-stage COPY.
The runtime uses the exact JAR extracted from the successful Docker source build.
Live verification uses that prebuilt image; CI uses the normal source Dockerfile.
No environment-specific credentials, generated certificates or image assembly
workarounds are stored in the repository.

Applied migration files, historical configuration helper, visual baseline images,
normal runtime data/uploads and source resources were preserved. Generated
`Project`, frontend `dist` and backend static output were removed from tracking.

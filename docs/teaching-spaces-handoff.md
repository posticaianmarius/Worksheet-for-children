# Teaching spaces implementation — resume checkpoint

Paused at the user's request on 2026-11-06 so they can shut down the laptop.

## Implemented

- Teaching spaces, owner/delegated permissions, co-teachers, private worksheet libraries.
- Shared student directory, reviewed transactional bulk creation, reusable class memberships.
- Student-level codes and migrated aliases, credential rotation/session invalidation, QR cards.
- Seven-day single-use invitations, direct invited signup, space switching and scoped caches.
- Overview / Students / Assignments / Progress, former-student and archived-class history.
- Frozen-revision assignment review, optional delivery titles, exact delivery links and legacy-code chooser.
- Scoped reports, batched roster profiles, preserved completed work and closed unfinished attempts.
- English/Romanian copy, mobile cards, print styles and architecture documentation.

## Verification completed

- Frontend lint, TypeScript, production build and bundle budget passed.
- 22 frontend unit tests passed.
- 72 backend tests and 7 PostgreSQL migration/schema integration tests passed.
- 74 mocked browser regression tests passed.
- Three real PostgreSQL-backed browser tests passed: all six game editors and student completion; teaching-team/student lifecycle; invited signup and QR login.
- Desktop/mobile roster and printed QR-card screenshots were inspected.

The last small changes (history filtering, legacy chooser dates, single-row class tabs) compiled and passed the relevant backend tests. A final live-browser rerun is still required against the newest built jar. The live test also now includes additional 320/390/1440px English/Romanian checks that have not yet run.

## Remaining work on resume

1. Start Docker Desktop if necessary and the disposable container `playsheets-spaces-qa` (PostgreSQL on localhost:55441).
2. Run the latest packaged application on port 8081 against that disposable database. Build first if sources have changed; run a copy of the jar from TEMP to avoid Windows locking the Maven output.
3. With `E2E_BASE_URL=http://localhost:8081` and `E2E_LIVE_BACKEND=true`, run:
   `npm --prefix my-react run test:e2e -- live-backend.spec.js teaching-spaces-live.spec.js --workers=1`.
   Use a separate `--output` directory for concurrent browser suites. Do not run these tests against the user's regular database.
4. Check the class tabs and teaching-space/student screens on narrow phones in both languages. Resolve any failures and checkpoint the result.
5. If bringing up the normal local preview, start `worksheets-postgres` on localhost:55440, then the new backend on 8080 with `DB_URL=jdbc:postgresql://localhost:55440/worksheets`, and Vite on localhost:5173. The local database backup below must remain available before applying V25.
6. Verify preserved record counts after migration, confirm the preview loads, and give the user the final completion report.

## Local data and runtime state

- Branch: `redesign`.
- Earlier checkpoints: `b97d7b0` (previous student UI) and `57e60fe` (teaching-space foundation).
- The regular local database is still at schema V24. V25 has only been applied to disposable/test databases.
- Verified regular database backup: `C:/Users/posti/AppData/Local/Temp/playsheets-before-spaces-20261106.dump` (66,592 bytes, PostgreSQL custom archive).
- Before migration: 10 authentication users, 2 classes, 0 worksheet assignments, 0 canonical attempts, 0 legacy worksheet results.
- QA server jar/logs are under TEMP with the `playsheets-spaces-qa` prefix. QA server and the two project database containers were stopped for shutdown.
- Do not stop or modify unrelated gigahack/municipal containers.
- Preserve unrelated untracked root logs and `test-results/`; they were present before this implementation.
- Do not recreate AGENTS.md. The user previously asked for its removal.

Read `ARCHITECTURE.md` for the implemented permission, lifecycle, compatibility and migration rules. No email messages or invitations were sent externally.

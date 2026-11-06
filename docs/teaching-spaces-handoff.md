# Teaching spaces — completion and verification

Completed on 2026-11-06 after resuming the saved checkpoint.

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

The latest packaged application passed the real-server game authoring/completion and teaching-team/student lifecycle tests. Invitation signup and QR login passed, followed by checks at 320, 390 and 1440 pixels in English and Romanian. These checks assert translated headings. Class tabs, rosters and assignments also passed the narrow-screen regression check.

## Final local rollout

The extra language test setup was corrected to open an application page before accessing localStorage and preserve the selected language during navigation. The ordinary preview passed read-only checks for student entrance, teacher login, phone layout and protected-route redirection.

The local database was backed up and upgraded to V25. All 10 accounts and 2 classes were retained, along with the existing counts of 0 assignments, 0 canonical attempts and 0 legacy worksheet results. There are 0 invalid student/class/space links. No implementation or verification work remains from the accepted plan.

The frontend is running at http://localhost:5173 and the backend at http://localhost:8080. The backend uses a jar copy under TEMP so Maven output remains unlocked. Logs use the `playsheets-teaching-spaces-preview` and `playsheets-teaching-spaces-vite` prefixes under TEMP.

For future live tests, use the disposable database on 55441 and backend on 8081 with `E2E_BASE_URL=http://localhost:8081` and `E2E_LIVE_BACKEND=true`:

`npm --prefix my-react run test:e2e -- live-backend.spec.js teaching-spaces-live.spec.js --workers=1`

Never run these data-creating tests against the ordinary local database. Use separate output directories for concurrent browser suites.

## Local data and runtime state

- Branch: `redesign`.
- Earlier checkpoints: `b97d7b0` (previous student UI) and `57e60fe` (teaching-space foundation).
- The regular local database is now at schema V25. Existing accounts and classes were retained.
- Verified regular database backup: `C:/Users/posti/AppData/Local/Temp/playsheets-before-spaces-20261106.dump` (66,592 bytes, PostgreSQL custom archive).
- A fresh verified backup is also saved at `C:/Users/posti/AppData/Local/Temp/playsheets-before-spaces-resume-20261106.dump` (66,592 bytes).
- Before migration: 10 authentication users, 2 classes, 0 worksheet assignments, 0 canonical attempts, 0 legacy worksheet results.
- QA server jar/logs are under TEMP with the `playsheets-spaces-qa` prefix. The disposable QA runtime can be stopped after verification; keep the ordinary local preview and its database running.
- Do not stop or modify unrelated gigahack/municipal containers.
- Preserve unrelated untracked root logs and `test-results/`; they were present before this implementation.
- Do not recreate AGENTS.md. The user previously asked for its removal.

Read `ARCHITECTURE.md` for the implemented permission, lifecycle, compatibility and migration rules. No email messages or invitations were sent externally.

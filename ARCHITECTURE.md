# PlaySheets architecture

Implemented model as of 2026-11-06. See the [session handoff](docs/teaching-spaces-handoff.md) for the final verification, local database state and restart instructions; the [backend guide](backend/README.md) and [frontend guide](my-react/FRONTEND.md) cover implementation contracts.

## Product and ownership

One React client, one Spring Boot modular monolith, and PostgreSQL. Flyway owns schema changes. Teachers work in teaching spaces: an individual workspace, school, or teaching team.

A teaching space contains teacher memberships, a shared student directory, classes, assignment deliveries, and progress. Student profiles are scoped to a space and reference existing authentication users. Class memberships reference those profiles. A student can therefore join several classes without receiving another identity or login.

Worksheet libraries remain private to their authors across spaces. Classes receive immutable revisions; co-teachers and space owners can review assigned snapshots and results without opening the author's editable worksheet.

| Permission | Owner | Lead teacher | Co-teacher |
| --- | --- | --- | --- |
| Space settings, directory names/archive, invitations and team permissions | Yes | No | No |
| View/manage all classes and results in space | Yes | Assigned classes | Assigned classes |
| Search/create directory profiles and add them to own classes | Yes | Yes | Yes |
| Choose co-teachers or transfer class lead | Yes | Own classes | No |
| Print/reset student codes across space | Yes | Explicit delegation | Explicit delegation |

Space ownership is separate from platform ADMIN. A worksheet author's identity alone does not grant access to class results. Removing a teacher revokes their space access immediately; active lead-teacher and owner responsibilities must be reassigned first. Archived classes retain their history and do not block removing a former lead.

## Modules and interfaces

- **auth** retains email/password accounts, session fixation protection, CSRF, and `/api/auth/me`. `/api/auth/context` lists available spaces, selected space, scoped student identity, and capabilities. POST selects an authorized space.
- **space** owns teaching spaces, memberships, invitations, student directory, credentials, and the shared authorization policy. `/api/spaces/{id}` exposes team, invitation, student, bulk-add and credential resources. Class co-teachers use `/api/classes/{id}/teachers`.
- **classroom** owns class setup, roster membership, former-student lookup, archive, and personal-code entry. Classes expose Overview / Students / Assignments / Progress.
- **assignment** creates recipient rows and one delivery, retaining existing batch UUIDs. Preview publishes the exact revision reviewed by the teacher; create accepts that revision ID. Delivery links use `/work/{batchId}` and require an eligible signed-in student.
- **attempt** preserves immutable configurations and the existing scoring contracts. Only a student can write their own active assignment attempt. Teachers review results through the class policy.
- **worksheet / minigame** retain the existing authoring, schemas, catalog, asset and game contracts.

Scoped browser requests send `X-Space-Id`. The server validates membership and resource scope; a selected value or hidden UI control never grants authority. Code-authenticated sessions are bound to the credential's student profile and space and cannot switch to another space. Legacy email students with multiple spaces choose one.

The frontend uses `[userId, spaceId, ...resourceKey]` query keys and clears resource caches on identity/space changes. Class tabs load independently. Reports query authorized classes on the server and load attempts/results in batches; roster responses contain neither private codes nor repeated per-student grade queries.

## Student access and invitations

Owners create revocable, single-use teacher invitation links with seven-day expiry. Only hashed tokens are stored; invitations are copied by the owner, without an email-delivery dependency. Existing teachers retain their personal spaces when joining. Invited signups join directly.

Students use one private eight-character code or QR card for all classes in their space. QR credentials travel in a URL fragment, cleared before authentication, and never in query strings. Codes are returned only by dedicated permission-controlled, non-cacheable credential operations. Printing preserves the current primary code; replacement invalidates every alias and all old code sessions. Archiving a profile disables its login and closes unfinished work without deleting history.

Directory search precedes creation. Duplicate names require an explicit choice, not automatic identity merging. Bulk pasted names have a review step and are applied in one transaction. Membership removal affects only that class; re-adding reuses the identity and never reopens old work.

## Assignments and history

The flow is Choose worksheet → Recipients → Review → Assign → Progress. Recipients are fixed after creation; additional recipients require a new delivery. Optional delivery titles distinguish repeated assignments of the same worksheet. Frozen revisions preserve game configurations and completed scores.

Closing a delivery affects only its batch. Class archive closes its work and exposes read-only history. Completed student work remains available in Finished work after membership removal or closure; unfinished attempts become ABANDONED. Archived classes have no restore operation in this release. Historical student pages use direct authorized lookups, including former memberships. Student history hides abandoned attempts from closed assignments while authorized teachers retain the full history.

Legacy revision-group routes and worksheet codes remain adapters. An ambiguous worksheet code asks the student to choose among eligible deliveries rather than silently selecting the newest one. Historical general share codes can create direct work only inside the author's personal space and cannot bypass fixed class recipients.

## Migration and verification

V25 adds teaching spaces after the existing V1–V24 sequence. It creates personal spaces for existing teachers, preserves all existing IDs, attaches classes, derives scoped students from memberships and direct assignments, and backfills deliveries from batch IDs. Valid active member codes become profile credential aliases, with the oldest valid code primary. Previously invalid codes stay invalid. The historical member-code column is retained but cleared; credential storage becomes authoritative.

No reset, reseed, name-based merge, class transfer, or score rewrite is required. Back up a populated database before applying migrations. Schema changes are forward-only; restoring an older application also requires the matching database backup.

Verification includes backend permission/lifecycle tests, real populated PostgreSQL upgrade tests, frontend checks, mocked browser regressions, and `teaching-spaces-live.spec.js` against a disposable database. See the backend and frontend READMEs for commands. Parents, shared worksheet libraries, cross-space linking, attendance, billing, and school administration remain outside this release.

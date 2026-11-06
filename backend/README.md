# Worksheet Backend

This backend is one Spring Boot modular monolith backed by PostgreSQL. Editable worksheets are separated from immutable published revisions, so assignments and completed history do not change when a worksheet is edited later.

## Module map

```text
com.worksheet
├── auth                 users, roles, sessions, admin bootstrap/API
├── space                teaching teams, directory, invitations, credentials and scoped authorization
├── classroom            classrooms and membership lifecycle
├── minigame             dynamic catalog, versions, schemas and asset links
├── worksheet            editable worksheet drafts and items
│   ├── revision         immutable published worksheet snapshots
│   └── result           deprecated result compatibility API
├── assignment           per-user grants to frozen revisions
├── attempt              canonical attempt and scoring lifecycle
├── minigame1            legacy game adapter
├── countmatch           legacy game adapter
└── shared
    ├── errors           stable JSON errors and request IDs
    ├── security         Spring Security, CORS and CSRF
    └── storage          replaceable asset storage contract
```

Each feature keeps the `controller -> service -> repository -> entity` flow. Controllers translate HTTP, services own authorization and transactions, repositories only query persistence, and response records keep JPA entities out of the API.

## Domain and database

```text
auth_users (USER / TEACHER / ADMIN)
  └──< worksheet (private editable draft)
          ├──< worksheet_item (editable)
          └──< worksheet_revision (immutable)
                  └──< worksheet_revision_item (frozen game + configuration)

teaching_space
  ├──< space_teacher >── auth_users (owner/delegated permissions)
  ├──< space_invitation (hashed single-use token)
  ├──< space_student >── auth_users
  │      └──< student_credential (primary code + migrated aliases)
  ├──< classroom
  │      ├──< class_teacher >── auth_users (lead/co-teachers)
  │      └──< classroom_member >── space_student
  └──< assignment_delivery (existing batch UUID, title, revision, closure)
          └── worksheet_assignment (recipient, space, optional class, revision)
                  └──< worksheet_attempt
                          └──< worksheet_attempt_item_result

mini_game_definition (type + version + JSON Schemas)
  ├──< worksheet_item
  ├──< worksheet_revision_item
  └──< mini_game_definition_asset >── mini_game_asset
```

Worksheet ownership stays private. Assignment content derives from its immutable revision; result authorization uses the teaching-space/class policy rather than source ownership. V25 adds delivery records, explicit space scope, teacher memberships and scoped student identities. See [ARCHITECTURE.md](../ARCHITECTURE.md) for the permission matrix and migration rules.

Worksheet and worksheet-item creation, updates and deletion require a `TEACHER` or
`ADMIN` session, together with the existing ownership checks. Child (`USER`) sessions
receive 403 even for historical drafts they own. Assignment and attempt APIs still
allow children to complete activities and save their results.

Publishing occurs when an assignment is created, a personal attempt starts, or a worksheet is shared. A SHA-256 content hash reuses the latest unchanged revision. A changed name, item order, definition version, or configuration creates the next revision. Published rows are never edited.

A worksheet share code points to an immutable revision. New assignment links
identify an exact delivery and require an eligible signed-in recipient. Legacy
worksheet-code redemption reuses eligible active work; multiple matches return a
conflict so the client can request `POST /api/worksheets/join/choices` and show a
chooser. Choices include title, frozen worksheet name, class and assignment time.
Historic general codes can create direct work only in the author's personal space
and cannot bypass fixed class recipients. Rotating a worksheet share code publishes
the latest draft without changing existing deliveries.

## Students and classroom access

Student directory profiles belong to a teaching space and reference existing
authentication users. `space_student.id` is the directory `studentId`;
`auth_users.id` remains the `userId` used in legacy member/history routes.
Creating or reusing a membership does not replace the child identity or history.

All space teachers can search/create directory profiles. Class managers add a
profile with `POST /api/classes/{id}/members` and `{ "studentId": 123 }`;
the name-based request remains a compatibility path. Duplicate names require an
explicit create-another-child choice. Bulk name/profile requests are reviewed by
the client and committed transactionally. Only owners rename shared profiles or
archive students.

V21 originally stored codes on memberships. V25 moves valid codes to
`student_credential`, with one primary printable code and migrated aliases for
each scoped profile. The old member-code column remains for migration compatibility
but is cleared and is no longer authoritative. Routine directory/roster responses
contain no credentials or per-student grade aggregates.

`POST /api/play/login` authenticates an active student profile and opens all their
classes in that space. It creates neither a profile nor an assignment. Code sessions
are validated on authenticated API requests, including `/api/auth/me`; they cannot
change space. Invalid public-code guesses are rate limited per remote address.
Legacy email-based students can choose among their existing spaces.

Only the owner or staff with explicit whole-space student-access permission can
issue/reprint/rotate credentials. Dedicated credential responses are non-cacheable.
QR codes carry the credential in a fragment that the client clears before login.
Rotation invalidates all aliases and their code-authenticated sessions without
changing identity or results. Membership removal and class archive do not revoke
the profile's login to other classes. Profile archive disables the login and ends
unfinished work across that space.

Legacy class credential routes are permission-checked adapters to the scoped
profile credential. `POST /api/classes/{id}/tests` remains a compatibility adapter;
the current UI uses the reviewed assignment flow below. `POST /api/play/join`
validates the supplied student code and worksheet selector before establishing its
session. `GET /api/classes/{id}/members/{userId}` and its `/tests` child route
support authorized former-student history as well as current members.

The old `worksheet_result` and `mini_game_result` tables/routes remain compatibility
APIs. New gameplay uses canonical attempts and immutable revision item IDs.

## Teacher and student workspaces

`SpaceAccess` is the common space/class authorization boundary. Teachers send
validated `X-Space-Id` context; resource IDs alone and source-worksheet ownership
never grant class/result access. Owners oversee the space, ordinary teachers manage
assigned classes, and leads/owners choose co-teachers. Private worksheet drafts
stay author-owned even when a co-teacher or owner can read an assigned snapshot.

Assignment preview publishes the version shown during review. Creation accepts
`revisionId`, optional `title`, and either a whole `classroomId` or that class
plus distinct selected `userIds`. The legacy single-user payload remains available.
Recipients must be active in that exact class and space. Creation persists the
delivery and recipient grants together; recipient lists are fixed afterward.

The existing batch UUID identifies each delivery independently. Class co-teachers
and owners can inspect progress or close it through the class policy. Creating a
new delivery still requires ownership of the source worksheet. Closing one batch
does not close another delivery of the same revision. Student responses distinguish
not-started/in-progress/completed work; completed history remains readable after
closure, while unfinished revoked attempts cannot be resumed.

## Attempt lifecycle

```text
POST worksheet/assignment attempts
        |
        v
  IN_PROGRESS on a frozen revision
        |
        +-- PUT each item result (COMPLETED or SKIPPED)
        |      - membership and score bounds checked
        |      - details checked against the definition result schema
        |      - repeated PUT replaces that item while in progress
        |
        +-- POST complete
               - every revision item must have a result
               - backend sums totalScore and maxScore
               - status becomes COMPLETED and immutable

membership removal -> active assignment revoked -> unfinished attempts ABANDONED
                                      completed history remains readable under the student/class policy
```

The client reports each dynamic game's item score because the backend cannot reproduce arbitrary frontend game logic. The backend controls revision membership, schemas, non-negative numeric bounds, `score <= maxScore`, completeness, lifecycle state, and aggregate totals.

## Authorization matrix

| Capability | USER | TEACHER | ADMIN |
| --- | --- | --- | --- |
| Sign in | Personal code or existing credentials | Email/password | Email/password |
| Create and edit worksheets | No | Yes | Yes |
| Create/join classroom | Legacy email accounts can join; managed children are added by staff | Create in space/manage assigned classes; owners oversee space | No special classroom bypass |
| Assign an owned worksheet | No | To an authorized class in the selected space | No implicit teacher bypass |
| Play a received assignment | Yes | No | No |
| Read assignment attempts | Own active work and completed historical attempts | Assigned classes, creator-owned direct work, or space-owner oversight | No global bypass |
| Read active public catalog | Public | Public | Public |
| Create/version/activate catalog entries | No | No | Yes |
| Upload/delete catalog assets | No | No | Yes |
| Manage account roles | No | No | Yes |

Missing authentication returns `401`, insufficient role returns `403`, inaccessible or cross-user resources return `404`, and lifecycle/data conflicts return `409`.

## Security

- Spring Security stores authentication in the existing `WORKSHEET_SESSION` HTTP session.
- Login/signup rotate the session ID. Logout invalidates it.
- The cookie is `HttpOnly`, `SameSite=Strict`, scoped to `/api`, and can be made secure with `AUTH_COOKIE_SECURE=true`.
- `GET /api/auth/csrf` returns the standard token. Send it as the returned header (normally `X-XSRF-TOKEN`) on mutating requests.
- CORS allows one configured frontend origin and credentials.
- Public signup can select `USER` or `TEACHER`, never `ADMIN`.
- Every JSON error has `code`, `message`, `fieldErrors`, `requestId`, and `timestamp`.

Example browser sequence:

```text
GET  /api/auth/csrf              credentials: include
POST /api/auth/login             credentials: include + X-XSRF-TOKEN
POST /api/worksheets/42/attempts credentials: include + X-XSRF-TOKEN
```

## Canonical APIs

Teachers archive a class using `DELETE /api/classes/{id}`. It becomes read-only,
its memberships leave the active roster, and its deliveries close. Unfinished
attempts become `ABANDONED`; completed attempts and immutable content remain.
The student's profile code continues to work for other classes and finished history.
There is no class restore operation in this release.

`DELETE /api/assignments/batches/{batchId}` is the current close-delivery operation.
Legacy class/revision and direct/revision delete routes close every matching grant
in that authorized scope, including repeated deliveries. They do not delete source
worksheets or work in other classes. Explicit reassignment creates fresh grants;
re-adding a membership never reopens old work.

`GET /api/assignments/report` returns authorized non-removed work by default.
Add `includeRemoved=true` for historical/archived rows, and `classroomId` for
a class-scoped report. The current Assignments screen has active/closed views.
Legacy revision-group report links remain supported. Reports batch attempt/result
reads; roster names/profiles load separately from progress.

| Route | Purpose |
| --- | --- |
| `POST /api/worksheets/{id}/attempts` | Start a personal attempt and publish/reuse a revision |
| `POST /api/assignments/{id}/attempts` | Assigned USER starts an attempt |
| `POST /api/worksheets/{id}/share` | Pin a revision and return its stable share code |
| `POST /api/worksheets/{id}/share/rotate` | Pin the latest draft and replace the share code |
| `POST /api/worksheets/join` | Redeem a code into a per-user assignment |
| `GET /api/attempts/{id}` | Frozen content, progress, results and totals |
| `PUT /api/attempts/{attemptId}/items/{revisionItemId}/result` | Idempotently save/replace an item result |
| `POST /api/attempts/{id}/complete` | Validate completeness and aggregate totals |
| `GET /api/worksheets/{id}/attempts` | Personal attempt history |
| `GET /api/assignments/{id}/attempts` | Assigned history visible to user/teacher |

Item result example:

```json
{
  "outcome": "COMPLETED",
  "score": 3,
  "maxScore": 5,
  "timeSeconds": 12,
  "details": { "moves": 4 }
}
```

Use `"outcome":"SKIPPED"` with score zero for an explicit skip.

Worksheet draft routes retain their existing paths. `PUT /api/worksheets/{id}` edits a worksheet name; item update/delete remains nested below the worksheet. Assignment and classroom routes also retain their existing paths.

## Dynamic mini-game catalog

Definitions are identified by stable `type` plus positive `version`. Configuration and result payloads are validated with NetworkNT's Jackson 3-compatible JSON Schema Draft 2020-12 implementation. Remote `$ref` values are rejected. Once a worksheet draft or immutable revision references a definition version, its contract cannot be edited; create a higher version.

Public `GET /api/minigames` returns active versions only. Admin APIs can list all definitions and create, edit unused versions, activate, or deactivate them. Definition metadata supports a description, optional thumbnail, and logical asset keys.

### Editable settings contract for new mini-games

Every field emitted by a teacher editor must be declared in `configurationSchema.properties`,
including fields shown using a frontend fallback. Put defaults in `defaultConfiguration` too:
JSON Schema's `default` keyword alone does not populate saved configurations. Match integer
types, bounds and array constraints between the editor and backend. Keep strict
`additionalProperties: false`; silently dropping an edited field would lose teacher changes.

The four built-in number games share `numberConfigurationSchema()` and
`numberDefaultConfiguration()` in `MiniGameDataInitializer`: `exerciseCount` is an integer
from 1 to 100, with default 10. It is optional for historical worksheets that omit it.
When adding a similar game, reuse this contract and align the player and scoring fallback.

For every new or changed editor, add a non-default create/update/reload case to
`DynamicMiniGameTests.editedBuiltInSettingsSurviveSavingAndReloading`, using the real seeded
definition. Test bounds and legacy configurations too. Permissive mocked catalogs do not
verify backend validation. Test database upgrades with existing draft and revision data;
changing startup seeds alone does not update definitions already stored in PostgreSQL.

The single-activity worksheet editor uses the existing draft save API for selection, duplication,
deletion/Undo and reordering. Photo-enabled built-ins use definition version 3 and optional nullable
`imageAssetId` fields (at the activity root and on letter-game animals/matching-game pairs).
V23 creates the additive catalog versions for populated databases; startup seeds cover fresh or
historically malformed catalogs. Neither process changes old draft item IDs/configurations,
published definition references, immutable revisions or saved results. A draft moves to the photo
contract only when its author chooses a photo; replacing a photo creates a new asset reference.
Old `img` paths and emoji values remain the fallback when an object photo is removed. Root photos
do not affect scoring. Children can view photos through authenticated content routes but cannot upload.
`DynamicMiniGameTests.builtInPhotosAndEditedSettingsSurviveSaveUpdateReloadAndPublishedHistory`
exercises uploads plus non-default settings on all six real seeded contracts. `PopulatedV22PhotoUpgradeIT`
checks the PostgreSQL upgrade with an existing draft and frozen revision.

V22 is a targeted additive repair for the missing optional exercise-count field in built-in
versions 1 and 2. It keeps definition IDs, required fields, draft/revision configurations and
saved results intact, and excludes user-owned definitions and later contracts. Other contract
changes still require a new version and an explicit compatibility plan for existing drafts.

Assets are verified from magic bytes (not the submitted MIME header), limited to supported image/audio formats and 10 MB, hashed with SHA-256, and stored through `MiniGameAssetStorage`. Local disk is the default implementation; an S3-compatible implementation can replace it without changing catalog services. Referenced assets cannot be deleted.

`minigame1` and `countmatch` are legacy adapters and remain behavior-compatible. New games use the dynamic catalog.

Teacher-uploaded task images and selectable variants are opt-in through the root configuration-schema
extension `x-image-slots`. See [Task image API and integration guide](TASK_IMAGES.md) for declarations,
discovery, uploads, image libraries, task configuration and lifecycle rules. No frontend changes are required
to existing games; an editor can integrate these APIs when it adds image fields.

## Configuration

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `DB_URL` | `jdbc:postgresql://localhost:5432/worksheets` | PostgreSQL JDBC URL |
| `DB_USERNAME` | `postgres` | Database username |
| `DB_PASSWORD` | `postgres` | Local-development fallback; set a secret in deployed environments |
| `AUTH_COOKIE_SECURE` | `false` | Use `true` behind HTTPS |
| `APP_CSRF_ENABLED` | `true` | Keep enabled outside isolated tests |
| `APP_BOOTSTRAP_ADMIN_NAME` | empty | Optional first-admin display name |
| `APP_BOOTSTRAP_ADMIN_EMAIL` | empty | Optional first-admin email |
| `APP_BOOTSTRAP_ADMIN_PASSWORD` | empty | Optional first-admin password (15–128 characters) |

All three admin bootstrap values must be supplied together. Creation is idempotent. Startup fails if the email already belongs to a non-admin account; the application never silently promotes it and never logs the password.

File paths and the allowed frontend origin are configured in `src/main/resources/application.properties`. Hibernate Open Session in View is disabled.

## Migrations

Flyway migrations are forward-only. Never rewrite V1–V13 or another migration already applied to a shared database.

- V14 adds `ADMIN` and optimistic locking to editable worksheet/classroom rows.
- V15 publishes/backfills immutable worksheet revisions, attaches assignments to revisions, then removes duplicate assignment teacher/worksheet columns.
- V16 creates attempts and item results and copies existing results while preserving their IDs and scores.
- V17 adds catalog metadata, asset integrity/lifecycle fields, and relational definition asset keys.
- V18 adds worksheet share codes.
- V19 pins each share code to an immutable worksheet revision.
- V20 tracks task image references in worksheet drafts and immutable revisions.
- V21 adds personal student access codes.
- V22 declares the editable exercise count and its default in existing built-in number-game definitions.
- V23 adds photo-enabled built-in catalog versions without rewriting existing snapshots.
- V24 adds class/archive and assignment-removal lifecycle fields.
- V25 adds teaching spaces, team/invitation records, scoped students/credentials, co-teachers and delivery records. Existing IDs and saved work remain intact; valid old codes become aliases.

The V13 upgrade migration can only snapshot the worksheet content available at upgrade time because older edits were not historically stored. Existing result history is preserved and linked to that snapshot.

The task-image migration uses V20 because V19 was already assigned to worksheet sharing.
After pulling this correction, run a clean build to remove any old V19 task-image resource
from `target/classes`. Databases upgraded from main through the sharing V19 migration
can apply V20 normally. If a database previously ran the task-image feature branch with
task images recorded as V19, inspect `flyway_schema_history` and back up that database
before planning reconciliation; do not delete its history or run `flyway repair` blindly.

## Run and verify

For the complete Docker development stack (frontend, backend, and database), run
`docker compose up --build -d` from the repository root and open
http://localhost:5173. See the [root README](../README.md) for teammate setup,
live frontend updates, backend rebuilds, persistent data, and container test commands.
The commands below are the alternative workflow with Java installed locally.

Requirements: Temurin Java 25 and Docker Desktop. Compose publishes PostgreSQL on
host port 5433; the existing local container for this checkout uses 55440. Confirm
with `docker port worksheets-postgres 5432` and use the matching `DB_URL`. For the
saved local setup, use the [session handoff](../docs/teaching-spaces-handoff.md).

```powershell
# repository root
docker compose up -d postgres

# backend directory
$env:DB_URL = 'jdbc:postgresql://localhost:5433/worksheets'
.\mvnw.cmd clean spring-boot:run
```

Verification:

```powershell
.\mvnw.cmd clean compile
.\mvnw.cmd test
.\mvnw.cmd verify
```

Fast application tests use isolated H2 schemas with Flyway disabled. `MigrationDiscoveryTests`
uses Flyway's real migration discovery against an empty H2 database without executing the
PostgreSQL scripts, so duplicate versions and invalid filenames fail even without Docker.
`verify` additionally runs Testcontainers PostgreSQL tests for a fresh V1-to-latest migration,
Hibernate schema validation, HTTP startup, a populated V13-to-latest upgrade, and a populated
V19-to-latest upgrade that preserves worksheet shares. Further upgrade fixtures cover
V21 exercise-count compatibility, V22 photo versions, V23 archive fields and V24
teaching-space migration with existing identities, code aliases and results. PostgreSQL integration tests are
skipped with an explicit JUnit skip when Docker is unavailable; start Docker to run all checks.


## Teaching-space API reference

All mutations use the existing session and CSRF protection. Space resources
validate membership independently of frontend controls. Public signup remains
teacher-first in the UI; platform ADMIN does not imply space-owner permissions.

| Route | Purpose |
| --- | --- |
| `GET /api/auth/context` | Available spaces, selected space, scoped student and capabilities |
| `POST /api/auth/context` | Select an authorized `spaceId`; code sessions stay bound |
| `GET /api/spaces` | List the actor's spaces |
| `PATCH /api/spaces/{spaceId}` | Owner renames the space |
| `GET/PATCH/DELETE /api/spaces/{spaceId}/members[/{userId}]` | List team, delegate student-login access, or remove a teacher |
| `POST /api/spaces/{spaceId}/owner/{userId}` | Transfer ownership to an existing team member |
| `GET/POST /api/spaces/{spaceId}/invitations` | Owner lists or creates seven-day single-use invitations |
| `DELETE /api/spaces/{spaceId}/invitations/{id}` | Revoke an invitation |
| `POST /api/spaces/invitations/accept` | Signed-in teacher accepts a token |
| `GET/POST /api/spaces/{spaceId}/students` | List/create scoped profiles; client searches the directory |
| `POST /api/spaces/{spaceId}/students/bulk` | Reviewed transactional profiles/memberships, up to 200 rows |
| `PATCH /api/spaces/{spaceId}/students/{id}` | Owner renames or archives a profile |
| `POST /api/spaces/{spaceId}/students/{id}/credential[/rotate]` | Owner/delegated staff reprints or replaces a code |
| `GET/POST /api/classes/{id}/teachers` | View teaching team or add/transfer lead teacher |
| `DELETE /api/classes/{id}/teachers/{userId}` | Owner/lead removes a co-teacher |
| `POST /api/worksheets/{id}/assignments/preview` | Return `{revisionId, worksheet}` for frozen review |
| `GET/DELETE /api/assignments/batches/{batchId}` | Read authorized delivery or close it |
| `POST /api/worksheets/join/choices` | Eligible legacy-code matches with class/title/date labels |

Invitations are copied as links by the owner; no mail provider or external sending
is implemented. Tokens are stored only as hashes and are single-use, expiring and
revocable. Invited signup accepts `invitationToken` and joins the team directly.
An existing teacher's personal classes stay in their own space. Transfer ownership
and active lead-teacher duties before removing a teacher.

For the completed rollout, exact verification results and database backup locations,
see the [session handoff](../docs/teaching-spaces-handoff.md). Never reset an existing
database to apply V25, and do not assume an older binary can write to the upgraded
schema without restoring its matching backup.

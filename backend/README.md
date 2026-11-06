# Worksheet Backend

This backend is one Spring Boot modular monolith backed by PostgreSQL. Editable worksheets are separated from immutable published revisions, so assignments and completed history do not change when a worksheet is edited later.

## Module map

```text
com.worksheet
├── auth                 users, roles, sessions, admin bootstrap/API
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
  ├──< worksheet (editable, owned)
  │      ├──< worksheet_item (editable)
  │      └──< worksheet_revision (immutable publication)
  │              └──< worksheet_revision_item (frozen game + configuration)
  │                      └──< worksheet_attempt
  │                              └──< worksheet_attempt_item_result
  ├──< classroom (teacher-owned)
  │      └──< classroom_member >── USER
  └── worksheet_assignment
          ├── one assigned USER
          ├── optional classroom
          └── one immutable worksheet_revision

mini_game_definition (type + version + JSON Schemas)
  ├──< worksheet_item
  ├──< worksheet_revision_item
  └──< mini_game_definition_asset >── mini_game_asset
```

Only `worksheet` stores worksheet ownership. An assignment derives its worksheet and teacher through `worksheet_revision -> worksheet -> auth_users`; it does not duplicate those foreign keys. Child access is checked through these parent relationships.

Worksheet and worksheet-item creation, updates and deletion require a `TEACHER` or
`ADMIN` session, together with the existing ownership checks. Child (`USER`) sessions
receive 403 even for historical drafts they own. Assignment and attempt APIs still
allow children to complete activities and save their results.

Publishing occurs when an assignment is created, a personal attempt starts, or a worksheet is shared. A SHA-256 content hash reuses the latest unchanged revision. A changed name, item order, definition version, or configuration creates the next revision. Published rows are never edited.

A worksheet share code points to one immutable revision. A signed-in `USER` redeems it once to receive a normal assignment, then uses the assignment attempt APIs. Reusing the same code returns the existing active assignment. `POST /api/worksheets/{id}/share/rotate` publishes the latest draft under a new code without changing earlier assignments.

Teachers create children by name with `POST /api/classes/{id}/members` and rename them
with `PATCH /api/classes/{id}/members/{userId}`. These profiles use internal `USER`
identities to store progress, with no usable email/password login. V21 stores a unique
personal code per membership. Existing accounts can receive a code using
`POST /api/classes/{id}/members/{userId}/code`; their account names remain self-managed.

`POST /api/classes/{id}/tests` accepts `worksheetId`, publishes the current draft,
updates its shared revision, and assigns it to every active member atomically.
Earlier assignments keep their frozen revisions. The public `POST /api/play/join`
accepts `studentCode` and `worksheetCode`, validates both against an active membership
and its teacher, and establishes a child session only after successful redemption.
It returns the child and `assignmentId` for the normal attempt APIs. Assignments are
matched within that membership's class. Child code entry never creates a new profile.

The teacher-only `GET /api/classes/{id}/members/{userId}/tests` returns saved attempts.
Roster responses include last-test percentage, average percentage, and the lowest
scoring test, calculated from completed attempts. Removing a member disables their
personal code and revokes their class assignments without deleting history.

The old `worksheet_result` and `mini_game_result` tables/routes remain as deprecated compatibility APIs. New work uses `worksheet_attempt` and `worksheet_attempt_item_result`.

## Teacher and student workspaces

`POST /api/play/login` accepts `{ "studentCode": "..." }` and establishes the normal
child session after validating an active membership and classroom. It does not
create a child or assignment. Personal codes are credentials: unsuccessful public
code attempts are limited per remote address, and code sessions are checked against
the active membership on authenticated API requests, including `/api/auth/me`.
`POST /api/classes/{classId}/members/{userId}/code/rotate` replaces a code and
invalidates sessions using the previous credential without changing the identity
or its history. Printable access cards are a teacher-owned frontend view.

Assignment creation additionally accepts `{ "classroomId": 1, "userIds": [2, 3] }`.
All selected users must be distinct, active members of that exact owned class.
The original whole-class and single-user payloads remain supported. Each creation
retains its existing unique batch UUID. Reports expose that `batchId`; the new
teacher workspace groups by delivery rather than combining repeated assignments
of the same worksheet version. `DELETE /api/assignments/batches/{batchId}` closes
only that teacher-owned delivery. Legacy revision-group endpoints are unchanged.
Student assignment responses now include `IN_PROGRESS` when an unfinished attempt
exists. Completed versions and results remain immutable.

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
                                      completed history remains readable by teacher
```

The client reports each dynamic game's item score because the backend cannot reproduce arbitrary frontend game logic. The backend controls revision membership, schemas, non-negative numeric bounds, `score <= maxScore`, completeness, lifecycle state, and aggregate totals.

## Authorization matrix

| Capability | USER | TEACHER | ADMIN |
| --- | --- | --- | --- |
| Sign in | Personal code or existing credentials | Email/password | Email/password |
| Create and edit worksheets | No | Yes | Yes |
| Create/join classroom | Join | Create/manage | No special classroom bypass |
| Assign an owned worksheet | No | Yes | No implicit teacher bypass |
| Play a received assignment | Yes | No | No |
| Read assignment attempts | Own active assignment | Assignments created through owned worksheets | No global bypass |
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

Teachers can delete a class using `DELETE /api/classes/{id}`. This archives the class,
disables its membership codes, removes its assignments from active lists and abandons
unfinished attempts. Completed attempts, draft IDs and immutable revisions remain intact.

`DELETE /api/assignments/classes/{classId}/revisions/{revisionId}` removes every recipient
and repeated assignment of that published revision in the selected class. Direct assignments
use `DELETE /api/assignments/direct/revisions/{revisionId}`. Neither operation deletes the
source worksheet or assignments in other classes. Old codes cannot recreate the removed
assignment; an explicit teacher reassignment creates fresh grants.

The teacher report defaults to active homework. `GET /api/assignments/report?includeRemoved=true`
also includes removed homework and archived classes, with `removedAt` on each removed grant.
The Assignments page exposes this history through **Show deleted homework**; teachers retain
access to the existing assignment and attempt history routes. V24 adds the nullable archive
columns without rewriting existing content or results.

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

Requirements: Temurin Java 25 and Docker Desktop.

```powershell
# repository root
docker compose up -d postgres

# backend directory
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
V19-to-latest upgrade that preserves worksheet shares. PostgreSQL integration tests are
skipped with an explicit JUnit skip when Docker is unavailable; start Docker to run all checks.

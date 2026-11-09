# PlaySheets

A React frontend and Spring Boot backend for worksheets, mini-games, classrooms,
assignments, and saved attempts. The backend requires PostgreSQL and applies Flyway
migrations at startup.

For the saved setup in this checkout, start with the [session handoff](docs/teaching-spaces-handoff.md). It records the existing database, restart commands, completed checks and release boundaries. The Compose workflow below is the portable setup; its host database port differs from the existing local container.

## Run all three services with Docker (recommended for development)

Install Docker Desktop and start it in **Linux containers** mode. Colleagues on
Linux can use Docker Engine with the Compose plugin. No local Java, Node.js, or
Maven installation is needed for this workflow.

After cloning the repository (or pulling this branch), run from the repository root:

```powershell
docker compose up --build -d
docker compose ps
```

The first run downloads images, builds Java, and installs frontend dependencies;
allow a few minutes. Open **http://localhost:5173** once all three services are healthy.

| Service | Local address | Purpose |
| --- | --- | --- |
| Frontend | http://localhost:5173 | React/Vite with live updates |
| Backend | http://localhost:8080 | Spring Boot API |
| PostgreSQL | localhost:5433 | Database `worksheets`, user/password `postgres` |

The frontend forwards `/api` requests to the backend inside Docker. Keep using
`localhost:5173` in the browser; the internal Docker service names are not browser URLs.
Ports are bound to the local computer. This configuration is for development.

### Everyday work

- Edit frontend files normally in your editor; Vite updates the browser automatically.
  Polling is enabled in Docker so changes made by Windows editors are detected too.
- After Java, backend configuration, or migration changes, rebuild the backend:
  `docker compose up --build -d backend`.
- After frontend dependency changes, restart the frontend:
  `docker compose restart frontend`. It runs `npm ci` using the committed lockfile
  at every start; dependencies are stored in a Docker volume.
- After pulling changes from colleagues, run `docker compose up --build -d` and
  `docker compose restart frontend` to refresh both the backend and dependencies.
- View logs: `docker compose logs -f frontend backend postgres`.
- Stop everything: `docker compose down`.
- Start again: `docker compose up -d`.

Each colleague has their own local database and uploads. Git shares the code and
configuration, not accounts, worksheet data, or uploaded images. Existing local
PostgreSQL data stays in `database/postgres-data`, and backend files stay in
`backend/data`; stopping or rebuilding containers does not remove those folders.
Do not delete these folders to troubleshoot startup. Back up an existing database
before applying new migrations. Frontend dependencies are isolated from host
`node_modules`, so Windows, macOS, and Linux colleagues can use the same setup.

If a port is already occupied, identify the owning process and use or stop the
matching PlaySheets service before starting another copy. Leave unrelated services
alone. If a service fails, inspect its logs.
The backend waits for PostgreSQL readiness, and the frontend waits for backend
readiness. Migration errors still need the investigation described below.

### Checks inside Docker

With the services running:

```powershell
docker compose exec frontend npm test
docker compose exec frontend npm run lint
docker compose exec frontend npm run build -- --outDir /tmp/worksheet-frontend-build
```

The build check uses a temporary container directory. Generated bundles are ignored by Git. For backend tests without a local JDK, use the build stage:

```powershell
docker build --target build -f backend/Dockerfile -t worksheet-backend-check .
docker run --rm --entrypoint ./mvnw worksheet-backend-check -B test
```

These backend tests run against isolated H2 databases; the PostgreSQL integration
checks under `verify` still require a local JDK and Docker as described below.

## Requirements for running outside Docker

- Java JDK 25.
- Node.js 24 LTS and npm.
- Docker Desktop running Linux containers (for the local PostgreSQL database and integration tests).

Check `java -version`, `node -v`, and `docker version`. Maven is downloaded by the backend wrapper.

## Start the website

From the repository root in PowerShell:

```powershell
docker compose up -d postgres
npm --prefix my-react ci
npm run build:app
$env:DB_URL = 'jdbc:postgresql://localhost:5433/worksheets'
java -jar backend/target/backend-0.0.1-SNAPSHOT.jar
```

Open http://localhost:8080. Stop the backend with Ctrl+C.
The frontend builds into ignored `my-react/dist`. The explicit Maven `with-frontend`
profile packages it into the JAR; `build:app` builds both source trees from scratch.
Rebuild the application and restart the backend after frontend changes in this mode.

Compose publishes PostgreSQL at `localhost:5433`, database `worksheets`, with local
username/password `postgres`. The standalone backend defaults to port 5432, so the
commands above explicitly select the Compose port. The existing container in this
checkout instead publishes port 55440; use the handoff instructions to resume it.
Data persists in `database/postgres-data`. Use `DB_URL`, `DB_USERNAME`, and
`DB_PASSWORD` for the actual database you intend to open.

## Develop with automatic frontend updates

From the repository root, start PostgreSQL and the backend:

```powershell
docker compose up -d postgres
cd backend
$env:DB_URL = 'jdbc:postgresql://localhost:5433/worksheets'
.\mvnw.cmd clean spring-boot:run
```

In a second terminal, from the repository root:

```powershell
cd my-react
npm ci
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` requests to the backend on port 8080.

## Teacher and student workspaces

Teachers sign in with email/password. A teacher working independently has a personal
teaching space; owners can invite other teachers and assign lead/co-teachers to
classes. Joining a team keeps existing personal classes separate. Ordinary teachers
see their assigned classes; owners oversee the space. Worksheet drafts remain
private to their authors.

Search the shared **Students** directory before creating a child. Reuse the same
profile in every class within that teaching space. Pasted name lists have a review
step, and matching names require an explicit identity choice. Children do not need
email, passwords or signup. Only owners and explicitly delegated teachers can print
or replace their private login cards.

Class pages have **Overview**, **Students**, **Assignments** and **Progress** tabs.
Assign through **Choose worksheet → Recipients → Review → Assign**. The review
pins an immutable revision; later edits cannot change the assigned work. Recipients
are fixed, and each delivery has its own batch ID and optional title. Share its
exact assignment link when directing students to a particular delivery.

Students enter one private personal code or scan their QR card to open **My work**
across all their classes in the space. They can resume work, filter by class, review
**Finished work**, and use **Another child** on shared devices. The optional legacy
worksheet-code shortcut shows a chooser when several eligible deliveries match.

Removing a class membership affects only that class. Closing work or archiving a
class stops unfinished attempts and preserves completed history. Codes belong to
student profiles, so another class remains accessible. Rotating a student's code
revokes its aliases and old code sessions; archiving the profile disables its space
login. Archived classes are read-only in this release.

Flyway V25 adds the teaching-space, directory, credential and delivery model.
Existing identities, memberships, revisions, assignments and results retain their
IDs. Valid old codes migrate as aliases; unrelated children are never merged by name.
See the [architecture](ARCHITECTURE.md) for permission and migration rules.

## Build and verify the backend

With Docker Desktop running, from `backend`:

```powershell
.\mvnw.cmd clean verify
$env:DB_URL = 'jdbc:postgresql://localhost:5433/worksheets'
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

The URL above selects the Compose database; use port 55440 for this checkout's
saved local container. The JAR requires a running PostgreSQL database. Use `npm run build:app` from the
repository root to build the complete UI/API artifact. Plain backend verification
builds an API-only JAR and does not require a frontend bundle.

Regular tests catch duplicate migration versions without Docker. Full verification
also checks migrations, upgrades with existing data, Hibernate mappings, and HTTP
startup using disposable PostgreSQL containers. These PostgreSQL tests are mandatory; full verification fails when Docker is
unavailable. Use regular backend `test` for the Docker-free checks.

## Complete verification

From the repository root, after installing frontend dependencies:

```bash
npm run verify
```

This runs frontend units and architecture checks, lint, types, build/bundle budget,
mocked/visual browser checks, backend/ArchUnit/PostgreSQL verification, then both
live browser suites against an automatically provisioned production stack.
Install Chromium once with `npx --prefix my-react playwright install chromium`.
Individual commands include `npm run test:e2e`, `npm run test:backend` and
`npm run test:live`. Live tests use a random Compose project, dynamic local port,
and their own volume; cleanup removes only that test stack. Existing local data
and uploads are never mounted by this runner.

## Migration startup troubleshooting

The worksheet-sharing migration is V19; the task-image migration is V20. After
pulling this correction, use `clean` in the Maven command so an old V19 task-image
file cannot remain in `target/classes`.

If startup reports a database connection error, check `docker compose ps` and
`docker compose logs postgres`, and confirm the backend database settings.

For migration history or checksum errors, inspect the database's
`flyway_schema_history` before making changes. A database that previously ran the
task-image feature branch with task images recorded as V19 needs separate
reconciliation; do not delete the database or its migration history to bypass the error.

## Structure

- `backend/`: Spring Boot source, Flyway migrations, tests, and Maven wrapper.
- `my-react/`: React source and Vite build configuration.
- `docker-compose.yml`: frontend, backend, and PostgreSQL development services.
- `database/postgres-data/`: local database files managed by PostgreSQL.
- `compose.test.yml`: disposable production-stack browser verification.
- `scripts/`: cross-platform build and verification commands.

Generated JARs, build bundles and the obsolete `Project` output are no longer tracked.

See [backend documentation](backend/README.md) for architecture, API configuration,
and migration details, and [task image documentation](backend/TASK_IMAGES.md) for image APIs.

## Documentation

| Document | Purpose |
| --- | --- |
| [Session handoff](docs/teaching-spaces-handoff.md) | Final checkpoint, local restart, backups and next-session context |
| [Architecture](ARCHITECTURE.md) | Product model, permissions, history and migration rules |
| [Backend guide](backend/README.md) | APIs, database, security and backend verification |
| [Frontend guide](my-react/FRONTEND.md) | Modules, caching, game contracts and UI verification |
| [Task image guide](backend/TASK_IMAGES.md) | Image fields, uploads and asset lifecycle |

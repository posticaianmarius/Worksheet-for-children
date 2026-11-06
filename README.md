# PlaySheets

A React frontend and Spring Boot backend for worksheets, mini-games, classrooms,
assignments, and saved attempts. The backend requires PostgreSQL and applies Flyway
migrations at startup.

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
| PostgreSQL | localhost:5432 | Database `worksheets`, user/password `postgres` |

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

If a port is already occupied, stop the existing local Vite, Java, or PostgreSQL
process before starting the Docker services. If a service fails, inspect its logs.
The backend waits for PostgreSQL readiness, and the frontend waits for backend
readiness. Migration errors still need the investigation described below.

### Checks inside Docker

With the services running:

```powershell
docker compose exec frontend npm test
docker compose exec frontend npm run lint
docker compose exec frontend npm run build -- --outDir /tmp/worksheet-frontend-build
```

The build check uses a temporary container directory, preserving the backend's
committed static files. For backend tests without a local JDK, use the build stage:

```powershell
docker build --target build -t worksheet-backend-check ./backend
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
cd my-react
npm ci
npm run build
cd ../backend
.\mvnw.cmd clean spring-boot:run
```

Open http://localhost:8080. Stop the backend with Ctrl+C.
The frontend build writes to `backend/src/main/resources/static`, which Spring Boot serves.
Rebuild the frontend and restart the backend after changing frontend code in this mode.

PostgreSQL uses `localhost:5432`, database `worksheets`, username `postgres`, and
password `postgres` by default. Its data persists in `database/postgres-data`.
Use `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` to connect to a different database.

## Develop with automatic frontend updates

From the repository root, start PostgreSQL and the backend:

```powershell
docker compose up -d postgres
cd backend
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

Teachers sign in, create a class, and add students by name. Each student receives a
private personal code; no child email, password or signup is required. Existing
class members can receive a code using **Generate code** without changing their
identity or saved work. The teacher can print access cards or replace a lost code.

Teachers build reusable worksheets, then assign a frozen version to a whole class
or selected students. Classes have **Students**, **Assignments** and **Progress**
tabs. Global **Assignments** manages each delivery independently; **Results** shows
progress and saved scores, including closed assignments.

Students enter their personal code on the home page and open **My work**. They can
start or resume an assigned worksheet, review **Finished work**, and adjust their
preferences. A worksheet code remains an optional shortcut into a particular task.
**Another child** signs out before a shared device changes hands.

Replacing a code ends sessions using the old credential. Closing an assignment or
removing a student stops access while retaining the teacher's completed history.
Existing worksheet IDs, immutable revisions, student identities and saved results
are preserved; this architecture change reuses the existing database columns.

## Build and verify the backend

With Docker Desktop running, from `backend`:

```powershell
.\mvnw.cmd clean verify
java -jar target/backend-0.0.1-SNAPSHOT.jar
```

The JAR requires a running PostgreSQL database. To include frontend changes, run
`npm run build` in `my-react` before building the JAR.

Regular tests catch duplicate migration versions without Docker. Full verification
also checks migrations, upgrades with existing data, Hibernate mappings, and HTTP
startup using disposable PostgreSQL containers. These PostgreSQL tests are skipped
when Docker is unavailable, so a build with skipped tests is not full verification.

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
- `Project/`: legacy build artifacts; use `backend` and `my-react` for current development.

See [backend documentation](backend/README.md) for architecture, API configuration,
and migration details, and [task image documentation](backend/TASK_IMAGES.md) for image APIs.


## Teaching spaces and classrooms

PlaySheets supports individual teachers and shared teaching teams. Space owners invite teachers, assign class co-teachers, and delegate student login-card permissions. The Students directory reuses one profile across classes; children use one private code or QR login for all their classes in that space.

Class pages have Overview, Students, Assignments and Progress tabs. Assign worksheets through recipient selection and a frozen-version review. Closing work or archiving a class preserves completed results. Worksheet drafts stay private to their author.

Existing accounts, classes and history migrate through Flyway V25 without resetting data. Joining a team keeps existing personal classes separate. Back up a populated database before upgrading. See [ARCHITECTURE.md](ARCHITECTURE.md) for permissions, migration details, and current release boundaries.

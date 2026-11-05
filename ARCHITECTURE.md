# Worksheet for Children — implemented architecture

The redesigned React client uses strict TypeScript, lazy routes, a shared design
system, and separate game engines, editors and players. See
[`my-react/FRONTEND.md`](my-react/FRONTEND.md) for frontend ownership, game-module
contracts, draft recovery and verification. The backend contracts described below
remain the source of truth for persistence and published history.

The product uses one React client, one Spring Boot modular-monolith backend, and one PostgreSQL database. Backend code is under `backend`; Flyway owns the schema. This document describes the implemented backend model rather than the obsolete addition-demo prototype.

```text
USER / TEACHER / ADMIN
        |
        +-- editable Worksheet --< WorksheetItem
        |          |
        |          +--< immutable WorksheetRevision --< RevisionItem
        |                                                   |
        +-- Classroom --< Membership                        +--< Attempt --< ItemResult
        |                                                       ^
        +-- per-user Assignment --------------------------------+

MiniGameDefinition(type, version, JSON schemas) --< logical asset links >-- Asset
```

Assignments and attempts reference immutable worksheet revisions. Editing a worksheet therefore cannot alter assigned content or completed history. New attempts have an explicit `IN_PROGRESS -> COMPLETED` lifecycle; classroom revocation changes unfinished assigned attempts to `ABANDONED`. The server validates item payloads and aggregates final totals.

Worksheet share codes use the same lifecycle. Sharing pins an immutable revision; redeeming the code creates one per-user assignment to that revision. Editing the draft does not change an already shared worksheet. Rotating the code publishes the current draft and invalidates the previous code.

Authentication uses one session system and roles. Spring Security centrally provides session authorization, credential CORS, CSRF protection, session fixation protection, and JSON `401/403` responses. Services enforce resource ownership and intentionally return `404` for cross-user identifiers.

Dynamic mini-games share one catalog pipeline rather than one backend per game. Versioned definitions provide configuration/result JSON Schemas and logical asset references. Admins manage catalog versions; teachers build worksheets from approved active definitions. Legacy Minigame1 and Count & Match routes remain available as adapters.

PostgreSQL changes are forward-only. Migrations V1–V13 remain historical; V14–V17 add admin/locking, immutable revisions, canonical attempts, and catalog/asset integrity. See `backend/README.md` and `backend/DYNAMIC_MINIGAME_REPORT.txt` for the module map, authorization matrix, route examples, configuration, and verification process.

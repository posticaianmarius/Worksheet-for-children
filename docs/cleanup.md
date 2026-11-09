# Redesign cleanup

Baseline: `20559c9` on `redesign`. The independent `work` checkout is preserved.

The cleanup preserves public routes and JSON contracts, authorization semantics,
English/Romanian text, all five visual baselines, immutable publications, scoring,
student identities, and the V1–V25 migration history. Existing functional tests
cover response shapes and permissions; `HttpContractTests` freezes the API route
surface independently of Java package names. Never regenerate this baseline to
make a structural refactor pass.

Audit baseline: 22 frontend tests, lint, strict types, production build and public
bundle budget passed (168.5/180 KiB gzip). Backend: 72 regular and 7 PostgreSQL
tests passed. Browser: 72/74 passed together, with both compound responsive tests
passing in isolation. Those loops are now separated by viewport and role.

Implementation checkpoints:

1. Regression protection and separate mocked/visual/live browser suites.
2. Source-only builds and isolated production-stack verification.
3. Frontend ownership, typed models and explicit query invalidation.
4. Backend modules and transactional cross-module workflows.
5. Architecture gates, full verification and updated handoff.

No schema migration, deployment, push or data reset is part of this cleanup.

# Worksheet library and entry flow

The collection, worksheet management and creation flow now lead clearly into the existing worksheet lab. This change starts from checkpoint `9cda2da`; it does not change the lab, games, player, saved worksheet formats or backend APIs.

## Finding and opening work

- Cards preview the actual activity types and available configured pictures. They use stable accents by content type, rather than colours based on their current position in a sorted list.
- Each card has one native link, with a clear Open worksheet or Start building action. Keyboard activation, modifier keys and opening in a new tab work normally. Sharing and management are separate controls.
- All worksheets, With activities and Empty worksheets are content filters. These labels describe the current worksheet items; they do not imply publication status or configuration validity.
- Search accepts Romanian names with or without diacritics. Search, filter, ordering and grid/list view live in the URL, survive reload, and preserve other query parameters.
- Recent ordering handles missing dates and resolves ties predictably. Cached worksheet arrays are never sorted in place.
- No matches has an explicit Clear filters recovery action. Empty libraries explain the steps from naming to building and sharing.
- Phone layouts show search immediately and reveal sorting/view controls on demand. List view provides a compact alternative.

## Creating and managing worksheets

Creation shows two steps: name the worksheet, then build in the lab. It explains what opens next, preserves the entered name after a request failure, prevents blank/whitespace submission, and locks duplicate submission and dismissal during a pending request. Cancelling restores focus to the opener.

Each card's action menu offers Rename and Delete. Dialogs identify the selected worksheet, retain input on failure and return focus predictably. Successful actions reconcile only the current scoped collection cache after server acknowledgement, so names and counts change immediately. The API client still invalidates other dependent read models.

Deletion retains the existing confirmation and backend restrictions. If the server reports that a published worksheet cannot be deleted, the dialog explains why it must remain available and stops offering an ineffective retry.

## Ownership

- `Library.tsx`: URL state, collection controls, notifications and scoped cache reconciliation.
- `WorksheetCard.tsx`: content previews, native navigation and action menu.
- `WorksheetManagement.tsx`: rename/delete forms, request locking and focus return.
- `library-model.ts`: pure search, content filtering and stable ordering.
- `CreateWorksheet.tsx`: shared pre-lab creation flow for the library and dashboard.
- `library.css` and `creation.css`: styles scoped to these surfaces. Existing lab and shared styles are unchanged.
- `shared/i18n/library.ts`: English/Romanian copy.

## Verification

Focused browser coverage exercises URL persistence, reset/empty states, grid/list views, touch-sized phone controls, keyboard filter selection, creation locking, cancellation focus, rename/delete retries, publication restrictions, native navigation and sharing. Pure tests cover accent-insensitive search, unknown activity preservation and stable ordering with invalid dates.

New visual baselines protect the collection on desktop and phone and the creation dialog on phone. The existing worksheet-lab visual check now visits the library first, so it also detects stylesheet leakage across navigation. Existing login, main-menu, lab and child baselines are retained.

The live suite creates, renames and deletes a temporary worksheet through the UI before exercising the existing six-game authoring flow. It runs against the packaged JAR and a disposable PostgreSQL database.

Before/after captures use the same fixtures and viewport sizes. Before captures come from a detached checkout of `9cda2da`; no real worksheet data is used in the screenshots.

### Verified checkpoint

- 28 frontend unit/architecture checks, lint, TypeScript and production build pass.
- All 112 browser checks pass, including the eight visual checks. The lab check also passes after following the collection link with client-side navigation; its existing baseline is retained.
- Public entry JavaScript: 172.2 KiB gzip, within the 180 KiB budget.
- All three live scenarios pass against the packaged JAR and disposable PostgreSQL, including the new create/rename/delete path.
- The workspace's Docker VFS disk limit prevented starting an additional application container. The same packaged JAR was therefore tested with the installed Java 25 runtime and a disposable PostgreSQL container. The temporary app, container and volume were removed afterward, and its generated upload was moved outside the repository.
- No worksheet-lab, game, shared stylesheet or backend source files changed.

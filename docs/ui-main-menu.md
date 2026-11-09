# Teacher main menu refresh

Route: `/home` on `redesign`. Before checkpoint: `be5310f`.

The current purple/neutral theme and workspace navigation are retained. Login,
permissions and API contracts are unchanged.

| Before | Change | Purpose |
| --- | --- | --- |
| “Create and edit activities” opens the library | Direct New worksheet action using the library's shared creation dialog | Start a worksheet without navigating through another screen |
| Setup guidance occupies three stacked phone rows | Compact steps with completion checks and a highlighted next step | Keep guidance useful while bringing recent work into view |
| Large recent cards with an implicit title link | Compact cards with update dates, explicit Edit and Share actions | Make resuming work clear and fit more work on screen |
| Phone statistic labels shrink to 9px | Larger labels and clear icon/count grouping | Improve scanning and readability |

The shared creation dialog retains names after errors, trims submitted names,
opens the new editor after success and restores keyboard focus on cancellation.
Worksheet creation logic is shared with the library rather than duplicated.
Dashboard CSS is scoped; account styling is preserved.

## Before/after review

Both captures use the same sample data (four worksheets, two classes and zero
deliveries), teacher, language and viewport. These are actual app screenshots,
with mocked API data and no changes to a real account or database.

Task screenshots are in `/workspace/artifacts/worksheet-ui/main-menu/`:
`before-desktop.png`, `after-desktop.png`, `before-mobile.png`, `after-mobile.png`.
Romanian phone, empty desktop and full-length phone captures are also included.

| Measure | Before | After |
| --- | --- | --- |
| Desktop document height, 1440×1000 | 1148px | 1000px; all four recent cards visible |
| Phone first worksheet top, 390×844 | 738px | 628px; Edit/Share visible within the screen |
| Phone document height | 1682px | 1247px |

## Verification

- TypeScript, lint, 26 unit/architecture tests and production build passed.
- Public-entry JavaScript is 169.4 KiB gzip, below the 180 KiB limit.
- All 89 browser checks passed, including creation/retry, keyboard focus,
  delivery counts, EN/RO narrow layouts and existing editor/library regressions.
- Only the teacher-dashboard screenshot baseline was updated; the login,
  worksheet-editor and child baselines are unchanged.

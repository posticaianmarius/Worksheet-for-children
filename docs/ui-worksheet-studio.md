# Worksheet lab and child activity system

## Direction

Build a calm teacher workspace and a playful child canvas around one activity at a time. Keep the existing purple application identity. Colour indicates a skill, while the same type, spacing, feedback and controls work across all six games.

Confirmed interaction choices: advance only after completion, keep Skip separate, and use a consistent illustration library with optional emoji and uploads.

## Teacher flow

Choose or add an activity → configure it in **Activity** → choose content in **Visuals** → try the live preview → save → preview the worksheet as a child → share or assign.

- The activity outline retains ordering, duplication, removal and undo.
- Activity and Visuals are keyboard-accessible tabs, rather than one growing form.
- Matching and letter games use the shared searchable illustration picker: All, Food, Animals, Nature and Objects.
- Images and custom emoji are secondary disclosures. Existing selected uploads remain indicated as “In use.”
- A visual selection never silently renames a word or changes its scoring. Word editing stays in Activity.
- Newly added built-in letter activities start with illustrations. Existing worksheet photos and image paths remain unchanged until explicitly edited.
- The inline preview remains local. The full child preview uses the same advance control as student work, and explicitly says that results are not saved.

## Child flow

Open/resume worksheet → play activity → complete → save result → show saved confirmation → swipe up or Continue → next unfinished activity → Finish worksheet → results.

- All six games share a frame, help button, answer feedback and completion navigation.
- Numeric games retain the existing questions, two-second answer feedback and scoring. Small addition/subtraction and comparison questions gain counting illustrations. Odd/even shows pairs. Sequence questions use a visual trail.
- Letter games retain word-based letter scoring and explicit completion. Matching retains tap, keyboard and drag placement and explicit checking.
- Completion saves automatically for every game. It does not automatically navigate away.
- Swipe-up exists only on the completion surface after successful saving. The dedicated surface avoids conflicts with normal page scrolling, matching drag/drop and word interaction.
- A deliberate mostly vertical upward gesture is required. Short, horizontal, downward and cancelled gestures do not advance. Continue, Enter/Space and Arrow Up provide alternatives. Completion focuses Continue, and advancing restores focus and scroll position to the next activity.
- Skip remains available while playing. It persists an explicit skipped result; it cannot overwrite a completed result while the child waits to advance.
- Save errors retain the scored result and offer Save result. Advancing remains unavailable until success. Requests remain guarded against double submission.
- Reload resumes from the server’s saved results, using frozen revision-item IDs.

## Module ownership and compatibility

- `shared/visuals` owns the illustration catalog, renderer, picker and styles. It has no feature or persistence dependencies.
- `games` owns rendering, input, scoring and the completion gesture surface. It receives completion, advance and skip callbacks.
- `features/worksheets` owns configuration, save/recovery and local preview coordination.
- `features/attempts` owns result persistence and the current activity; it retains a just-saved activity until explicit advance.
- Catalog uploads retain their existing feature API and slot policies.

The 32 self-hosted Microsoft Fluent Emoji flat SVGs are licensed under MIT, with attribution, license and pinned source revision in `public/img/illustrations/README.md`. There are no runtime third-party image requests. UI control icons remain Lucide; illustrations are learning content.

No schema changes or applied-migration edits are needed. Matching persists its existing `emoji` values; known emoji resolve to stable illustration paths, and unknown/custom emoji retain their literal rendering. Letter activities persist their existing `img` field with a versioned library path. Uploaded `imageAssetId` references take precedence. Selecting a built-in explicitly removes the corresponding upload override. Historical configurations and unknown configuration fields remain intact.

Keep v1 illustration paths and mappings available for published worksheets. A future change to game mechanics, scoring, persisted visual themes or content structure must introduce a new game-definition version, with a reader for old versions. Do not repurpose an existing configuration field for incompatible data.

## Verification

Exercise all six games, save failure/retry, duplicate answers, slow save, skip/save races, touch direction and cancellation, keyboard advance, server resume, built-in selection/save/reload, custom emoji fallback, image upload/reuse/removal, EN/RO, 320px layouts, and reduced motion. Update only the two intentionally changed editor/child visual baselines; the login and main-menu baselines must stay unchanged.

## Packaged build verification

Corrected the frontend build directory to use Maven’s supported `project.basedir` property. The packaging profile now requires nonempty entry and manifest files, using a rule compatible with the portable `../my-react/dist` path. Missing and empty builds both fail clearly. The packaged JAR was inspected for its frontend entry and all 32 illustrations. The live browser suite exercises the same packaged JAR on disposable PostgreSQL, including a public illustration request, all six editor configurations, uploads, assignment completion and teaching-space workflows.

### Verified checkpoint

- 26 frontend unit/architecture checks, lint, TypeScript and production build pass.
- The 96-case browser suite was exercised; a paused-clock reload test was corrected, then all 31 affected gameplay, visual and picker checks passed. The final illustration capture test also passed.
- All three packaged-application live scenarios pass against disposable PostgreSQL.
- Public entry JavaScript: 171.0 KiB gzip, within the 180 KiB budget.
- Only the intentionally changed editor and child visual baselines were replaced. Login and main-menu baselines remain unchanged.
- Before screenshots were captured from `c8a9a0b` using the same fixtures and viewports as after screenshots.

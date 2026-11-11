# Part 2 - Software Requirements Specification

**Product:** PlaySheets / Worksheet for Children  
**Document date:** 2026-11-11  
**Status:** Draft for team review  
**Document owner:** Repository maintainer

## 1. Purpose and baseline

This document describes the product boundary and the behavior implemented in the
current repository. It gives the team stable requirement labels for review and
acceptance checks.

The requirements below are supported by project documentation and existing
implementation/test sources. Their availability in the team's live deployment
still needs confirmation under **TBD-1**. The latest recorded complete verification
is dated 2026-11-09 in [the cleanup handoff](docs/cleanup.md); preparing this document
does not constitute a new application test run.

## 2. Product boundary

PlaySheets is a web application where teachers create interactive worksheets,
organize children into classes within a teaching space, assign fixed versions of
activities, and review saved results. Children use a private personal code or QR
card to access their work across classes in that space, continue unfinished work,
and review completed activities. Teaching-space owners and authorized co-teachers
manage shared student profiles, classroom access, and progress according to their
permissions. The current release includes English and Romanian interfaces and
optional activity images. Parent accounts, payments, attendance, shared editable
worksheet libraries, cross-space student identity linking, automatic merging of
duplicate student names, class transfers, restoration of archived classes, and
broader school administration are outside this release.

## 3. Users and terms

| User or term | Meaning |
| --- | --- |
| Teacher | An authenticated adult who authors private worksheets and manages classes for which they have permission. |
| Teaching-space owner | A teacher who oversees the space, its directory, teaching team, classes, and permissions. |
| Co-teacher | A teacher assigned to a class who can manage its roster, deliveries, and progress within their permissions. |
| Student | A child with a profile scoped to one teaching space; managed children do not need email, passwords, or signup. |
| Platform administrator | A user who manages platform roles and the game catalog; this role does not grant unrestricted classroom access. |
| Worksheet draft | The author's editable worksheet, including activity order and game settings. |
| Revision | A frozen copy of a worksheet and its activities. |
| Delivery | One assignment of a revision to a fixed set of recipients, with its own identifier and optional title. |
| Attempt | One student's saved progress and results for a frozen worksheet revision. |

## 4. Functional requirements

FR-01 through FR-07 retain the labels used in the initial form draft. Additional
requirements continue the sequence. A retired label must remain recorded and must
not be reused for another behavior.

| ID | Trigger and required behavior | Observable acceptance check |
| --- | --- | --- |
| **FR-01** | When a teacher signs in with valid email/password credentials, the system shall open their authenticated teaching workspace. | Valid credentials open the workspace; invalid credentials do not create an authenticated session. |
| **FR-02** | When a teacher saves a worksheet, the system shall persist its name, activities, activity order, and supported game settings. | Change settings and order, save successfully, and reopen the worksheet; the saved values remain. |
| **FR-03** | When a teacher adds an existing student profile to an authorized class, the system shall reuse that profile. Directory search and an explicit identity choice shall precede creation when names match. | Add the same profile to two classes; it retains one identity within the space. A matching name alone does not merge students. |
| **FR-04** | When a teacher confirms an assignment, the system shall create a delivery for the selected recipients using the exact revision shown during review. | Edit the source draft after assignment; recipients still receive the reviewed content. Adding a class member later does not add that child to the existing delivery. |
| **FR-05** | When a student enters a valid private personal code or scans their QR card, the system shall open My work for that student's teaching space. | One profile login shows eligible work from the child's classes in that space. An invalid code does not grant access. |
| **FR-06** | When a student completes an assigned worksheet, the system shall save the activity outcomes and aggregate results as a completed attempt. | Every activity has a completed or explicitly skipped result before completion. The saved total equals the sum of the activity scores, and a completed attempt cannot be edited. |
| **FR-07** | When an authorized teacher opens class progress, the system shall display assignment completion status and saved results for that class. | A completed attempt shows its saved score, including zero; unstarted work has no fabricated score. Results outside the teacher's permissions remain inaccessible. |
| **FR-08** | When a student continues an active assignment with an unfinished attempt, the system shall reopen that attempt with its saved progress. | Leave an active worksheet after saving an activity result, then select Continue; the saved progress is retained. |
| **FR-09** | When a student opens Finished work, the system shall display their completed assignment history, including completed work retained after class removal or delivery closure. | Complete work, then close its delivery or remove the class membership; the completed result remains available to that student. |
| **FR-10** | When an owner or explicitly delegated teacher opens student access cards, the system shall allow printing the current private code/QR card or replacing the code. | Reprinting preserves the code. Replacing it invalidates its aliases and previous code sessions. A teacher without credential permission cannot obtain or reset the code. |
| **FR-11** | When an owner creates a teacher invitation, the system shall provide a revocable, single-use link valid for seven days. Accepting a valid invitation shall join the teacher to that space. | A valid invitation can be accepted once; an expired, revoked, or already-used invitation is rejected. Existing personal classes remain in the teacher's personal space. |
| **FR-12** | When an authorized teacher closes a delivery, the system shall stop unfinished work for that delivery and preserve completed history. | Its unfinished attempts cannot resume. Another delivery of the same worksheet remains independent and accessible to its eligible recipients. |
| **FR-13** | When an authorized teacher archives a class, the system shall expose that class as read-only history and close its unfinished work. | Archived work cannot be resumed or changed. Completed results remain readable under the history permissions, and the child's profile login still works for other classes. |
| **FR-14** | When a teacher selects, replaces, or removes an optional image in a supported activity, the system shall retain that choice with the activity configuration and display it in preview and assigned content. | Save and reopen an activity with a selected image; it appears in preview and the frozen assigned version. Replacing or removing it preserves the other game settings. |
| **FR-15** | When a user selects English or Romanian, the system shall display the supported interface labels and messages in the selected language. | Navigate between the teaching-space, directory, class, and student screens; the selected language remains applied. |
| **FR-16** | When a user requests a worksheet, student profile, class, credential, assignment, or result, the system shall enforce the applicable author, role, teaching-space, and classroom permissions on the server. | A co-teacher can review authorized assigned snapshots without accessing another author's editable draft. Changing a resource or space identifier does not grant access. A code-authenticated student cannot switch to another space. |

## 5. Operating and data constraints

- The application consists of a browser client, a server API, and persistent
  PostgreSQL storage. The current implementation uses React and Spring Boot.
- Worksheet drafts remain private to their authors. Assigned content uses immutable
  revisions, preserving the game configurations associated with saved results.
- Student identities and credentials are scoped to a teaching space. Matching names
  are insufficient evidence that two profiles represent the same child.
- Private student codes are available only through dedicated authorized operations.
  Routine directory lists and reports do not expose them. QR login clears the URL
  fragment before authentication.
- Saving a worksheet is explicit. Its current multi-request save operation is not
  transactional; a failed save must not be presented as a fully successful save.
- Student result reports contain recorded activity totals; they do not imply
  per-question data that the application has not recorded.
- Archiving a class or closing a delivery preserves completed history. The current
  release has no class restoration operation.

## 6. Open issues

Dates in this register are dates raised. The owner is identified by their existing
project role; the team can record a named assignee and agreed deadline during
review. No delivery deadline has been assumed.

| ID | Question and resolution needed | Owner | Date raised | What it blocks |
| --- | --- | --- | --- | --- |
| **TBD-1** | Which URL and build identify the team's live product, and which FRs can be demonstrated there? Record the deployed commit/build, check each applicable FR, and attach the results before calling this a live-product baseline. | Repository maintainer / deployment owner | 2026-11-11 | Signing off FR-01 through FR-16 as behavior available in the live deployment and submitting a verified live-product inventory. |

## 7. Evidence and review

The following sources support this repository baseline:

| Evidence | Requirements supported |
| --- | --- |
| [Project overview and user workflows](README.md) | FR-01 through FR-13, FR-15, FR-16 |
| [Product model, permissions, and history rules](ARCHITECTURE.md) | FR-03 through FR-13, FR-16 |
| [Frontend behavior and save constraints](my-react/FRONTEND.md) | FR-02, FR-04, FR-05, FR-08 through FR-10, FR-14, FR-15 |
| [Backend contracts and lifecycle](backend/README.md) | FR-01 through FR-07, FR-10 through FR-14, FR-16 |
| [Real-backend editor and completion scenario](my-react/e2e/live-backend.spec.js) | FR-02, FR-04, FR-06, FR-09, FR-14 |
| [Real-backend teaching-space scenarios](my-react/e2e/teaching-spaces-live.spec.js) | FR-03 through FR-05, FR-09 through FR-11, FR-15, FR-16 |
| [Attempt tests](backend/src/test/java/com/worksheet/learning/attempt/WorksheetAttemptTests.java), [delivery tests](backend/src/test/java/com/worksheet/learning/assignment/DeliveryWorkflowTests.java), [report tests](backend/src/test/java/com/worksheet/learning/assignment/AssignmentReportTests.java), and [history tests](backend/src/test/java/com/worksheet/learning/assignment/WorkHistoryTests.java) | FR-04, FR-06 through FR-09, FR-12, FR-13 |
| [Teaching-space permission tests](backend/src/test/java/com/worksheet/teaching/space/TeachingSpaceTests.java) | FR-03 through FR-05, FR-10, FR-11, FR-16 |

The [2026-11-09 verification record](docs/cleanup.md) reports successful frontend,
backend, PostgreSQL, and browser checks, including disposable production-stack
scenarios. It provides dated repository evidence; live deployment acceptance
remains tracked by TBD-1.

For the form, copy section 2 as the boundary, the requirement behavior from section
4 as the numbered FRs, and section 6 as the open issue register. Once this file is
published to GitHub, use its file-page URL in the form's document-link field.

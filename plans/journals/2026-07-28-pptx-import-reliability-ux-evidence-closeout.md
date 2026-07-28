# PPTX Import Reliability UX Evidence Closeout

**Date**: 2026-07-28
**Severity**: High
**Component**: PPTX import lifecycle, client UX, and release evidence
**Status**: Best-effort software lane PASS WITH RESIDUALS; optional qualification lanes remain separate

## What happened

The closeout was paused after SSE-to-poll handoff review found two lifecycle races. Queued progress could reach the client after fallback or final recovery began, while an over-broad guard could suppress valid terminal SSE outcomes. Two additional client-contract defects were then verified: an admission response-body timeout could occur after the server accepted the job, and non-timeout poll failures could bypass the reserved final durable read.

## Resolution

- Kept separate bounded admission and terminal-wait clocks.
- Changed admission-timeout UX to report acceptance as unconfirmed and direct the user to check existing presentations before retrying.
- Routed non-timeout poll/network/HTTP failures through the bounded final status read; persistent uncertainty becomes `PPTX_JOB_OUTCOME_UNKNOWN` while caller aborts and typed terminal errors remain distinct.
- Fenced queued SSE progress after polling/final recovery handoff while preserving `done`, `failed`, and `cancelled` terminal outcomes.
- Added one wait-owned transport controller for SSE fallback polling and final status recovery. Public settlement aborts that child transport before callback completion, leaves the caller ownership signal independent, and settlement-fences late progress.
- Kept timeout recovery GET-only and non-destructive; no automatic reconcile, cancel, delete, or fabricated success was added.

## Final evidence

| Gate | Result |
|---|---|
| Focused wait suite | 1 file, 26 tests passed |
| Combined client lifecycle/API/HomePage suite | 3 files, 69 tests passed |
| Focused ESLint | Passed |
| Full unit | Exit 0; 518 files passed / 1 skipped; 4196 tests passed / 3 skipped; 1227.75s; documented unrelated characterization exclusion only |
| Full lint | 0 errors, 27 existing warnings |
| Production build | Passed |
| Critical PPTX browser journey | 1/1 passed, 38.7s |
| Lifecycle review | Approved/clean for the scoped client contract |

The prior full-unit result (4186 tests, 1248.73s) remains historical and is not used as the final gate.

## Claim boundary

The product remains a self-hosted, parser-backed, best-effort PPTX importer. This closeout does not claim native PowerPoint fidelity, OfficeCLI validation, pixel-perfect output, universal native import, editable chart promotion, L4/L5 promotion, crash-safe media consistency, whole-server RSS isolation, OS/network converter sandboxing, package-first G0-G5 completion, or G5 PowerPoint/oracle qualification.

## Residuals

- Explicit dashboard Cancel and visible retry countdown controls remain deferred.
- Dedicated editor-report navigation/reload and multipart race/stall coverage remain deferred.
- Durable typed-failure persistence across restart/TTL and Windows reparse-point proof remain unqualified.
- Durable media manifest/replay and destructive retention remain outside the best-effort lane; retention stays dry-run/default-off.
- Strict/native, full browser heuristic, performance, package-first G0-G4, oracle integrity, and G5 remain independently blocked, open, or skipped.

## Safety and delivery boundary

Unrelated dirty work and user-owned temporary artifacts were preserved. No commit, push, release authorization, destructive retention, evidence publication, or sibling package-first authority change was performed.

## Unresolved questions

1. Which job-control authorization method is the approved deployment policy?
2. Should missing-head repair remain read-only classification plus scheduled repair, or gain a separately authorized writer action?
3. Is durable media manifest/replay required for the intended recovery promise, or should media remain explicitly best-effort?
4. What retention age/count/byte policy and authority-tombstone lifetime are acceptable before any destructive compaction?
5. Must imported external media remain always blocked, or is a fully pinned administrator origin policy required?
6. Does the sibling local G5 authority remain in force, or will an owner-approved external trust model supersede it?

AgentWiki publish skipped — local journal is the source of truth.

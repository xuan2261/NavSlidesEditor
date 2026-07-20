---
title: 'EditorPage UI UX Remediation Deep TDD'
description: 'Comprehensive test-first remediation of EditorPage command consistency, responsive workspace, ribbon discoverability, accessibility, touch editing, and maintainability.'
status: blocked
progress: 100
priority: P1
branch: 'master'
tags: [frontend, refactor, ui, ux, accessibility, responsive, touch, ribbon, tdd, tech-debt]
blockedBy: []
blocks:
  [
    260709-0913-verified-ui-findings-remediation-deep-tdd,
    260708-1900-verified-ui-accessibility-ux-remediation-deep-tdd,
    260705-0000-frontend-ui-hygiene-ux-consistency-deep-tdd,
  ]
created: '2026-07-11T03:38:53.878Z'
createdBy: 'ck:plan'
source: skill
mode: '--deep --tdd'
scopeDecision: 'hold'
redTeamReviewed: '2026-07-11'
redTeamResult: 'conditional-pass'
validated: '2026-07-11'
validationResult: 'blocked'
---

# EditorPage UI UX Remediation Deep TDD

## Overview

Remediate the verified EditorPage UI/UX defects without changing presentation data semantics or removing NavSlides' PowerPoint-style capability surface. Work proceeds test-first: protect the current user-owned save/PPTX changes, unify command state, extract behavior-preserving seams, then improve responsive layout, ribbon reachability, accessibility, touch editing, and controller maintainability.

### Product Outcomes

- One canonical zoom model and one canonical manual-save command across keyboard, ribbon, status bar, File menu and command palette; transient Retry remains a separate idempotency-preserving recovery command.
- Canvas remains the visual priority at 768, 1024, and 1440 widths; panels adapt without clipping the workspace.
- Every ribbon action remains discoverable without relying on an invisible horizontal scrollbar.
- Editor axe baseline contains no known `nested-interactive`, `label`, or `select-name` exceptions.
- Mouse, pen, and touch share one pointer interaction path; tablet editing is real, not only advertised.
- `EditorPage.jsx` becomes a composition root while preserving autosave, generation conflict, PPTX fidelity, vertical slides, AI, games, export, and keyboard behavior.

### Locked Scope

In scope: EditorPage shell, editor command/state consistency, responsive workspace, status density, ribbon overflow, table-picker input ergonomics, slide navigator semantics, editor-specific accessibility baseline, pointer/touch editing, and controller decomposition.

Out of scope: HomePage redesign, new element types, backend/schema redesign, replacement of Radix/TipTap/Zustand/Tailwind, presentation theme redesign, and unrelated accessibility findings outside editor surfaces. Advanced Insert actions remain available; lower-frequency groups may move behind explicit named overflow triggers at constrained widths.

### Architecture Decisions

1. Preserve the current local presentation state model. Do not expand `presentation-store` into a document store.
2. Keep canonical zoom in `ui-store` because `SlideCanvas` auto-fit and `StatusBar` already depend on it; remove dead zoom state from `editor-store`.
3. Keep shell extraction slot-based in Phase 3. Move behavior into controllers only after interaction and responsive contracts are green.
4. Use actual ribbon container width, not only viewport width, for density decisions.
5. Convert mouse transport to Pointer Events while retaining existing geometry, snapping, clamping, lock, history, and autosave logic.
6. Never reset or replace user-owned dirty files. Use narrow patches against current working-tree content.

### Scope Challenge Result

- Existing code reused: Radix tabs, Zustand stores, `SlideCanvas` ResizeObserver, save queue, pointer geometry helpers, ribbon popup primitives, axe/Playwright harnesses.
- Minimum complete change set: all nine phases. Deferring controller decomposition would preserve the defect-producing orchestration debt; deferring touch would contradict the supported tablet breakpoint.
- Complexity: broad by design, but no new framework or persistence model. New modules remain focused and under 200 LOC.
- Selected scope: HOLD. No expansion to the rest of the application.

### Execution Strategy

`Phase 1 -> Phase 2 -> Phase 3 -> Phase 4`

`Phase 4 -> Phase 5`

`Phase 3 -> Phase 6`

`Phase 2 + Phase 4 -> Phase 7`

`Phases 1-7 -> Phase 8 -> Phase 9`

Phases 4 and 6 may run in parallel after Phase 3 with strict file ownership. Phase 5 waits for Phase 4 and consumes its finalized responsive panel command interface. Phase 7 waits for canonical zoom, responsive tablet workspace and ribbon touch-target policy. Phase 8 is serialized because it touches the current user-owned save/PPTX orchestration.

## Phases

| Phase | Name                                                                                                                       | Status      |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1     | [Baseline Contracts And Conflict Guardrails](./phase-01-baseline-contracts-and-conflict-guardrails.md)                     | Complete    |
| 2     | [Canonical Zoom And Save Commands](./phase-02-canonical-zoom-and-save-commands.md)                                         | Complete    |
| 3     | [Behavior Preserving Editor Shell Extraction](./phase-03-behavior-preserving-editor-shell-extraction.md)                   | Complete    |
| 4     | [Adaptive Responsive Workspace And Status Density](./phase-04-adaptive-responsive-workspace-and-status-density.md)         | Complete    |
| 5     | [Ribbon Overflow Discoverability And Input Density](./phase-05-ribbon-overflow-discoverability-and-input-density.md)       | Complete    |
| 6     | [Slide Navigator And Accessibility Baseline Burn Down](./phase-06-slide-navigator-and-accessibility-baseline-burn-down.md) | Complete    |
| 7     | [Pointer And Touch Editing](./phase-07-pointer-and-touch-editing.md)                                                       | Complete    |
| 8     | [Editor Controller Decomposition](./phase-08-editor-controller-decomposition.md)                                           | Complete    |
| 9     | [Integrated Regression And Release Gate](./phase-09-integrated-regression-and-release-gate.md)                             | Blocked — live white-overlay E2E |

## Dependencies

### Cross-Plan Dependencies

| Relationship      | Plan                                                            | Treatment                                                                                                              |
| ----------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Related blocked | [P0 Oversized Unload Persistence And Reconciliation](../260716-1125-p0-unload-persistence-reconciliation/plan.md)       | Focused Chromium durability evidence remains valid. Its current full release status is **BLOCKED** by the live white-overlay full-E2E failure, not an unload-durability regression. |
| Blocks            | `260709-0913-verified-ui-findings-remediation-deep-tdd`         | Absorb overlapping EditorPage layout, slide semantics, and editor a11y work; retain unrelated findings there.          |
| Blocks            | `260708-1900-verified-ui-accessibility-ux-remediation-deep-tdd` | Absorb overlapping editor canvas/ribbon/a11y slices; retain renderer, route, Home, and tour work there.                |
| Blocks            | `260705-0000-frontend-ui-hygiene-ux-consistency-deep-tdd`       | Absorb overlapping status-bar, touch-target, and ribbon-overflow phases; retain app-shell/dashboard/dialog work there. |
| Related completed | `260608-1503-editorpage-element-interaction-bug-fixes-tdd`      | Regression baseline for element interactions and autosave.                                                             |
| Related completed | `260619-ux-polish-teaching-docs-tdd`                            | Prior ribbon/tour polish context.                                                                                      |
| Related completed | `260629-2154-full-application-qa-verification-deep-tdd`         | Reuse deterministic fixtures, page objects, and QA matrix.                                                             |

### Global Success Criteria

- [x] All new behavior is introduced through RED, GREEN, REFACTOR gates; no skipped/todo/fails tests remain in the touched editor/P0 scope.
- [x] No user-owned dirty changes are overwritten, reset, stashed away, or silently dropped.
- [x] All zoom and save surfaces dispatch one canonical command path.
- [x] Workspace and active ribbon have no unintended horizontal overflow at 768, 1024, and 1440.
- [x] Every ribbon action remains reachable within two activations, except game subtype selection may require three.
- [x] Editor serious/critical axe results are empty without editor-specific allowlists.
- [x] Tablet pointer tests prove select, drag, resize, rotate, crop, pinch, cancel, and lock behavior.
- [x] EditorPage becomes composition-focused; all new production modules stay under 200 LOC.
- [x] Autosave generation/idempotency, vertical slides, PPTX fidelity, AI, games, export, undo/redo, keyboard, and mouse flows remain green.
- [ ] Lint, coverage, build, a valid full E2E, PPTX strict/full browser audit, and load smoke gates pass for the current release decision. Historical stable-source evidence from 2026-07-18 remains recorded; the valid 2026-07-20 isolated serial full E2E has one live white-overlay failure.

## Implementation Status Sync

**Updated:** 2026-07-20<br>
**Progress:** Implementation work is complete across 9 of 9 phases; the current Phase 9 and P0 full release status is **BLOCKED** pending the live white-overlay fix and a valid green full E2E run.

- Historical focused editor unit evidence recorded 8 files / 107 tests and a save/controller slice at 5 files / 31 tests; the current-source follow-up is tracked separately below.
- Test-first follow-up regressions passed: 8 files / 32 tests covering conflict resolution, route-epoch save ownership, stale conflict continuation protection, redo dirty state, docked/overlay panel keyboard contracts, compact overlay dismissal, keyboard-open/immediate-Escape dismissal, first-load rich-text clearing, autosave characterization and shell contracts. The additional deferred A-to-B route-load regression passed 1/1, with its lifecycle/persistence/keyboard matrix passing 7 files / 34 tests. See [follow-up regression report](./reports/tester-260716-follow-up-regressions-report.md).
- Latest post-follow-up route/persistence validation passed 12 files / 56 tests, adding stale conflict failure fencing, same-ID route-epoch successor protection, per-epoch conflict-resolution serialization, queued-successor discard on Use Remote, unchanged Use Remote autosave suppression, latest-edit Keep Local preservation, Use Remote history reseeding, interaction reset extraction, layout-synchronous keyboard disabling, conflict-dialog Escape/focus isolation, history-save timing stabilization, and the EditorPage composition-size guard; full audit, lint, and client build also passed after those changes.
- The P0 unload-recovery extension then passed 14 focused files / 66 tests, with a 1/1 Chromium oversized-draft receipt/reconciliation test and a 1/1 small-payload route-flush regression. It preserves generation/idempotency identity, retains interrupted drafts, fences queued successor drafts, and requires an explicit remote/local choice after reload.
- The route-load and P0 source follow-ups were applied after the broader 2026-07-16 browser/PPTX evidence; the stable-source 2026-07-18 rerun reconfirmed focused matrices, audit, lint, build, strict/full PPTX audits, touch, P0 lifecycle, load smoke, and exact flaky E2E cases.
- The responsive/a11y browser gate passed 13/13, desktop editor gate passed 20/20, mandatory tablet-touch project passed 7/7, and the stable-source focused editor matrix passed 13 files / 116 tests; audit passed 8 files / 36 tests, lint reported 0 errors and 25 warnings, and the client build transformed 2,297 modules.
- Phase-focused implementation evidence is present for canonical save/zoom, shell extraction, responsive workspace, ribbon density/table picker, semantic slide navigation, pointer/touch editing, and controller decomposition.
- `test:pptx:strict` passed on 2026-07-18 with 11 corpus tests and 3 strict smoke browser tests; the full strict PPTX browser audit passed all 6 tests.
- Isolated API load smoke passed with 100% successful requests, p95 `http_req_duration=178.32ms`, and p95 `iteration_duration=1.24s`; WebSocket load smoke passed with 100% room joins, p95 connect 3.99ms, and 6 messages received.
- Full coverage passed on the stable source: **470 files / 3,686 tests passed**, with 1 file and 3 tests skipped; coverage was 68.75% statements, 56.14% branches, 63.99% functions, and 71.53% lines, above configured floors.
- Historical stable-source full Playwright E2E (2026-07-18) completed with 506 passed, 21 intentional skips, and 3 flaky outcomes that passed on retry; one exact trace rerun of the reported cases passed 3/3. No snapshot was updated.
- The valid isolated serial current-tree run `clean-e2e-20260720-final-direct-api` exited 1 after 6.1m: **530 total / 508 passed / 1 failed / 21 skipped**. The sole failure is the live white-overlay viewer case at `tests/e2e/live/black-and-white-screen-overlay-viewer-keyboard.spec.js:54-60`; after `W`, the viewer remained `Waiting for presenter` and no white overlay appeared. Playwright worker API-base propagation is verified but partial: the config guard passed 9/9 and the no-env four-worker candidate probe passed 68/68; helper API calls go direct, while some raw Playwright request calls still route through Vite. No preview/server exit or shared-build `ENOENT` occurred; the concurrent-build `ENOENT` result is invalid evidence, not a product failure.
- The stale writer lock was explicitly inspected, reclaimed only after its recorded PID was proven absent, and the local server was stopped after load validation.
- The P0 oversized-unload persistence implementation and focused Chromium receipt/reconciliation evidence remain valid and do not cause the current block. Its full release status is **BLOCKED** with Phase 9 until the live-overlay fix and a valid green full E2E run. IndexedDB/private-browsing durability limits remain documented non-goals.

### Open Questions

None for the original remediation scope. The P0 plan now documents the supported browser-storage boundary; future decisions remain whether to add a server receipt for storage-disabled browsers and whether to add an expiry/size budget for unreconciled drafts.

## Red Team Review

### Session - 2026-07-11

**Reviewers:** Security Adversary, Failure Mode Analyst, Assumption Destroyer, Scope and Complexity Critic  
**Raw findings:** 38; **deduplicated:** 15; **accepted:** 14; **deferred with gate:** 1; **rejected:** 0  
**Severity:** 4 Critical, 10 High, 1 Medium

| #   | Finding                                                                       | Severity | Disposition        | Applied to                 |
| --- | ----------------------------------------------------------------------------- | -------- | ------------------ | -------------------------- |
| 1   | Idle successful save leaves local generation stale                            | Critical | Accept             | Phases 1, 2, 8             |
| 2   | Generic Retry destroys idempotency continuity                                 | Critical | Accept             | Phases 1, 2                |
| 3   | Stale-generation Retry has no recovery protocol                               | High     | Accept             | Phases 1, 2, 8             |
| 4   | Route loads can resolve out of order                                          | High     | Accept             | Phases 1, 8                |
| 5   | Save focus policy can open browser Save Page                                  | High     | Accept             | Phase 2                    |
| 6   | Responsive model ignores Design Ideas as a third panel                        | High     | Accept             | Phase 4                    |
| 7   | Phase 4/5 sequencing and View-tab ownership conflict                          | High     | Accept             | Master plan, Phases 4, 5   |
| 8   | Index-based slide multi-selection drifts after mutation                       | High     | Accept             | Phase 6                    |
| 9   | Pointer cancellation lacks rollback semantics                                 | High     | Accept             | Phase 7                    |
| 10  | Touch release gate may omit real multi-touch project                          | High     | Accept             | Phases 7, 9                |
| 11  | Thumbnail extraction could execute inactive scripts                           | High     | Accept             | Phase 6                    |
| 12  | Compact overlays leave background commands active                             | High     | Accept             | Phase 4                    |
| 13  | Protected API signature is inaccurate                                         | High     | Accept             | Phases 1, 2                |
| 14  | Decomposition LOC target is impossible and command ownership duplicates hooks | Critical | Accept             | Phase 8                    |
| 15  | Oversized unload save transport is not durable                                | Critical | Deferred with gate | Phase 1 follow-up decision |

### Binding Amendments

1. Accepted server generations update a call-time authority used by every future snapshot, including idle sequential saves.
2. `retryPendingSave` reuses the rejected snapshot and idempotency key; generic manual save never replaces it.
3. `STALE_GENERATION` uses an explicit conflict-resolution UX; generic Retry is disabled for this failure class.
4. Loads use an epoch or AbortController so stale requests cannot overwrite the active route.
5. Save chord is recognized before editable suppression, always prevents browser default in editor scope, and follows explicit modal policy.
6. Responsive arbitration covers navigator, properties and design ideas atomically; compact overlays are inert/modal boundaries where they obscure the workspace.
7. Slide selection stores stable IDs and derives indices only at callback boundaries.
8. Pointer cancellation rolls back the captured start snapshot or uses preview buffering; it cannot leave partial history/autosave mutations.
9. Real touch/pinch tests require an explicit Chromium CDP multi-contact helper and mandatory touch project/script.
10. Thumbnail previews use a static whitelist and never execute scripts, active media or focusable embeds.
11. Phase 8 uses responsibility/dependency/file-size criteria, not an impossible EditorPage line target; existing keyboard/clipboard hooks remain owners.
12. Rollback uses per-phase focused diff manifests against the Phase 1 dirty-tree baseline.
13. Mouse-only consistency searches are scoped to the migrated canvas interaction files.

### Deferred Gate

Oversized unload persistence was a real data-loss risk and required an offline draft/reconciliation design outside this UI remediation. The P0 follow-up proves the supported Chromium localStorage receipt path and explicit remote-first recovery; the historical stable-source full release gate passed on 2026-07-18. It clears only the unload-durability issue: the current Phase 9 and P0 full release status is **BLOCKED** by the live white-overlay E2E failure pending a valid green full E2E rerun. Storage-disabled/private-browsing limits remain documented support boundaries, not the current blocker.

### Whole-Plan Consistency Sweep

Validation decisions propagated. Current sweep confirms Phase 5 depends on Phase 4, Phase 6 is the only phase parallelizable with Phase 4, and no phase may weaken generation, axe, touch, PPTX or visual gates.

## Validation Log

### Session 1 - 2026-07-11

**Mode:** deep, full verification supported by red-team evidence  
**Questions:** 4  
**Result:** PASS

| Topic             | Confirmed decision                                                               | Applied to     |
| ----------------- | -------------------------------------------------------------------------------- | -------------- |
| Tablet support    | Full editor from exactly 768px; explicit guard below                             | Phases 4, 7, 9 |
| Inspector policy  | Properties and Design Ideas share one tabbed right inspector host                | Phases 3, 4    |
| Save conflict     | Keep Local is an explicitly warned force-save using the latest remote generation | Phases 2, 8    |
| Unload durability | Failed oversized-close receipt creates a mandatory blocking P0 persistence plan  | Phases 1, 9    |

### Verification Results

- Tier: Full
- Claims checked: 135+ across nine phases through deep scouts and four red-team verification roles
- Verified: plan paths, symbols, store ownership, panel widths, interaction handlers, tests and scripts were sampled with codebase evidence
- Failed claims corrected: API signature, 6×8 table dimensions, phase sequencing, third-panel state, touch-project optionality, impossible EditorPage LOC target and overly broad mouse search
- Unverified: 0

### Whole-Plan Consistency Sweep

- Tablet policy is consistent: guard `<768`, adaptive editor `>=768`.
- Right-panel policy is consistent: one tabbed inspector host.
- Phase 5 depends on Phase 4 and does not own View-tab panel semantics.
- Retry semantics are split: transient retry preserves key; explicit conflict force-save uses latest generation and a new confirmed logical attempt.
- Oversized unload failure blocks release through the separate [P0 persistence follow-up](../260716-1125-p0-unload-persistence-reconciliation/plan.md).
- Remaining contradictions: none.

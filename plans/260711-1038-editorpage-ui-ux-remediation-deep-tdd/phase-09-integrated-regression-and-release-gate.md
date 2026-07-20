---
phase: 9
title: 'Integrated Regression And Release Gate'
status: blocked
priority: P0
effort: '2-3 dev-days'
dependencies: [2, 3, 4, 5, 6, 7, 8]
---

# Phase 9: Integrated Regression And Release Gate

<!-- Updated: Validation Session 1 - oversized unload failure creates mandatory blocking P0 plan -->

## Overview

Verify the remediation as one system. This phase introduces no planned product code. Any failure returns to the owning phase, is fixed there test-first, and restarts the integrated gate.

## Requirements

### Functional

- Re-run all focused contracts from Phases 1-8.
- Verify mouse, keyboard, touch, responsive, accessibility, autosave, history, vertical slides, export, PPTX, AI, games and live behavior together.
- Compare visual outputs only after behavioral assertions pass.
- Confirm cross-plan absorbed work is marked clearly before unblocking old plans.

### Non-functional

- Do not update snapshots merely to hide drift.
- Do not weaken coverage, axe, PPTX or load thresholds.
- One exact flaky-test rerun with trace is allowed; repeated failure is a defect.
- Missing external tooling is a documented blocker, not a pass.
- Oversized unload durability cannot be claimed unless the Phase 1 real-browser receipt check passes; otherwise the separate mandatory [P0 persistence follow-up](../260716-1125-p0-unload-persistence-reconciliation/plan.md) blocks release.

## Release Dependency Map

```text
Phase 1 baseline
  -> Phase 2 commands
  -> Phase 3 shell
  -> Phases 4-6 responsive/ribbon/navigation
  -> Phase 7 pointer/touch
  -> Phase 8 controllers
  -> focused unit/browser gates
  -> lint + audit + coverage + build
  -> full E2E and visual
  -> PPTX strict/full browser audit
  -> API/WS load smoke
  -> release decision
```

## File Inventory

| Action | File         | Rule                                           |
| ------ | ------------ | ---------------------------------------------- |
| Modify | None planned | Fix regressions in their owning phase          |
| Create | None planned | Reuse existing reports and test infrastructure |
| Delete | None planned | Cleanup belongs to owning phase                |

## Regression Matrix

| Domain             | Critical gate                                                        |
| ------------------ | -------------------------------------------------------------------- |
| Editor mount/shell | Renderability, responsive workspace and no console errors            |
| Zoom/save          | Cross-surface command E2E and generation-aware autosave tests        |
| Mouse editing      | Selection, drag, resize, rotate, crop, guides                        |
| Touch editing      | Tablet tap, drag, resize, rotate, crop, pinch, cancel                |
| Keyboard/clipboard | Shortcuts, focus order, clipboard, group, z-order                    |
| Navigator/a11y     | Raw-zero axe, slide semantics, labels and context focus              |
| Ribbon             | All-tab reachability, inventory, compact menus and table grid        |
| History            | Undo/redo cap, first edit and removed-selection behavior             |
| Vertical slides    | Parent/child mutation, preview, live order and export                |
| Persistence        | Debounce, in-flight coalescing, route flush, 409 conflict            |
| PPTX               | Critical import/edit/export journey, strict corpus and browser audit |
| Export             | HTML and PPTX artifacts                                              |
| AI/games/live      | Existing specialized E2E suites                                      |
| Visual             | No unexplained screenshot drift                                      |
| Performance        | No interaction listener leak; load smoke thresholds pass             |

## Browser And Quality Metrics

- Desktop Chromium 1440×900.
- Responsive Chromium at 768×1024 and 1024×768.
- Mobile guard on Pixel 7 profile.
- Live project remains single-worker where configured.
- No horizontal editor/ribbon overflow at supported breakpoints.
- Touch targets ≥44×44 in tablet/touch mode.
- Real multi-contact touch uses the mandatory CDP driver; mouse substitution is not accepted as touch evidence.
- Pointer geometry tolerance ≤2 slide-coordinate px.
- Autosave burst: one request; in-flight mutation: one successor.
- Event listener count stable across ten rerenders/route changes.
- Coverage remains above configured repository floors.
- Zero unexpected page errors, unhandled rejections or failed requests.
- No editor-specific axe baseline targets.

## Tests Before

1. Verify working-tree status and confirm only expected plan/source changes.
2. Run focused unit/controller/pointer/save suites.
3. Run focused browser suites by domain.
4. Treat each first failure as RED evidence assigned to an owning phase.

## Refactor

No release-phase refactor. Correct only verified regressions in their originating phase, run that phase gate, then restart Phase 9 from the beginning.

## Tests After

- Run audit, lint, coverage, build and full E2E.
- Run PPTX strict and full browser audit.
- Run API and WebSocket load smoke if `k6` exists.
- Verify plan consistency, phase status and absorbed-plan dependencies.

## Implementation Steps

1. Capture `git status --short --branch`.
2. Run focused unit/component matrix.
3. Run focused desktop/tablet browser matrix.
4. Run `test:audit`, lint, coverage and build.
5. Run the mandatory touch project/script explicitly, then full E2E including visual projects.
6. Run PPTX strict and full browser audit.
7. Run load smoke.
8. Review generated traces/screenshots; do not blindly update baselines.
9. Run source searches for stale guard/zoom/mouse/baseline patterns.
10. Mark phases complete only when all mandatory gates are green.

## Focused Gate

```powershell
npx vitest run client/src/hooks/editor-controller/ client/src/components/editor/editor-panel-keyboard-propagation.test.jsx client/src/components/editor/editor-workspace-overlay.test.jsx client/src/components/editor/editor-shell.test.jsx client/src/components/canvas/use-canvas-pointer-interaction.test.js client/src/components/canvas/use-canvas-pointer-interaction.touch.test.jsx client/src/pages/__tests__/editor-page-autosave.characterization.test.jsx client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx client/src/pages/editor-autosave-lifecycle.test.jsx client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx client/src/pages/__tests__/editor-page-vertical-slides.test.jsx
npx playwright test tests/e2e/keyboard-shortcuts.spec.js tests/e2e/undo-redo.spec.js tests/e2e/autosave-flush-on-leave.spec.js tests/e2e/canvas/clipboard.spec.js tests/e2e/canvas/group-zorder-guides.spec.js tests/e2e/coverage-gaps-resize-guides.spec.js --project=chromium
npx playwright test tests/e2e/responsive/editor-workspace-status-and-navigator.spec.js tests/e2e/a11y/axe-core-scans-across-editor-present-share-live-and-home-views.spec.js --project=chromium
```

## Mandatory Full Gate

```powershell
npm run test:audit
npm run lint
npm run test:coverage
npm run build
npm run test:e2e:touch
npm run test:e2e
npm run test:pptx:strict
npm run test:pptx:browser-audit:full
```

## Load Smoke Gate

```powershell
npm run test:load:api:smoke
npm run test:load:ws:smoke
```

Confirm `k6` exists before starting. If unavailable, report the exact blocker and leave the phase incomplete unless the user explicitly approves deferral.

## Consistency Searches

```powershell
rg "useEditorStore\\(.*zoom|A11Y_BASELINE_KNOWN_BLOCKING.*editor|editor-small-screen-guard" client/src tests/e2e
rg "onMouseDown|mousemove|mouseup" client/src/components/SlideCanvas.jsx client/src/components/canvas client/src/hooks/use-pinch-zoom.js client/src/hooks/use-touch-gestures.js
rg "it\\.skip|test\\.skip|describe\\.skip|it\\.todo|test\\.todo|it\\.fails" client/src tests/e2e
```

Every remaining match needs an explicit, documented reason.

## Success Criteria

- [x] Every phase-focused gate passes.
- [ ] Audit, lint, coverage, build and a valid full E2E pass. Historical stable-source evidence (2026-07-18) remains recorded below; the current isolated serial run failed only the live white-overlay case (508 passed / 1 failed / 21 skipped).
- [x] PPTX strict and full browser audit pass without threshold changes on 2026-07-18.
- [x] API and WebSocket load smoke pass, or an explicitly approved blocker is recorded.
- [x] No unexplained visual drift or updated snapshot masking. *(visual matrix ran inside full E2E without baseline updates this session)*
- [x] No skipped/todo/fails tests remain in touched P0/editor scope.
- [x] No stale duplicate zoom, migrated-canvas mouse-only transport or editor axe baseline remains. *(`editor-small-screen-guard` is intentional mobile UX)*
- [x] Mandatory real-touch project runs independently of optional environment configuration. *(stable-source tablet-touch rerun 7/7)*
- [x] Oversized unload durability is proven on the supported Chromium receipt path; [P0 persistence follow-up](../260716-1125-p0-unload-persistence-reconciliation/plan.md) retains focused durability evidence and does not block release on durability grounds. Its full release status is **BLOCKED** with Phase 9 pending the live white-overlay fix and a valid green full E2E run.
- [x] Cross-plan dependency metadata is consistent, including the reciprocal P0 blocker relation.

## Current Validation Record

**Run status:** **BLOCKED** (2026-07-20). All implementation phases and focused P0 durability evidence remain recorded, but the current full E2E release gate is not green.

Evidence scope: rows labeled **Pre-patch** are from the preceding integrated browser/PPTX run; the 2026-07-18 stable-source rerun is historical evidence. The valid current-tree release result is `clean-e2e-20260720-final-direct-api`: isolated serial full E2E exited 1 after 6.1m (530 total: 508 passed / 1 failed / 21 skipped).

| Gate                                   | Result                  | Evidence / blocker                                                                                                                                                                 |
| -------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused editor unit matrix             | Historical pass         | 8 test files, 107 tests passed before the current source follow-up.                                                                                                               |
| Save/controller follow-up slice        | Historical pass         | 5 test files, 31 tests passed before the current source follow-up.                                                                                                                |
| 2026-07-16 regression follow-up        | Pass                    | 8 test files, 32 tests passed; conflict, route-epoch save ownership, stale conflict continuation protection, redo dirty state, docked/overlay panel keyboard contracts, keyboard-open/immediate-Escape dismissal, overlay dismissal and rich-text load ordering are covered. |
| 2026-07-16 route-load follow-up        | Pass                    | Deferred A-to-B lifecycle regression passed 1/1; the lifecycle/persistence/panel/keyboard matrix passed 7 files / 34 tests and hides the outgoing deck while the incoming route is pending. |
| 2026-07-16 post-follow-up hardening    | Pass                    | 12 focused files / 56 tests passed after stale conflict failure fencing, same-ID route-epoch successor protection, conflict-action serialization, queued-successor discard on Use Remote, unchanged Use Remote suppression, latest-edit Keep Local preservation, Use Remote history reseeding, interaction reset extraction, layout-synchronous keyboard disabling, conflict-dialog Escape/focus isolation, history-save timing stabilization, and the EditorPage composition-size guard. |
| 2026-07-16 P0 unload recovery          | Pass                    | 14 focused files / 66 tests passed; 1/1 Chromium oversized-draft recovery and 1/1 existing small-payload route-flush checks passed. The local receipt is durable on the supported Chromium path, queued successor drafts are fenced, and reload requires explicit remote/local reconciliation. |
| 2026-07-17 P0 resume + gate unblockers | Pass                    | 14 focused files / 70 tests; Chromium oversized + flush-on-leave 2/2; corpus opaque closure 3/3 (~4.7s, no 60s timeout); package-store 54/54; API smoke p95 ~35ms after 52MB fixture purge + permanent k6 cleanup; WS smoke pass; build pass. |
| 2026-07-17 session resume (fable-code) | Pass (focused + coverage + load + E2E) | 14 focused / 71 tests; oversized Chromium 2/2 (+ Recover Local Draft); flush-on-leave 1/1; lint 0 errors + build; **coverage 466/3636**; API p95 35ms + WS smoke; full E2E 507 + exact overlay 3/3 under one-rerun. M1 fixed; M2 waived. **P0 unload plan completed** — unload-durability blocker cleared. |
| 2026-07-18 stable-source release rerun | Pass (all mandatory gates) | Focused editor matrix **13 files / 116 tests**; lint **0 errors / 25 existing warnings**; audit **8 files / 36 tests**; build **2,297 modules**; full coverage **470 files / 3,686 tests passed, 1 file and 3 tests skipped** (68.75% statements, 56.14% branches, 63.99% functions, 71.53% lines); strict PPTX **11/11 corpus + 3/3 smoke**, full browser audit **6/6**; touch **7/7**; oversized recovery + route flush **3/3**; API p95 **178.32ms**, WS connect p95 **3.99ms**; full E2E **506 passed / 21 intentional skips / 3 flaky outcomes**, exact trace rerun **3/3 passed**. |
| Phase-focused component/browser checks | Historical pass         | Responsive, ribbon, navigator/a11y, pointer/touch, and composition acceptance was verified before phase closeout; representative remediation suites passed after root-cause fixes. |
| 2026-07-16 browser/touch rerun         | Pre-patch pass          | Responsive/a11y 13/13, desktop editor 20/20, and tablet-touch 7/7 passed in the preceding integrated run.                                                                        |
| Audit / lint / build                   | Post-patch pass         | Stable-source rerun: audit 8 files / 36 tests, lint 0 errors (25 warnings), and client build passed; build transformed 2,297 modules. |
| PPTX strict                            | Pass (2026-07-18)       | 11/11 corpus tests and 3/3 strict smoke browser tests passed. |
| Full PPTX browser audit                | Pass (2026-07-18)       | 6/6 strict full-scope browser audit tests passed. |
| Full coverage                          | Pass (2026-07-18 stable-source rerun)| **470 passed / 1 skipped** files; **3686 passed / 3 skipped** tests; exit 0 (~1223s). Coverage: 68.75% statements, 56.14% branches, 63.99% functions, 71.53% lines. |
| Full E2E                               | Historical pass (2026-07-18, exact flaky-case rerun) | 530 scheduled: **506 passed**, 21 intentional skips, 3 flaky outcomes that passed on retry; exact `--trace=on` rerun passed **3/3**. |
| 2026-07-20 isolated serial current-tree E2E | **BLOCKED** | `clean-e2e-20260720-final-direct-api` exited 1 after 6.1m: **530 total / 508 passed / 1 failed / 21 skipped**. The sole failure was `tests/e2e/live/black-and-white-screen-overlay-viewer-keyboard.spec.js:54-60`: after `W`, the viewer remained `Waiting for presenter` and no white overlay appeared. Playwright worker API-base propagation is verified but partial: the config guard passed 9/9 and the no-env four-worker candidate probe passed 68/68; helper API calls go direct, while some raw Playwright request calls still route through Vite. No preview/server exit or shared-build `ENOENT` occurred; the concurrent-build `ENOENT` result is invalid evidence, not a product failure. |
| API load smoke                         | Pass (2026-07-18 isolated server) | p95 `http_req_duration` **178.32ms**, failed **0%**, iteration p95 **1.24s**; permanent per-iteration cleanup kept the isolated store bounded. |
| WebSocket load smoke                   | Pass (2026-07-18 isolated server) | 100% room joins; p95 connect **3.99ms**, 6 messages received. |
| Validation cleanup                     | Complete                | The writer lock was reclaimed only after its recorded PID was proven absent, and the local server was stopped after smoke validation.                                            |

The 2026-07-18 release result remains historical evidence only. Phase 9's current full release gate is **BLOCKED** until the live white-overlay failure is fixed and a valid isolated serial current-tree full E2E run is green. The current failure is not the invalid concurrent-build `ENOENT` evidence; no preview/server exit or shared-build `ENOENT` occurred in the valid run. Residual product non-goals (IDB/private-browsing durability, controller LOC hygiene) remain documented and are not the current blocker.

## Risk Assessment

- **Dirty-tree ambiguity:** compare current changes to the Phase 1 baseline.
- **Flaky Playwright:** retain trace and rerun exact failure once.
- **Visual masking:** reject unexplained baseline updates.
- **PPTX unrelated failure:** classify against baseline, but do not waive an explicit preservation gate.
- **Scope creep:** fixes return to the owning phase and require its RED/GREEN gate.
- **Missing k6:** blocker, not success.

## Security And Data Integrity

Review diffs for secrets, payload dumps and weakened conflict validation. Verify public share/editor trust boundaries remain unchanged.

## Rollback

Do not perform broad rollback. Revert only the responsible phase's implementation while preserving unrelated working-tree content, then rerun its gate and restart this phase.

## Next Steps

1. Fix the live white-overlay failure in `tests/e2e/live/black-and-white-screen-overlay-viewer-keyboard.spec.js:54-60` through its owning implementation path and run its focused suite.
2. Rerun a valid isolated serial current-tree full E2E gate; keep Phase 9 and the P0 full release status **BLOCKED** unless it is green.
3. After all gates pass, reconcile absorbed work in the three blocked plans, then implementation can be considered complete.

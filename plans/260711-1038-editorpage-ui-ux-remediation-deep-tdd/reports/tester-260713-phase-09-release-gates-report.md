# Phase 9 Integrated Regression / Release Gates QA Report

Date: 2026-07-13 14:02–14:10 Asia/Saigon  
Plan: `260711-1038-editorpage-ui-ux-remediation-deep-tdd`  
Mode: focused gates first; mandatory release gate stopped after the repeatable EditorPage regression.  
Scope rule: no product, test, config, snapshot, threshold, or unrelated-file changes.

## Decision

**Release gate: BLOCKED.** The focused desktop browser matrix has one repeatable EditorPage-plan failure. The configured exact retry failed with the same assertion, so this is not treated as flaky or waived. Per the no-side-effects hard gate, no further mandatory commands were started after the currently running lint command completed.

The working tree was already heavily dirty on `master...origin/master`, containing both EditorPage remediation work and concurrent PPTX work. No source/config/test files were changed by this QA run; only this report was created.

## Test Results Overview

| Scope | Exact command | Result / exit | Counts | Elapsed |
| --- | --- | --- | --- | --- |
| Focused editor unit/controller | `npx vitest run client/src/hooks/editor-controller/ client/src/components/canvas/use-canvas-pointer-interaction.test.js client/src/components/canvas/use-canvas-pointer-interaction.touch.test.jsx client/src/pages/__tests__/editor-page-history-autosave.characterization.test.jsx client/src/pages/editor-autosave-lifecycle.test.jsx client/src/pages/__tests__/editor-page-element-ops.characterization.test.jsx client/src/pages/__tests__/editor-page-vertical-slides.test.jsx` | PASS / 0 | 6 files, 68 passed, 0 failed | 62.98s |
| Focused desktop browser | `npx playwright test tests/e2e/keyboard-shortcuts.spec.js tests/e2e/undo-redo.spec.js tests/e2e/autosave-flush-on-leave.spec.js tests/e2e/canvas/clipboard.spec.js tests/e2e/canvas/group-zorder-guides.spec.js tests/e2e/coverage-gaps-resize-guides.spec.js --project=chromium` | FAIL / 1 | 20 tests scheduled; 19 passed, 1 failed. Configured retry also failed identically (`21/20` progress line). | 1.5m |
| Focused responsive/a11y browser | `npx playwright test tests/e2e/responsive/editor-workspace-and-status-density.spec.js tests/e2e/a11y/slide-navigator-semantics-focus-and-selection.spec.js tests/e2e/a11y/axe-core-scans-across-editor-present-share-live-and-home-views.spec.js --project=chromium` | PASS / 0 | 9 passed, 0 failed | 41.2s |
| Audit | `npm run test:audit` | PASS / 0 | 8 files, 36 passed, 0 failed | 15.43s |
| Lint | `npm run lint` | PASS / 0 | 0 errors, 25 warnings | Not emitted by ESLint |

Focused total: 103 passing test cases and 1 failing test case across the reported matrices. Counts are kept per command because Vitest and Playwright use different aggregation models.

## First Actionable Failure

`tests/e2e/canvas/group-zorder-guides.spec.js:31` (`group and ungroup preserve member order while z-order moves the selected block`):

```text
expect(locator).toContainText(expected) failed
Locator: locator('.properties-panel')
Expected substring: "2 elements selected"
Received: "ElementXYRotWHLock elementFragment (animate in)Drop ShadowXYBlurColorForwardBackwardDelete ElementSelection PaneFillStroke ColorStroke Width: 0pxOpacity: 100%Corner Radius: 0pxLabel TextSlide FooterSpeaker Notes"
```

The failure occurred after selecting `a`, then Shift-clicking `b`. The page snapshot showed three rendered shape groups, but the inspector rendered the single-element controls and no multi-select badge. The retry reproduced the same state and assertion after the same 5,000 ms wait. The first failure stack points to the test helper assertion; owning production scope is the EditorPage remediation selection/pointer/inspector path (`client/src/pages/EditorPage.jsx`, `client/src/components/SlideCanvas.jsx`, `client/src/components/PropertiesPanel.jsx`, and related migrated pointer files), not PPTX import.

## Trace / Screenshot Review

- Failure screenshot inspected: `test-results/canvas-group-zorder-guides-718ca-er-moves-the-selected-block-chromium/test-failed-1.png`.
- Screenshot is behaviorally consistent with the assertion: two/three shapes are visible on canvas, while the right inspector shows one-element controls. No unexplained visual baseline drift or snapshot update was used.
- Playwright output recorded the exact retry trace at `test-results/canvas-group-zorder-guides-718ca-er-moves-the-selected-block-chromium-retry1/trace.zip`; its `error-context.md` was inspected. The subsequent Playwright invocation removed the default `test-results` artifacts before a later archive listing, so no additional trace archive remains to inspect. This does not change the repeatable failure evidence.
- No snapshot was updated and no threshold was weakened.

## Lint Warnings

Lint is green with 25 warnings and 0 errors. Warnings are non-blocking but should not be silently converted to errors:

- Existing `no-regex-spaces` warning in `client/src/data/element-defaults.test.js`.
- Existing `no-redeclare` warnings in PPTX parser benchmark tests.
- Existing `no-undef` warnings in `server/services/pptx-import/officecli/__fixtures__/fake-officecli.cjs`.
- Existing unused variable warning in `server/services/pptx-import/roundtrip-original-parts.test.js`.

These warnings are outside the focused EditorPage regression and are mostly concurrent PPTX scope.

## Coverage Metrics

`npm run test:coverage` was **not started** after the repeatable focused E2E failure triggered the no-side-effects hard gate. Therefore no fresh line, branch, function, or statement percentages are claimed. The plan's prior historical record says coverage had eight unrelated server/PPTX failures; that prior result is not re-claimed as this run's output.

## Build Status

`npm run build` was **not started** after the hard gate. No build status is claimed.

## Mandatory Gate Ledger

The following mandatory commands were required by Phase 9 but were not started because the repeatable EditorPage regression is a blocking RED result and the coordinator instructed the QA run to stop after the currently running lint command:

| Exact command | Status | Exit | First failure / reason |
| --- | --- | --- | --- |
| `npm run test:coverage` | NOT RUN | N/A | Stopped by repeatable focused EditorPage E2E regression |
| `npm run build` | NOT RUN | N/A | Stopped by repeatable focused EditorPage E2E regression |
| `npm run test:e2e:touch` | NOT RUN | N/A | Stopped by repeatable focused EditorPage E2E regression |
| `npm run test:e2e` | NOT RUN | N/A | Stopped by repeatable focused EditorPage E2E regression |
| `npm run test:pptx:strict` | NOT RUN | N/A | Stopped by repeatable focused EditorPage E2E regression; no PPTX pass/blocker inferred |
| `npm run test:pptx:browser-audit:full` | NOT RUN | N/A | Stopped by repeatable focused EditorPage E2E regression; no PPTX pass/blocker inferred |
| `npm run test:load:api:smoke` | NOT RUN | N/A | Stopped by repeatable focused EditorPage E2E regression |
| `npm run test:load:ws:smoke` | NOT RUN | N/A | Stopped by repeatable focused EditorPage E2E regression |

Historical plan entries report PPTX strict/full browser and WebSocket smoke as passed, and API smoke as a threshold failure (100% success, p95 2.6 s vs 2 s). Those entries are preserved context only, not fresh evidence from this run.

## k6 Availability

Command executed:

```text
command -v k6 || where.exe k6 || true
```

Result: exit 0; `/c/Program Files/k6/k6` found. Missing k6 is not the blocker; load gates were stopped before execution.

## Ownership Classification

- **EditorPage-plan blocker:** repeatable Shift multi-selection/inspector mismatch in `group-zorder-guides.spec.js`; production ownership is the EditorPage/canvas selection path. Requires fix in its owning phase, then focused RED/GREEN rerun and Phase 9 restart.
- **Concurrent PPTX work:** dirty-tree files under `server/services/pptx-import/`, PPTX routes/services, PPTX scripts, and related plan/report paths were not touched by this QA run. No PPTX gate was run after the hard stop, so no PPTX result is inferred.
- **Shared/other existing changes:** README/docs, feature inventory, server routes, and other dirty files pre-existed this QA run. They are not attributed to the focused E2E failure without a failure stack showing those paths.

## Consistency Searches

Phase 9 searches were **not started** after the hard gate:

```powershell
rg "useEditorStore\\(.*zoom|A11Y_BASELINE_KNOWN_BLOCKING.*editor|editor-small-screen-guard" client/src tests/e2e
rg "onMouseDown|mousemove|mouseup" client/src/components/SlideCanvas.jsx client/src/components/canvas client/src/hooks/use-pinch-zoom.js client/src/hooks/use-touch-gestures.js
rg "it\\.skip|test\\.skip|describe\\.skip|it\\.todo|test\\.todo|it\\.fails" client/src tests/e2e
```

No classification of remaining matches is claimed. Run these after the owning regression is fixed.

## Critical Issues

1. **P0 release blocker:** focused desktop editor regression is repeatable under retry. Multi-selection contract fails before group/z-order behavior can be exercised.
2. Mandatory coverage, build, touch, full E2E, PPTX, load, and consistency gates have no fresh result because the hard gate stopped execution. They must not be reported as passes.
3. Existing historical API load p95 threshold failure and eight unrelated coverage failures remain open in the plan record; neither was re-tested here.

## Recommendations / Next Steps

1. Fix or investigate the owning EditorPage selection path first; preserve stable selected IDs and verify Shift-click updates `selectedElementIds` before rendering `PropertiesPanel`.
2. Rerun the exact focused desktop command. Keep the existing trace policy; do not add waits, weaken assertions, update snapshots, or reduce thresholds.
3. Once focused desktop is green, restart Phase 9 from the beginning: focused gates, `test:audit`, lint, coverage, build, mandatory real-touch project, full E2E, PPTX strict/full audit, load smoke, and consistency searches.
4. Inspect all new full-E2E/PPTX trace and screenshot summaries before any release decision. Classify failures by stack/file ownership against the dirty-tree baseline.
5. Resolve or explicitly track the historical unrelated coverage failures, API p95 threshold failure, and oversized-unload durability/P0 persistence decision before marking the plan complete.

## Unresolved Questions

- Which exact selection-state transition in the EditorPage/canvas pointer path drops the first selected ID during Shift-click? The browser evidence narrows the symptom but does not establish the code-level root cause.
- After the focused regression is fixed, will the mandatory coverage, full E2E, PPTX, load, and consistency gates reproduce the historical results or change under the current dirty tree?

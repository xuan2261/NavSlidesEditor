# Shift-select regression diagnosis — 2026-07-13 (Asia/Saigon)

## Executive summary

**Impact:** Phase 9 focused desktop E2E cannot group, z-order, or otherwise operate on a Shift multi-selection. `tests/e2e/canvas/group-zorder-guides.spec.js` fails before the Group action: it expects `2 elements selected`, but `PropertiesPanel` receives one selected ID.

**Classification:** confirmed **EditorPage UI/UX remediation Phase 7 pointer-event regression**, not a pre-existing test defect and not a Windows/Playwright artifact.

**One-line root cause:** Phase 7 marks every pointer session—including a stationary click—as `suppressCanvasClick`; its newly added element-click consumer returns before the Shift-click callback, so the second element is never added to Zustand selection.

No source, test, config, snapshot, or threshold changed during this investigation. The failed E2E was not rerun.

## Evidence and timeline

### Test contract and persisted run evidence

| Time / source | Evidence |
| --- | --- |
| 2026-06-17 22:52 +07:00 | `git blame` assigns the unchanged `selectMany` helper and Shift modifier contract to commit `51781f0b`. The test first clicks `a`, then `b` with `modifiers: ['Shift']`, and asserts the panel text at [`tests/e2e/canvas/group-zorder-guides.spec.js:26-32`](C:/Work/NavSlidesEditor/tests/e2e/canvas/group-zorder-guides.spec.js#L26-L32). `git diff --` reports no change to that file. |
| 2026-07-13, tester report | Supplied result: 20 tests, 19 pass / 1 fail; the configured retry failed identically. This matches local non-CI config: one retry and trace on first retry at [`playwright.config.js:21-29`](C:/Work/NavSlidesEditor/playwright.config.js#L21-L29). |
| 2026-07-13 14:09 +07:00 | Current `test-results/` contains only `.last-run.json` (`{"status":"passed"}`); `playwright-report/` contains only `index.html`; no trace, screenshot, video, or error-context directory exists. Therefore these on-disk artifacts cannot be attributed to the reported failure and were not used as root-cause evidence. Their absence despite the retry policy is an evidence-retention gap. |
| 2026-07-13 14:16 +07:00 | Non-E2E validation passed: `npx vitest run client/src/utils/active-slide-selection.pointer-down.test.js client/src/stores/editor-store-multiselect.deep.test.js` — 2 files, 12 tests. This validates the intended Shift resolver and Zustand functional-update contracts without consuming the flaky allowance. |

### Exact failing event/state transition

The following is the deterministic application path for the E2E's `a` click followed by `Shift+b` click. A normal `locator.click()` dispatches pointer down, pointer up, then click. The test explicitly applies `Shift` to the second click.

| Step | Event and producer | State/result |
| --- | --- | --- |
| 1 | First click, `a` pointer-down reaches [`SlideCanvas.jsx:570-590`](C:/Work/NavSlidesEditor/client/src/components/SlideCanvas.jsx#L570-L590). `resolvePointerDownSelection([], a, shift=false, move)` returns `[a]`; the code synchronizes the ref and calls `onToggleSelectElement(a, false)`. | [`use-editor-selection-controller.js:52-67`](C:/Work/NavSlidesEditor/client/src/hooks/editor-controller/use-editor-selection-controller.js#L52-L67) resolves plain selection to `[a]`, then [`editor-store.js:8-16`](C:/Work/NavSlidesEditor/client/src/stores/editor-store.js#L8-L16) stores `[a]`. |
| 2 | The same pointer-down starts a **pending** session at [`use-canvas-pointer-interaction.js:515-571`](C:/Work/NavSlidesEditor/client/src/components/canvas/use-canvas-pointer-interaction.js#L515-L571), even though the user did not move. | `pendingDragRef.current` is truthy. |
| 3 | First pointer-up invokes `finishPointer`. Its `hadInteraction` includes `pendingDragRef.current`, so it calls `setSuppressCanvasClick(true)` at [`use-canvas-pointer-interaction.js:431-439`](C:/Work/NavSlidesEditor/client/src/components/canvas/use-canvas-pointer-interaction.js#L431-L439). | The following click is marked suppressed. The element click handler consumes it at [`SlideCanvas.jsx:607-612`](C:/Work/NavSlidesEditor/client/src/components/SlideCanvas.jsx#L607-L612). Selection remains `[a]`, which is correct for the first click. |
| 4 | Second click, `Shift+b` pointer-down reaches the same selection resolver. The resolver deliberately preserves the current IDs for additive intent: [`active-slide-selection.js:60-84`](C:/Work/NavSlidesEditor/client/src/utils/active-slide-selection.js#L60-L84), directly unit-tested at [`active-slide-selection.pointer-down.test.js:48-57`](C:/Work/NavSlidesEditor/client/src/utils/active-slide-selection.pointer-down.test.js#L48-L57). | `dragIds === [a]`; no selection callback occurs on pointer-down. A pending session again starts, now with `selectedIds: [a]`. |
| 5 | Second pointer-up again treats the stationary pending session as suppressible and sets the same boolean. The subsequent element `click` enters the **new** early return at `SlideCanvas.jsx:609-612`. | `onToggleSelectElement(b, true)` at [`SlideCanvas.jsx:621`](C:/Work/NavSlidesEditor/client/src/components/SlideCanvas.jsx#L621) is never reached. The final selection is exactly `[a]`; `b` is never added. |
| 6 | `EditorPage` passes the one-ID selection through `EditorCanvasWorkspace` to `SlideCanvas` ([`editor-canvas-workspace.jsx:11-39`](C:/Work/NavSlidesEditor/client/src/components/editor/editor-canvas-workspace.jsx#L11-L39)) and through `EditorInspector` to `PropertiesPanel` ([`editor-inspector.jsx:50-77`](C:/Work/NavSlidesEditor/client/src/components/editor/editor-inspector.jsx#L50-L77)). | `PropertiesPanel` only renders the asserted badge when `selectedElementIds.length > 1` ([`PropertiesPanel.jsx:108-123`](C:/Work/NavSlidesEditor/client/src/components/PropertiesPanel.jsx#L108-L123)); therefore `2 elements selected` cannot appear. |

If a browser failed to retain Shift (not supported by available trace evidence), the defect still produces a one-element selection: plain `b` pointer-down replaces `[a]` with `[b]`, then its click is suppressed. Thus the failure does not depend on a Windows modifier artifact.

## Diff and causality proof

1. `Phase 7: Pointer And Touch Editing` explicitly owns `SlideCanvas.jsx` and `use-canvas-pointer-interaction.js` ([phase plan file inventory, lines 53-69](C:/Work/NavSlidesEditor/plans/260711-1038-editorpage-ui-ux-remediation-deep-tdd/phase-07-pointer-and-touch-editing.md#L53-L69)) and requires mouse click parity ([lines 71-81](C:/Work/NavSlidesEditor/plans/260711-1038-editorpage-ui-ux-remediation-deep-tdd/phase-07-pointer-and-touch-editing.md#L71-L81)).
2. The current uncommitted Phase 7 diff converts the old mouse transport to a pointer session and adds the element-level suppression return at `SlideCanvas.jsx:609-612`.
3. `git show HEAD:client/src/components/SlideCanvas.jsx` shows the same element click handler **without** that early return; it always reaches `onToggleSelectElement(element.id, e.shiftKey)`.
4. The pre-existing suppression producer was harmless while it applied only to the canvas-background click. The remediation widened its consumer to element clicks, where the click callback is the sole additive-selection mutation after a Shift pointer-down.
5. The test’s unchanged June contract plus the baseline handler prove this is not an obsolete test expectation. The narrow dirty source files are client/editor files; no server/PPTX file participates in the path.

### First incorrect producer/consumer

- **Latent producer made incorrect by the new interaction contract:** [`client/src/components/canvas/use-canvas-pointer-interaction.js:431-437`](C:/Work/NavSlidesEditor/client/src/components/canvas/use-canvas-pointer-interaction.js#L431-L437) calls `setSuppressCanvasClick(true)` for a non-dragging `pendingDragRef` session.
- **First newly incorrect consumer and regression insertion:** [`client/src/components/SlideCanvas.jsx:609-612`](C:/Work/NavSlidesEditor/client/src/components/SlideCanvas.jsx#L609-L612). It consumes the flag before the Shift selection callback at line 621.

The consumer is the minimal regression diff; the producer/consumer contract mismatch is the root cause.

## Hypotheses tested

| Hypothesis | Result | Evidence |
| --- | --- | --- |
| H1 — Phase 7 click-suppression regression prevents additive selection | **Confirmed** | Exact event/state chain above; current Phase 7 diff adds the consumer; baseline source lacks it. |
| H2 — Zustand selection/controller or PropertiesPanel loses a correctly added `b` | **Eliminated** | The callback that would add `b` is never invoked. The controller uses a functional updater for `multi=true` (`use-editor-selection-controller.js:55-58`); the selection/store unit contracts passed 12/12; PropertiesPanel is a length-only consumer. |
| H3 — Test expectation is pre-existing/stale | **Eliminated** | Test’s Shift contract has existed unchanged since 2026-06-17; pre-remediation handler reaches the callback and supports it. |
| H4 — Windows, retry, or trace artifact is causal | **Eliminated as root cause; artifact retention remains a concern** | Identical configured retry was reported. The deterministic code path fails regardless of Shift delivery. Current artifact folders lack the reported failure data, so they cannot either prove or explain it. |

## Remediation options

1. **Recommended — suppress only an actual drag/crop, not a stationary pending press.** In `use-canvas-pointer-interaction.js`, calculate `hadInteraction` from `cropDragRef.current || draggingRef.current`, excluding `pendingDragRef.current`. Keep element-level suppression for real drags. This is a one-line behavioral correction that restores the original click-to-select contract and obeys Phase 7’s intent to suppress only matching compatibility clicks.
2. **Smallest direct rollback — remove the four-line element-click early return in `SlideCanvas.jsx:609-612`.** This exactly restores the committed element-click contract, but can re-enable post-drag element click behavior that Phase 7 was attempting to avoid, especially for tables/text. Use only if the actual-drag suppression intent is deliberately abandoned.
3. **Pointer-down additive selection — handle `Shift` toggle before creating the pending session, then retain click suppression.** This can preserve a no-duplicate-click policy but adds selection timing/ref synchronization paths and must define Shift-drag semantics. Larger and less compatible than option 1.
4. **Typed suppression metadata — carry pointer type, target, and `dragging` state rather than a boolean.** Strongest long-term state-machine model, but disproportionate for this regression.

## Required RED/GREEN validation before implementation

### RED tests

1. Add a focused pointer-hook test in `client/src/components/canvas/use-canvas-pointer-interaction.test.js`: pointer-down followed by matching pointer-up **without crossing the 4 px threshold** must not call `setSuppressCanvasClick(true)`; a pointer-down/move-over-threshold/pointer-up must still call it.
2. Add a component integration test in `client/src/components/SlideCanvas.test.jsx` with two shapes and a controlled selection callback: plain click `a`, then pointer-down/pointer-up/click `b` with `shiftKey: true`; assert the second callback is `onToggleSelectElement('b', true)`. Include the plain-click counterpart so click selection remains intact.

### GREEN verification

1. Run the two new focused tests plus existing `active-slide-selection.pointer-down.test.js`, `use-canvas-pointer-interaction.test.js`, `canvas-element-wrapper.test.jsx`, and `SlideCanvas.test.jsx`.
2. Run the existing Phase 9 E2E scenario once after the RED/GREEN fix: `npx playwright test tests/e2e/canvas/group-zorder-guides.spec.js --project=chromium`. This is the previously consumed flaky allowance; do not run it before a code fix.
3. Run the Phase 7 desktop regression slice: `tests/e2e/coverage-gaps-resize-guides.spec.js` and `tests/e2e/editor-element-interactions.spec.js` on Chromium. Run the mandatory touch slice if option 1 changes shared pointer completion behavior.

### Likely blast radius

- Every `CanvasElement` pointer click/tap: select, Shift add/remove, table second-click edit, text/HTML/code entry interactions.
- Real move/resize/rotate/crop completion: must still suppress the compatibility click after an actual gesture.
- Canvas background deselection and rubber-band selection: the existing background consumer at `SlideCanvas.jsx:461-470` remains intentionally guarded.
- Touch fallback, pointer capture/cancel, group selection, lock enforcement, and autosave/history must remain unchanged because they share `finishPointer`.

## Recurrence prevention

- Treat `pending` and `dragging` as distinct interaction states in tests. `pending` means a click may still own selection; only an actual gesture may suppress the compatibility click.
- Retain the retry trace/error-context for release-gate failures. Local config requests `trace: 'on-first-retry'`, yet the current report tree has no retrievable failed attempt; future root-cause work should not depend on static reconstruction.

## Unresolved questions

1. Why were the reported failed retry trace/screenshot/video artifacts absent from the current `test-results/` and `playwright-report/` directories despite the configured local retry trace policy? This does not block the source-level root cause, but it should be fixed before relying on Phase 9 evidence.

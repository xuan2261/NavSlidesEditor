# Phase 02 Cross-Cutting Canvas And Selection Controls

## Context Links

- [Phase 01 matrix](./phase-01-matrix-source-of-truth-and-harness.md)
- `C:/Work/NavSlidesEditor/client/src/components/SlideCanvas.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/canvas/canvas-element-wrapper.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/properties/common-element-controls.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx`

## Overview

Priority: P0
Status: Completed
Goal: lock down shared element controls: geometry, selection, lock, hide, group, z-order, guides, snapping, context menu.

## Key Insights

- These controls affect almost every element.
- Bugs here multiply across the 19-element matrix.
- Existing report marks most as `works`, but many need browser proof.

## Requirements

Functional:
- Verify X/Y/W/H/rotation/opacity controls update selected element state.
- Verify mixed multi-select displays indeterminate state where implemented.
- Verify locked elements cannot be moved/deleted/resized by keyboard, canvas, or menu.
- Verify hidden elements disappear from canvas and remain controllable via Selection Pane.
- Define hidden as presentation visibility, not a secrecy control; viewer exports must not render hidden elements, but project archives may still retain authored content unless separately redacted.
- Verify group/ungroup and z-order preserve internal order.
- Verify snap reference, smart guides, persistent guides.
- Verify select/move/resize/lock/delete/visibility smoke for each canonical element type or renderer family, not only a text/shape representative.

Non-functional:
- Prefer unit tests for pure helpers, Playwright only for real pointer/UI behavior.
- Keep E2E specs under 200 LOC by splitting by concern.

## Architecture

```text
Properties/Ribbon/Context menu
  -> EditorPage.updateSelectedElements / useSlideOperations
  -> presentation JSON
  -> SlideCanvas sorted/filtered render
  -> visual handles and guides
```

## Related Code Files

Modify/create tests:
- `C:/Work/NavSlidesEditor/tests/e2e/canvas/element-geometry-controls.spec.js`
- `C:/Work/NavSlidesEditor/tests/e2e/canvas/selection-lock-visibility.spec.js`
- `C:/Work/NavSlidesEditor/tests/e2e/canvas/group-zorder-guides.spec.js`
- `C:/Work/NavSlidesEditor/client/src/utils/selection-mixed-values.test.js`
- `C:/Work/NavSlidesEditor/client/src/utils/z-order-step.test.js`

Potential source files:
- `C:/Work/NavSlidesEditor/client/src/pages/EditorPage.jsx`
- `C:/Work/NavSlidesEditor/client/src/hooks/use-slide-operations.js`
- `C:/Work/NavSlidesEditor/client/src/components/SelectionPane.jsx`
- `C:/Work/NavSlidesEditor/client/src/components/canvas/use-canvas-pointer-interaction.js`
- `C:/Work/NavSlidesEditor/client/src/components/canvas/use-canvas-resize-rotate.js`

## Tests First

1. E2E: select one element, edit X/Y/W/H/Rot/Opacity in Properties, assert canvas style/state persisted after reload.
2. E2E: multi-select mixed X values, assert placeholder `—`, then edit and assert fan-out behavior.
3. E2E: locked selected element ignores Delete, drag, resize, rotate.
4. E2E: Selection Pane hide toggles canvas render, lock toggles handle availability.
5. E2E: hidden elements are absent from HTML/PPTX viewer output or explicitly documented as retained only in project/archive data.
6. E2E/contract: each renderer family supports select, move, resize, lock/delete, and visibility smoke.
7. Unit: z-order stepping keeps selected block internal order.
8. E2E: ruler guide add/remove and smart guide toggle.

Commands:

```bash
npm run test -- client/src/utils/selection-mixed-values.test.js client/src/utils/z-order-step.test.js
npx playwright test tests/e2e/canvas/element-geometry-controls.spec.js tests/e2e/canvas/selection-lock-visibility.spec.js tests/e2e/canvas/group-zorder-guides.spec.js
```

## Implementation Steps

1. Add Playwright page helpers for selecting elements by `data-testid="slide-element-*"` and property `prop-*` fields.
2. Write failing tests for geometry and selection.
3. Fix only the failing shared path.
4. Add matrix rows or update statuses with test IDs.
5. Add renderer-family smoke rows before marking cross-cutting controls `works` for all element types.
6. Keep any store consolidation out unless test proves drift.

## Todo List

- [x] Add geometry E2E.
- [x] Add lock/visibility E2E.
- [x] Add group/z-order/guides E2E.
- [x] Add renderer-family smoke coverage.
- [x] Add hidden visibility export/archive decision.
- [x] Fix any failing shared control paths.
- [x] Fix any failing shared control paths for hidden viewer exports.
- [x] Update matrix statuses for cross-cutting visibility.

## Progress Notes

- Added `client/src/utils/z-order-step.test.js` to pin multi-select z-order block movement and dense z-index normalization at the utility boundary.
- Added shared HTML export coverage proving hidden elements are omitted from viewer output.
- Added server PPTX export roundtrip coverage proving hidden elements are omitted from PPTX viewer output while project/archive JSON may retain authored content.
- Filtered hidden elements before client/server PPTX raster target discovery so hidden HTML/LaTeX elements do not trigger missing-raster failures.
- Filtered hidden fragment elements before print fragment page expansion so hidden fragments do not create blank/duplicate print pages.
- Updated `element-control-expected-controls.json` and `element-control-audit-matrix.json` with `visibility` rows for all 19 canonical element types across canvas, HTML export, and PPTX export.
- Added `tests/e2e/canvas/element-geometry-controls.spec.js` for X/Y/W/H/rotation/opacity persistence, canvas content opacity, reload state, and mixed multi-select X fan-out.
- Added `tests/e2e/canvas/selection-lock-visibility.spec.js` for locked element delete/drag/resize/rotate protection and Selection Pane lock/hide affordances.
- Added `tests/e2e/canvas/group-zorder-guides.spec.js` for group/ungroup, selected block z-order movement, smart guide toggle, and persistent ruler guide add/remove.
- Added `tests/e2e/canvas/renderer-family-controls-smoke.spec.js` for representative renderer-family coverage of select, geometry persistence, lock, visibility, and delete. The full 19-canonical type factory floor remains covered by unit smoke; line/timeline/game pointer/live semantics stay in their dedicated phase scopes.
- Added `data-testid="selection-pane-toggle-lock-{id}"` to stabilize Selection Pane lock E2E coverage.
- Updated visibility canvas matrix rows with Phase 02 Selection Pane evidence and renderer-family smoke evidence only for element representatives directly exercised by the smoke spec.

## Success Criteria

- Cross-cutting rows remain `works` only if backed by tests.
- Any unsupported behavior is downgraded to `partial` with explanation.
- No broad refactor to `EditorPage.jsx`.

## Risk Assessment

- Risk: pointer tests flaky.
  Mitigation: use deterministic canvas positions, state-based waits, no `waitForTimeout`.
- Risk: all-element matrix explodes.
  Mitigation: test shared behavior deeply once, then add smoke coverage per renderer family so outlier wrappers cannot falsely inherit `works`.

## Red Team Review Applied

- Finding 6: Phase command now includes all listed canvas specs; cross-cutting rows need renderer-family smoke before broad `works`.
- Finding 5 security overlap: hidden visibility must be documented as non-secret or tested in viewer exports, so users do not treat hide as redaction.

## Security Considerations

- No external data.
- Avoid clipboard tests relying on OS clipboard unless mocked or browser context grants are stable.
- Hidden elements must not be described as a data-protection feature unless export/archive redaction is explicitly implemented and tested.

## Next Steps

Phase 03 covers media-specific controls that do not fit shared geometry.

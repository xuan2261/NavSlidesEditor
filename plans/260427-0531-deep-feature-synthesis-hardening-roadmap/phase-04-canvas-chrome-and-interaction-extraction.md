---
phase: 4
title: "Canvas Chrome And Interaction Extraction"
status: pending
priority: P0
effort: "4-6d"
dependencies: [3]
---

# Phase 4: Canvas Chrome And Interaction Extraction

## Context Links

- Roadmap Phase C: extract drag/resize, selection, context menu, ruler/guides, crop mode.
- Code: `client/src/components/SlideCanvas.jsx`
- Tests: `client/src/utils/smartGuides.test.js`, `tests/e2e/element-interactions.spec.js`, `tests/e2e/visual-regression.spec.js`

## Overview

Extract canvas chrome and interaction hooks after renderer extraction. Goal:
`SlideCanvas.jsx <=1200 LOC` with behavior covered by tests.

## Key Insights

- Interaction modes are high-risk because they share refs, pointer state, snapping, crop, and keyboard state.
- Canvas chrome is lower-risk and can move before drag/resize hooks.
- Stop at `<=1200 LOC`; do not chase `~400 LOC` until behavior is stable.

## Requirements

- Functional: dragging, resizing, rotation, multi-select, rubber band, guides, rulers, zoom, context menu, crop still work.
- Functional: locked elements remain protected from edit/move/resize operations.
- Functional: smart guides and snapping remain aligned with 960 x 540 logical canvas.
- Non-functional: hooks have pure helper tests where possible.
- Non-functional: no broad styling redesign.

## Architecture

```text
SlideCanvas.jsx
  -> use-canvas-pointer-interaction.js
  -> use-canvas-selection.js
  -> use-canvas-resize-rotate.js
  -> CanvasRulers.jsx
  -> CanvasGridOverlay.jsx
  -> CanvasContextMenu.jsx
  -> CropOverlay.jsx
  -> CanvasZoomControls.jsx
```

Keep state ownership clear: shared editor state stays in stores; transient pointer
state stays inside canvas hooks.

## Related Code Files

- Modify: `client/src/components/SlideCanvas.jsx`
- Create: `client/src/components/canvas/CanvasRulers.jsx`
- Create: `client/src/components/canvas/CanvasGridOverlay.jsx`
- Create: `client/src/components/canvas/CanvasContextMenu.jsx`
- Create: `client/src/components/canvas/CanvasFooterOverlay.jsx`
- Create: `client/src/components/canvas/CanvasZoomControls.jsx`
- Create: `client/src/components/canvas/CropOverlay.jsx`
- Create: `client/src/components/canvas/use-canvas-selection.js`
- Create: `client/src/components/canvas/use-canvas-pointer-interaction.js`
- Create: `client/src/components/canvas/use-canvas-resize-rotate.js`
- Modify: `client/src/utils/smartGuides.test.js`
- Modify: `tests/e2e/element-interactions.spec.js`
- Modify: `tests/e2e/visual-regression.spec.js`
- Delete: dead inline helpers only after replacement is verified.

## Implementation Steps

1. Extract low-risk chrome components first: grid, rulers, footer, zoom controls.
2. Extract context menu using command callbacks from Phase 2.
3. Extract `CropOverlay` with image crop E2E coverage.
4. Extract pure geometry helpers for pointer-to-canvas coordinates and bounds math.
5. Extract selection/rubber-band hook with unit tests for hit testing and bounds.
6. Extract resize/rotate hook with tests for aspect-ratio lock and rotation snapping.
7. Extract drag/snap hook and reuse existing smart guide tests.
8. Remove obsolete refs/state from `SlideCanvas.jsx` after each extraction batch.
9. Run targeted Playwright after each batch; do not batch all interaction changes at once.
10. Stop when `SlideCanvas.jsx <=1200 LOC` and no component exceeds manageable size.

## Todo List

- [ ] Chrome components extracted first.
- [ ] Context menu calls Phase 2 command layer.
- [ ] Crop overlay isolated and covered.
- [ ] Pointer math helpers tested.
- [ ] Drag/resize/rotate behavior covered by E2E.
- [ ] `SlideCanvas.jsx <=1200 LOC`.

## Verification & Tests

```bash
npm run test -- client/src/utils/smartGuides.test.js
npx playwright test tests/e2e/element-interactions.spec.js tests/e2e/element-properties.spec.js tests/e2e/keyboard-shortcuts.spec.js tests/e2e/visual-regression.spec.js
npm run lint
npm run build
```

Manual smoke:

- Drag near canvas center and sibling edges to verify smart guide alignment.
- Resize with Shift aspect-ratio lock.
- Rotate with Shift snap to 15 degrees.
- Crop an image, save, reload.
- Right-click context menu actions on selected and unselected elements.

## Success Criteria

- [ ] `SlideCanvas.jsx` is `<=1200 LOC`.
- [ ] Canvas interaction behavior matches baseline.
- [ ] No duplicate keyboard or clipboard listener reappears.
- [ ] Chrome components are isolated and reusable.
- [ ] Tests pass without loosening assertions.

## Risk Assessment

- Risk: pointer refs are tightly coupled and extraction causes race bugs.
- Mitigation: extract in batches, keep a revertable diff per hook, add E2E after each batch.
- Risk: file count increases without clarity.
- Mitigation: only extract named responsibilities; no generic `helpers2` or `enhanced` files.

## Security Considerations

- Context menu must not expose actions for locked elements that bypass lock rules.
- HTML embed handling remains trusted and unchanged.

## Next Steps

Proceed to Phase 5 after canvas command and interaction paths are stable.

## Unresolved Questions

- Should renderer and chrome components live under `client/src/components/canvas/` only, or should common pure helpers move to `client/src/utils/`? Default: colocate until reused outside canvas.

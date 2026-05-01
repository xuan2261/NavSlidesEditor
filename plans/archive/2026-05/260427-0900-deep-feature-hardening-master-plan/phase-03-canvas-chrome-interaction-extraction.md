---
phase: 3
title: "Phase 4: Canvas Chrome & Interaction Extraction"
status: completed
priority: P0
effort: "4-6d"
dependencies: [2]
completed: "2026-04-27"
---

# Phase 3: Canvas Chrome & Interaction Extraction

## Context Links

- Predecessor: Phase 2 (canvas render decomposition — `<=1200 LOC` achieved)
- Code: `client/src/components/SlideCanvas.jsx` (target `<=~900 LOC` after Phase 2's ~1423 LOC)
- Code: `client/src/components/canvas/` (extracted components from Phase 2)
- Tests: `client/src/utils/smartGuides.test.js`, `tests/e2e/element-interactions.spec.js`, `tests/e2e/visual-regression.spec.js`

## Overview

Extract canvas chrome (rulers, grid, context menu, zoom controls, footer) and interaction hooks
(drag, resize, rotate, selection) from `SlideCanvas.jsx`. Target after extraction: **`<=~900 LOC`**.

> **Realistic target: ~800-900 LOC.** Phase 2 leaves SlideCanvas at ~1423 LOC.
> Reaching ~600 requires also extracting CanvasElement and all interaction hooks — aggressive.
> ~600 is a stretch goal only.

## Key Insights

- Phase 2 extracted renderers. This phase extracts everything else that is NOT renderer, NOT command layer, NOT pure geometry helpers.
- Interaction hooks (pointer state, snapping, crop mode) are tightly coupled via refs — extract in small, testable batches.
- Canvas chrome components are relatively independent — extract first.
- Context menu already uses command callbacks from Phase 1 — extract it to its own component.

## Architecture

```
client/src/components/canvas/
  # From Phase 2
  CanvasElement.jsx
  CropOverlay.jsx
  element-renderers/ (15 files)

  # New in Phase 3 — chrome
  CanvasRulers.jsx
  CanvasGridOverlay.jsx
  CanvasContextMenu.jsx
  CanvasZoomControls.jsx
  CanvasFooterOverlay.jsx

  # New in Phase 3 — interaction hooks
  use-canvas-pointer-interaction.js
  use-canvas-selection.js
  use-canvas-resize-rotate.js
  use-canvas-snapping.js
```

## Related Code Files

- Modify: `client/src/components/SlideCanvas.jsx`
- Create: `client/src/components/canvas/CanvasRulers.jsx`
- Create: `client/src/components/canvas/CanvasGridOverlay.jsx`
- Create: `client/src/components/canvas/CanvasContextMenu.jsx`
- Create: `client/src/components/canvas/CanvasZoomControls.jsx`
- Create: `client/src/components/canvas/CanvasFooterOverlay.jsx`
- Create: `client/src/components/canvas/use-canvas-pointer-interaction.js`
- Create: `client/src/components/canvas/use-canvas-selection.js`
- Create: `client/src/components/canvas/use-canvas-resize-rotate.js`
- Create: `client/src/components/canvas/use-canvas-snapping.js`
- Modify: `client/src/utils/smartGuides.test.js`
- Modify: `tests/e2e/element-interactions.spec.js`

## Implementation Steps

### Chrome Components (extract first — lower risk)

#### 1. CanvasGridOverlay
- Find inline grid rendering in SlideCanvas
- Extract to `canvas/CanvasGridOverlay.jsx`
- Props: `gridVisible`, `scale`
- Smoke: toggle grid, confirm overlay renders

#### 2. CanvasRulers
- Find inline ruler rendering in SlideCanvas
- Extract to `canvas/CanvasRulers.jsx`
- Props: `scale`, `canvasWidth`, `canvasHeight`, `scrollLeft`, `scrollTop`
- Smoke: scroll canvas, confirm ruler markers update

#### 3. CanvasZoomControls
- Find inline zoom controls in SlideCanvas
- Extract to `canvas/CanvasZoomControls.jsx`
- Props: `scale`, `onZoomIn`, `onZoomOut`, `onZoomReset`
- Smoke: zoom in/out, verify scale updates

#### 4. CanvasFooterOverlay
- Find inline page number / footer rendering in SlideCanvas
- Extract to `canvas/CanvasFooterOverlay.jsx`
- Props: `slideNumber`, `totalSlides`, `scale`
- Smoke: verify page number displays

#### 5. CanvasContextMenu
- Already uses command callbacks from Phase 1 — extract to component
- Extract context menu JSX (currently ~lines 1280-1420) to `canvas/CanvasContextMenu.jsx`
- Props: `contextMenu`, `slide`, `onAddElements`, `onUpdateElement`, `onDeleteElement`, `startCrop`, `setContextMenu`
- Note: Keep `setContextMenu` internal or pass as callback; context menu closes on outside click
- Smoke: right-click element, verify all menu items work

### Interaction Hooks (extract after chrome)

#### 6. use-canvas-snapping
- Extract snap/ref helpers and `calculateGuides` integration
- Extract `snapWithRef` function
- Create hook: `useCanvasSnapping(slideWidth, slideHeight, elements, selectedIds)`
- Returns: `{ getSnapOffset(dx, dy), guides }`
- Unit test: snap guides appear at correct positions

#### 7. use-canvas-selection
- Extract selection state management: `selectedElementIds`, `rubberBand`, `hitTest`
- Create hook: `useCanvasSelection(elements, scale)`
- Returns: `{ selectedIds, addToSelection, removeFromSelection, clearSelection, selectAll, rubberBand }`
- Unit test: hit testing for single click and rubber band

#### 8. use-canvas-resize-rotate
- Extract resize math: `applyResize`, `HANDLE_STYLES`, `MIN_SIZE`
- Extract rotation math: rotation snapping
- Create hook: `useCanvasResizeRotate()`
- Returns: `{ getResizeStyle, getRotationAngle, onResizeStart, onRotateStart }`
- Unit test: aspect-ratio lock, 15-degree snap

#### 9. use-canvas-pointer-interaction
- Extract pointer event routing: `startElementDrag`, `onPointerDown`, `onPointerMove`, `onPointerUp`
- Extract drag state: `pendingDragRef`, `isDragging`, `isResizing`, `isRotating`
- Extract coordinate conversion: canvas-to-client and client-to-canvas
- Create hook: `useCanvasPointerInteraction(props)`
- This is the largest extraction — do last, after chrome and other hooks are stable

### SlideCanvas Refactor

10. Import and compose all extracted chrome components.
11. Import and use all extracted interaction hooks.
12. Replace inline chrome/interaction code with hook/component calls.
13. Remove orphaned refs/state from SlideCanvas.
14. Record final LOC. Target `<=~600 LOC`.

## Batch Extraction Order

| Batch | Items | Risk |
|-------|-------|------|
| 1 | Grid overlay | Low |
| 2 | Rulers | Low |
| 3 | Zoom controls | Low |
| 4 | Footer overlay | Low |
| 5 | Context menu (command callbacks from Phase 1) | Medium |
| 6 | use-canvas-snapping | Medium |
| 7 | use-canvas-selection | Medium |
| 8 | use-canvas-resize-rotate | Medium |
| 9 | use-canvas-pointer-interaction (largest) | High |
| 10 | SlideCanvas composition | Integration |

## Todo List

- [ ] CanvasGridOverlay extracted
- [ ] CanvasRulers extracted
- [ ] CanvasZoomControls extracted
- [ ] CanvasFooterOverlay extracted
- [ ] CanvasContextMenu extracted (uses Phase 1 command callbacks)
- [ ] use-canvas-snapping created and tested
- [ ] use-canvas-selection created and tested
- [ ] use-canvas-resize-rotate created and tested
- [ ] use-canvas-pointer-interaction created
- [ ] SlideCanvas composes all extracted components/hooks
- [ ] SlideCanvas.jsx `<=~600 LOC`
- [ ] All interaction E2E tests pass

## Verification Commands

```bash
npm run test -- client/src/utils/smartGuides.test.js
npx playwright test tests/e2e/element-interactions.spec.js tests/e2e/element-properties.spec.js tests/e2e/keyboard-shortcuts.spec.js tests/e2e/visual-regression.spec.js
npm run lint
npm run build
```

## Manual Smoke Per Batch

- **Chrome**: grid toggle, ruler scroll, zoom controls, page number, context menu actions
- **Snapping**: drag near canvas center and sibling edges, verify smart guides
- **Selection**: click, Ctrl+click, rubber band
- **Resize**: resize with Shift (aspect-ratio lock), resize near snap points
- **Rotate**: rotate with Shift (15-degree snap)
- **Pointer**: drag element across canvas, verify smooth movement

## Success Criteria

- [ ] SlideCanvas `<=~600 LOC`
- [ ] Chrome components isolated and composable
- [ ] Interaction hooks are pure and testable
- [ ] Context menu uses Phase 1 command callbacks
- [ ] Drag, resize, rotate, multi-select, rubber band, guides, rulers, zoom, context menu, crop all work
- [ ] No duplicate keyboard or clipboard listener
- [ ] All interaction E2E tests pass

## Risk Assessment

- Risk: pointer refs (`pendingDragRef`, `clipboardRef`, `slideRef`) are shared across hooks.
  - Mitigation: consolidate all refs into one `canvasStateRef` object passed to hooks.
- Risk: extracting `use-canvas-pointer-interaction` as one hook is too large.
  - Mitigation: split into `use-drag`, `use-resize`, `use-rotate` if it exceeds ~300 LOC.

## Security Considerations

- Context menu must not expose actions that bypass locked-element rules.
- Keep HTML embed handling unchanged.

## Next Steps

Proceed to Phase 4 (shortcut registry) and Phase 5 (PPTX import fidelity) in parallel — Phase 4 needs Phase 3 canvas stability, Phase 5 does not.

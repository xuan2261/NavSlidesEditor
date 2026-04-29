---
phase: 5
title: "Canvas Interaction And Slide Operations QA"
status: completed
priority: P1
effort: "1.5 days"
dependencies: [1, 2, 4]
---

# Phase 5: Canvas Interaction And Slide Operations QA

## Overview

Verify the canvas, reveal preview frame, slide operations hook/helpers, selection model, drag/resize/rotate interactions, and undo history after refactor.

## Requirements

- Canvas must render selected presentation slides consistently after dashboard navigation and refresh.
- Element geometry must be preserved across select, move, resize, rotate, duplicate, copy/paste, group-like operations if present, and undo/redo.
- Slide operations must not depend on stale component closure state.
- Reveal preview frame must render nonblank content and not steal editor focus unexpectedly.
- Tailwind classes must style editor chrome without rewriting authored slide geometry.

## Architecture

Canvas interaction flow:

Input event -> `SlideCanvas` selection/geometry handler -> `use-slide-operations` or helper -> presentation state update -> undo history -> canvas/properties rerender -> optional reveal preview sync.

Geometry remains data-driven and may use inline styles as an allowed exception.

## Related Code Files

- `client/src/components/SlideCanvas.jsx`
- `client/src/hooks/use-slide-operations.js`
- `client/src/hooks/slide-operation-helpers.js`
- `client/src/hooks/slide-operation-helpers.test.js`
- `client/src/hooks/use-reveal-preview-frame.js`
- `client/src/pages/EditorPage.jsx`
- `tests/e2e/editor.spec.js`
- `tests/e2e/elements.spec.js`
- `tests/e2e/slides.spec.js`
- `tests/e2e/slide-management.spec.js`
- `tests/e2e/undo-redo.spec.js`
- `tests/e2e/properties-panel.spec.js`

## Implementation Steps

1. Review `SlideCanvas` responsibilities:
   - Render slide background/content.
   - Render selectable/resizable element wrappers.
   - Dispatch selection and geometry mutations.
   - Keep authored element styles separate from app chrome classes.
2. Validate helper extraction:
   - Pure helpers contain deterministic geometry/slide operations.
   - Hook remains focused on state wiring and callbacks.
   - Tests cover edge cases: no selected slide, missing element, duplicate IDs, invalid index.
3. Test canvas interactions:
   - Select single element.
   - Multi-select if supported.
   - Drag move.
   - Resize from handles.
   - Rotate if supported.
   - Delete, duplicate, copy/paste.
   - Z-order changes.
4. Test slide operations:
   - Add blank slide.
   - Duplicate slide.
   - Delete selected slide.
   - Reorder slides.
   - Navigate vertical/horizontal slides if supported.
5. Check reveal preview frame:
   - Nonblank iframe/canvas/frame.
   - Correct slide count.
   - No stale notes/shared import issue.
   - No console errors from optimized dependency mismatch.
6. Verify undo/redo after every mutation family.

## Verification & Tests

- `npx vitest run client/src/hooks/slide-operation-helpers.test.js`
- `npx playwright test tests/e2e/editor.spec.js`
- `npx playwright test tests/e2e/elements.spec.js`
- `npx playwright test tests/e2e/slides.spec.js`
- `npx playwright test tests/e2e/slide-management.spec.js`
- `npx playwright test tests/e2e/undo-redo.spec.js`
- `npx playwright test tests/e2e/properties-panel.spec.js`
- Browser checks:
  - Canvas is nonblank after opening from dashboard.
  - Canvas remains nonblank after hard refresh on editor URL.
  - Drag/resize handles do not shift page layout.
  - Selection box aligns with element at zoom levels 50, 100, 150 if zoom exists.
  - Undo/redo restores geometry exactly enough for UI assertions.
- Pixel/screenshot checks:
  - Selected element border visible.
  - Handles visible and not clipped.
  - Reveal preview frame content visible at desktop and tablet sizes.

## Success Criteria

- [ ] Canvas interactions pass unit and E2E tests.
- [ ] No blank editor/canvas state after dashboard navigation or refresh.
- [ ] Slide operation helpers are tested for invalid/missing data.
- [ ] All geometry-related inline styles are justified as data-driven exceptions.

## Risk Assessment

- Risk: refactor moves logic out of hook but changes callback identity. Mitigation: E2E tests for repeated operations and undo stack.
- Risk: resizing math breaks at zoom. Mitigation: run interaction checks at multiple zoom values.
- Risk: reveal preview dependencies cache stale shared module output. Mitigation: clean build and hard refresh in browser checks.

## Security Considerations

- Do not execute authored slide HTML/scripts during editor canvas rendering beyond existing controlled path.
- Keep export/preview sanitization unchanged.

## Todo List

- [ ] Helper tests pass.
- [ ] Canvas interaction matrix complete.
- [ ] Reveal preview nonblank screenshots captured.
- [ ] Undo/redo geometry checks pass.

## Next Steps

Proceed to Phase 6 when canvas state and operations are reliable.

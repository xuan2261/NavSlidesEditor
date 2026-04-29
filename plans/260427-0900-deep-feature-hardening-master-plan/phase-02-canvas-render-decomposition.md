---
phase: 2
title: "Phase 3: Canvas Render Decomposition"
status: completed
priority: P0
effort: "4-6d"
dependencies: [1]
completed: "2026-04-27"
---

# Phase 2: Canvas Render Decomposition

## Context Links

- Predecessor: Phase 1 (command layer unified — no duplicate clipboard/keyboard paths)
- Code: `client/src/components/SlideCanvas.jsx` (2759 LOC — target `<=1200` first pass)
- Code: element renderer switch at lines 1731-1848 (15 element types)
- Code: pure helpers at lines 1-196 (already isolated — keep as-is)
- Tests: `tests/e2e/elements.spec.js`, `tests/e2e/element-properties.spec.js`, `tests/e2e/visual-regression.spec.js`

## Overview

Extract element render dispatch and renderer components from `SlideCanvas.jsx`.
This is the **BLOCKER** for all later phases — Phase 3 (chrome), Phase 4 (shortcuts), Phase 5+ all depend on a stable decomposed canvas.

Target first pass: **`<=1200 LOC`**.

## Key Insights

- Pure helpers at lines 1-196 (SNAP_REF_OPTIONS, snapWithRef, applyResize, applyCropHandle, getBgStyle) are already isolated — do NOT extract further.
- Renderer switch (lines 1731-1848) is the PRIMARY extraction target.
- `CropOverlay` function (lines 1906-2043, ~138 LOC) should be extracted as a component.
- First extraction candidate: **ShapeRenderer** (simpler than text, no external deps).
- TextRenderer extracted LAST — TipTap integration is highest risk.

## Architecture

```
client/src/components/canvas/
  CanvasElement.jsx        # Wrapper: element dispatch + selection handles + rotation handle
  CropOverlay.jsx          # Extracted from SlideCanvas lines 1906-2043
  element-renderers/
    registry.js            # Maps element.type -> renderer component
    text-element-renderer.jsx
    image-element-renderer.jsx
    shape-element-renderer.jsx
    table-element-renderer.jsx
    code-element-renderer.jsx
    chart-element-renderer.jsx
    media-element-renderer.jsx   # video + audio
    latex-element-renderer.jsx
    markdown-element-renderer.jsx
    html-element-renderer.jsx
    callout-element-renderer.jsx
    icon-element-renderer.jsx
    drawing-element-renderer.jsx
    line-element-renderer.jsx
    svg-element-renderer.jsx
    qrcode-element-renderer.jsx
```

## Related Code Files

- Modify: `client/src/components/SlideCanvas.jsx`
- Create: `client/src/components/canvas/CanvasElement.jsx`
- Create: `client/src/components/canvas/CropOverlay.jsx`
- Create: `client/src/components/canvas/element-renderers/registry.js`
- Create: 15 element renderer components (see architecture above)
- Modify: renderer E2E tests (may need selector updates)

## Implementation Steps

### 0. Extract `markdownToHtml` utility FIRST (BLOCKER for MarkdownRenderer)

`MarkdownRenderer` depends on `markdownToHtml` (~55 lines). Extracting any renderer before this creates circular imports.

1. Create `client/src/utils/markdown-utils.js`:
   - Move `markdownToHtml` from SlideCanvas (~lines 2047-2099)
   - Move `escapeForHtml` helper if present
   - Keep imports: `content-safety.js`, `url-safety.js`
2. Add `markdown-utils.test.js` unit tests: basic conversion, sanitization enforcement, URL safety
3. Replace `markdownToHtml` call in SlideCanvas with import from `markdown-utils.js`
4. Consolidate with `markdown-import.js` if it has a local duplicate

### 1. Confirm pure helpers (already isolated)

Verify lines 1-196 of SlideCanvas are pure functions. If confirmed, mark as done — do not extract.

### 2. Extract renderers in researcher's recommended order (lowest risk first)

1. CalloutRenderer (~24 LOC, zero deps)
2. IconRenderer (~30 LOC, zero deps)
3. QrCodeRenderer (~40 LOC) — recommend dynamic import of `qrcode` for bundle optimization
4. DrawingRenderer (~43 LOC, pure SVG)
5. SvgElementRenderer (~22 LOC) — uses `content-safety.js`
6. MarkdownRenderer (~16 LOC) — now unblocked by Step 0
7. ChartRenderer (~46 LOC, Chart.js iframe)
8. LatexRenderer (~14 LOC, uses `katex`)
9. ShapeRenderer (~128 LOC, largest pure renderer)
10. LineArrowRenderer (~60 LOC + ARROWHEAD_MARKERS)
11. TableRenderer (~125 LOC, interactive cell editing)
12. CropOverlay (~139 LOC)
13. CanvasElement wrapper (~391 LOC)

### 3. Create registry

```js
// client/src/components/canvas/element-renderers/registry.js
export const registry = {
  text: TextRenderer,
  image: ImageRenderer,
  shape: ShapeRenderer,
  // ...
}
export function getRenderer(type) {
  return registry[type] || null
}
```

### 4. Extract renderers in researcher's recommended order

Follow the extraction order from Step 2 above. For each renderer:
1. Create renderer component file under `client/src/components/canvas/element-renderers/`
2. Move inline rendering logic from SlideCanvas switch
3. Update registry
4. Update SlideCanvas to use `<CanvasElement>` wrapper
5. Remove inline renderer from SlideCanvas
6. Run visual smoke per renderer

### 5. Create CanvasElement wrapper

Wraps registry dispatch + selection/rotation handles + fragment/group badges. Props: element, isSelected, isEditing, isCropping, cropState, onPointerDown, onCommitCrop, onCropHandleDown, editor, iconPaths.

### 6. Replace switch

Replace lines 1731-1848 with `<CanvasElement {...props} />`.

### 7. Record LOC

Target `<=1200 LOC`. If between 1200-1400, document which renderers remain inline and why.

## Batch Extraction Order

**⚠️ NOTE:** `markdownToHtml` utility (Step 0) must be extracted BEFORE MarkdownRenderer.

| Step | Renderer | LOC | Risk | Reason |
|------|----------|-----|------|--------|
| 0 | `markdown-utils.js` | ~60 | BLOCKER | MarkdownRenderer depends on it |
| 1 | CalloutRenderer | ~24 | Lowest | Zero deps |
| 2 | IconRenderer | ~30 | Low | Zero deps |
| 3 | QrCodeRenderer | ~40 | Low | Recommend dynamic `qrcode` import |
| 4 | DrawingRenderer | ~43 | Low | Pure SVG |
| 5 | SvgElementRenderer | ~22 | Low | Uses `content-safety.js` |
| 6 | MarkdownRenderer | ~16 | Low | Unblocked by Step 0 |
| 7 | ChartRenderer | ~46 | Low | Chart.js iframe |
| 8 | LatexRenderer | ~14 | Low | Uses `katex` |
| 9 | ShapeRenderer | ~128 | Medium | Largest pure renderer |
| 10 | LineArrowRenderer | ~119 | Medium | Includes `ARROWHEAD_MARKERS` |
| 11 | TableRenderer | ~125 | Medium | Interactive cell editing |
| 12 | CropOverlay | ~139 | Medium | Interaction + rendering |
| 13 | CanvasElement wrapper | ~391 | High | Orchestration hub |
| **Net** | **14 files** | **~1336** | — | SlideCanvas: 2759 → ~1423 (−48%) |

## Todo List

- [ ] Pure helpers at lines 1-196 confirmed isolated
- [ ] CropOverlay extracted to `canvas/CropOverlay.jsx`
- [ ] Registry created at `canvas/element-renderers/registry.js`
- [ ] All 15 element renderers extracted
- [ ] CanvasElement wrapper created
- [ ] SlideCanvas switch replaced with CanvasElement
- [ ] SlideCanvas.jsx `<=1200 LOC`
- [ ] Visual regression unchanged

## Verification Commands

```bash
npm run test -- shared/tests/element-renderers.test.js
npx playwright test tests/e2e/elements.spec.js tests/e2e/element-properties.spec.js tests/e2e/visual-regression.spec.js
npm run lint
npm run build
```

## Manual Smoke Per Batch

- Open editor with that element type
- Verify rendering matches before state
- Verify selection handles appear
- Verify resize/rotate/move works
- Verify context menu works

## Success Criteria

- [ ] SlideCanvas `<=1200 LOC`
- [ ] All 17 element types render correctly
- [ ] Selection, resize, rotation, crop, context menu unchanged
- [ ] Each extracted component under ~150 LOC
- [ ] Registry dispatch replaces element-type switch
- [ ] Visual regression unchanged

## Risk Assessment

- TextRenderer (TipTap): extract LAST. Keep `editor` prop explicit; test Ctrl+B/I formatting after extraction.
- ImageRenderer crop: pass all crop state as explicit props.
- Unknown element types: registry `getRenderer()` should throw or warn loudly for missing types.

## Security Considerations

- Preserve HTML embed sandbox policy in HtmlRenderer.
- Keep `sanitizeRichTextHtml`, `sanitizeSvgContent` intact.
- Do not expand `dangerouslySetInnerHTML` beyond existing usage.

## Next Steps

Proceed to Phase 3 after this phase completes.

# Research Report: Canvas Decomposition (Phase 3) & Chrome Extraction (Phase 4)

**Author:** researcher subagent
**Date:** 2026-04-27
**Files analyzed:** `SlideCanvas.jsx` (2759 LOC), `shared/src/element-renderers.js`, `client/src/stores/editor-store.js`, `shared/src/shapeUtils.js`

---

## 1. SlideCanvas.jsx — Current Inventory

### LOC Breakdown

| Section | Lines | % |
|---|---|---|
| Imports + utility fns (highlightCode, snap, resize, crop, bg) | 1–196 | 7% |
| `SlideCanvas` component (state, effects, handlers) | 198–1028 | 30% |
| `SlideCanvas` render (JSX — chrome, overlays, footer, context menu, zoom) | 1030–1509 | 17% |
| `CanvasElement` sub-component (state, styles, type-switch) | 1512–1903 | 14% |
| `CropOverlay` | 1906–2044 | 5% |
| Renderer functions (16 inline) | 2046–2759 | 26% |
| **Total** | **2759** | **100%** |

### 16 Element Renderers in SlideCanvas

| # | Type | Lines | Inline dep | Shared dep | Interactive |
|---|---|---|---|---|---|
| 1 | `CalloutRenderer` | 24 | 0 | 0 | no |
| 2 | `QrCodeRenderer` | 40 | 0 | 0 | no |
| 3 | `IconRenderer` | 30 | 0 | 0 | no |
| 4 | `DrawingRenderer` | 43 | 0 | 0 | no |
| 5 | `SvgElementRenderer` | 22 | 0 | `content-safety.js` | no |
| 6 | `MarkdownRenderer` | 16 | **`markdownToHtml`** (55 lines) | `content-safety.js`, `url-safety.js` | no |
| 7 | `ChartRenderer` | 46 | 0 | 0 | no |
| 8 | `LatexRenderer` | 14 | 0 | 0 | no |
| 9 | `ShapeRenderer` | 128 | 0 | 0 | no |
| 10 | `LineArrowRenderer` | 60 | 0 | 0 | no |
| 11 | `TableRenderer` | 125 | 0 | 0 | **yes** (cell editing) |
| 12 | `CanvasElement` wrapper | 391 | All of above + handles + crop | 0 | **yes** |
| 13 | `CropOverlay` | 139 | 0 | 0 | **yes** |
| 14 | `markdownToHtml` utility | 55 | 0 | `content-safety.js`, `url-safety.js` | utility |
| 15 | `highlightCode` | 10 | 0 | `highlight.js` | utility |
| 16 | `getBgStyle` | 14 | 0 | 0 | utility |

### Existing Shared Equivalents

`shared/src/element-renderers.js` already implements HTML-string versions of all 16 renderers. These are used by `htmlGenerator.js` for export/print/share. No duplication risk if React renderers are kept in `client/`.

`shared/src/shapeUtils.js` → `shapeSvgString(el)` generates SVG string used by `shared/src/element-renderers.js`. `ShapeRenderer` in SlideCanvas uses JSX directly, so no real duplication.

`client/src/utils/content-safety.js` already exports `sanitizeRichTextHtml`, `sanitizeSvgContent`. `client/src/utils/url-safety.js` exports `isSafeHref`. These can be imported by extracted renderers.

---

## 2. Phase 3 — Canvas Decomposition: Extraction Plan

### Target Directory

```
client/src/components/element-renderers/
  markdown-utils.js          # BLOCKER: extracted first
  callout-renderer.jsx
  qr-code-renderer.jsx
  icon-renderer.jsx
  drawing-renderer.jsx
  svg-element-renderer.jsx
  markdown-renderer.jsx
  chart-renderer.jsx
  latex-renderer.jsx
  shape-renderer.jsx
  line-arrow-renderer.jsx
  table-renderer.jsx
  crop-overlay.jsx           # Phase 4 candidate
  canvas-element.jsx         # Main wrapper, Phase 4
  index.js                   # Re-export all
```

### Extraction Order (Lowest Risk First)

#### Step 0 — Blocker: Extract `markdownToHtml` to `client/src/utils/markdown-utils.js`
- Lines 2047–2099 in SlideCanvas.jsx
- LOC: ~55
- Dependencies: `content-safety.js`, `url-safety.js`
- Action: Create `client/src/utils/markdown-utils.js` with `markdownToHtml(content)` and `escapeForHtml(str)` helper
- Reason: `MarkdownRenderer` is blocked by this; also this utility is useful elsewhere (`markdown-import.js`)

#### Step 1 — `CalloutRenderer` (lowest risk, zero deps)
- Lines 2165–2188, LOC: ~24
- No imports, no utilities
- Action: Extract to `callout-renderer.jsx`, replace inline with import

#### Step 2 — `IconRenderer`
- Lines 2193–2222, LOC: ~30
- No imports (receives `iconPaths` as prop)
- Action: Extract to `icon-renderer.jsx`

#### Step 3 — `QrCodeRenderer`
- Lines 2719–2759, LOC: ~40
- Import: `QRCode` from `qrcode` (already in SlideCanvas imports)
- Action: Extract to `qr-code-renderer.jsx`; **recommend: lazy-load QRCode generation** to reduce bundle
  - Use `useEffect` + dynamic import of `qrcode` only when element is visible
  - This saves `qrcode` from main bundle → only loaded when a QR code element exists

#### Step 4 — `DrawingRenderer`
- Lines 2532–2574, LOC: ~43
- No imports
- Action: Extract to `drawing-renderer.jsx`

#### Step 5 — `SvgElementRenderer`
- Lines 2696–2717, LOC: ~22
- Import: `sanitizeSvgContent` from `content-safety.js`
- Action: Extract to `svg-element-renderer.jsx`

#### Step 6 — `MarkdownRenderer`
- Lines 2101–2116, LOC: ~16
- Import: `markdownToHtml` (from Step 0), `sanitizeRichTextHtml` (existing)
- Action: Extract to `markdown-renderer.jsx`; delete inline `markdownToHtml` from SlideCanvas

#### Step 7 — `ChartRenderer`
- Lines 2118–2163, LOC: ~46
- No imports (inline Chart.js iframe HTML)
- Action: Extract to `chart-renderer.jsx`

#### Step 8 — `LatexRenderer`
- Lines 2262–2275, LOC: ~14
- Imports: `katex` (already in SlideCanvas imports)
- Action: Extract to `latex-renderer.jsx`

#### Step 9 — `ShapeRenderer`
- Lines 2403–2530, LOC: ~128 (largest)
- No external imports (pure JSX SVG)
- Action: Extract to `shape-renderer.jsx`

#### Step 10 — `LineArrowRenderer` + `ARROWHEAD_MARKERS`
- Lines 2576–2694, LOC: ~119 (includes `ARROWHEAD_MARKERS` object)
- No imports
- Action: Extract both to `line-arrow-renderer.jsx`

#### Step 11 — `TableRenderer`
- Lines 2277–2401, LOC: ~125
- Interactive: cell editing via `useState`/`useRef`
- Action: Extract to `table-renderer.jsx`; test cell editing flow after extraction

#### Step 12 — `CropOverlay`
- Lines 1906–2044, LOC: ~139
- Phase 4 candidate (interaction + rendering)
- Action: Extract to `crop-overlay.jsx`

#### Step 13 — `CanvasElement` wrapper
- Lines 1512–1903, LOC: ~391
- This is the orchestration hub — renders all element types + handles/resize/rotation overlays
- Action: Extract to `canvas-element.jsx`; keep type-switch in `SlideCanvas` but call extracted renderers
- After extraction: SlideCanvas JSX becomes a thin coordinator

### LOC Estimates

| Step | File | LOC (extracted) | Change to SlideCanvas |
|---|---|---|---|
| 0 | `utils/markdown-utils.js` | ~60 | −55 |
| 1 | `callout-renderer.jsx` | ~30 | −24 |
| 2 | `icon-renderer.jsx` | ~35 | −30 |
| 3 | `qr-code-renderer.jsx` | ~45 | −40 |
| 4 | `drawing-renderer.jsx` | ~48 | −43 |
| 5 | `svg-element-renderer.jsx` | ~28 | −22 |
| 6 | `markdown-renderer.jsx` | ~22 | −16 |
| 7 | `chart-renderer.jsx` | ~52 | −46 |
| 8 | `latex-renderer.jsx` | ~20 | −14 |
| 9 | `shape-renderer.jsx` | ~132 | −128 |
| 10 | `line-arrow-renderer.jsx` | ~124 | −119 |
| 11 | `table-renderer.jsx` | ~130 | −125 |
| 12 | `crop-overlay.jsx` | ~145 | −139 |
| 13 | `canvas-element.jsx` | ~400 | −391 |
| **Net** | **14 files** | **~1336** | **SlideCanvas: 2759 → ~1423 (−48%)** |

---

## 3. Phase 4 — Chrome Extraction: Interaction Hooks

These are the non-rendering concerns that need extraction from `SlideCanvas`.

### Interaction Refs (keep in `SlideCanvas` or move to hook)

| Ref | Purpose | Recommendation |
|---|---|---|
| `pendingDragRef` | Drag promotion threshold tracking | Keep in SlideCanvas |
| `draggingRef` | Active drag state | Keep in SlideCanvas |
| `suppressCanvasClickRef` | Prevent deselect on drag end | Keep in SlideCanvas |
| `rubberBandRef` | Rubber-band selection | Keep in SlideCanvas |
| `cropDragRef` | Crop handle drag state | Keep in SlideCanvas |
| `clipboardRef` | Synced clipboard mirror | Move to `use-canvas-interactions.js` |

### Hook Candidates for Extraction

#### `use-canvas-interactions.js` — Main mouse/keyboard interaction hook
Extract from lines 316–659 (SlideCanvas):
- `onMouseMove` (drag, crop, rubber-band)
- `onMouseUp` (rubber-band completion)
- `onKeyDown` (delete, clipboard shortcuts Ctrl+C/X/V/D, Escape)
- All refs synced via `useEffect`
- Props consumed: `onUpdateElement`, `onUpdateElements`, `onDeleteSelectedElements`, `onAddElements`, `onToggleSelectElement`, `onStopEdit`, `setClipboard`, `slide`, `selectedElementIds`, `editingElementId`, `cropMode`

**Signature:**
```js
function useCanvasInteractions({
  slideRef, selectedElementIdsRef, scaleRef, showGridRef, gridSizeRef,
  smartGuidesRef, onUpdateElement, onUpdateElements, onDeleteSelectedElements,
  onAddElements, onToggleSelectElement, onStopEdit, onDeleteElement,
  clipboardRef, setClipboard, slideWidth, slideHeight, editingElementId,
  cropMode, setCropMode, cropDragRef, pendingDragRef, draggingRef,
  suppressCanvasClickRef, rubberBandRef, setRubberBand, setActiveGuides,
  toggleSelectRef,
}) { ... }
```

#### `use-element-drag.js` — Drag/reflow/refine logic
Extract `startElementDrag`, `applyResize`, `snapWithRef`, `SNAP_REF_OPTIONS` from:
- Lines 28–48: `SNAP_REF_OPTIONS`, `snapWithRef`
- Lines 50–120: `applyResize`
- Lines 669–701: `startElementDrag`

**Note:** These are tightly coupled to `useCanvasInteractions` (shared state via refs). Consider keeping together in `use-canvas-interactions.js`.

#### `use-crop.js` — Image cropping state + logic
Extract from:
- Lines 122–181: `applyCropHandle`
- Lines 703–747: `startCrop`, `commitCrop`
- Lines 260–262: `cropMode` state + `cropDragRef`
- `CropOverlay` (extracted in Phase 3)

**Signature:**
```js
function useCrop({ slide, onUpdateElement }) {
  const [cropMode, setCropMode] = useState(null)
  const commitCropRef = useRef(null)
  // ... startCrop, commitCrop, applyCropHandle
  return { cropMode, startCrop, commitCrop, cropDragRef, commitCropRef }
}
```

#### `use-rubber-band.js` — Rubber-band selection
Extract from:
- Lines 257–258: `rubberBandRef`, `rubberBand` state
- Lines 332–341, 456–483 (in `onMouseMove`/`onMouseUp`)
- Lines 925–938: `rubberBandStyle`

#### `use-scale-fit.js` — Zoom + scale-to-fit
Extract from:
- Lines 241–242: `scale`, `userZoomMode` state
- Lines 255: `scaleRef`
- Lines 302–314: ResizeObserver scale effect

**Signature:**
```js
function useScaleFit({ containerRef, slideWidth, slideHeight, userZoomMode, setUserZoomMode }) {
  return { scale, scaleRef, setScale, setUserZoomMode }
}
```

#### `use-context-menu.js` — Context menu state + snap reference
Extract from:
- Lines 250: `contextMenu` state
- Lines 661–667: close effect
- Lines 1005–1028: snap reference grid styles
- Lines 1281–1430: context menu JSX (action buttons)

#### `use-mini-toolbar.js` — MiniToolbar positioning
Extract from:
- Lines 1489–1507: MiniToolbar conditional render + position calculation

### Phase 4 — Remaining Chrome

| Item | Lines | Action |
|---|---|---|
| `getBgStyle` | 14 | Move to `client/src/utils/canvas-style-utils.js` |
| `highlightCode` | 10 | Move to `client/src/utils/markdown-utils.js` |
| Top/Left rulers (JSX + styles) | ~80 | Extract `canvas-rulers.jsx` |
| Footer overlay (JSX + styles) | ~50 | Extract `canvas-footer.jsx` |
| Zoom controls (JSX + styles) | ~60 | Extract `canvas-zoom-controls.jsx` |
| Grid overlay | ~10 | Inline in SlideCanvas |
| Persistent/smart guides | ~30 | Inline in SlideCanvas |
| Clipboard context menu items | ~50 | `use-context-menu.js` |

---

## 4. Architectural Recommendations

### Renderer Architecture

```
SlideCanvas.jsx  (will be ~1000 LOC after Phase 3+4)
  ├── canvas-rulers.jsx           (ruler overlays)
  ├── canvas-footer.jsx           (footer + page numbers)
  ├── canvas-zoom-controls.jsx    (zoom UI)
  ├── canvas-element.jsx          (element wrapper + handles)
  │     ├── shape-renderer.jsx
  │     ├── table-renderer.jsx
  │     ├── chart-renderer.jsx
  │     ├── latex-renderer.jsx
  │     ├── markdown-renderer.jsx
  │     ├── qr-code-renderer.jsx
  │     ├── svg-element-renderer.jsx
  │     ├── drawing-renderer.jsx
  │     ├── line-arrow-renderer.jsx
  │     ├── icon-renderer.jsx
  │     ├── callout-renderer.jsx
  │     └── crop-overlay.jsx
  └── canvas-interaction-hooks/
        ├── use-canvas-interactions.js
        ├── use-crop.js
        ├── use-rubber-band.js
        ├── use-scale-fit.js
        └── use-context-menu.js
```

### Key Architectural Decisions

1. **Keep renderers as React components** (not HTML-string generators) — SlideCanvas is inherently a React component, HTML strings only apply at export time (already handled by `shared/src/element-renderers.js`)

2. **`qrcode` import strategy** — Currently imported at top level in SlideCanvas. After extraction, make `QrCodeRenderer` dynamically import `qrcode` to enable tree-shaking and deferred loading

3. **`katex` runtime rendering** — KaTeX rendering for text element previews (lines 1534–1547) is in `CanvasElement`'s `useEffect`. After extraction, move to a shared hook `useKatexPreview(contentRef, content, isEditing)`

4. **`ARROWHEAD_MARKERS`** — Currently at lines 2576–2633, in same file as `LineArrowRenderer`. Extract together to `line-arrow-renderer.jsx`

5. **`canvas-element.jsx` as orchestration hub** — The extracted `CanvasElement` should NOT import all renderers at once. Use dynamic imports or a lazy registry to avoid circular dependencies during Phase 3 transition

6. **Shared utilities between client and shared** — `content-safety.js` (client) and `shared/src/content-safety.js` may diverge. Audit both before Phase 3 to establish which is canonical

---

## 5. Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| `markdownToHtml` has no tests | Medium | Write basic tests for markdown-to-HTML conversion before extraction |
| `TableRenderer` has complex editing state | High | Extract after all pure renderers; write integration test for cell editing |
| `qrcode` bloats main bundle | Medium | Dynamic import in `QrCodeRenderer`; verify bundle size after |
| `CanvasElement` 391 LOC | High | Split into `canvas-element.jsx` + individual renderers; test each import |
| Interaction refs tightly coupled | Medium | Extract `useCanvasInteractions` as single cohesive hook, not granular |
| `highlight.js` at top level | Low | Already imported; confirm no tree-shaking issues |
| `sanitizeSvgContent` vs `sanitizeSvgHtml` naming | Low | `shared/src/element-renderers.js` uses `sanitizeSvgHtml`; `client/utils/content-safety.js` uses `sanitizeSvgContent` — audit for divergence |

---

## 6. Unresolved Questions

1. **Canonical content-safety module?** `client/src/utils/content-safety.js` vs `shared/src/content-safety.js` — which has the authoritative `sanitizeSvgContent` / `sanitizeRichTextHtml` implementations? Are they in sync?
2. **PPTX export renderers** (`client/src/utils/export-pptx-basic-renderers.js`, `export-pptx-renderers.js`) — do these overlap with SlideCanvas renderers? Should they also be extracted/consolidated?
3. **`qrcode` bundle impact** — Has `qrcode` been measured in the current bundle? It's imported at top of SlideCanvas but only used by QR code elements.
4. **Test coverage for renderers** — Is there existing test coverage for any of the inline renderer functions? `shared/tests/element-renderers.test.js` exists; any client-side tests?
5. **`CanvasElement` wrapper future** — Should `CanvasElement` be further split (separate render-only wrapper from interaction wrapper), or is the 391-LOC wrapper acceptable once renderers are external?

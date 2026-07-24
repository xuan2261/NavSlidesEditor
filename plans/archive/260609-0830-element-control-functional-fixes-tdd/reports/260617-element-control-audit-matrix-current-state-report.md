---
type: report
title: "Element Control Audit Matrix Current State"
date: 2026-06-17
plan: "260609-0830-element-control-functional-fixes-tdd"
mode: "ck:plan --deep --tdd"
scope: "19 canonical element types, editor controls, canvas behavior, HTML export, PPTX export"
status: current-source-audit
---

# Element Control Audit Matrix Current State

## Summary

Source-based audit only. No browser run. No source changed.

The 2026-06-09 audit is partly stale. Current source shows many old P0/P1 items are fixed:

- `opacity` now exists in shared HTML export base style and canvas content layer.
- `markdown` font size/color controls exist and shared renderer consumes them.
- `image` saturation, flip, border, citation, crop paths exist in editor/shared renderers.
- `chart` `areaFill` and `stacked` controls exist and shared renderer consumes them.
- `table` header text, border style, merged cells, per-cell style, col/row sizing exist in editor/shared/PPTX paths.
- `timeline` connector length control exists and shared renderer consumes event connector fields.
- `svg` content textarea + fill/stroke override controls exist.

Main remaining risk is not missing controls. It is **cross-surface drift**:

```text
control UI -> EditorPage handler -> presentation JSON -> canvas renderer -> shared HTML renderer -> PPTX renderer
```

Any property not covered in all relevant surfaces becomes `partial` or `export-gap`.

## Status Legend

| Status | Meaning |
|---|---|
| `works` | Control exists and expected state/render path is wired in editor; export path acceptable or not applicable. |
| `partial` | Control works in main editor path but has limited UI, legacy ambiguity, or incomplete secondary behavior. |
| `broken` | Control exists but likely no-op/wrong in current editor path. |
| `export-gap` | Editor/canvas works, but HTML/PPTX export is missing, rasterized, placeholder-only, or format-limited. |

## Source Map

| Area | Files |
|---|---|
| Element defaults | `client/src/data/element-defaults.js` |
| Editor orchestration | `client/src/pages/EditorPage.jsx` |
| Canvas shell | `client/src/components/SlideCanvas.jsx` |
| Canvas element wrapper | `client/src/components/canvas/canvas-element-wrapper.jsx` |
| React renderers | `client/src/components/canvas/element-renderers/*` |
| Properties panel | `client/src/components/PropertiesPanel.jsx`, `client/src/components/properties/*` |
| Ribbon | `client/src/components/ribbon/*` |
| Shared HTML export | `shared/src/element-renderers.js` |
| PPTX export | `client/src/utils/export-pptx-basic-renderers.js`, `client/src/utils/export-pptx-renderers.js` |

## Cross-Cutting Controls

| Control | Applies To | Status | Evidence | Notes / TDD Need |
|---|---|---|---|---|
| X/Y position | all elements | works | `common-element-controls.jsx`, `ribbon-format-tab-element-position-size-rotation-controls.jsx`, `EditorPage.updateSelectedElements` | Multi-select mixed state implemented for common geometry. Need E2E persistence test. |
| Width/height | all elements | works | same as above + canvas resize handles | W/H absolute apply across multi-select by current helper path. Need E2E for mixed multi-select. |
| Rotation | all elements | works | `canvas-element-wrapper.jsx`, `normalizeRotation`, shared `buildBaseStyle`, PPTX native rotate for supported types | Shift-snap is canvas path. Need E2E for handle + numeric parity. |
| Opacity | all elements | partial | canvas content layer opacity; shared `buildBaseStyle`; PPTX only native image/shape, raster/fallback for others | Editor/HTML works. PPTX not uniformly native for all types. |
| Lock | all elements | works | `CommonElementControls`, `SelectionPane`, `FormatTab`, canvas blocks handles/delete/move | Need locked + multi-select E2E. |
| Hidden/visibility | all elements | works | `SelectionPane`, `SlideCanvas` filters `hidden` | Export hidden behavior should be explicitly tested. |
| Fragment animation | all elements | works | `CommonElementControls`, `AnimationsTabContent`, shared `buildWrapperAttrs` | PPTX does not preserve reveal fragments; acceptable export-gap if PPTX animation expected. |
| Drop shadow | most except html/code | export-gap | `CommonElementControls`, canvas `boxShadow`, shared `buildBaseStyle` | PPTX native lacks general shadow mapping in current native renderers. Document as limit or rasterize specific types. |
| Z-order forward/back | all elements | works | `SelectionPane`, `ArrangeControls`, `computeMultiZOrderStep`, sorted render by zIndex | Need browser z-order E2E. |
| Group/ungroup | selected elements | works | `ArrangeControls`, `useSlideOperations`, group badge in wrapper | Need copy/paste/duplicate groupId E2E. |
| Align/distribute | selected elements | works | `ArrangeControls`, `alignElements` | Need mixed locked selection test. |
| Resize handles | selectable elements | works | `canvas-element-wrapper.jsx`, `use-canvas-pointer-interaction` | Needs real pointer E2E. |
| Rotation handle | selectable elements | works | `canvas-element-wrapper.jsx`, `use-canvas-resize-rotate` | Needs real pointer E2E. |
| Context menu copy/cut/paste/duplicate | all elements | partial | `canvas-right-click-context-menu-for-slide-elements.jsx` | Copy disabled for locked, cut path calls delete directly; verify locked cut behavior. |
| Snap reference | all elements | works | context menu `snapRef` buttons | Verify snapping helper consumes all refs. |
| Grid/rulers/guides/smart guides | canvas | works | `CanvasControls`, `SlideCanvas`, `CanvasRulers` | Need E2E for persistent guide add/remove. |

## Element Matrix

### 1. Text

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| TipTap rich text edit | works | `canvas-element-wrapper.jsx`, `EditorPage` TipTap wiring | Double-click starts editing; editor content swaps into selected text element. |
| Bold/italic/underline/strike | works | `ribbon-text-formatting-controls.jsx`, TipTap extensions | Need one E2E for toolbar + persisted HTML. |
| Font family/size/weight/line height | works | TipTap extensions, shared `renderText` | PPTX converts text runs; verify rich nested marks. |
| Text color/highlight | works | TipTap color/highlight controls, shared `renderText` | Export sanitizes text HTML. |
| Alignment/lists/links/math inline | partial | TipTap/ribbon controls | Broad feature exists; matrix needs per-command test depth. |
| HTML export | works | `shared/src/element-renderers.js:renderText` | Sanitizes scripts/events. |
| PPTX export | partial | `addTextElement` | Rich text run support exists, but complex TipTap nodes may degrade. |

### 2. Image

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Upload / URL / media library / drag-drop | works | Insert ribbon, `EditorPage`, `SlideCanvas.onDrop` | Need upload failure path. |
| Object fit | works | `image-properties.jsx`, `canvas-element-wrapper.jsx`, shared `renderImage`, PPTX sizing | Verify `none/fill` PPTX behavior; PPTX maps mostly cover/contain. |
| Brightness/contrast/grayscale/saturation | export-gap | canvas and shared `renderImage` consume filters | PPTX native image export does not map CSS filters. Document or rasterize. |
| Round corners | export-gap | canvas wrapper + shared base style | PPTX image corner radius not native in current path. |
| Crop/reset crop | works | context menu + `CropOverlay`, PPTX crop sizing path | Needs E2E: crop commit + reset + export smoke. |
| Flip H/V | works | canvas img transform, shared renderImage, PPTX `flipH/flipV` | Controls location not obvious; verify if exposed in UI elsewhere. |
| Border color/width | partial | shared renderImage + PPTX overlay border | Properties panel lacks obvious image border controls in current `image-properties.jsx`. |
| Citation text/link/color/align | works | `image-properties.jsx`, shared `buildCitationHtml` | PPTX export likely ignores citation. |
| Copy URL | works | context menu `getCopyableMediaUrl` | Browser clipboard failure intentionally swallowed. |

### 3. Shape

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Shape insert variants | works | Insert `ShapeGallery`, shared `shapeSvgString` | Variants route through canonical `shape`. |
| Fill/stroke/stroke width | works | `shape-properties.jsx`, Format tab, shared/PPTX renderers | `stroke='none'` handling in color picker should be tested. |
| Opacity | works | `shape-properties.jsx`, canvas/shared/PPTX transparency | Native PPTX maps fill transparency. |
| Border radius | partial | rect/rounded rect gate, shared/PPTX roundRect | Gate is shape-string-dependent. |
| Label text/font/color | works | `shape-properties.jsx`, shared/PPTX shape text | Rich text label not supported; plain label only. |
| Export | works | shared `renderShape`, PPTX `addShapeElement` | Gradient fill uses fallback in PPTX. |

### 4. Code

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Edit code modal | works | `code-properties.jsx`, `CodeEditorModal.jsx` | Need modal save/cancel test. |
| Language | works | Properties + Format tab + highlight.js/shared language class | Unknown language fallback needs test. |
| Font size | works | properties, canvas `codeBlockStyle`, shared/PPTX | PPTX exports plain monospace text, not syntax colors. |
| Border radius | partial | canvas wrapper + shared base style | Inner `<pre>` does not set radius in canvas; wrapper clips only if overflow hidden. Verify visual. |
| Drop shadow | partial | excluded from common controls for `code` | Intentional? If users expect all elements, document. |
| Export | export-gap | PPTX `addCodeElement` plain text | Syntax highlighting not preserved in PPTX native path. |

### 5. LaTeX / TikZ

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Edit LaTeX/TikZ modal | works | `misc-properties.jsx`, `LatexEditorModal.jsx` | Need malformed input fallback test. |
| Font size/color | works | misc controls, React/shared renderers | TikZ iframe color has known CSS cascade limits; default frozen color exists. |
| HTML/print export | works | shared `renderLatex` | Uses KaTeX/TikZJax runtime. |
| PPTX export | export-gap | `export-pptx-renderers` fallback/raster path | Raster/server fallback likely required; native editable equation not supported. |

### 6. HTML Embed

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Edit HTML/D3 modal | works | `misc-properties.jsx`, `HtmlEditorModal.jsx` | Trusted programmable content by product policy. |
| Canvas render | works | iframe `srcDoc` sandbox allow scripts/same-origin | Pointer events disabled in editor preview. |
| Shared HTML export | works | data URL iframe, base URL injection | Preserves scripts intentionally. |
| Print/PDF path | partial | `data-pdf-iframe` path | Browser layout edge cases remain likely. |
| PPTX export | export-gap | fallback/raster path | Not editable; needs raster evidence. |

### 7. Markdown

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Markdown content textarea | works | `misc-properties.jsx` | Direct edit in properties only. |
| Text color/font size | works | misc controls, React/shared renderers | Old audit gap fixed. |
| HTML export | works | shared `renderMarkdown` iframe/print path | Sanitization in embedded script should be covered. |
| PPTX export | export-gap | `export-pptx-renderers` falls back | Likely raster/placeholder, not editable markdown. |

### 8. Chart

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Chart type | works | `chart-properties.jsx`, Format tab, shared/PPTX | Format tab includes `scatter`, properties does not. Mismatch. |
| Labels/series/values/colors | works | `chart-properties.jsx`, shared `renderChart` | Need invalid number input test. |
| Area fill | works | `chart-properties.jsx`, shared renderer tests | Only shown for line chart. |
| Stacked | works | `chart-properties.jsx`, shared renderer tests | UI allows for all chart types; renderer applies axis stacking where relevant. |
| HTML export | works | Chart.js iframe/print config | Depends on vendor runtime. |
| PPTX export | partial | `addChartElement` native chart | Rotation absent in `addChartElement`; some chart options may drop. |

### 9. Video

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Source URL | partial | `media-properties.jsx`, Format `VideoControls`, shared reads `videoUrl || src` | Legacy `videoUrl` still overrides `src`; user changing `src` may be ignored if old data has `videoUrl`. |
| Poster/objectFit | works | media props, canvas/shared video | PPTX likely fallback. |
| Start/end trim | works | `getMediaFragmentSrc` in canvas/shared | Need E2E with saved state and exported HTML. |
| Playback speed | works | canvas `playbackRate`, shared `onloadedmetadata` | Not PPTX. |
| Controls/autoplay/loop/muted | works | media props, shared renderVideo | Audio/video autoplay browser policy caveat. |
| Copy URL | works | context menu for video | Safe URL filtering. |
| PPTX export | export-gap | default fallback/raster path | Video not native embedded in current PPTX renderer switch. |

### 10. Audio

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Source URL | works | `media-properties.jsx`, shared `renderAudio` | Format tab labels generic Source. |
| Autoplay/loop/muted | works | media props, shared audio attrs | Canvas audio does not apply autoplay/loop/muted in inline render; verify. |
| Controls display | partial | audio always renders controls in canvas/shared | No explicit `controls` toggle for audio. |
| PPTX export | export-gap | fallback path | Native audio embed not implemented. |

### 11. Table

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Add/remove row/col | works | `table-properties.jsx`, Format table rows/cols | Normalize shape helper used. |
| Header row | works | `table-properties.jsx`, renderer | |
| Header BG/header text/text/border colors | works | properties + shared/PPTX | |
| Border style | partial | properties + shared renderer | PPTX table border style maps mostly color/width, not style. |
| Cell edit | works | properties grid + canvas table edit route | Need table inline editing E2E. |
| Per-cell BG/text/bold/align/valign | works | properties + shared/PPTX | |
| Merged cells | partial | shared/PPTX resolver exists | Current Properties UI has no merge/unmerge control in `table-properties.jsx`. |
| Col widths/row heights | partial | shared/PPTX consume fields | UI resize is renderer-specific; properties panel lacks direct width/height list. |
| Export | works | shared `resolveMergedCells`, PPTX `addTableElement` | Border style and rotation likely export gaps. |

### 12. Icon

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Icon gallery | works | `misc-properties.jsx`, `IconGallery` | Lazy icon paths loaded in SlideCanvas. |
| Color/stroke width | works | misc controls, React/shared renderer | |
| PPTX export | export-gap | fallback path | No native icon renderer in PPTX switch. |

### 13. Callout

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Number/font size | works | misc controls, shared/PPTX renderers | |
| BG/text color | works | misc controls, shared/PPTX renderers | |
| Shape semantics | works | ellipse/circle render | |
| Export | works | shared `renderCallout`, PPTX `addCalloutElement` | |

### 14. QR Code

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Data/URL | works | misc controls, shared QR config | |
| Foreground/background | works | misc controls, shared QR config | |
| Error correction | works | misc controls, shared QR config | |
| PPTX export | export-gap | fallback path | No native QR image generation in PPTX switch. |

### 15. Drawing

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Stroke color/width | partial | misc controls, shared `renderDrawing` | Controls affect element/default; per-path behavior may preserve existing path values. |
| Path count display | works | misc controls | Informational only. |
| Drawing path edit | partial | drawing renderer consumes paths | No full drawing authoring control found in properties. |
| PPTX export | export-gap | fallback/raster path | Raster path can render paths; native editable drawing not in main switch. |

### 16. Line

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Stroke color/width | works | `shape-properties.jsx`, Format tab, shared/PPTX | |
| Dash pattern | works | shape properties, shared/PPTX dash mapping | Dash values differ between misc legacy branch and shape properties; line routes to ShapeProperties now. |
| Start/end markers | works | shape properties, shared/PPTX arrow mapping | |
| Fill | works | Format `ShapeControls` hides fill for line | Old dead control fixed. |
| Export | works | shared `renderLine`, PPTX `addLineElement` | Curved line `cx/cy` likely not native PPTX; check if needed. |

### 17. SVG

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| SVG markup textarea | works | `misc-properties.jsx` | Old missing editor gap fixed. |
| Fill/stroke override | works | misc controls, shared `renderSvg` | Override avoids defs/url paints. |
| Reset overrides | works | misc controls | |
| HTML export | works | shared sanitizes SVG | |
| PPTX export | export-gap | fallback/raster path | Not native editable SVG. |

### 18. Timeline

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Tick spacing | works | `timeline-properties.jsx`, shared renderTimeline | |
| Start/end year/date | works | properties + shared timeline | |
| Line/dot/text color | works | properties + shared timeline | |
| Font size | works | properties + shared timeline | |
| Add/remove/edit events | works | properties event list | |
| Event side/date/title/description/image | works | properties + shared timeline | |
| Connector length | works | `prop-timeline-connector-*`, shared connectorLength/connectorOffset mapping | Old gap fixed. |
| PPTX export | export-gap | fallback/raster path | Native timeline not implemented. |

### 19. Game

| Control / Behavior | Status | Evidence | Notes / TDD Need |
|---|---|---|---|
| Insert 7 game variants | works | Insert game gallery, `GAME_TYPES` | |
| Game properties | partial | `misc-properties.jsx` routes to `game-properties.jsx` | Subtype matrix not audited in this pass. |
| Canvas render | works | `game-element-renderer.jsx` + interactive renderers | |
| Live/player socket behavior | partial | game socket services/hooks outside element-control matrix | Needs separate game protocol audit. |
| Shared HTML export | partial | shared `renderGame` static placeholder | Deliberate: interactive runtime not exported as editable/live game. |
| PPTX export | export-gap | fallback/placeholder | Expected limit unless raster/export spec changes. |

## Current High-Risk Items

| ID | Status | Finding | Why It Matters | TDD First |
|---|---|---|---|---|
| A1 | partial | `videoUrl || src` legacy precedence can make Source control look ignored on old video data | User edits URL but render keeps old `videoUrl` | Unit: migrate/load old video. E2E: edit source on legacy fixture. |
| A2 | export-gap | PPTX support remains uneven for html/markdown/latex/video/audio/icon/qrcode/drawing/svg/timeline/game | Export claims broad PPTX support; many types degrade to raster/fallback | PPTX warning assertions + documented expected limits. |
| A3 | partial | Chart type options mismatch: Format includes `scatter`, Properties list does not | Same selected chart exposes inconsistent options | Unit/RTL: chart type options parity. |
| A4 | partial | Table merged cells supported by model/render/export but no obvious merge/unmerge UI in PropertiesPanel | Hidden capability; imported merged tables cannot be edited structurally | Either add UI plan or document read-only merge editing. |
| A5 | partial | Image border render/export exists but no obvious PropertiesPanel controls | Model/export richer than UI | Add controls or document unsupported authoring. |
| A6 | partial | Audio checkboxes expose autoplay/loop/muted, but canvas inline audio render only sets `src` and `controls` | Editor preview may not match exported HTML | Unit/RTL canvas render test. |
| A7 | export-gap | Drop shadow has editor/HTML support but not native PPTX mapping | Users expect visual parity | Decide: document or rasterize affected native types. |
| A8 | partial | `zoom` exists in both `editor-store` and `ui-store` | Controls can drift if reading different stores | Unit/store audit + consolidate plan if drift confirmed. |

## TDD Recommendations

Write failing tests before any fix. Suggested order:

1. `video-src-legacy-precedence.test.jsx`
   - Fixture: video element has both `videoUrl` and `src`.
   - Edit Source control.
   - Expected: saved/rendered source follows user edit or migration removes `videoUrl`.

2. `chart-control-options-parity.test.jsx`
   - Render Properties and Format chart controls.
   - Assert same supported chart type set or documented intentional subset.

3. `audio-canvas-media-flags.test.jsx`
   - Render audio element with autoplay/loop/muted.
   - Assert canvas/audio DOM matches properties.

4. `image-border-authoring.test.jsx`
   - If product wants authoring: add failing test for border color/width controls.
   - If not: add docs/test proving imported border is display/export-only.

5. `table-merge-authoring-or-readonly.test.jsx`
   - Decide merge/unmerge UI vs readonly.
   - Test chosen behavior.

6. `pptx-export-element-fallback-contract.test.js`
   - For fallback-only types, assert warning text and placeholder/raster behavior.
   - Prevent silent empty exports.

7. `drop-shadow-pptx-policy.test.js`
   - Either assert warning/documented omission, or assert raster/native shadow once implemented.

## Recommended Plan Update

Existing plan `260609-0830-element-control-functional-fixes-tdd` should be revised rather than replaced:

- Mark old P0 opacity, markdown, chart area/stack, table border/header, svg edit, timeline connector, image flip/filter HTML as **resolved in current source**.
- Keep `videoUrl/src`, PPTX fallback coverage, chart options parity, table merge authoring, image border authoring, audio preview parity as active items.
- Add a phase-07 or report-linked follow-up for **export policy documentation**.

## Verification Commands

Run after fixes, not during this report:

```bash
npm run lint
npm run test
npm run matrix:gate
npm run test:pptx:browser-audit
```

For high-risk export work:

```bash
npm run test:pptx:strict
```

## Unresolved Questions

- Should `videoUrl` be fully migrated away now, or kept as legacy read-only forever?
- Should fallback-only PPTX element types be considered acceptable if warnings are explicit?
- Should table merge/unmerge be an authoring feature, or only imported/rendered fidelity?
- Should image border authoring be exposed in PropertiesPanel?
- Should `editor-store.zoom` and `ui-store.zoom` be consolidated, or is one legacy dead state?

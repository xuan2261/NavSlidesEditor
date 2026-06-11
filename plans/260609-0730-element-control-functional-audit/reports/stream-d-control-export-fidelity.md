# Stream D — Control Export Fidelity Audit
**Date:** 2026-06-09
**Scope:** 19 element types × 3 rendering targets (canvas / reveal.js HTML / PPTX)
**Method:** Diff of actual prop reads in each renderer. All citations are file:line.

---

## Key Sources Read

| Target | File |
|--------|------|
| Canvas wrapper | `client/src/components/canvas/canvas-element-wrapper.jsx` |
| Canvas per-type | `client/src/components/canvas/element-renderers/*.jsx` |
| Reveal base style | `shared/src/element-renderers.js:106-116` (`buildBaseStyle`) |
| Reveal per-type | `shared/src/element-renderers.js:130-591` |
| PPTX dispatcher | `client/src/utils/export-pptx-renderers.js` + `server/utils/server-renderers.js` |
| PPTX per-type | `client/src/utils/export-pptx-basic-renderers.js` + `server/utils/server-basic-renderers.js` |
| PPTX fallback | `client/src/utils/export-pptx-fallback-renderer.js` + `client/src/utils/export-pptx-raster.js` |

**PPTX architecture summary:** 8 types get native pptxgenjs output (text, image, shape, line, callout, table, code, chart). `html` and `latex` are server-rasterized to PNG. All remaining types (icon, qrcode, svg, drawing, markdown, video, audio, timeline, game) fall through to `addFallbackElement`, which tries: (1) media poster image, (2) client-side raster to SVG/PNG data URI, (3) placeholder rectangle.

---

## Legend

- ✓ = prop read and applied
- ✗ = prop ignored / not read by that renderer
- ~ = partial / lossy (noted inline)
- N/A = inherently unsupported for that target (noted)

---

## Master Matrix

### Geometry (all element types share these via wrapper/buildBaseStyle/scaleElementBounds)

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| x, y | ✓ wrapper:97-98 | ✓ buildBaseStyle:116 | ✓ scaleElementBounds |
| width, height | ✓ wrapper:98 | ✓ buildBaseStyle:116 | ✓ scaleElementBounds |
| zIndex | ✓ wrapper:99 | ✓ buildBaseStyle:116 | ✗ not passed to pptxgenjs |
| rotation | ✓ wrapper:110 | ✓ buildBaseStyle:115 | ✓ `rotate:` on all native types |
| opacity (global) | ✗ not on wrapper | ✗ not in buildBaseStyle | ✗ not in any PPTX handler |
| shadowBlur/X/Y/Color | ✓ wrapper:111-113 | ✓ buildBaseStyle:107-110 | ✗ no pptxgenjs shadow |
| borderRadius (image/code only) | ✓ wrapper:109 | ✓ buildBaseStyle:111-114 | ✗ image: no sizing.radius; code: N/A |
| borderRadius (other types) | ✗ only image+code in wrapper | ✗ only image+code in buildBaseStyle | ✗ |

**Note on global opacity:** `element.opacity` on wrapper level is never read (wrapper has no `opacity:` style). It is only applied inside `ShapeRenderer` (canvas `div` inline style :169) and `renderShape` reveal (:185). All other types ignore it at wrapper level on all three targets.

---

### text

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| content (rich HTML) | ✓ | ✓ sanitizeRichTextHtml | ~ htmlToPptTextRuns (bold/italic/color preserved; advanced spans may degrade) |
| textColor | ✓ | ✓ renderText:131 | ✓ basic-renderers:30 |
| fontFamily | ✓ wrapper:118 | ✓ renderText:133 | ✓ basic-renderers:34 |
| fontSize | ✓ wrapper:119 | ✓ renderText:135 | ✓ basic-renderers:35 |
| lineHeight | ✓ wrapper:122 | ✗ not in renderText | ✗ not in addTextElement |
| textAlign | ✗ (lives inside HTML content) | ✗ (lives inside HTML content) | ~ passed to htmlToPptTextRuns:23 |
| rotation | ✓ | ✓ | ✓ basic-renderers:38 |
| opacity (global) | ✗ | ✗ | ✗ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ |

---

### image

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| src | ✓ | ✓ | ✓ |
| objectFit | ✓ | ✓ renderImage:178,181 | ✓ basic-renderers:79-84 |
| cropData (normalized crop) | ✓ | ✓ renderImage:171-179 | ✓ basic-renderers:56-70 |
| imageW/imageOffsetX/Y (drag-crop) | ✓ | ✓ renderImage:175-179 | ✓ basic-renderers:71-78 |
| filterBrightness/Contrast/Grayscale/Saturate | ✓ wrapper:167 | ✓ renderImage:159-168 | ✗ no CSS filter in pptxgenjs |
| borderRadius | ✓ wrapper:109 | ✓ buildBaseStyle:111-114 | ✗ not on image sizing options |
| borderColor/borderWidth | ✓ (via CSS on wrapper) | ✗ not in renderImage | ✓ basic-renderers:89-97 |
| alt / altText | ✓ | ✓ | ✓ |
| flipH/flipV | ✗ (canvas has no flip render) | ✗ not in renderImage | ✓ basic-renderers:52-53 |
| rotation | ✓ | ✓ | ✓ |
| opacity (global) | ✗ | ✗ | ✗ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ |
| citationText/citationLink | ✗ not on canvas wrapper | ✓ renderImage:170 | ✗ |

---

### shape

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| shape (type) | ✓ | ✓ shapeSvgString | ✓ getShapeType |
| fill | ✓ | ✓ | ✓ |
| fillGradient (gradient fill) | ✓ ShapeRenderer:50-54 | ~ shapeSvgString (SVG linearGradient) | ~ fallback to first stop color basic-renderers:105 |
| stroke / strokeWidth | ✓ | ✓ | ✓ |
| borderRadius (rect only) | ✓ ShapeRenderer:99 | ✓ shapeSvgString | ✓ basic-renderers:122-125 (roundRect only) |
| opacity | ✓ ShapeRenderer:169 | ✓ renderShape:185 | ~ encoded as fill transparency basic-renderers:109-111 |
| text / textHtml | ✓ | ✓ shapeSvgString | ✓ |
| textColor | ✓ | ✓ | ✓ |
| fontFamily | ✓ | ✓ | ✓ |
| fontSize | ✓ | ✓ | ✓ |
| textAlign | ✓ | ✓ | ✓ |
| rotation | ✓ | ✓ | ✓ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ |

---

### code

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| content | ✓ | ✓ | ✓ (plain text, no highlighting) |
| language | ✓ hljs | ✓ hljs class | ✗ ignored |
| fontSize | ✓ wrapper:137 | ✓ renderCode:193 | ✓ basic-renderers:184 |
| borderRadius | ✓ wrapper:109 | ✓ buildBaseStyle:111-114 | ✗ |
| rotation | ✓ | ✓ | ✓ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ |
| opacity (global) | ✗ | ✗ | ✗ |

---

### html

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| content | ✓ iframe srcdoc | ✓ iframe/data-url | ✓ server-rasterized PNG |
| rotation | ✓ | ✓ | ✓ (applied to raster image) |
| opacity (global) | ✗ | ✗ | ✗ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ (raster doesn't preserve) |

---

### markdown

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| content | ✓ iframe | ✓ iframe (present) / escaped text (print) | ~ raster-fallback: rasterized to PNG via marked |
| rotation | ✓ | ✓ | ✓ (fallback image rotate) |
| opacity (global) | ✗ | ✗ | ✗ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ |

---

### chart

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| chartType | ✓ | ✓ | ✓ native (bar/line/pie/doughnut/radar); scatter/polarArea → fallback |
| chartData (labels/datasets) | ✓ | ✓ | ✓ |
| dataset color | ✓ | ✓ | ✓ |
| areaFill (line only) | ✓ canvas | ✓ renderChart:229 | ✗ not in getNativeChartDefinition |
| stacked | ✓ canvas | ✓ renderChart:239 | ✗ not in getNativeChartDefinition |
| rotation | ✓ | ✓ | ✗ addChartElement has no rotate |
| opacity (global) | ✗ | ✗ | ✗ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ |

---

### video

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| src / videoUrl | ✓ | ✓ | ~ poster image if set, else placeholder |
| objectFit | ✓ wrapper:138 | ✓ renderVideo:359 | N/A (video not embeddable) |
| controls/autoplay/loop/muted | ✓ | ✓ | N/A |
| startTime/endTime | ✓ | ✓ getMediaFragmentSrc | N/A |
| playbackRate | ✓ | ✓ | N/A |
| poster | ✓ | ✓ | ✓ used as cover image fallback |
| rotation | ✓ | ✓ | ✓ (on poster/placeholder) |
| opacity (global) | ✗ | ✗ | ✗ |

---

### audio

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| src | ✓ | ✓ | N/A — placeholder only |
| controls/autoplay/loop/muted | ✓ | ✓ | N/A |
| rotation | ✓ | ✓ | ✓ (on placeholder) |
| opacity (global) | ✗ | ✗ | ✗ |

---

### table

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| data | ✓ | ✓ | ✓ |
| headerRow / headerBgColor | ✓ | ✓ | ✓ |
| cellBgColor / textColor | ✓ | ✓ | ✓ |
| borderColor / borderWidth | ✓ | ✓ | ✓ |
| borderStyle (solid/dashed/dotted) | ✓ canvas | ✓ reveal | ✗ not mapped in pptx border options |
| fontSize / cellPadding | ✓ | ✓ | ✓ |
| headerTextColor | ✓ canvas:40 | ✗ not in renderTable | ✗ not in addTableElement |
| headerIsBold | ✓ (inferred from headerRow) | ✗ not explicit | ✗ not in addTableElement |
| cellStyles (per-cell) | ✓ | ✓ | ✓ |
| colWidths / rowHeights | ✓ | ✓ | ✓ |
| mergedCells | ✓ | ✗ not in renderTable | ✓ basic-renderers |
| rotation | ✓ | ✓ | ✗ no rotate on addTable in pptxgenjs |
| opacity (global) | ✗ | ✗ | ✗ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ |

---

### icon

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| iconName | ✓ | ✓ | ✓ via raster fallback SVG |
| iconColor | ✓ | ✓ | ✓ via raster fallback |
| iconStrokeWidth | ✓ | ✓ | ✓ via raster fallback |
| rotation | ✓ | ✓ | ✓ (on raster image) |
| opacity (global) | ✗ | ✗ | ✗ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ |

---

### callout

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| calloutNumber | ✓ | ✓ | ✓ |
| calloutColor | ✓ | ✓ | ✓ |
| calloutTextColor | ✓ | ✓ | ✓ |
| fontSize | ✓ | ✓ | ✓ |
| rotation | ✓ | ✓ | ✓ |
| opacity (global) | ✗ | ✗ | ✗ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ |
| borderRadius | ✓ (50% hardcoded) | ✓ (50% hardcoded) | ~ ellipse shape (correct) |

---

### qrcode

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| qrData | ✓ | ✓ | ✓ via raster fallback |
| qrColor / qrBgColor | ✓ | ✓ | ✓ via raster fallback |
| qrErrorLevel | ✓ | ✓ | ✓ via raster fallback |
| borderRadius | ✓ qrcode-renderer:28 | ✓ renderQrcode:507,512 | ✗ not applied to raster wrapper |
| rotation | ✓ | ✓ | ✓ (on raster image) |
| opacity (global) | ✗ | ✗ | ✗ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ |

---

### drawing

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| paths (d, stroke, strokeWidth, opacity) | ✓ | ✓ | ✓ via SVG data URI raster |
| strokeColor (element-level default) | ✓ | ✓ | ✓ via raster |
| strokeWidth (element-level default) | ✓ | ✓ | ✓ via raster |
| rotation | ✓ | ✓ | ✓ (on raster image) |
| opacity (global) | ✗ | ✗ | ✗ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ |

---

### line

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| x1/y1/x2/y2 | ✓ | ✓ | ✓ |
| cx/cy (bezier control) | ✓ | ✓ renderLine:483-487 | ✗ addLineElement ignores cx/cy |
| stroke | ✓ | ✓ | ✓ |
| strokeWidth | ✓ | ✓ | ✓ |
| dashArray | ✓ | ✓ | ✓ mapLineDashType |
| arrowStart / arrowEnd | ✓ | ✓ | ✓ mapArrowType |
| rotation | ✓ | ✓ | ✓ |
| opacity (global) | ✗ | ✗ | ✗ |

---

### svg

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| content | ✓ | ✓ | ✓ via createSvgDataUri raster |
| fillOverride | ✓ | ✓ renderSvg:492-493 | ✓ applied before raster |
| strokeOverride | ✓ | ✓ renderSvg:493-494 | ✓ applied before raster |
| rotation | ✓ | ✓ | ✓ (on raster image) |
| opacity (global) | ✗ | ✗ | ✗ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ |

---

### timeline

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| timelineStart/End | ✓ | ✓ | ~ raster (if falls back) |
| events/items | ✓ | ✓ | ~ raster |
| lineColor/dotColor/textColor | ✓ | ✓ | ~ raster |
| fontSize | ✓ | ✓ | ~ raster |
| tickSpacing | ✓ | ✓ | ~ raster |
| rotation | ✓ | ✓ | ✓ (on raster image) |
| opacity (global) | ✗ | ✗ | ✗ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ |

---

### game

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| all game props | ✓ interactive | N/A — no reveal renderer (no case in RENDERERS dispatcher) | N/A — placeholder |

**game in reveal:** `RENDERERS` object in `shared/src/element-renderers.js:632-651` has no `game` key → `renderElement` returns `''`. Game slides are silently blank in reveal export. This is an inherent limitation (live socket game), not a fixable mapping gap.

---

### latex

| Prop | Canvas | Reveal | PPTX |
|------|--------|--------|------|
| content | ✓ iframe | ✓ span/iframe | ✓ server-rasterized PNG |
| fontSize / textColor | ✓ | ✓ | ✓ (embedded in raster document) |
| rotation | ✓ | ✓ | ✓ (on raster image) |
| opacity (global) | ✗ | ✗ | ✗ |
| shadowBlur/X/Y | ✓ | ✓ | ✗ |

---

## GAP List

Gaps are props that a user can set via controls that drop or render wrong on at least one export target. Sorted by impact.

| # | Type | Prop | Target | Evidence | Fixable? |
|---|------|------|--------|----------|----------|
| G1 | ALL (19) | `opacity` (element-level wrapper) | Canvas + Reveal + PPTX | canvas-element-wrapper:96-114 has no `opacity:` style; buildBaseStyle:116 has no opacity; only shape reads it internally | Fixable mapping — add `opacity` to wrapper style and buildBaseStyle |
| G2 | ALL (16 non-game/audio/video) | `shadowBlur/shadowX/shadowY/shadowColor` | PPTX | pptxgenjs has no box-shadow; no shadow props in any PPTX handler | Inherent limitation of pptxgenjs format |
| G3 | text | `lineHeight` | Reveal + PPTX | buildBaseStyle never emits line-height; addTextElement has no lineHeight | Fixable mapping — add `line-height:${el.lineHeight}` in renderText; no pptxgenjs equivalent (inherent for PPTX) |
| G4 | image | `filterBrightness/Contrast/Grayscale/Saturate` | PPTX | addImageElement:43-98 reads no filter props; pptxgenjs has no CSS filter support | Inherent for PPTX native; fixable by rasterizing filtered images |
| G5 | image | `borderRadius` | PPTX | buildBaseStyle applies it for image; addImageElement has no border-radius; pptxgenjs has no image corner radius | Inherent limitation — pptxgenjs can't round image corners natively |
| G6 | image | `borderColor/borderWidth` | Reveal | renderImage:156-182 never reads borderColor/borderWidth; PPTX does handle them (basic-renderers:89-97) | Fixable mapping — add border overlay div in renderImage |
| G7 | image | `flipH/flipV` | Canvas + Reveal | canvas-element-wrapper image section has no flipH/flipV transform; renderImage has no flip | Fixable mapping — add `transform:scaleX(-1)/scaleY(-1)` |
| G8 | shape | `fillGradient` | PPTX | gradientFallbackColor used (basic-renderers:105) — only first gradient stop color, gradient lost | Partial — pptxgenjs supports gradient fills but mapping is not implemented |
| G9 | chart | `rotation` | PPTX | addChartElement:305-312 passes no `rotate:` to addChart | Fixable mapping — add `rotate: element.rotation || 0` |
| G10 | chart | `areaFill` / `stacked` | PPTX | getNativeChartDefinition (shared-pptx-core:141-174) has no areaFill or stacked option | Fixable mapping — pptxgenjs supports `fill:true` for area, `barGrouping:'stacked'` |
| G11 | table | `headerTextColor` | Reveal + PPTX | renderTable never reads headerTextColor (uses textColor for all); addTableElement same | Fixable mapping |
| G12 | table | `headerIsBold` | Reveal + PPTX | renderTable never reads headerIsBold explicitly; addTableElement never reads it | Fixable mapping |
| G13 | table | `mergedCells` | Reveal | renderTable:374-432 has no merged cell logic (no colspan/rowspan output) | Fixable mapping — colspan/rowspan are valid HTML table attrs |
| G14 | table | `borderStyle` (solid/dashed/dotted) | PPTX | addTableElement border options use `{color, pt}` only — no dashType | Fixable mapping — pptxgenjs table border supports `dashType` |
| G15 | table | `rotation` | PPTX | addTable in pptxgenjs does not support rotate (library limitation) | Inherent limitation |
| G16 | line | `cx/cy` (bezier curve) | PPTX | addLineElement:155-175 computes straight x1/y1→x2/y2 only; bezier control point ignored | Fixable — approximate with straight line or rasterize curved lines |
| G17 | qrcode | `borderRadius` | PPTX | renderElementFallbackDataUri for qrcode uses QRCode.toDataURL (no border-radius applied to wrapper) | Fixable — render with wrapper HTML then rasterize |
| G18 | game | all props | Reveal | No `game` key in RENDERERS dispatcher — element silently renders empty string | Inherent (live socket game; N/A for static export) |
| G19 | image | `citationText/citationLink` | Canvas + PPTX | canvas-element-wrapper image section doesn't render citation; PPTX addImageElement ignores it | Fixable mapping for canvas (render as absolutely positioned div below image) and PPTX (addText below image bounds) |
| G20 | ALL (16) | `zIndex` | PPTX | scaleElementBounds:51-59 returns only x/y/w/h; zIndex never passed to pptxgenjs shape/text options | Inherent — pptxgenjs uses insertion order, not z-index. Elements are already sorted by zIndex before insertion (exportPptx.js:84) so visual order is correct |

> **G20 clarification:** zIndex is effectively honored because elements are sorted before insertion (exportPptx.js:84 `sort((a,b)=>(a.zIndex||0)-(b.zIndex||0))`). Not a real gap — marking N/A on inspection.

---

## Prioritized Backlog

### P0 — Common prop silently lost on common export path

| ID | What | Why P0 |
|----|------|--------|
| G1 | `opacity` dropped on canvas + reveal + PPTX for all non-shape types | Opacity control exists in UI; user sets 0.5 on a text/image element; looks right in editor; disappears in both reveal present and PPTX. Affects 18 types. Canvas fix: add `opacity` to `elementWrapperStyle` in canvas-element-wrapper.jsx:96; reveal fix: add `opacity:${el.opacity};` to buildBaseStyle in shared/src/element-renderers.js:116; PPTX: inherent for most types. |
| G7 | `flipH/flipV` on image: canvas renders no flip, reveal renders no flip | Canvas: canvas-element-wrapper.jsx:170 img style has no scaleX(-1); reveal: renderImage:178,181 no transform. PPTX correctly handles it. Users who set flip see no effect in any HTML export. |
| G6 | `borderColor/borderWidth` on image drops in reveal | PPTX handles it (basic-renderers:89-97); reveal renderImage never reads these props. User adds a border overlay to image via controls — visible in PPTX, absent in reveal/share-link. |
| G9 | `chart rotation` dropped in PPTX | addChartElement:305-312 passes no `rotate`. Easy one-line fix. |
| G13 | `mergedCells` dropped in reveal HTML | renderTable has no colspan/rowspan logic. Merged cells shown as separate in shared-link view. |

### P1 — Real defects, less frequent user path

| ID | What |
|----|------|
| G3 | `lineHeight` dropped in reveal and PPTX. Custom line-height on text elements ignored in all exports. |
| G8 | `fillGradient` on shape reduced to single solid color in PPTX. Gradient lost silently. pptxgenjs supports `fill:{type:'gradient'}` — mapping work required. |
| G10 | `chart areaFill` and `stacked` props ignored in PPTX native chart. |
| G11 | `headerTextColor` dropped in reveal and PPTX table. User-set header text color shows in editor, reverts to textColor in exports. |
| G12 | `headerIsBold` ignored in reveal. |
| G16 | `line cx/cy` bezier curves rendered as straight lines in PPTX. Curved connectors lose their shape silently. |

### P2 — Edge cases or inherent limitations

| ID | What |
|----|------|
| G2 | Shadow props dropped in PPTX — inherent pptxgenjs limitation. |
| G4 | Image CSS filters dropped in PPTX — inherent; would need rasterization path for filtered images. |
| G5 | Image borderRadius dropped in PPTX — pptxgenjs has no native image corner radius. |
| G14 | Table borderStyle (dashed/dotted) dropped in PPTX — fixable but low frequency. |
| G15 | Table rotation unsupported in pptxgenjs — inherent. |
| G17 | qrcode borderRadius not applied in PPTX raster — minor, fixable. |
| G18 | game element blank in reveal — inherent (live feature, N/A for static). |
| G19 | image citation dropped on canvas and PPTX — niche import-only feature. |

---

## Summary Stats

- **Total gaps identified:** 19 (G1–G19; G20 retracted after investigation)
- **Fixable mapping gaps:** 13 (G1-canvas/reveal, G3-reveal, G6, G7, G8, G9, G10, G11, G12, G13, G14, G16, G17, G19)
- **Inherent limitations:** 6 (G2, G3-pptx, G4, G5, G15, G18)

---

## Limitations of This Audit

- Did not audit `plugin:*` element types (custom plugin sandbox — inherently N/A for static export).
- Did not audit slide-level props (background fx, transitions, autoAnimate) — out of scope.
- PPTX `scatter` and `polarArea` chart types fall to raster fallback — not fully traced (likely works via canvas iframe capture).
- `htmlToPptTextRuns` fidelity (inline styles, nested spans) was not deep-tested; complex rich text may degrade beyond what is noted.
- Negative x/y (off-canvas elements): both buildBaseStyle and scaleElementBounds pass the raw value through — no clipping added. In reveal, `overflow:hidden` on the section clips them. In PPTX, pptxgenjs allows negative coords and they will bleed off-slide. Functionally consistent with canvas behavior (which also allows it).

---

## Unresolved Questions

1. Does `shapeUtils.js` `shapeSvgString` handle the `'line'` shape sub-type for reveal in the same way the canvas ShapeRenderer does? (Not traced — both use the same shared util so likely consistent.)
2. The server-side PPTX export path (`server/utils/server-renderers.js`) mirrors client-side basic-renderers exactly. Confirm both are kept in sync — duplication creates drift risk.

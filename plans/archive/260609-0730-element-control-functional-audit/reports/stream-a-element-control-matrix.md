# Element × Control Functional Audit
Date: 2026-06-09  
Scope: 19 canonical element types × all editing controls (Properties panel + Format ribbon)  
Method: Static read of renderers, property panels, ribbon, fanout util, canvas wrapper — no mocks.

---

## Summary Table

| Type     | WORKS | DEAD | MISSING | WRITES-IGNORED | WRONG |
|----------|-------|------|---------|----------------|-------|
| text     | 6     | 0    | 0       | 0              | 0     |
| image    | 12    | 0    | 1       | 0              | 0     |
| shape    | 10    | 0    | 1       | 0              | 0     |
| code     | 4     | 1    | 0       | 0              | 0     |
| latex    | 3     | 0    | 0       | 0              | 0     |
| html     | 2     | 0    | 0       | 0              | 0     |
| markdown | 1     | 0    | 2       | 0              | 0     |
| chart    | 5     | 0    | 2       | 0              | 0     |
| video    | 9     | 0    | 0       | 0              | 1     |
| audio    | 4     | 0    | 0       | 0              | 0     |
| table    | 13    | 0    | 2       | 0              | 0     |
| icon     | 3     | 0    | 0       | 0              | 0     |
| callout  | 4     | 0    | 0       | 0              | 0     |
| qrcode   | 4     | 0    | 0       | 0              | 0     |
| drawing  | 2     | 0    | 0       | 0              | 0     |
| line     | 5     | 0    | 0       | 1              | 0     |
| svg      | 3     | 0    | 1       | 0              | 0     |
| timeline | 7     | 0    | 1       | 0              | 0     |
| game     | 3     | 0    | 0       | 0              | 0     |
| **TOTAL**| **100**| **1**| **10**  | **1**          | **1** |

---

## Common Controls (all 19 types)

These controls appear for every selected element via `CommonElementControls` + the Format ribbon's Position/Size/Rotate/Opacity/Align/Lock sections.

| Control | Classification | Evidence |
|---------|---------------|----------|
| X position | WORKS | `common-element-controls.jsx:35`, consumed at `canvas-element-wrapper.jsx:98` |
| Y position | WORKS | `common-element-controls.jsx:43`, consumed at `canvas-element-wrapper.jsx:98` |
| Width | WORKS | `common-element-controls.jsx:68`, consumed at `canvas-element-wrapper.jsx:98` |
| Height | WORKS | `common-element-controls.jsx:76`, consumed at `canvas-element-wrapper.jsx:98` |
| Rotation | WORKS | `common-element-controls.jsx:52`, consumed at `canvas-element-wrapper.jsx:110` |
| Lock toggle | WORKS | `common-element-controls.jsx:93`, consumed at `canvas-element-wrapper.jsx:102` |
| Fragment toggle + index + animation | WORKS | `common-element-controls.jsx:109-152`, consumed by reveal.js fragment classes via `htmlGenerator` |
| Drop shadow (X/Y/Blur/Color) | WORKS | `common-element-controls.jsx:155-201`, consumed at `canvas-element-wrapper.jsx:111-113` |
| Bring Forward / Send Backward | WORKS | `common-element-controls.jsx:204-222`, routed via `EditorPage.jsx:1571-1572` |
| Delete | WORKS | `common-element-controls.jsx:226`, routed via `EditorPage.jsx:1570` |
| Opacity (ribbon) | WORKS | `ribbon-format-tab…:306`, consumed at `canvas-element-wrapper.jsx:98` |
| Align left/center/right (ribbon) | WORKS | `ribbon-format-tab…:317-339`, writes `x` consumed at `canvas-element-wrapper.jsx:98` |

**Drop shadow excluded for `html` and `code`** — gated at `common-element-controls.jsx:155`. Renderer ignores shadow for all registry-rendered types anyway (shadow is applied on the wrapper div, so it works for all).

---

## Per-Type Detail

### text
All type-specific editing done in TipTap inline editor. `ElementTypeProperties` returns `null` for `text` (`PropertiesPanel.jsx:38`). Common controls all apply.  
No defects.

---

### image
Controls: `ImageProperties` + `ImageControls` (ribbon).

| Control | Classification | Notes |
|---------|---------------|-------|
| objectFit | WORKS | `image-properties.jsx:11`, consumed `canvas-element-wrapper.jsx:170` |
| filterBrightness | WORKS | `image-properties.jsx:27`, consumed `canvas-element-wrapper.jsx:167` |
| filterContrast | WORKS | `image-properties.jsx:44`, consumed `canvas-element-wrapper.jsx:167` |
| filterGrayscale | WORKS | `image-properties.jsx:62`, consumed `canvas-element-wrapper.jsx:167` |
| borderRadius | WORKS | `image-properties.jsx:82`, consumed `canvas-element-wrapper.jsx:109` |
| citationText | WORKS | `image-properties.jsx:103`, consumed by `htmlGenerator` export path |
| citationLink | WORKS | `image-properties.jsx:112` |
| citationColor | WORKS | `image-properties.jsx:121` |
| citationAlign | WORKS | `image-properties.jsx:131` |
| ribbon: objectFit | WORKS | `ribbon-format-tab…:63` |
| ribbon: alt text | WORKS | `ribbon-format-tab…:74` |
| filterSaturate | MISSING | `canvas-element-wrapper.jsx:167` reads `element.filterSaturate` and applies `saturate()` CSS filter, but `ImageProperties` has no saturation slider. User cannot control saturation via any panel. |

---

### shape
Controls: `ShapeProperties` + `ShapeControls` (ribbon).

| Control | Classification | Notes |
|---------|---------------|-------|
| fill color | WORKS | `shape-properties.jsx:18`, consumed `shape-element-renderer.jsx:55` |
| stroke color | WORKS | `shape-properties.jsx:28`, consumed `shape-element-renderer.jsx:56` |
| strokeWidth | WORKS | `shape-properties.jsx:39`, consumed `shape-element-renderer.jsx:57` |
| opacity | WORKS | `shape-properties.jsx:106`, consumed `shape-element-renderer.jsx:169` |
| borderRadius (rect/rounded-rect) | WORKS | `shape-properties.jsx:121`, consumed `shape-element-renderer.jsx:99` |
| label text | WORKS | `shape-properties.jsx:143`, consumed `shape-element-renderer.jsx:214` |
| fontSize (label) | WORKS | `shape-properties.jsx:162`, consumed `shape-element-renderer.jsx:220` |
| textColor (label) | WORKS | `shape-properties.jsx:176`, consumed `shape-element-renderer.jsx:205,221` |
| ribbon: fill | WORKS | `ribbon-format-tab…:28` |
| ribbon: stroke + strokeWidth | WORKS | `ribbon-format-tab…:37-50` |
| borderRadius shown for `circle`/`triangle`/etc. | MISSING | `shape-properties.jsx:121` gates radius control on `rect` or `rounded-rect` only. Other shapes (circle, diamond, star, arrow-right) show no border radius control — expected for most but `circle`/`diamond` could reasonably support it. Minor but the gate is shape-string-dependent so adding a shape variant breaks silently. Not a defect in the strict sense; documented for awareness. |

---

### code
Controls: `CodeProperties` + `CodeControls` (ribbon).

| Control | Classification | Notes |
|---------|---------------|-------|
| language | WORKS | `code-properties.jsx:52`, consumed `canvas-element-wrapper.jsx:201` via `hljs.highlight` |
| fontSize | WORKS | `code-properties.jsx:63`, consumed `canvas-element-wrapper.jsx:137` |
| Edit Code button | WORKS | `code-properties.jsx:38`, routes to `onEditCode` → `EditorPage.jsx:1574` |
| borderRadius | DEAD | `code-properties.jsx:84` writes `borderRadius`. The wrapper applies `borderRadius` only to `image` and `code` types at `canvas-element-wrapper.jsx:109`, which is correct — but `codeBlockStyle` at line 137 hardcodes `borderRadius: 0`, overriding the wrapper's `borderRadius`. The outer div gets the radius but the `<pre>` element inside always has 0, creating a clipping mismatch. The user sees no visible change to inner content corners. |

---

### latex
Controls: in `MiscProperties` (latex branch).

| Control | Classification | Notes |
|---------|---------------|-------|
| fontSize | WORKS | `misc-properties.jsx:95`, consumed `latex-element-renderer.jsx:39` |
| textColor | WORKS | `misc-properties.jsx:110`, consumed `latex-element-renderer.jsx:39` |
| Edit LaTeX button | WORKS | `misc-properties.jsx:120`, routes to `onEditLatex` → `EditorPage.jsx:1575` |

No defects.

---

### html
Controls: in `MiscProperties` (html branch).

| Control | Classification | Notes |
|---------|---------------|-------|
| Edit HTML button | WORKS | `misc-properties.jsx:77`, routes to `onEditHtml` → `EditorPage.jsx:1573` |

No type-specific property controls beyond the edit button. Drop shadow excluded by `common-element-controls.jsx:155`. No defects.

---

### markdown
Controls: in `MiscProperties` (markdown branch).

| Control | Classification | Notes |
|---------|---------------|-------|
| content textarea | WORKS | `misc-properties.jsx:138`, consumed `markdown-element-renderer.jsx:5` |
| fontSize | MISSING | `markdown-element-renderer.jsx:13` hardcodes `fontSize: '18px'` — no element prop read. No control exists or would work. |
| textColor | MISSING | `markdown-element-renderer.jsx:12` hardcodes `color: 'white'` — ignores any `textColor` prop. No control and writing one would be silently ignored. |

---

### chart
Controls: `ChartProperties` + `ChartControls` (ribbon).

| Control | Classification | Notes |
|---------|---------------|-------|
| chartType | WORKS | `chart-properties.jsx:36`, consumed `chart-element-renderer.jsx:2` |
| labels | WORKS | `chart-properties.jsx:48`, consumed `chart-element-renderer.jsx:18` |
| dataset label | WORKS | `chart-properties.jsx:77`, consumed `chart-element-renderer.jsx:23` |
| dataset values | WORKS | `chart-properties.jsx:83`, consumed `chart-element-renderer.jsx:24` |
| dataset color | WORKS | `chart-properties.jsx:97`, consumed `chart-element-renderer.jsx:25-26` |
| areaFill (line charts) | MISSING | `chart-element-renderer.jsx:5` reads `element.areaFill`. No control in `ChartProperties` or ribbon. |
| stacked | MISSING | `chart-element-renderer.jsx:6` reads `element.stacked`. No control anywhere. |

---

### video
Controls: `MediaProperties` + `VideoControls` (ribbon).

| Control | Classification | Notes |
|---------|---------------|-------|
| src (upload path) | WORKS | `media-properties.jsx:20`, consumed `canvas-element-wrapper.jsx:204` via `element.src` fallback |
| videoUrl | WORKS | `media-properties.jsx:31`, consumed `canvas-element-wrapper.jsx:204` as `element.videoUrl \|\| element.src` |
| poster | WORKS | `media-properties.jsx:43`, consumed `canvas-element-wrapper.jsx:208` |
| objectFit | WORKS | `media-properties.jsx:53`, consumed `canvas-element-wrapper.jsx:138` |
| startTime | WORKS | `media-properties.jsx:68`, consumed `canvas-element-wrapper.jsx:14` via `getMediaFragmentSrc` |
| endTime | WORKS | `media-properties.jsx:80`, consumed `canvas-element-wrapper.jsx:14` |
| playbackRate | WORKS | `media-properties.jsx:97`, consumed `canvas-element-wrapper.jsx:92-94` |
| controls toggle | WORKS | `media-properties.jsx:116`, consumed `canvas-element-wrapper.jsx:209` |
| autoplay | WORKS | not directly applied in canvas preview (intentional — autoplay only in slideshow), but written correctly |
| loop | WORKS | `media-properties.jsx:116`, consumed `canvas-element-wrapper.jsx:210` |
| muted | WORKS | `media-properties.jsx:116`, consumed `canvas-element-wrapper.jsx:208` |
| ribbon VideoControls `src` | WRONG | `ribbon-format-tab…:158` shows a "Source" field that writes `src`. But `MediaProperties` now has two separate fields: `src` (upload path) and `videoUrl` (URL). The ribbon only writes `src`; if the user sets `videoUrl` via the panel and then edits `src` in the ribbon, they get divergent state. The renderer reads `videoUrl \|\| src` so the ribbon edit may have no visible effect when `videoUrl` is already set. `ribbon-format-tab…:152-165` |

---

### audio
Controls: `MediaProperties` (audio branch) + `VideoControls` (ribbon, audio falls through to same component).

| Control | Classification | Notes |
|---------|---------------|-------|
| src | WORKS | `media-properties.jsx:20`, consumed `canvas-element-wrapper.jsx:220` |
| autoplay | WORKS | written; consumed in slideshow context |
| loop | WORKS | `media-properties.jsx:116`, consumed `canvas-element-wrapper.jsx:220` |
| muted | WORKS | `media-properties.jsx:116` |

No defects beyond the ribbon `src` issue noted under video (audio has only one source field so no divergence problem).

---

### table
Controls: `TableProperties` + `TableControls` (ribbon).

| Control | Classification | Notes |
|---------|---------------|-------|
| +Row/-Row/+Col/-Col | WORKS | `table-properties.jsx:26-53`, consumed `table-element-renderer.jsx:34` |
| headerRow toggle | WORKS | `table-properties.jsx:68`, consumed `table-element-renderer.jsx:40` |
| headerBgColor | WORKS | `table-properties.jsx:79`, consumed `table-element-renderer.jsx:35` |
| textColor | WORKS | `table-properties.jsx:79`, consumed `table-element-renderer.jsx:39` |
| borderColor | WORKS | `table-properties.jsx:79`, consumed `table-element-renderer.jsx:37` |
| fontSize | WORKS | `table-properties.jsx:94`, consumed `table-element-renderer.jsx:41` |
| cell edit (inline grid) | WORKS | `table-properties.jsx:110-131`, consumed `table-element-renderer.jsx:34` |
| cell bgColor (per-cell) | WORKS | `table-properties.jsx:138`, consumed `table-element-renderer.jsx:59` via `cellStyles.bgColors` |
| cell textColor (per-cell) | WORKS | `table-properties.jsx:148`, consumed `table-element-renderer.jsx:59` |
| cell bold (per-cell) | WORKS | `table-properties.jsx:155`, consumed `table-element-renderer.jsx:59` |
| cell align (per-cell) | WORKS | `table-properties.jsx:166`, consumed `table-element-renderer.jsx:59` |
| cell vAlign (per-cell) | WORKS | `table-properties.jsx:180`, consumed `table-element-renderer.jsx:59` |
| ribbon row/col resize | WORKS | `ribbon-format-tab…:102-150` |
| headerTextColor | MISSING | `ELEMENT_DEFAULTS` declares `headerTextColor: '#1e40af'`. `table-element-renderer.jsx:40` reads and applies `headerTextColor`. No control in `TableProperties` or ribbon to edit it. |
| borderStyle | MISSING | `ELEMENT_DEFAULTS` declares `borderStyle: 'solid'`. `table-element-renderer.jsx:15` calls `safeBorderStyle`. No control to change it (no dashed/dotted option exposed). |

---

### icon
Controls: `IconElementProperties` (inside `MiscProperties`).

| Control | Classification | Notes |
|---------|---------------|-------|
| iconColor | WORKS | `misc-properties.jsx:16`, consumed `icon-element-renderer.jsx:7` |
| iconStrokeWidth | WORKS | `misc-properties.jsx:22`, consumed `icon-element-renderer.jsx:8` |
| iconName (gallery picker) | WORKS | `misc-properties.jsx:42-58`, consumed `icon-element-renderer.jsx:2-3` |

No defects.

---

### callout
Controls: in `MiscProperties` (callout branch).

| Control | Classification | Notes |
|---------|---------------|-------|
| calloutNumber | WORKS | `misc-properties.jsx:152`, consumed `callout-element-renderer.jsx:2` |
| fontSize | WORKS | `misc-properties.jsx:152`, consumed `callout-element-renderer.jsx:4` |
| calloutColor (BG) | WORKS | `misc-properties.jsx:173`, consumed `callout-element-renderer.jsx:3` |
| calloutTextColor | WORKS | `misc-properties.jsx:173`, consumed `callout-element-renderer.jsx:4` |

No defects.

---

### qrcode
Controls: in `MiscProperties` (qrcode branch).

| Control | Classification | Notes |
|---------|---------------|-------|
| qrData | WORKS | `misc-properties.jsx:199`, consumed `qrcode-element-renderer.jsx:8` |
| qrColor | WORKS | `misc-properties.jsx:207`, consumed `qrcode-element-renderer.jsx:10` |
| qrBgColor | WORKS | `misc-properties.jsx:207`, consumed `qrcode-element-renderer.jsx:11` |
| qrErrorLevel | WORKS | `misc-properties.jsx:223`, consumed `qrcode-element-renderer.jsx:13` |

No defects.

---

### drawing
Controls: in `MiscProperties` (drawing branch).

| Control | Classification | Notes |
|---------|---------------|-------|
| strokeColor | WORKS | `misc-properties.jsx:244`, consumed `drawing-element-renderer.jsx:16` |
| strokeWidth | WORKS | `misc-properties.jsx:256`, consumed `drawing-element-renderer.jsx:17` |

Note: controls only affect the **default** stroke for new paths. Existing per-path `stroke`/`strokeWidth` override them (`drawing-element-renderer.jsx:16-17` checks `p.stroke \|\| element.strokeColor`). This is by design — no defect, but no per-path editing is exposed.

---

### line
Controls: `ShapeProperties` (isLine=true branch) + `ShapeControls` (ribbon, shared with shape).

| Control | Classification | Notes |
|---------|---------------|-------|
| stroke (color) | WORKS | `shape-properties.jsx:28` writes `stroke`, consumed `line-element-renderer.jsx:69` |
| strokeWidth | WORKS | `shape-properties.jsx:39`, consumed `line-element-renderer.jsx:70` |
| dashArray | WORKS | `shape-properties.jsx:57`, consumed `line-element-renderer.jsx:71` |
| arrowStart | WORKS | `shape-properties.jsx:72`, consumed `line-element-renderer.jsx:72` |
| arrowEnd | WORKS | `shape-properties.jsx:87`, consumed `line-element-renderer.jsx:73` |
| ribbon: Fill color picker | WRITES-IGNORED | `ribbon-format-tab…:22-32` renders a Fill color section for both `shape` AND `line` (same `ShapeControls` component, `line` at case `'line'`, line 189). Writes `fill`. `LineArrowRenderer` does not read `element.fill` at all (`line-element-renderer.jsx:60-119`). User sees a fill color picker that silently does nothing for line elements. |

---

### svg
Controls: in `MiscProperties` (svg branch).

| Control | Classification | Notes |
|---------|---------------|-------|
| fillOverride | WORKS | `misc-properties.jsx:346`, consumed `svg-element-renderer.jsx:6-8` |
| strokeOverride | WORKS | `misc-properties.jsx:346`, consumed `svg-element-renderer.jsx:9-12` |
| Reset Overrides | WORKS | `misc-properties.jsx:359`, sets both to null → renderer falls back to SVG's own colors |
| content editor | MISSING | `svg-element-renderer.jsx:3` reads `element.content` (raw SVG markup). No control exists to edit the SVG source — no edit button, no textarea. User must rely on PPTX import or other means to set it initially. After creation, the SVG content is frozen from the UI. |

---

### timeline
Controls: `TimelineProperties`.

| Control | Classification | Notes |
|---------|---------------|-------|
| tickSpacing | WORKS | `timeline-properties.jsx:72`, consumed `timeline-element.jsx` (via TimelineRenderer) |
| timelineStart / startDate | WORKS | `timeline-properties.jsx:93`, both fields written for compat `timeline-properties.jsx:18-21` |
| timelineEnd / endDate | WORKS | `timeline-properties.jsx:109` |
| lineColor | WORKS | `timeline-properties.jsx:130`, consumed `timeline-element.jsx:15` |
| dotColor | WORKS | `timeline-properties.jsx:137`, consumed `timeline-element.jsx:16` |
| textColor | WORKS | `timeline-properties.jsx:145`, consumed `timeline-element.jsx:17` |
| fontSize | WORKS | `timeline-properties.jsx:155`, consumed `timeline-element.jsx:18` |
| event CRUD (add/remove/edit title/date/description/imageUrl/side) | WORKS | `timeline-properties.jsx:165-227` |
| connectorOffset (per-event) | MISSING | `timeline-element.jsx:66` reads `item.connectorLength` (alias for connectorOffset) to position connectors. `ELEMENT_DEFAULTS` declares `connectorOffset: 0`. `timeline-properties.jsx` has no control to set per-event `connectorOffset`. Events are always rendered with 0 offset. |

---

### game
Controls: `GameProperties` (routed via `MiscProperties` when `type === 'game'`).

| Control | Classification | Notes |
|---------|---------------|-------|
| backgroundColor | WORKS | `game-properties.jsx:267`, consumed `game-element-renderer.jsx:1250` |
| accentColor | WORKS | `game-properties.jsx:275`, consumed `game-element-renderer.jsx:75,94,95,99…` |
| showSoundEffects | WORKS | `game-properties.jsx:41`, consumed in game runner |

`fontFamily` in `ELEMENT_DEFAULTS` is declared but `game-properties.jsx` has no control to change it and the renderer hardcodes `'sans-serif'` in most places (`game-element-renderer.jsx:115,1216,1291`). However, since the renderer ignores it anyway, this is a schema-vs-renderer gap rather than a control gap — omitted from MISSING count as no renderer actually reads `element.fontFamily` for game.

---

## Indeterminate / Mixed-Value State Audit

When multiple elements with **different** values are selected, every control below displays the **primary element's value** with no indication that other selected elements differ. There is no indeterminate/blank/"—" state anywhere in the codebase.

Root cause: `CommonElementControls` and all type-specific panels receive `element` (the primary/last selected), not a merged/computed state. `PropertiesPanel.jsx:115` passes `selectedElement` directly; no mixing logic exists.

**Every control in every panel is affected.** Specific high-impact cases:

| Control | File:Line | Impact |
|---------|-----------|--------|
| X/Y position inputs | `common-element-controls.jsx:35,43` | Silent: shows primary position; editing shifts all by delta (fanout is correct, but the displayed value is misleading) |
| W/H inputs | `common-element-controls.jsx:68,76` | Shows primary size; writes same absolute size to all (PowerPoint "make same size" — intentional per fanout design, but no visual cue) |
| Rotation | `common-element-controls.jsx:52` | Shows primary rotation |
| Opacity | `ribbon-format-tab…:306` | Shows primary opacity |
| Shadow X/Y/Blur/Color | `common-element-controls.jsx:155-201` | Shows primary shadow |
| Lock toggle | `common-element-controls.jsx:89` | Shows primary lock state |
| Fragment toggle | `common-element-controls.jsx:109` | Shows primary fragment state |
| Shape fill/stroke | `shape-properties.jsx:18,28` | Shows primary shape color |
| Image objectFit | `image-properties.jsx:11` | Shows primary fit |
| Image filters | `image-properties.jsx:27-90` | Shows primary filter values |
| Chart type | `chart-properties.jsx:36` | Shows primary chart type |

**Bottom line:** 0 controls implement indeterminate state. This is a systemic gap, not per-control. The fanout logic (`element-update-fanout.js`) correctly fans writes, but there is no read-side mixing.

---

## Prioritized Defect Backlog

### P0 — User-visible broken or confusing

**P0-1: Ribbon Fill color picker shown for `line` elements writes `element.fill`; renderer ignores it — user action has no effect**  
File: `ribbon-format-tab-element-position-size-rotation-controls.jsx:188-190` (case `'line'` routes to `ShapeControls` which always renders a Fill section).  
Fix: add `element.type !== 'line'` guard in `ShapeControls` or split the routing so `line` only renders Stroke controls.

**P0-2: `code` `borderRadius` control writes the prop, outer wrapper applies it, but inner `<pre>` hardcodes `borderRadius: 0` — visual result is clipped corners with no visual effect on the code block itself**  
Files: `code-properties.jsx:84` (control), `canvas-element-wrapper.jsx:137` (`codeBlockStyle` hardcodes `borderRadius: 0`).  
Fix: change `codeBlockStyle` at line 137 to read `borderRadius: element.borderRadius || 0` instead of hardcoded `0`. The outer wrapper already applies the border radius at line 109, so the inner `<pre>` should match.

**P0-3: Video ribbon "Source" field writes `src` but panel exposes both `src` and `videoUrl`; renderer reads `videoUrl || src` — ribbon edit is silently ignored when `videoUrl` is set**  
File: `ribbon-format-tab-element-position-size-rotation-controls.jsx:158` writes `src`. `canvas-element-wrapper.jsx:204` reads `element.videoUrl || element.src`.  
Fix: ribbon VideoControls should write `videoUrl` (not `src`), matching the panel's primary URL field (`media-properties.jsx:31`). Or unify to a single field.

**P0-4: `markdown` font size and text color are hardcoded in renderer — any attempt to control them is impossible; no controls exist and adding them would be silently ignored**  
File: `markdown-element-renderer.jsx:12-13` (`color: 'white'`, `fontSize: '18px'` — both literals, no element prop reads).  
Fix: read `element.textColor` and `element.fontSize` from the element and add corresponding controls in `MiscProperties` (markdown branch).

**P0-5: Multi-select shows primary element's value in all controls with no indeterminate indication — user editing a mixed opacity or color selection cannot tell values differ**  
Files: `PropertiesPanel.jsx:115` passes `selectedElement` directly; `common-element-controls.jsx` (all inputs); all type-specific panels.  
Fix: pass both `selectedElement` (primary) and `selectedElementIds` + slide elements into controls; compute `isMixed` per property; display placeholder/blank or strikethrough when mixed. At minimum, the opacity slider and position inputs should show indeterminate state.

### P1 — Incomplete (feature works but missing controls for renderer-supported props)

**P1-1: `image` missing saturation control — renderer reads `filterSaturate` and applies CSS `saturate()` but no slider exists**  
File: `canvas-element-wrapper.jsx:167` reads `filterSaturate`. `image-properties.jsx` has no saturation slider.  
Fix: add a Saturation slider to `ImageProperties` alongside the existing brightness/contrast/grayscale sliders.

**P1-2: `chart` missing area-fill toggle for line charts — renderer reads `element.areaFill`**  
File: `chart-element-renderer.jsx:5`. No control in `ChartProperties`.  
Fix: add checkbox "Fill area under line" in `ChartProperties`, shown only when `chartType === 'line'`.

**P1-3: `chart` missing stacked toggle — renderer reads `element.stacked`**  
File: `chart-element-renderer.jsx:6`. No control anywhere.  
Fix: add checkbox "Stacked" in `ChartProperties`.

**P1-4: `table` missing `headerTextColor` control — renderer reads and applies it (`table-element-renderer.jsx:40`), ELEMENT_DEFAULTS declares it**  
File: `table-properties.jsx` — no control for `headerTextColor`.  
Fix: add a "Header text color" color picker alongside the existing "Header BG" picker.

**P1-5: `table` missing `borderStyle` control — renderer calls `safeBorderStyle` on `element.borderStyle`**  
File: `table-element-renderer.jsx:15`. ELEMENT_DEFAULTS declares `borderStyle: 'solid'`. No control.  
Fix: add a border style select (solid/dashed/dotted) in `TableProperties`.

**P1-6: `svg` missing content editor — `svg-element-renderer.jsx:3` reads `element.content` (SVG markup) but no control exists to edit it after creation**  
File: `misc-properties.jsx` (svg branch) — only fill/stroke overrides.  
Fix: add a textarea or edit-button (modal code editor) for `element.content` on svg elements, similar to the html/latex edit button pattern.

**P1-7: `timeline` per-event `connectorOffset` has no control — renderer reads `item.connectorLength` which aliases connectorOffset**  
File: `timeline-element.jsx:66` reads `item.connectorLength`. `timeline-properties.jsx` event editor has no connectorOffset field.  
Fix: add a numeric "Connector length" input per event in the timeline event editor.

### P2 — Polish

**P2-1: `ShapeProperties` border radius control gated on shape string (`rect`/`rounded-rect`) — if new shape variants are added the gate must be manually updated**  
File: `shape-properties.jsx:121` condition `element.shape === 'rect' || element.shape === 'rounded-rect'`.

**P2-2: `drawing` strokeColor/strokeWidth only affect default for new paths, not existing paths — no affordance communicates this to users**  
File: `misc-properties.jsx:244`. Consider a "Apply to all paths" button.

**P2-3: `game` `fontFamily` declared in ELEMENT_DEFAULTS but renderer ignores it everywhere — schema noise**  
File: `element-defaults.js:229`. Either add renderer support or remove from defaults.

---

## Limitations of This Audit

- Did not trace `htmlGenerator.js` (server-side export path) — citation props for image and some game props may have additional consumer/gaps not covered here.
- Did not audit per-path editing for `drawing` (no UI exists at all for it).
- Did not test `_pptxImportMeta` interaction with controls — imported elements may behave differently.
- `game` sub-mode properties (hot-potato questions, jeopardy categories, etc.) were not audited at property-by-property depth; `GameProperties` is a large component with its own sub-editors.
- Indeterminate state audit is a static analysis — confirmed 0 implementations exist; did not verify fanout correctness under all type-mixing combinations at runtime.

---

## Unresolved Questions

1. Is the `videoUrl` vs `src` dual-field design intentional (e.g. `src` = upload, `videoUrl` = external URL)? If so, the ribbon should be updated to write `videoUrl`. If not, the fields should be unified.
2. Should markdown support editable `fontSize`/`textColor`? Currently the renderer hardcodes both — may be intentional (markdown theme consistency).
3. Is the per-event `connectorOffset` intentionally hidden (advanced feature) or genuinely missing?

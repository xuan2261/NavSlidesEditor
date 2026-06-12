# Element Render Pipeline — Fidelity Review (R1)

Scope: edit → JSON → render → reveal HTML. Read-only review.
Files: shared/src/{htmlGenerator,element-renderers,shapeUtils,presenterTools,content-safety,shared-color-utils,design-tokens}.js; client/src/data/element-defaults.js; client/src/utils/element-factory.js; client/src/components/canvas/element-renderers/*; client/src/components/canvas/canvas-element-wrapper.jsx; client/src/components/timeline-element.jsx.

Focus: editor-canvas (client JSX) vs exported HTML (shared) divergence, dropped props, null guards, registry completeness.

---

## Summary by severity
- Critical: 0
- Important: 4
- Minor: 4

---

## Important

### I1 — Editor canvas renders 7 shape types as plain rectangles; export draws them correctly
- Editor: `client/src/components/canvas/element-renderers/shape-element-renderer.jsx:90-165` (`renderShape` switch). Cases handled: `rect, rounded-rect, circle, triangle, diamond, arrow-right, star`, else `default → <rect>`.
- Export: `shared/src/shapeUtils.js:126-187` (`shapeSvgString` switch) additionally handles `hexagon, pentagon, cloud, cylinder, parallelogram, trapezoid, bracket`.
- Shape picker `SHAPES` (`shapeUtils.js:1-17`) offers all of: hexagon, pentagon, cloud, cylinder, parallelogram, trapezoid, bracket. A user can insert any of these.
- Impact: insert a hexagon (or pentagon/cloud/cylinder/parallelogram/trapezoid/bracket) → it appears as a RECTANGLE while editing, but renders as the correct shape in present/export. WYSIWYG broken; user cannot trust the canvas. `bracket` also has special stroke handling in export only.
- Fix direction: bring the editor `renderShape` switch to parity with `shapeSvgString` (ideally share the path-geometry generation so the two never drift), or render via the same SVG-string emitter inside the editor.

### I2 — `'auto'` color sentinel not resolved in several editor JSX renderers → invalid CSS in editor only
The token layer (`shared/src/design-tokens.js`) makes `'auto'` resolve to `var(--ns-*)` via `resolveColorField`. ELEMENT_DEFAULTS ships many color fields as `'auto'` (`client/src/data/element-defaults.js`), and `createElement` (`client/src/utils/element-factory.js:25-32`) persists `'auto'` verbatim. The shared export path calls `resolveColorField` everywhere, but these editor renderers use the raw value:
- `icon-element-renderer.jsx:5` — `const color = element.iconColor || '#ffffff'` (default `iconColor:'auto'`) → `stroke="auto"` (invalid SVG paint → lacuna `none`): new icon is invisible while editing.
- `line-element-renderer.jsx:69` — `const color = element.stroke || '#ffffff'` (default `stroke:'auto'`) → path `stroke="auto"` + marker `fill="auto"` invalid: new line/arrow invisible/black while editing.
- `drawing-element-renderer.jsx:16` — `stroke={p.stroke || element.strokeColor || '#ffffff'}` (default `strokeColor:'auto'`).
- `callout-element-renderer.jsx:4` — `const textColor = element.calloutTextColor || '#ffffff'` (default `calloutTextColor:'auto'`) → `color:auto` ignored (inherits).
- `timeline-element.jsx:15-17` — `lineColor/dotColor/textColor` taken raw (defaults `'auto'`) → `stroke="auto"/fill="auto"` invalid.
- `canvas-element-wrapper.jsx:118` — text `color: element.textColor || 'white'` (text default `textColor:'auto'`) → `color:auto` ignored; editor text color also never honors deck/slide tokens.
- Correct (already use `resolveColorField`): `shape-element-renderer.jsx`, `table-element-renderer.jsx`.
- Impact: freshly-created icon/line/drawing/timeline/callout/text elements (or any deck saved with `'auto'`) render wrong or invisible on the editor canvas while exporting correctly — a direct editor↔export divergence, and tokens/theming never apply in the editor for these types.
- Fix direction: wrap each color field in `resolveColorField(value, type, field)` (and gate token-var values through `svgPaint`/style as the shared path does) so the editor uses the same `var(--ns-*)` the export emits.

### I3 — Timeline item images are dropped on export
- Editor: `timeline-element.jsx:130-139` and `:146-155` render `<image href={item.image} …>` for each event.
- Export: `shared/src/element-renderers.js:590-609` (`renderTimeline`) iterates `items` and emits line/circle/label/description/date `<text>` but never renders `item.image`.
- Impact: a timeline authored with event images shows them in the editor; the present/PDF/share export silently drops every image. `connectorLength`, label, description, date survive — only images are lost.
- Fix direction: add `<image>` emission to `renderTimeline` mirroring the editor's top/bottom placement math.

### I4 — `game` element silently dropped from exported/print HTML
- `RENDERERS` (`shared/src/element-renderers.js:654-673`) has no `game` entry; `renderElement` (`:691-693`) returns `''` for any type without a renderer.
- `game` is a canonical type (`element-defaults.js:224`) and has an editor renderer (`registry.js:13,28`).
- Impact: a slide containing a game element exports to nothing — no content, no placeholder. For static export (PDF/HTML/share) the region just vanishes with no indication.
- Fix direction: even if live game interactivity can't be exported, emit a static placeholder (title/background) for `game` like `renderPluginFallback` does, so the slide area isn't blank.

---

## Minor

### M1 — `renderSvg` overrides corrupt multi-paint SVGs and miss `style="fill:"`
- `shared/src/element-renderers.js:514-516`: `svgContent.replace(/fill="[^"]*"/g, …)` replaces EVERY `fill="…"` (including gradient stop colors inside `<defs>`), and ignores `fill` set via `style="fill:…"`. Same for stroke.
- Impact: `fillOverride`/`strokeOverride` on a complex SVG can recolor unintended sub-paths or silently no-op when colors live in `style`. Author-trusted content, so not a security issue — fidelity only.
- Fix direction: scope the replacement (e.g. only top-level element fills) or document the single-fill expectation.

### M2 — Gradient `stop.offset` unit convention differs between background and shape gradients
- Background: `htmlGenerator.js:27` treats `offset > 1` as already-percent else multiplies by 100.
- Shape: `shapeUtils.js:89` (`gradientDefsString`) passes `Number(s.offset)` straight through as an SVG 0..1 offset.
- Impact: two gradient subsystems interpret `offset` differently; safe today because they don't share data, but a shared editing control feeding both could mis-map. Worth a comment or a single normalizer.

### M3 — `renderText` always emits `color:white` before the resolved color
- `element-renderers.js:141`: style is `…color:white${tc}…` where `tc` is `;color:${resolved}`. Two `color` declarations; the later wins so output is correct, but the redundant `white` is dead and can mislead future edits. Cosmetic.

### M4 — Line marker id derived from `el.id.slice(0,8)` can collide
- `element-renderers.js:480` (`uid = (el.id || 'l').slice(0,8)`) and editor `line-element-renderer.jsx:74`. Two lines whose ids share the first 8 chars produce identical `ms-/me-` marker ids in one document; SVG `url(#…)` resolves to the first, so arrowheads can take the wrong color/shape. UUIDs make collision unlikely but the 8-char truncation is an unnecessary risk.
- Fix direction: use the full id (sanitized) for the marker id.

---

## Registry completeness check (canonical 19)
ELEMENT_DEFAULTS (19): text, image, shape, code, latex, html, markdown, chart, video, audio, table, icon, callout, qrcode, drawing, line, svg, timeline, game.
- Shared `RENDERERS` (18): all except **game** (text/image/code/html/video/audio handled by their renderers; game missing → I4).
- Client: registry (13) + inline in `canvas-element-wrapper.jsx` (text/image/html/code/video/audio) = all 19 present. No client gap.

## Null/guard notes (no defect)
- `renderElement` returns `''` for unknown type (no crash) — fine except it masks the game gap (I4).
- `renderSlideElements` guards `slide.elements || []`, sorts a copy. OK.
- `renderLine`/`renderTimeline` guard missing coords/dates with `??` and parse fallbacks. OK.

## Unresolved questions
1. Is `game` intentionally export-excluded, or should it get a static placeholder (I4)?
2. Are timeline event images expected to survive PDF/share export (I3)? If yes this is a straightforward gap.
3. Were the editor JSX renderers (icon/line/drawing/callout/timeline/text) intentionally left on raw colors, or missed when shape/table were migrated to `resolveColorField` (I2)?

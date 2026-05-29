---
phase: 4
title: "R3 Gradient Parse + Shape SVG Render + Angle"
status: completed
priority: P0
effort: "2d"
dependencies: [1]
---

# Phase 4: R3 Gradient Parse + Shape SVG Render + Angle

## Overview
Fix the gradient family (R3): #3 stops collapse to 0% (every gradient becomes a solid color), #4 shape gradient emits invalid SVG paint (`fill="gradient"`) while `fillGradient` is dead data, #8 gradient angle is off ~90° (OOXML vs CSS reference). Per decision: render a **proper SVG `<linearGradient>`** for shapes (consume `fillGradient`), not a solid-color fallback.

## Key Insights (verified)
- `utils-color.js:14-15`: `offsetSource = stop.offset ?? stop.pos ?? ...`; parser emits `pos: "50%"` (string). `Number("50%") = NaN` → every stop `offset = 0`. Repro confirmed: `linear-gradient(90deg, #fff 0%, #888 0%, #000 0%)`.
- `utils-color.js:6`: `colorValue` returns literal string `'gradient'` for gradient fills.
- `map-shape.js:88`: `fill: colorValue(...)` → `'gradient'`; `:103` `mapped.fillGradient = gradientBackground(...)`.
- `fillGradient` has **zero consumers** (grep clean across `shared/`, `client/`).
- `shapeUtils.js:64`: `const fill = el.fill || '#6366f1'` → used as SVG paint → `fill="gradient"` invalid → default/no fill.
- `shape-element-renderer.jsx:37` reads fit-meta; its fill path also uses `el.fill` (confirm in step 1).
- Angle: OOXML `ang` is clockwise from East (parser already `/6e4` to degrees). CSS `linear-gradient`: `0deg` = to-top (North), increasing clockwise, so `90deg` = to-right (East). **Both clockwise but different zero-reference.** Two candidate conversions exist and they diverge at 90°/270°: `(90 − θ)` vs `(θ + 90)`. Direction-vector reasoning favors `(θ + 90) % 360` (East θ=0→90 ✓, South θ=90→180 ✓), but OOXML gradient-vector semantics are subtle — **do not hard-code a formula; derive it empirically in step 3** (render a deck with a known left→right gradient, observe required CSS angle, pin the mapping the render demands). `gradientBackground:31` currently copies the raw OOXML angle into `${angle}deg` (no conversion).

## Requirements
- Functional #3: `normalizeGradientStops` parses string `"50%"` → `0.5`; numeric `0.5` and `50` both normalize correctly; missing pos → evenly distributed.
- Functional #4: shapes with gradient fill render an SVG `<linearGradient>` (canvas + shared/export renderers); `fillGradient` is consumed; no `fill="gradient"` literal reaches SVG.
- Functional #8: gradient direction converts OOXML clockwise-from-East to CSS clockwise-from-North via a single `ooxmlAngleToCss(θ)` helper whose mapping is **fixed by the step-3 render observation**, not assumed; SVG gradient vector encodes the same direction as the CSS string.
- Non-functional: stable per-element gradient id (use `el.id`); ≥2 stops always; degenerate (1 stop) → solid.

## Architecture
```
parser stop {pos:"50%", color} ─► normalizeGradientStops ─► {offset:0.5, color}
                                                              │
   ┌──────────────────────────────────────────────────────┘
   ▼ slide-bg path: gradientBackground.gradient = linear-gradient(cssAngle, stops)  (CSS string consumer)
   ▼ shape path:    fillGradient {stops, cssAngle} ─► SVG <defs><linearGradient id=el.id> ─► fill="url(#id)"
```
- `normalizeGradientStops` (utils-color.js:11): strip trailing `%`, `parseFloat`; if value had `%` or `>1`, divide by 100; clamp [0,1].
- `gradientBackground` (utils-color.js:23): introduce `ooxmlAngleToCss(θ)` and apply it; the exact mapping is pinned by the step-3 render observation (candidates `(θ+90)%360` favored vs `(90−θ+360)%360`; they agree at 0/180, diverge at 90/270). Keep `stops` + `angle:cssAngle` + CSS string.
- Shape SVG: add a gradient-def emitter shared by `shapeUtils.js` (server/export) and `shape-element-renderer.jsx` (canvas). Convert angle → SVG `x1,y1,x2,y2` on the unit square (or `gradientUnits="objectBoundingBox"` + `gradientTransform="rotate(...)"`). When `el.fillGradient` present, fill = `url(#grad-${el.id})` and prepend `<defs>`.
- `map-shape.js`: when fill is gradient, set `mapped.fill` to a sentinel the renderer recognizes (or leave `'gradient'` but have renderers branch on `el.fillGradient` first). **Prefer:** renderers check `el.fillGradient` → use gradient; else fall back to `el.fill`. Keeps `colorValue` unchanged.

## Related Code Files
- Modify: `server/services/pptx-import/mapper/utils-color.js:11-33` (stops parse + angle)
- Modify: `shared/src/shapeUtils.js:61-...` (consume `fillGradient`, emit `<defs><linearGradient>`)
- Modify: `client/src/components/canvas/element-renderers/shape-element-renderer.jsx` (same gradient consumption on canvas)
- Verify: `client/src/utils/export-pptx-basic-renderers.js` (shape export path — gradient or rasterized?)
- Read for context: `node_modules/pptxtojson/dist/index.cjs` (gsLst pos `/1e3+"%"`, rot `/6e4`)
- Tests: `utils-color.test.js`, `shapeUtils` tests (locate/create), shape renderer test

## Implementation Steps
1. **Read renderers:** confirm how `shapeUtils.js` and `shape-element-renderer.jsx` currently turn `el.fill` into paint; decide the shared gradient-def helper signature (`buildSvgGradientDef(el)` → `{defs, fillRef}`).
2. **Red #3:** `utils-color.test.js` using Phase 1 fixture: stops `["0%","50%","100%"]` → offsets `[0,0.5,1]`; angle `0` (OOXML) → cssAngle `90`. Run — fails (NaN→0, angle 0).
3. **Green #3/#8:** fix `normalizeGradientStops` string parse. For the angle: render a deck with a known left→right (OOXML θ=0) and top→bottom (θ=90) gradient, observe the CSS angle that reproduces each direction, and pin `ooxmlAngleToCss` to the observed mapping (do not assume `90−θ`). Slide-bg gradient now correct.
4. **Red #4:** shape-renderer test: a shape with `fillGradient` emits `<linearGradient id="grad-...">` and `fill="url(#grad-...)"`; no `fill="gradient"` substring. Run — fails.
5. **Green #4:** implement `buildSvgGradientDef`; wire into `shapeUtils.js` + `shape-element-renderer.jsx`; renderers branch on `el.fillGradient` first.
6. **Refactor:** dedupe gradient-def logic into one shared helper (DRY across shared/client); ensure SVG id uniqueness; `fill="gradient"` literal cannot reach output (assert).

## Tests (this phase)
- stops: `"50%"`→0.5; `0.5`→0.5; `50`→0.5; missing → even distribution
- angle anchors (both candidate formulas agree): OOXML 0→css 90, 180→css 270
- angle divergent (90/270): assert against the **step-3 observed** value once pinned (e.g. if render shows `θ+90`, lock 90→180, 270→0); test references the chosen helper, not a raw literal
- shape gradient: `<linearGradient>` present, `fill="url(#...)"`, two-stop minimum, unique id
- regression lock: no output contains `fill="gradient"`
- slide-bg gradient string has non-zero distinct stop offsets

## Success Criteria
- [ ] Multi-stop gradients keep distinct offsets (no solid-color collapse)
- [ ] Shape gradients render as real SVG gradients (canvas + export)
- [ ] Direction matches PPTX orientation (angle test green)
- [ ] No `fill="gradient"` literal anywhere; `fillGradient` consumed
- [ ] `npm run test` (color + shape renderer) green; lint clean

## Risk Assessment
- Risk: SVG angle→vector math wrong. Mitigation: dedicated wrap-around angle tests; visual spot-check Phase 8.
- Risk: canvas vs export gradient divergence. Mitigation: single shared `buildSvgGradientDef` helper used by both.
- Risk: id collisions across slides. Mitigation: namespace with `el.id` (uuid).

## Security Considerations
- Stop colors pass through existing `svgAttr` escaping; gradient id derived from internal uuid, not user string.

## Next Steps
- Phase 8 visual audit confirms gradient fidelity on a real gradient deck.

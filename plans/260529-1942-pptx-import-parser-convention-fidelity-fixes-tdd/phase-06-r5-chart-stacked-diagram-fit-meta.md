---
phase: 6
title: "R5 Chart Stacked/Area + Diagram Fit-Meta + Font Scale"
status: completed
priority: P1
effort: "1.5d"
dependencies: [1, 2]
---

# Phase 6: R5 Chart Stacked/Area + Diagram Fit-Meta

## Overview
Fix #6 (stacked/area charts render with wrong data semantics) and #9 (diagram node text has no scale-aware font and no overflow clamp). Root cause R5 — the mapper emits intent (`_pptxChartMeta.grouping`) the renderer never consumes, and diagram nodes skip the `_pptxImportMeta` fit-meta that text/shape elements get. Depends on Phase 2 (`ptToCanvasPx` shared helper).

## Key Insights (verified)
- `chart-output-to-navslides-mapper.js:20-21`: `stacked`→'bar', `area`→'bar' (semantics lost).
- `:50` `grouping: element.grouping` stored in `_pptxChartMeta` — **zero consumers** (grep clean).
- `element-renderers.js:213-261` `renderChart`: never sets Chart.js `scales.*.stacked`; `fill: chartType==='line' ? false : undefined` (no area fill).
- `map-diagram.js:21` `extractTextMetadata(nodeHtml, node)` — after Phase 2 this uses raw pt correctly, but `:27-44` returns the node with **no** `_pptxImportMeta`, so no `fitFontSizePx` clamp → overflow on long node text.
- Diagram node box IS scaled (`:29-32`), so geometry is fine; only font-fit is missing.

## Requirements
- Functional #6: stacked bar → renders stacked (Chart.js `scales.x.stacked && scales.y.stacked`); area → renders as filled line (`type:'line'`, dataset `fill:true`).
- Functional #6: imported charts use the **same fields a native NavSlides chart would** (round-trip safe) — confirmed in investigation step.
- Functional #9: diagram nodes carry `_pptxImportMeta` via `buildPptxTextImportMeta(box, node, {textLength})` so font gets the fit clamp; font uses `ptToCanvasPx` (Phase 2).
- Non-functional: non-stacked/non-area charts unchanged; diagrams without text unchanged.

## Architecture
**Chart (investigation-gated):**
```
mapChartType: stacked → 'bar' + mapped.stacked = true
              area    → 'line' + mapped.areaFill = true
renderChart: if el.stacked → scales.x.stacked=true, scales.y.stacked=true
             if el.areaFill → datasets[].fill = true (chartType 'line')
```
Set explicit top-level fields (`stacked`, `areaFill`) the renderer reads — do **not** make the renderer branch on `_pptxChartMeta` (meta is diagnostic, not behavioral). Step 1 confirms whether the native editor already has a stacked option to reuse those exact field names.

**Diagram:**
```
mapDiagramNode: box = {width,height from scaled dims}
                node._pptxImportMeta = buildPptxTextImportMeta(box, {fontSize: ptToCanvasPx(...)}, {textLength})
```
Reuse Phase 2 helpers; no new conversion logic.

## Related Code Files
- Modify: `server/services/pptx-import/chart-output-to-navslides-mapper.js:11-26,28-56` (emit `stacked`/`areaFill`)
- Modify: `shared/src/element-renderers.js:213-261` (consume stacked + area fill)
- Verify: `client/src/components/.../chart-*` native chart renderer + chart editor schema (field-name parity)
- Modify: `server/services/pptx-import/mapper/map-diagram.js:21,27-44` (add fit-meta, reuse `ptToCanvasPx`)
- Read for context: `client/src/data/element-defaults.js` (chart defaults)
- Tests: `chart-output-to-navslides-mapper` tests (locate/create), `map-diagram.test.js`, chart renderer test

## Implementation Steps
1. **Investigate (gate):** does the native chart editor support stacked/area? Grep chart store/defaults/renderer. Decide field names: reuse native `stacked`/`fill` if they exist, else introduce `stacked`/`areaFill` and document. Confirm Chart.js version supports the stacked scales API used.
2. **Red #6:** chart mapper test (Phase 1 fixture, `grouping:'stacked'`, `chartType:'stackedBar'`) → `{chartType:'bar', stacked:true}`; area fixture → `{chartType:'line', areaFill:true}`. Renderer test: stacked chart srcdoc/config sets `scales.x.stacked && scales.y.stacked`. Run — fails.
3. **Green #6:** emit fields in mapper; consume in `renderChart` (both `forPrint` config and iframe srcdoc paths — note `renderChart` has two config builders, update both).
4. **Red #9:** `map-diagram.test.js` — node with text → result has `_pptxImportMeta.fitFontSizePx` finite and ≤ node height fit; font uses scale. Run — fails (no meta).
5. **Green #9:** add `buildPptxTextImportMeta` to `mapDiagramNode`; ensure font via `ptToCanvasPx`.
6. **Refactor:** ensure `_pptxChartMeta.grouping` either now backs `stacked` or is removed if fully redundant (avoid leaving new dead data).

## Tests (this phase)
- stacked fixture → `chartType:'bar', stacked:true`; renderer config has both axes stacked
- area fixture → `chartType:'line', areaFill:true`; datasets fill true
- plain bar → no `stacked` field; plain line → no `areaFill`
- diagram node text → `_pptxImportMeta.fitFontSizePx` finite, font scale-aware (18pt→18 at scale 1.0)
- diagram node without text → no fit-meta forced

## Success Criteria
- [ ] Stacked bars render stacked; area renders filled line
- [ ] Imported stacked/area charts use native-compatible fields (round-trip safe)
- [ ] Diagram node text gets fit clamp; font scale-correct
- [ ] Both `renderChart` config paths updated (print + iframe)
- [ ] `npm run test` (chart mapper + diagram + renderer) green; lint clean

## Risk Assessment
- Risk (confidence ~80%): native chart schema may lack stacked/area. Mitigation: step-1 investigation gate; introduce + document fields if absent; ensure editor doesn't choke on unknown fields.
- Risk: `renderChart` has duplicate config logic (print vs live). Mitigation: update both, test both, or refactor to one config builder.
- Risk (confidence ~70%): diagram font scale axis. Mitigation: reuse Phase 2 `ptToCanvasPx` decision (scale.y), no new convention.

## Security Considerations
- Chart config serialized via existing `JSON.stringify` + `<` escaping; no new injection surface.

## Next Steps
- Phase 8 visual audit confirms stacked/area + diagram rendering.

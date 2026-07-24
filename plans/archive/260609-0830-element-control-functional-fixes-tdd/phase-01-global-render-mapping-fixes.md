---
phase: 1
title: "Global Render-Mapping Fixes"
status: completed
priority: P0
effort: "0.5d"
dependencies: []
---

# Phase 1: Global Render-Mapping Fixes

## Overview
Single-point prop-mapping fixes with broad impact: opacity (no-op on 18/19
types), code border-radius (inner `<pre>` overrides), image flip (canvas+reveal
drop it). Highest impact/effort ratio — mostly small additions touching many
element types.

**Red-team correction:** chart rotation is NOT in this phase. `IChartOpts` (the
pptxgenjs chart opts type) has NO `rotate` field (verified
`node_modules/pptxgenjs/types/index.d.ts` — `rotate` exists only on Shape/Image/
Text props). pptxgenjs places charts as a graphicFrame and cannot rotate them.
Writing `rotate` would silently no-op while a test asserting the opt passes —
the classic false-green trap. → chart rotation is an INHERENT limit, documented
in Phase 5, not fixed here.

## Defects Addressed
- **P0-OPACITY** — `element.opacity` never applied for 18/19 types. Canvas wrapper
  `canvas-element-wrapper.jsx:96-114` has no `opacity` key; reveal `buildBaseStyle`
  `shared/src/element-renderers.js:116` likewise. Only `shape` applies it
  internally (canvas `shape-element-renderer.jsx:169`; reveal `renderShape`
  `shared/src/element-renderers.js:185`). User sets 50% → nothing, on canvas AND
  both exports.
- **P0-CODE-RADIUS** — `code` borderRadius written + applied to outer div, but inner
  `codeBlockStyle` hardcodes `borderRadius: 0` at `canvas-element-wrapper.jsx:137`.
- **P0-FLIP** — image `flipH/flipV` honored in pptx
  (`export-pptx-basic-renderers.js:52-53`) but dropped on canvas
  (`canvas-element-wrapper.jsx:170`) and reveal (`shared/src/element-renderers.js:178,181`).

## Requirements
- Functional: setting opacity on ANY type dims it on canvas + reveal + pptx.
  `shape` must NOT double-apply (wrapper + internal). Code radius visible on the
  code block. Flipped image shows flipped on canvas + reveal. Rotated chart
  exports rotated to pptx.
- Non-functional: no regression to existing per-type rendering; shape opacity
  must remain visually identical (apply once, not twice).

## Architecture
- **Opacity (canvas) — MUST NOT dim selection chrome (red-team M1):** the
  `elementWrapperStyle` div (`canvas-element-wrapper.jsx:96-114`) is the container
  whose children ALSO include the selection outline, resize handles, rotation
  handle/guide, and group/fragment badges (`~:229-239`). Putting `opacity` on the
  wrapper fades the handles/outline too — a real regression for all types. Apply
  opacity to the element-CONTENT layer instead: wrap only the rendered content
  (text/image/shape/etc.) in an opacity-bearing layer, leaving handles/outline/
  badges at full opacity. Drop the shape-internal opacity
  (`shape-element-renderer.jsx:169`) so it isn't double-applied via the new
  content layer.
- **Opacity (reveal) — avoid double-apply (red-team M2):** `renderShape` ALREADY
  emits opacity at `shared/src/element-renderers.js:185-186`. Add opacity to
  `buildBaseStyle:116` for the generic types, but REMOVE the `opacityStyle` from
  `renderShape:185` (or exclude shape from buildBaseStyle's opacity) so shape is
  applied exactly once. Test reveal-shape parity (0.5 not 0.25).
- **Opacity (pptx) — shape already done (red-team m1):** `addShapeElement` already
  maps opacity→`transparency` at `export-pptx-basic-renderers.js:108-111`. Scope
  the pptx work to the types that LACK it (image via `ImageProps.transparency`;
  others as supported). NOTE: text-level `transparency` is glyph-fill transparency
  (fades text color), not whole-element opacity — do not claim it dims a text
  block's background. Map `transparency:(1-opacity)*100` only where the opt is the
  correct whole-element semantic; document where pptx can't.
- **Code radius:** `codeBlockStyle` at `:137` → `borderRadius: element.borderRadius || 0`.
- **Flip — target the `<img>`, not the wrapper (red-team m2):** the wrapper
  transform (`:110`) holds `rotate()`; flipping there would mirror the handles too.
  Add `scaleX(-1)`/`scaleY(-1)` to the `<img>` style (`:170`) / `imageWrapperStyle`
  on canvas, and to `renderImage` in reveal. Compose flip+rotation so they don't
  cancel (match pptx rotate/flip semantics).

## Related Code Files
- Modify: `client/src/components/canvas/canvas-element-wrapper.jsx` (add content-opacity layer; codeBlockStyle 137; image `<img>` flip ~170)
- Modify: `client/src/components/canvas/element-renderers/shape-element-renderer.jsx` (remove internal opacity ~169)
- Modify: `shared/src/element-renderers.js` (buildBaseStyle ~116 opacity; remove renderShape:185 double-apply; renderImage flip ~178-181)
- Modify: `client/src/utils/export-pptx-basic-renderers.js` (image transparency mapping; shape already done at 108-111 — no change)
- Create: `client/src/components/canvas/global-render-mapping.test.jsx` (or co-locate per concern)

## Implementation Steps (TDD)
1. **Test first (opacity, canvas content vs chrome — red-team M1):** render a
   `text` element with `opacity:0.5` selected → assert the rendered CONTENT layer
   has `opacity:0.5` AND the selection outline / resize handles do NOT (they stay
   opaque). Render a `shape` with `opacity:0.5` → applied EXACTLY ONCE (0.5 not 0.25).
2. Add a content-opacity layer to the wrapper (excluding handles/outline/badges);
   drop shape-internal opacity (`shape-element-renderer.jsx:169`). Run → green;
   verify handles stay crisp.
3. **Test first (opacity, reveal — no double-apply, M2):** `renderShape({opacity:0.5})`
   output contains opacity ONCE (not nested 0.5×0.5). Generic `buildBaseStyle({opacity:0.5})`
   includes `opacity:0.5`.
4. Add opacity to `buildBaseStyle`; REMOVE `renderShape:185` opacityStyle (single
   source). Run → green; assert shape reveal opacity is 0.5.
5. **Test first (opacity, pptx — re-scoped, m1):** image with opacity 0.5 →
   `addImage` opts include `transparency:50`. (Shape already maps it at 108-111 —
   assert it still does; no new code.) Skip text whole-element opacity (pptx text
   transparency is glyph-only — document, don't fake).
6. Add image transparency mapping; green.
7. **Test first (code radius):** code element `borderRadius:12` → `codeBlockStyle.borderRadius === 12`. Fix `:137`; green.
8. **Test first (flip — `<img>` target, m2):** image `flipH:true` → the `<img>`
   style transform contains `scaleX(-1)` (NOT the wrapper); `renderImage` output
   contains `scaleX(-1)`. Test flipH + rotation compose without canceling. Fix; green.
9. `npm run test` touched files; `npm run lint`.

## Success Criteria
- [ ] Opacity applies once to element CONTENT on canvas (handles/outline stay opaque); shape not double-applied
- [ ] Opacity once in reveal (renderShape no longer double-applies); image transparency in pptx; shape pptx unchanged
- [ ] Code border-radius visible on the code block
- [ ] Image flipH/flipV render on canvas (`<img>`) + reveal (pptx already worked)
- [ ] Chart rotation NOT attempted here (moved to Phase 5 docs as inherent limit)
- [ ] No regression in existing shape/image/chart render tests; lint clean

## Risk Assessment
- **Risk (red-team M1):** opacity on the wrapper dims selection chrome.
  **Mitigation:** content-layer opacity, explicit test that handles stay opaque.
- **Risk (red-team M2):** reveal shape opacity double-applied (buildBaseStyle +
  renderShape:185). **Mitigation:** remove renderShape:185; single-apply test.
- **Risk:** shape canvas opacity double-applied (content layer + internal).
  **Mitigation:** drop shape-internal; assert 0.5 not 0.25.
- **Risk (red-team m2):** flip on wrapper mirrors handles. **Mitigation:** target
  `<img>`; test transform location + flip/rotation compose.
- **Risk (red-team m1):** pptx text transparency is glyph-only, not element bg.
  **Mitigation:** scope pptx opacity to image (+ shape already done); document text limit.

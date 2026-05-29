---
phase: 2
title: "R1 Length-Unit Fix (Font, Table Font, Insets, Acceptance Gate)"
status: completed
priority: P0
effort: "2d"
dependencies: [1]
---

# Phase 2: R1 Length-Unit Fix

## Overview
Fix the user's primary complaint: imported text is ~1.333× too large and overflows its box. Root cause R1 — every font/inset path multiplies pt by `96/72` (96-DPI assumption), but `CANVAS_SIZE = 960×540` is **72 DPI**, so box geometry uses `scale = 1.0` and 1pt must map to 1px. Fixes #1 (text font), #5 (table font), #G (insets), and #F (acceptance gate that currently pins the wrong invariant).

## Key Insights (verified)
- `geometry.js:25` `scale.x = CANVAS_SIZE.width / width = 960/960 = 1.0` for standard 16:9.
- `shared-html-parser.js:22-23` `parseCssLengthToPx('18pt')` → `18 × 96/72 = 24`. **Generic CSS converter assumes 96 DPI** — correct for browser layout, wrong for the 72-DPI import canvas.
- Two font paths in `utils-text.js`:
  - raw: `buildBaseTextStyle` → `normalizeFontSize(element.fontSize || element.fontSz)` = raw pt (18), no 96/72.
  - HTML-inline: `extractTextMetadata` walk → `mergeInlineStyle` → `parseCssLengthToPx` = 24. `applyTextStyle(metadata, dominant.style)` lets the inline 24 win.
- `map-table.js:111` and `utils-text.js:157` apply `×96/72` directly.
- `utils-base.js:3,46` `scaleLength(value, axis)` = `round(value × PT_TO_PX(96/72) × axis)` — **same bug, wider blast radius**: used by `map-image.js:37` (border width) and `extractShadow` (`utils-base.js:53-55`, shadow x/y/blur). A 2pt border → 2.67px on a scale=1.0 deck instead of 2px. Confirmed by grep: `PT_TO_PX` has exactly these two consumers. Phase 2 must fix this too or its own "no 96/72 on import path" success criterion is unmet.
- `acceptance-criteria.js:22` enforces `expectedPx = sourcePt × 96/72` → would throw on the correct fix. Must change.
- All render surfaces read `_pptxImportMeta.fitFontSizePx` (`element-renderers.js:121`, `shapeUtils.js:53`, `canvas-element-wrapper.jsx:53`, `shape-element-renderer.jsx:37`, `export-pptx-basic-renderers.js:15`), so fixing the metadata propagates everywhere.

## Requirements
- Functional: imported font in canvas px = `pt × scale.y` (not `pt × 96/72`). For standard 16:9 and 4:3 decks (`scale.y = 1.0`), font_px = font_pt.
- Functional: table cell font and text insets use the same scale-based conversion.
- Functional: acceptance gate asserts `font_px ≈ pt × scale.y`.
- Non-functional: do not regress non-import callers of `parseCssLengthToPx` / `mergeInlineStyle`.

## Architecture
**Decision — isolate the fix to the import path; do not change shared `parseCssLengthToPx` globally.** The generic converter is correct for 96-DPI browser contexts; only the import target is 72 DPI.

Font conversion (recommended): thread `scale` into `extractTextMetadata` and `buildPptxTextImportMeta`. Derive font in pt, then `font_px = round(pt × scale.y)`.
- Prefer the **raw element pt** (`element.fontSz ?? element.fontSize`) as the pt source — it never passed through the 96/72 converter.
- For runs where only HTML-inline `font-size` exists, recover pt by dividing the mergeInlineStyle px back by `PX_PER_PT` (`px × 72/96`), then `× scale.y`. (Equivalent net factor: `px × scale.y × 72/96`.)
- Centralize as one helper `ptToCanvasPx(pt, scale)` in `utils-text.js` so table/insets/diagram reuse it (DRY; Phase 6 imports it).

```
pt (parser) ──► ptToCanvasPx(pt, scale) = round(pt × scale.y) ──► fitFontSizePx ──► renderers
```

## Related Code Files
- Modify: `server/services/pptx-import/mapper/utils-text.js` (font path, `extractTextInsetsWithScale:157`, add `ptToCanvasPx`)
- Modify: `server/services/pptx-import/mapper/map-table.js:111` (drop `×96/72`)
- Modify: `server/services/pptx-import/mapper/utils-base.js:3,46` (`scaleLength` — drop `PT_TO_PX` so border/shadow use `× axis` only, matching box scale)
- Modify: `server/services/pptx-import/mapper/map-presentation.js:51-55`, `map-shape.js:81,98` (pass `scale` to text helpers)
- Modify: `server/services/pptx-import/acceptance-criteria.js:21-27,132-152` (gate uses `× scale.y`)
- Read for context: `shared/src/shared-html-parser.js` (mergeInlineStyle, parseCssLengthToPx), `shared/src/element-renderers.js:121`
- Tests: `utils-text.test.js`, `map-table.test.js`, `acceptance-criteria` tests (locate/create)

## Implementation Steps
1. **Audit (decision gate):** grep all callers of `mergeInlineStyle` and `parseCssLengthToPx` across `shared/`, `client/`, `server/`. Confirm import is the only 72-DPI consumer. Record findings in the phase before editing. (If a non-import caller also needs 72-DPI, escalate — but expectation is import-only.)
2. **Red:** add `utils-text.test.js` cases using the Phase 1 fixture: `18pt` element with `scale.y=1.0` → `fitFontSizePx`/`sourceFontSizePx` ≈ 18 (not 24); table `18pt` cell → 18; insets `lIns:12pt` → 12. Run — fail (current = 24/16).
3. **Green — font:** add `ptToCanvasPx(pt, scale)`; thread `scale` through `extractTextMetadata`/`buildPptxTextImportMeta`; prefer raw element pt, recover pt from inline px otherwise. Update `map-presentation.js`/`map-shape.js` call sites.
4. **Green — table:** `map-table.js:111` → `ptToCanvasPx(fontSize, context.scale)`.
5. **Green — insets:** `utils-text.js:157` → replace `× (96/72)` with `× scale axis` via the same helper convention.
6. **Green — border/shadow:** `utils-base.js:46` `scaleLength` → drop `PT_TO_PX`, return `round(num × axis × 10)/10`. Border width (`map-image.js:37`) and shadow x/y/blur (`extractShadow`) now match box scale. Add a `utils-base.test.js` case: `scaleLength(2, 1.0) → 2` (was 2.67).
7. **Green — gate:** `acceptance-criteria.js:22` `expectedPx = sourcePt × scale.y`; `assertSourceFontSizesWithinTolerance` passes the deck's scale (derive from presentation.resolution vs source size, or accept `scale` arg). Keep `tolerancePx = 1`.
8. **Refactor:** ensure single source of truth for pt→px; remove now-dead 96/72 literals on the import path. Confirm `assertNoRawUnits`/`assertFiniteLengthFields` still pass.

## Tests (this phase)
- `utils-text.test.js`: 18pt→18 (scale 1.0); 18pt→13.5 on a synthetic non-uniform deck (scale.y=0.75) to prove scale-axis behavior; inset 12pt→12.
- `utils-base.test.js`: `scaleLength(2, 1.0) → 2` (was 2.67); `scaleLength(2, 0.5) → 1`; shadow `{h:4,v:4,blur:8}` at scale 1.0 → x/y 4, blur 8 (regression lock on border/shadow inflation).
- `map-table.test.js`: cell 18pt → fontSize 18 (update fabricated expectation 24→18 with rationale comment).
- acceptance test: gate passes for correct fix, **throws** for a 24px (old-bug) element — proves the gate now guards the right invariant.

## Success Criteria
- [ ] 18pt text/table/inset → 18px on standard deck; gate green
- [ ] 2pt border / 4pt shadow → 2px / 4px on scale=1.0 deck (no `scaleLength` inflation)
- [ ] Gate throws on a deliberately-inflated 24px element (regression lock)
- [ ] No `×96/72` / `PT_TO_PX` literals remain under `mapper/` + `acceptance-criteria.js` (grep clean). `shared-html-parser.js:2 PX_PER_PT` is intentionally retained (generic 96-DPI CSS converter, not import-only — see Architecture decision).
- [ ] `npm run test -- server/services/pptx-import` green; `npm run lint` clean
- [ ] Non-import `parseCssLengthToPx` callers unchanged (audit recorded)

## Risk Assessment
- Risk: changing the acceptance gate hides a real future regression. Mitigation: gate still enforces a tight `±1px` band, just around the correct target; add the inverse "throws on 24px" test.
- Risk: HTML-inline-only fonts mis-recovered. Mitigation: prefer raw element pt; unit-test the inline-recovery branch explicitly.
- Risk: non-uniform decks. Mitigation: `scale.y` chosen (height-proportional, matches text-box vertical fit); documented in plan.md Decisions.

## Security Considerations
- No new external input; sanitization order (`sanitizeHtml` before parse) preserved. Inset clamp (`box/2`, max 96) retained.

## Next Steps
- Unblocks Phase 6 (diagram reuses `ptToCanvasPx`). Phase 8 verifies end-to-end in real browser.

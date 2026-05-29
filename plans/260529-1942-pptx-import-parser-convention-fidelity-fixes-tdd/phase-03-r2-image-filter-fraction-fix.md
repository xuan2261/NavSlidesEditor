---
phase: 3
title: "R2 Image-Filter Fraction Fix (Brightness/Contrast/Saturation)"
status: completed
priority: P0
effort: "1d"
dependencies: [1]
---

# Phase 3: R2 Image-Filter Fraction Fix

## Overview
Fix #2 — images with PowerPoint color corrections render black/gray. Root cause R2: pptxtojson@2.0.2 emits filter values as fractions (`parseInt/1e5`) with brightness/contrast as offsets (neutral 0) and saturation as a multiplier (neutral 1.0), but `map-image.js:41-46` assumes raw values (neutral 100000) and divides by `1000` → always 0 → `brightness(0%)` = black; neutral saturation 1.0 → `grayscale(100%)` = gray.

## Key Insights (verified)
- `map-image.js:41` `Math.round(f.brightness / 1000)` with `f.brightness = 0.2` → `0` → `brightness(0%)`.
- `map-image.js:43-45` saturation neutral `1.0` → `1.0 < 50000` → `filterGrayscale = round((1 - 1.0/100000)*100) ≈ 100` → full gray on a *normal* image.
- Renderer reads CSS-percent fields, neutral 100, skipping neutral: `element-renderers.js:146` `el.filterBrightness != null && el.filterBrightness !== 100 ? brightness(${...}%)`; line 147 contrast; `filterGrayscale` consumed downstream.
- Parser convention (CONFIRM in step 1): brightness/contrast = OOXML offset fraction (neutral 0, range −1..+1); saturation = multiplier fraction (neutral 1.0).

## Requirements
- Functional: brightness offset `b` → `filterBrightness% = round((1 + b) × 100)`; neutral `b=0` emits nothing.
- Functional: contrast offset `c` → `filterContrast% = round((1 + c) × 100)`; neutral `c=0` emits nothing.
- Functional: saturation multiplier `s` → neutral `s=1` emits nothing; `s≤0` → `filterGrayscale=100`; `0<s<1` → `filterGrayscale=round((1−s)×100)`; `s>1` → `filterSaturate=round(s×100)` (add field + renderer support, OR document as out-of-scope if renderer lacks `saturate()`).
- Non-functional: clamp negative CSS percents to 0; neutral values must round-trip to "no filter".

## Architecture
```
parser fraction ──► offset/multiplier-aware map ──► CSS-percent field (neutral-guarded) ──► renderImage filter chain
```
Keep the mapping in `map-image.js`; no new module needed. Extract a small pure `mapImageFilters(filters)` returning `{filterBrightness?, filterContrast?, filterGrayscale?, filterSaturate?}` for unit-testability (< 30 LOC).

## Related Code Files
- Modify: `server/services/pptx-import/mapper/map-image.js:39-49`
- Verify/Modify (only if `s>1` path needed): `shared/src/element-renderers.js:143-160` (image filter chain — confirm full field list incl. grayscale/saturate), `client/src/utils/export-pptx-basic-renderers.js`
- Read for context: `node_modules/pptxtojson/dist/index.cjs` (brightnessContrast block), pptxtojson README (filter semantics)
- Tests: `map-image.test.js`

## Implementation Steps
1. **Verify convention (gate):** read `index.cjs` brightnessContrast block + any saturation/duotone path; confirm neutral (0 vs 1.0) and units. Record exact expressions in the phase. If saturation neutral differs from hypothesis, adjust mapping before coding.
2. **Read renderer:** confirm `renderImage` filter fields actually consumed (brightness/contrast/grayscale; whether `saturate` exists). Decide `s>1` handling: add `filterSaturate` + renderer support, or scope out with a documented warning.
3. **Red:** update `map-image.test.js` to use Phase 1 fixture fractions: `brightness:0.2 → filterBrightness:120`; `contrast:-0.5 → filterContrast:50`; `saturation:1.0 → no grayscale field`; `saturation:0 → filterGrayscale:100`; `saturation:0.3 → filterGrayscale:70`. Replace the fabricated `120000` expectation with rationale comment. Run — fail.
4. **Green:** implement `mapImageFilters`; replace lines 41-46. Neutral-guard each field; clamp `max(0, ...)`.
5. **Refactor:** ensure no `/1000` or `!== 100000` literals remain for filters; `_pptxSharpen`/`_pptxColorTemp` meta untouched.

## Tests (this phase)
- brightness 0.2 → 120; −0.5 → 50; 0 → field absent
- contrast 0.8 → 180; 0 → absent
- saturation 1.0 → no grayscale; 0 → grayscale 100; 0.3 → grayscale 70; (if supported) 1.5 → saturate 150
- regression lock: a fully-neutral filter object yields **no** filter fields (image unchanged)

## Success Criteria
- [ ] Neutral corrections produce no filter (image renders unchanged)
- [ ] 20% brighten → `brightness(120%)`, not black
- [ ] Normal-saturation image not forced to grayscale
- [ ] `npm run test -- server/services/pptx-import/mapper/map-image` green; lint clean

## Risk Assessment
- Risk: OOXML→CSS color math is approximate (linear offset model). Mitigation: matches PowerPoint's −100..+100 ↔ CSS 0..200 convention; visual spot-check in Phase 8.
- Risk: saturation source field differs (sat mod vs duotone). Mitigation: step-1 verification gate before coding.

## Security Considerations
- Numeric-only transforms; no new external input.

## Next Steps
- Phase 8 visual audit confirms corrected images render with intended tone.

---
phase: 2
title: "Image/Line/Supported Shape Fidelity"
status: complete
priority: P1
effort: "2 days"
dependencies: [phase-00-sanitizer-hardening, phase-01-rich-html-preservation]
---

# Phase 2: Image, Line, and Supported Shape Fidelity

## Overview

Fix critical data losses for image metadata, line coordinates, and shape type mapping. **Corrected from plan review:** current codebase supports 14-15 shape types (NOT 20+ as originally stated). This phase focuses on the 15 shapes that already have export support, plus image metadata and real line coordinates.

## Context Links

- Review finding: `plans/reports/debug-260425-1102-pptx-full-fidelity-plan-review.md` — P1-A Shape overstated
- Existing shapeUtils: `shared/src/shapeUtils.js` — 15 shapes
- Existing getShapeType: `client/src/utils/export-pptx-core.js:70` — 14 shapes
- Existing mapper: `server/services/pptx-import/mapper.js`
- Existing test: `server/services/pptx-import/mapper.test.js`

## Requirements

**Image (high impact, low effort):**
- Preserve `objectFit`: cover/contain/stretch from pptxtojson fill mode
- Preserve crop data: `rect` (t,b,l,r as 0-1 ratios) → `cropData`
- Preserve flip: `isFlipH`, `isFlipV` → `flipH`, `flipV`
- Preserve border: `borderColor`, `borderWidth`
- Preserve alt text from pptxtojson output

**Lines (high impact, critical fix):**
- Extract real coordinates from pptxtojson (x1, y1, x2, y2)
- Handle diagonal, vertical, angled lines
- Handle arrow types: triangle, diamond, oval, square
- Handle line style: solid, dashed, dotted

**Shapes (medium impact):**
- Verify 15 shape types: rect, rounded-rect, circle, triangle, diamond, arrow-right, star, hexagon, pentagon, cloud, cylinder, parallelogram, trapezoid, bracket, line
- Expand `shapeName()` to cover ALL 15 shapes with correct normalization
- Handle `path` field for custom SVG shapes → store as `path` property for SVG fallback
- Preserve fill color, stroke, strokeWidth, rotation, flip

## Architecture

**Supported shape mapping** (15 types — verified against shapeUtils.js + getShapeType()):

| NavSlides shape | pptxtojson shapType patterns | Export | shapeUtils |
|---|---|---|---|
| rect | rect, frame | rect | ✅ |
| rounded-rect | roundRect, roundedRect, rounded, corner | roundRect | ✅ |
| circle | ellipse, oval, circle | ellipse | ✅ |
| triangle | triangle, isoscelesTriangle, rightTriangle | triangle | ✅ |
| diamond | diamond, rhombus | diamond | ✅ |
| arrow-right | arrowRight, rightArrow, arrow | rightArrow | ✅ |
| star | star4, star5, star6, star7, star8, star10, star12 | star5 | ✅ |
| hexagon | hexagon | hexagon | ✅ |
| pentagon | pentagon | pentagon | ✅ |
| cloud | cloud | cloud | ✅ |
| cylinder | cylinder, can | can | ✅ |
| parallelogram | parallelogram | parallelogram | ✅ |
| trapezoid | trapezoid | trapezoid | ✅ |
| bracket | bracket, leftBrace, rightBrace, brace | leftBrace | ✅ |
| line | line, straightConnector | line | ✅ |

Custom/unknown shapes with `path` field → `'svg'` type with raw SVG path stored in `path` property.

## Related Code Files

**Modify:**
- `server/services/pptx-import/mapper.js` — expand `shapeName()`, fix line coords, enhance image mapping, fix `colorValue()` for gradient
- `server/services/pptx-import/mapper.test.js` — add tests for each shape type, line coords, image metadata
- `client/src/utils/export-pptx-basic-renderers.js` — verify line export handles new coord format

## Implementation Steps

1. **Expand `shapeName()` in `mapper.js`**
   - Create lookup table for all 15 shapes (see table above)
   - Normalize shapType: lowercase, remove spaces
   - Check for path field → return `'svg'` type with `path` property
   - Fallback: `'rect'`

2. **Fix line coordinate extraction in `mapShape()`**
   - Read actual x1/y1/x2/y2 values if present in pptxtojson output
   - Calculate angle from coordinates: `Math.atan2(y2-y1, x2-x1)`
   - Map arrow types from pptxtojson `arrowType` / `shapType` patterns
   - Handle: triangle, diamond, oval, square, stealth, arrow, noArrow
   - Map line styles from `borderStrokeDasharray` (solid/dashed/dotted)

3. **Enhance image mapping in `mapImage()`**
   - `objectFit`: read from pptxtojson `fill` field ('cover'/'contain'/'stretch')
   - `cropData`: store `rect` (crop ratios 0-1) for round-trip export
   - `flipH`/`flipV`: from `isFlipH`/`isFlipV`
   - `borderColor`/`borderWidth`: from pptxtojson border fields
   - `alt`: from pptxtojson `alt`/`title`

4. **Fix `colorValue()` helper**
   - Handle `{ type: 'gradient', ... }` → return `'gradient'` (store separately)
   - Handle `fill === 'none'` or `{ type: 'none' }` → return `'none'`
   - Handle `{ type: 'scheme' }` → resolve via theme colors if available
   - Handle pattern fill → return `'transparent'` with warning

5. **Add SVG shape fallback**
   - If shapType unknown AND element has `path` field → create shape with `type: 'svg'` and `path` property
   - SlideCanvas needs SVG renderer for type: 'svg' (may need new renderer or use img with SVG data URI)

6. **Add tests in `mapper.test.js`**
   - Test each of 15 shape types maps correctly
   - Test diagonal line with real coordinates
   - Test image with crop/flip/border
   - Test image with objectFit: 'cover'
   - Test custom SVG path → svg type with path stored
   - Test gradient fill → stores gradient info
   - Test 'none' fill → returns 'none'

## Success Criteria

- [ ] All 15 shape types correctly mapped and exported
- [ ] Diagonal lines preserve real coordinates and angle
- [ ] Arrow types (triangle, diamond, oval, square) correctly mapped
- [ ] Image with `fill: 'cover'` → `objectFit: 'cover'`
- [ ] Image with crop data → `cropData` stored
- [ ] Flipped images → `flipH`/`flipV` set
- [ ] Images with borders → `borderColor`/`borderWidth` set
- [ ] Custom SVG path → `'svg'` type with path stored
- [ ] Gradient fill → stored as gradient info (not solid)
- [ ] All existing tests pass

## Risk Assessment

**Risk:** Custom SVG paths may not render correctly in all contexts.
**Mitigation:** Store SVG path in element. Render via `<img src="data:image/svg+xml,...">` or `<svg>` inline. Fall back to rect for unrecognizable paths.
**Risk:** pptxtojson may not always provide x1/y1/x2/y2 for lines.
**Mitigation:** Fall back to bounding box calculation (existing behavior).

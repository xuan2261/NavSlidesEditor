# Phase 04 Fix Shape Geometry And SVG Console Errors

## Context Links

- Console errors: `<rect> attribute width/height: A negative value is not valid`
- Shape renderer: [shape-element-renderer.jsx](../../client/src/components/canvas/element-renderers/shape-element-renderer.jsx)
- Shared shape utils: [shapeUtils.js](../../shared/src/shapeUtils.js)
- Import geometry: [geometry.js](../../server/services/pptx-import/geometry.js)

## Overview

Priority: P0. Status: complete. Remove SVG negative dimension errors and separate intentional decorative bleed from unexpected geometry drift.

## Key Insights

- Baseline raw out-of-canvas: 141.
- Latest raw out-of-canvas after Phase 04: 136, with 127 accepted decorative bleed entries and 9 remaining unexpected entries, all image-only for Phase 05.
- `Bai3_HinhChieuVuongGoc.pptx` contributes 135, many are thin full-width shapes at `x=-7`, `width=1154`.
- Console errors point to `w - sw` or `h - sw` becoming negative in SVG rects.

<!-- Updated: Validation Session 1 - Decorative bleed can be accepted only with source PPTX geometry evidence or explicit allowlist entries with screenshot/reason. -->

## Requirements

- Functional: no SVG negative width/height emitted in editor or shared renderer.
- Functional: actual misplaced text/images remain flagged.
- Functional: decorative overscan shapes preserve visual design but are classified as expected only with source geometry evidence or explicit allowlist evidence.
- Non-functional: no blanket clamping that distorts normal shapes.

## Architecture

```text
mapper geometry
  -> element box + stroke
renderer safety
  -> clamp inner SVG dimensions
audit classifier
  -> expected decorative bleed vs unexpected out-of-canvas
```

## Related Code Files

- Modify: `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/shape-element-renderer.jsx`
- Modify: `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/shape-element-renderer.test.jsx`
- Modify: `C:/Work/NavSlidesEditor/shared/src/shapeUtils.js`
- Modify: `C:/Work/NavSlidesEditor/server/services/pptx-import/mapper/map-shape.js`
- Modify: `C:/Work/NavSlidesEditor/server/services/pptx-import/geometry.js`
- Modify: `C:/Work/NavSlidesEditor/server/services/pptx-import/mapper/map-presentation.js`
- Modify: `C:/Work/NavSlidesEditor/server/services/pptx-import/mapper/map-media.js`
- Modify: `C:/Work/NavSlidesEditor/tests/e2e/pages/pptx-import-audit-helper.js`

## Implementation Steps

1. RED: reproduce negative rect with width/height smaller than stroke width.
2. Add renderer helper with defined semantics for `strokeWidth >= width/height`:
   - `innerWidth = Math.max(0, w - sw)`
   - `innerHeight = Math.max(0, h - sw)`
   - clamp rect/rounded-rect/default rect.
   - preserve visible stroke/fill behavior using a line/capsule/path fallback or stroke scaling if zero inner dimension would make the shape visually disappear.
3. Add equivalent clamp in shared `shapeSvgString`.
4. Review mapper for any negative width/height after group transforms; clamp only invalid dimensions, not positions.
5. Add audit classifier for expected decorative bleed using Phase 01 candidate output:
   - shape/line only
   - no text content
   - thin or full-slide background/header primitive
   - source PPTX geometry already extends beyond slide bounds, or explicit allowlist `{deck, slide, elementId, reason, screenshot}`
   - no hyperlink/action/pointer-events/interactive behavior
   - reported separately in final output.
6. Add console error capture assertion.

## Tests

- Unit/component:
  - `ShapeRenderer` emits no negative rect attrs when `strokeWidth > width/height`.
  - `shapeSvgString` emits no negative rect attrs.
  - tiny thick-stroke shapes remain visually represented instead of disappearing.
  - mapper rejects or clamps non-finite/negative dimensions.
- E2E:
  - `consoleErrors=0`.
  - `unexpectedOut=0` for shapes after accepted bleed classification.
  - text/image out-of-canvas still fail.
- Commands:
  ```bash
  npx vitest run client/src/components/canvas/element-renderers/shape-element-renderer.test.jsx
  npx vitest run shared/src/shapeUtils.test.js server/services/pptx-import/geometry-drift.test.js
  npx playwright test tests/e2e/pptx-import-real-browser-audit.spec.js --project=chromium --workers=1 --retries=0
  ```

## Todo List

- [x] Add RED negative SVG tests.
- [x] Clamp renderer geometry.
- [x] Add accepted bleed classifier tests.
- [x] Verify console errors drop from 16 to 0.
- [x] Verify unexpected out-of-canvas count excludes only documented decorative shapes.

## Progress Evidence

- `ShapeRenderer` and shared `shapeSvgString` now clamp rect dimensions when `strokeWidth > width/height`.
- Targeted tests passed: `npx vitest run client/src/components/canvas/element-renderers/shape-element-renderer.test.jsx shared/tests/shapeUtils.test.js`.
- Targeted lint passed for shape renderer/shared shape utils.
- Added explicit decorative bleed allowlist patterns with reason strings in `pptx-import-audit-helper.js`.
- Added importer-side bound fitting for text and math/latex boxes so non-image content does not drift outside slide bounds.
- Targeted tests passed: `npx vitest run server/services/pptx-import/property-mapping.test.js`.
- Targeted lint passed: `npx eslint server/services/pptx-import/geometry.js server/services/pptx-import/mapper/map-presentation.js server/services/pptx-import/mapper/map-media.js server/services/pptx-import/property-mapping.test.js`.
- Real-browser audit passed non-strict with `text=0`, `consoleErrors=0`, `acceptedBleed=127`, `acceptedBleedCandidates=0`, `unexpectedOutOfCanvas=9`; the 9 remaining unexpected entries are all images.

## Success Criteria

- Browser console error count is 0.
- No SVG negative dimension warnings.
- Raw out-of-canvas still reported; strict unexpected out-of-canvas is 0 after real fixes/classification.
- Any accepted decorative bleed entry has source geometry evidence or explicit allowlist evidence; heuristic-only acceptance is not enough for strict pass.

## Risk Assessment

- Risk: accepted bleed hides visual crop. Mitigation: screenshot review list remains in report.
- Risk: clamping hides import geometry bug. Mitigation: mapper tests still assert finite positive dimensions.
- Risk: zero inner dimensions hide SVG warnings by dropping visuals. Mitigation: add thick-stroke visual fallback tests.

## Security Considerations

- SVG output remains sanitized with explicit tests for `<script>`, event attributes, unsafe `href`, external images, `foreignObject`, and malformed SVG. Console-error fixes must not bypass sanitizer paths.

## Next Steps

Fix image clipping in Phase 05.

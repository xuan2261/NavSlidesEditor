# SVG Path Scaling Diagnostic

Date: 2026-05-25
Plan: `260525-1450-pptx-import-unit-conversion-and-scale-fixes`
Phase: 4

## Finding

`pptxtojson` path coordinates are local to the source shape dimensions, not canvas-scaled coordinates.

Evidence:

- `node_modules/pptxtojson/src/pptxtojson.js` calls `getShapePath(shapType, width, height, node)` and stores that as `path`.
- `node_modules/pptxtojson/src/shapePath.js` builds paths with the same `w` / `h` values, for example `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`.
- A corpus probe over `server/data/test-corpus` found 282 path elements. Representative rows had path max values matching raw element dimensions, for example `width: 154.1078`, `height: 90`, `path: M 0 0 L 154.1078 0 L 154.1078 90 L 0 90 Z`.

## Decision

Use Strategy A from the phase plan:

- Keep the outer NavSlides SVG element box scaled via `mapBox`.
- Keep the inner SVG `viewBox` in raw source dimensions.
- Add `preserveAspectRatio="none"` so the local path fills the scaled wrapper box.
- Continue escaping `element.path` through `svgAttr()`.

This avoids adding an SVG path parser and matches pptxtojson's local-coordinate contract.

## Verification

- Added unit assertions for raw-dimension `viewBox` and `preserveAspectRatio="none"` on custom path shape mapping.
- Re-run targets after implementation:
  - `npx vitest run server/services/pptx-import/mapper/map-shape.test.js server/services/pptx-import/mapper.test.js`
  - `npm run test:corpus`

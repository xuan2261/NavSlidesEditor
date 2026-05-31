# Phase 06 Align Shared Export Renderers With Editor

## Context Links

- Shared render: [element-renderers.js](../../shared/src/element-renderers.js)
- HTML generator: [htmlGenerator.js](../../shared/src/htmlGenerator.js)
- Editor render: [canvas-element-wrapper.jsx](../../client/src/components/canvas/canvas-element-wrapper.jsx)

## Overview

Priority: P1. Status: complete. Ensure fixes visible in editor also apply to present mode, exported HTML/PDF/PPTX raster fallback, and shared server rendering.

## Key Insights

- Editor and shared renderer duplicate text/image/shape CSS.
- Shared HTML render now mirrors imported text wrapping/fit, source-crop image clipping, and shape SVG dimension clamping.
- Client and server PPTX export renderers now use imported fitted font size for text and shape text.

## Requirements

- Functional: shared renderer uses same imported text fit policy.
- Functional: shared image renderer uses same crop intent semantics.
- Functional: shared shape renderer clamps SVG dimensions.
- Functional: render-surface inventory covers editor canvas, reveal present mode, exported HTML, PDF capture path, PPTX raster fallback, speaker/viewer surfaces if they render slide content, and thumbnails/previews if applicable.
- Non-functional: avoid a large shared React dependency; use small pure helper utilities.

## Architecture

```text
shared pptx render helpers
  -> text style helper
  -> image style helper
  -> shape dimension helper
client renderer
  -> imports or mirrors pure helpers where practical
server export
  -> same CSS contract
```

## Related Code Files

- Modify:
  - `C:/Work/NavSlidesEditor/shared/src/element-renderers.js`
  - `C:/Work/NavSlidesEditor/shared/src/shapeUtils.js`
  - `C:/Work/NavSlidesEditor/client/src/components/canvas/canvas-element-wrapper.jsx`
  - `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/shape-element-renderer.jsx`
- `C:/Work/NavSlidesEditor/client/src/utils/export-pptx-basic-renderers.js`
- `C:/Work/NavSlidesEditor/server/utils/server-basic-renderers.js`
- Tests:
  - `C:/Work/NavSlidesEditor/shared/src/element-renderers.test.js`
  - `C:/Work/NavSlidesEditor/shared/src/shapeUtils.test.js`

## Implementation Steps

1. RED: generate shared HTML for problematic imported text; assert no no-wrap/overflow-prone style.
2. Create render-surface checklist and mark each surface as using editor, shared helper, or separate renderer.
3. Extract or mirror minimal pure helper for imported text style string/object only where it prevents actual drift; do not turn this phase into broad renderer refactor.
4. Extract pure helper for safe SVG inner dimensions.
5. Keep client code simple; do not create framework-heavy abstraction.
6. Add snapshot-like targeted tests for shared HTML output.
7. Add tests or explicit no-impact notes per render surface.
8. Run export-related tests.

## Tests

- Shared unit:
  - text renderer includes wrap-safe CSS.
  - image renderer uses bounded crop/contain CSS.
  - shape renderer never emits negative SVG attrs.
  - unsafe imported HTML/SVG/media attributes remain escaped or sanitized in shared output.
- Integration:
  - HTML generator emits slide sections with unchanged resolution.
  - PPTX export fallback still captures imported content.
  - PDF/export/present path uses the same deterministic text fit contract or has a documented separate browser-layout pass.
- Commands:
  ```bash
  npx vitest run shared/src/element-renderers.test.js shared/src/shapeUtils.test.js
  npx vitest run client/src/utils/export-pptx-core.test.js client/src/utils/export-pptx-basic-renderers.test.js
  npm run build
  ```

## Todo List

- [x] Add shared renderer RED tests.
- [x] Extract or mirror minimal pure helpers where useful.
- [x] Apply helpers in shared and client/server export paths.
- [x] Verify build.

## Render Surface Inventory

- Editor canvas: `canvas-element-wrapper.jsx` and shape renderer use imported text fit/wrap, source crop diagnostics, and safe SVG dimensions.
- Present/export HTML/PDF shared render: `shared/src/element-renderers.js` and `shared/src/shapeUtils.js` use the same imported text/image/shape contracts.
- PPTX browser export: `client/src/utils/export-pptx-basic-renderers.js` uses fitted imported text font size for text and shape text.
- PPTX server/Electron export: `server/utils/server-basic-renderers.js` mirrors the browser export fitted font-size contract.
- Speaker/viewer/reveal surfaces: consume shared generated HTML or presentation elements; no separate PPTX import renderer found for text/image/shape.

## Progress Evidence

- `npx vitest run shared/tests/element-renderers.test.js shared/tests/shapeUtils.test.js client/src/utils/export-pptx-core.test.js server/utils/server-basic-renderers.test.js client/src/components/canvas/canvas-element-wrapper.test.jsx` passed: 61 tests.
- `npx eslint shared/src/element-renderers.js shared/src/shapeUtils.js client/src/utils/export-pptx-basic-renderers.js server/utils/server-basic-renderers.js client/src/utils/export-pptx-core.test.js server/utils/server-basic-renderers.test.js` passed.
- `npm run build` passed.

## Success Criteria

- Editor, present, export HTML, and PPTX fallback share the same layout contract: met for imported text/image/shape.
- No known inconsistent CSS policy remains for imported text/image/shape on the inventoried render surfaces: met.
- Old saved presentations with no/partial `_pptxImportMeta` render safely: met via fallback font/image tests.

## Risk Assessment

- Risk: helper extraction grows files. Mitigation: keep helper under 200 LOC, narrow API.
- Risk: export changes affect non-imported decks. Mitigation: guard behavior behind `_pptxImportMeta` where needed.
- Risk: runtime editor fit cannot run in shared/export HTML. Mitigation: use deterministic import-time/shared contract or explicit browser-layout export pass.

## Security Considerations

- Shared renderer must keep HTML escaping and sanitization, with negative tests for rich-text HTML, SVG attributes/elements, external media URLs, and exported HTML output.

## Next Steps

Enforce corpus gates in Phase 07.

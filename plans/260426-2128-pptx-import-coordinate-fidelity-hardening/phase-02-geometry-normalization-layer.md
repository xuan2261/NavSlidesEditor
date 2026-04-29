---
phase: 2
title: "Geometry Normalization Layer"
status: completed
priority: P1
effort: "2-3d"
dependencies: [1]
---

# Phase 2: Geometry Normalization Layer

## Context Links
- `server/services/pptx-import/constants.js`
- `server/services/pptx-import/mapper.js`
- `client/src/components/SlideCanvas.jsx`
- `shared/src/element-renderers.js`
- `client/src/utils/export-pptx-basic-renderers.js`

## Overview
Replace scattered coordinate math with one normalizer. Fix x/y/width/height,
zero-value handling, source-size scaling, line local endpoints, and bounded
canvas output.

## Key Insights
- NavSlides canvas coordinates are logical px at `960 x 540`.
- Rendering wrappers use `element.x/y/width/height`.
- Line endpoints are local to the wrapper viewBox.
- Current direct scaling makes source/global vs local endpoint behavior unclear.

## Requirements
- Functional: all imported elements land in correct canvas box.
- Functional: line endpoints render correctly in editor, HTML export, and PPTX export.
- Non-functional: no geometry code duplication in mapper.

## Architecture
```text
pptxtojson element
  -> geometry.js normalizeSourceSize()
  -> readNumber() / readCoord()
  -> mapBox()
  -> mapLineBoxAndEndpoints()
  -> baseElement()
```

## Related Code Files
- Create: `server/services/pptx-import/geometry.js`
- Create: `server/services/pptx-import/geometry.test.js`
- Modify: `server/services/pptx-import/mapper.js`
- Modify: `server/services/pptx-import/mapper.test.js`

## Tests Before
- Move Phase 1 failing geometry assertions into `geometry.test.js`.
- Add unit tests for:
  - nullish fallback: `0` valid, `null/undefined/NaN` fallback.
  - arbitrary source size to `CANVAS_SIZE`.
  - clamp negative/oversized boxes with warning or safe output.
  - absolute line endpoints converted to local endpoints.
  - local endpoints preserved when parser already emits local coordinates.

## Implementation Steps
1. Create `geometry.js` with pure functions:
   `normalizeSourceSize`, `readNumber`, `mapBox`, `mapBaseElement`,
   `mapLineGeometry`, `clampBox`.
2. Replace `rect()` and `baseElement()` in `mapper.js`.
3. Use nullish semantics, not `||`, for geometry fields.
4. Normalize line geometry:
   - If endpoints look absolute, wrapper box = endpoint bounding box.
   - Store `x1/y1/x2/y2` local to wrapper viewBox.
   - Preserve rotation only when parser supplies shape rotation.
5. Add warnings for impossible geometry:
   - zero/negative size
   - NaN source values
   - source size missing
6. Keep public NavSlides schema unchanged.

## Todo List
- [x] Add `geometry.js` pure helpers.
- [x] Replace mapper geometry calls.
- [x] Fix line endpoint semantics.
- [x] Add geometry warnings.
- [x] Verify export and shared render still agree.

## Success Criteria
- [x] Geometry tests pass.
- [x] Phase 1 drift tests improve or pass.
- [x] No mapper coordinate math left outside geometry helper except group phase.
- [x] Imported line renders same in editor and HTML export.

## Risk Assessment
- Risk: real parser outputs mixed local/absolute endpoint formats.
- Mitigation: heuristic plus fixture evidence. Prefer tests over assumptions.

## Security Considerations
- Geometry helper must not parse or execute XML.
- Keep diagnostics text-only and capped.

## Regression Gate
```bash
npm run test -- server/services/pptx-import/geometry.test.js server/services/pptx-import/mapper.test.js shared/tests/element-renderers.test.js
```

## Next Steps
- Phase 3 fixes type-specific property loss after base geometry is stable.

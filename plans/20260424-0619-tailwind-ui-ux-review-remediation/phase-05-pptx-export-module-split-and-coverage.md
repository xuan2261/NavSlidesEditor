---
phase: 5
title: "PPTX Export Module Split And Coverage"
status: complete
priority: P2
effort: "3h"
dependencies: [1]
---

# Phase 05: PPTX Export Module Split And Coverage

## Context Links

- `client/src/utils/exportPptx.js`
- `client/src/utils/export-pptx-core.js`
- `client/src/utils/export-pptx-raster.js`

## Overview

Split the new PPTX export helpers enough to make the path reviewable while preserving the public API.

## Requirements

- Functional: `exportToPptx(presentation)` remains unchanged for callers.
- Non-functional: reduce oversized module concentration and add branch coverage.

## Architecture

Move HTML text-run parsing and per-element renderers into dedicated utility modules. Keep rasterization public functions stable.

## Related Code Files

- Modify: `client/src/utils/exportPptx.js`
- Modify: `client/src/utils/export-pptx-core.js`
- Create: `client/src/utils/export-pptx-text.js`
- Create: `client/src/utils/export-pptx-renderers.js`
- Modify: PPTX-related tests.

## Implementation Steps

1. Move HTML parsing/text-run helpers to `export-pptx-text.js`.
2. Move element renderer functions from `exportPptx.js` to `export-pptx-renderers.js`.
3. Keep `exportPptx.js` as orchestration only.
4. Add tests for image, native chart, fallback placeholder, and gradient background warning.
5. Document any remaining file-size exceptions in final report.

## Todo List

- [ ] Public PPTX API stable.
- [ ] Renderer branches covered.
- [ ] File-size risk reduced.

## Success Criteria

- [ ] `npm run test -- exportPptx export-pptx-core export-pptx-raster` passes.
- [ ] `npm run build` passes.

## Risk Assessment

Risk: refactor changes export output. Mitigation: move functions without changing logic and expand mocks to assert calls.

## Security Considerations

Do not alter sandboxed HTML capture permissions.

## Next Steps

Run system verification and update docs.

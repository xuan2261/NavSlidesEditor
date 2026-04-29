---
phase: 2
title: "Property Panel Test IDs"
status: completed
priority: P1
effort: "1d"
dependencies: [1]
---

# Phase 2: Property Panel Test IDs

## Context Links
- `phase-01-baseline-and-selector-contract.md`
- `client/src/components/properties/common-element-controls.jsx`
- `client/src/components/properties/shape-properties.jsx`
- `client/src/components/properties/image-properties.jsx`
- `client/src/components/properties/chart-properties.jsx`
- `client/src/components/properties/code-properties.jsx`
- `client/src/components/properties/table-properties.jsx`
- `client/src/components/properties/misc-properties.jsx`
- `client/src/components/PropertiesPanel.jsx`

## Overview
Priority P1. Add stable test IDs to ambiguous property controls only. Preserve UI behavior, labels, styling, and current canvas IDs.

## Key Insights
- Common controls have repeated `input[type="number"]`; tests currently use `.nth()` in places.
- Color and range inputs are hard to target accessibly.
- Text element typography is handled mainly by TipTap toolbar, not `PropertiesPanel`.
- Image URL editing does not currently exist in `ImageProperties`; do not invent it here.

## Requirements
- Functional: add test IDs to property controls needed for E2E.
- Non-functional: no visual change, no behavior change, no CSS refactor.
- Accessibility: keep labels/text; test IDs supplement accessible structure.

## Architecture
Add `data-testid` at the direct interactive element:
- `Input`, `Select`, `ColorPicker`, native `input[type=range]`, and action `Button`.
- Repeated series/cell controls include index suffix when needed, e.g. `prop-chart-values-0`.
- Existing test IDs outside properties stay unchanged.

## Related Code Files
- Modify: `client/src/components/properties/common-element-controls.jsx`
- Modify: `client/src/components/properties/shape-properties.jsx`
- Modify: `client/src/components/properties/image-properties.jsx`
- Modify: `client/src/components/properties/chart-properties.jsx`
- Modify: `client/src/components/properties/code-properties.jsx`
- Modify: `client/src/components/properties/table-properties.jsx`
- Modify: `client/src/components/properties/misc-properties.jsx`
- Optional modify: `client/src/components/PropertiesPanel.jsx` for multi-select delete ID only.
- Delete: none.

## Implementation Steps
1. In common controls add:
   - `prop-x`, `prop-y`, `prop-rotation`
   - `prop-width`, `prop-height`
   - `prop-lock-toggle`
   - `prop-fragment-toggle`, `prop-fragment-index`, `prop-fragment-animation`
   - `prop-shadow-x`, `prop-shadow-y`, `prop-shadow-blur`, `prop-shadow-color`
   - `prop-layer-forward`, `prop-layer-backward`, `prop-delete`
2. In shape controls add:
   - `prop-shape-fill`, `prop-shape-stroke`, `prop-shape-stroke-width`
   - `prop-shape-opacity`, `prop-shape-border-radius`
   - `prop-shape-label`, `prop-shape-text-size`, `prop-shape-text-color`
   - line-specific IDs only where tests need them.
3. In image controls add:
   - `prop-image-object-fit`, `prop-image-brightness`, `prop-image-contrast`
   - `prop-image-grayscale`, `prop-image-border-radius`
4. In chart controls add:
   - `prop-chart-type`, `prop-chart-labels`, `prop-chart-add-series`
   - indexed IDs for series label, values, color, remove.
5. In code controls add:
   - `prop-code-edit`, `prop-code-language`, `prop-code-font-size`, `prop-code-border-radius`
6. In table controls add:
   - `prop-table-add-row`, `prop-table-remove-row`, `prop-table-add-col`, `prop-table-remove-col`
   - `prop-table-header-row`, `prop-table-header-bg`, `prop-table-text-color`
   - indexed cell edit IDs only if needed by Phase 3 tests.
7. In misc controls add:
   - `prop-latex-edit`, `prop-html-edit`
   - IDs for callout/icon/qrcode/svg controls only if Phase 3 tests target them.
8. Do not add table merge IDs. Merge UI is not present.
9. Run existing tests before adding new tests.

## Todo List
- [ ] Common control IDs added.
- [ ] Shape/image/chart/code/table/misc IDs added.
- [ ] No canvas test ID changed.
- [ ] Existing E2E subset passes.

## Verification & Tests
- `npx playwright test tests/e2e/properties-panel.spec.js --reporter=list`
- `npx playwright test tests/e2e/coverage-gaps.spec.js --reporter=list`
- `npm run build`
- Optional smoke: `npx playwright test --list`

## Success Criteria
- [ ] Current property panel tests pass unchanged.
- [ ] Current coverage gap canvas tests pass unchanged.
- [ ] `rg "canvas-resize-handle|canvas-rotation-handle" client/src tests/e2e` returns no new dependencies.
- [ ] `rg "resize-handle-se|rotation-handle" client/src tests/e2e` still finds current IDs.
- [ ] Build succeeds.

## Risk Assessment
- Risk: custom UI components may not pass `data-testid` to DOM.
- Mitigation: verify `Input`, `Select`, `ColorPicker`, `Button` spread unknown props. If not, update wrappers once.
- Risk: IDs drift from docs.
- Mitigation: update `docs/code-standards.md` in same phase if ID list changes.

## Security Considerations
- Test IDs expose no sensitive data.
- Do not add data attributes containing presentation content, tokens, URLs, or API keys.

## Next Steps
- Phase 3 uses these IDs for behavior tests.


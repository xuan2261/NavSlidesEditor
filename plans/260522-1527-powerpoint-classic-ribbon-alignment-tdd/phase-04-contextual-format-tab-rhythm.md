# Phase 04: Contextual Format Tab Rhythm

## Context Links

- [Scout report](./reports/ribbon-alignment-scout-report.md)
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-format-tab-element-position-size-rotation-controls.jsx`
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-format-tab-element-position-size-rotation-controls.test.jsx`

## Overview

Priority: P0  
Status: Complete  
Goal: make Format tab feel like a PowerPoint contextual tab in both empty and selected states.

## Key Insights

- Current no-selection state is a standalone row: `Select an element to format`.
- Classic ribbon should still show a stable group-like area, not free-floating text.
- Selected state already uses groups; keep that.
- Selected-state tests must seed/select elements deterministically to avoid CI flakes.

## Requirements

- Functional: no-selection state uses `RibbonTabContentRow` and `RibbonSection`.
- Functional: selected states keep existing element-type contextual controls.
- Functional: Format commands must not mutate stale or wrong targets after deselect/delete.
- Non-functional: no button clipping or vertical rhythm regression.

## Architecture

No-selection design:

```jsx
<RibbonTabContentRow>
  <RibbonSection label="Selection">
    <span>Select an element to format</span>
  </RibbonSection>
</RibbonTabContentRow>
```

Optional: disabled groups are not needed now; avoid fake disabled controls.
If `RibbonTabContentRow` is not created in Phase 02, use equivalent row markup with `data-ribbon-content-row`.

## Related Code Files

- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-format-tab-element-position-size-rotation-controls.jsx`
- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-format-tab-element-position-size-rotation-controls.test.jsx`
- Modify: `C:\Work\NavSlidesEditor\tests\e2e\ribbon-layout.spec.js`
- Modify visual spec if needed: `C:\Work\NavSlidesEditor\tests\e2e\visual\ribbon-tabs-across-all-seven-tabs-dark-theme.spec.js`

## Implementation Steps

1. Add unit test: no selected element renders `RibbonSection` label `Selection`.
2. Add unit test: no selected element still has classic row wrapper.
3. Update component no-selection return.
4. Add E2E: Format tab no-selection has no vertical overflow and first section left-flow.
5. Add selected-element Format E2E scenario with deterministic seed:
   - create a shape/text element with stable locator/id.
   - assert selected state is visible before switching to Format.
   - assert real contextual prefix groups (`Fill`/`Stroke` for shape, text/image equivalents where covered) plus Position/Size/Align/Properties.
6. Add stale-selection guard: select element, focus a Format command, deselect/delete, press Enter/Space, assert no exception and no wrong-target mutation.

## Phase Tests

- `npm run test -- client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.test.jsx`
- `npm run test:e2e -- tests/e2e/ribbon-layout.spec.js --project=chromium`
- `npm run test:e2e -- tests/e2e/visual/ribbon-tabs-across-all-seven-tabs-dark-theme.spec.js --project=chromium` if snapshots updated.

## Todo List

- [x] Add failing unit tests.
- [x] Implement no-selection `RibbonSection`.
- [x] Add deterministic selected Format E2E geometry checks.
- [x] Add stale-selection/no-wrong-target guard.
- [ ] Update visual baseline only after geometry tests pass.

## Success Criteria

- Format empty state aligns like other tabs.
- Format selected state unchanged functionally.
- Tests cover empty and selected states.
- Deselect/delete transition renders empty state or no-ops safely, without mutating another element.

## Risk Assessment

- Risk: screen reader label changes. Mitigation: keep visible text and accessible tab panel name unchanged.
- Risk: selected-state E2E flakes. Mitigation: use deterministic seed/locator, assert selection before tab switch, and wait active tabpanel render before geometry checks.

## Security Considerations

- None.

## Next Steps

- Phase 05 validates density/overflow under viewport pressure.

## Unresolved Questions

- None.

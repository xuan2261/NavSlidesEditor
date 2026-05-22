# Phase 02: Shared Ribbon Layout Primitives

## Context Links

- [Phase 01](./phase-01-baseline-and-classic-ribbon-contract.md)
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-section.jsx`
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-panel.jsx`

## Overview

Priority: P0  
Status: Complete  
Goal: harden only the shared layout contract needed by the failing gates, without forcing a broad wrapper refactor across healthy tabs.

<!-- Updated: Validation Session 1 - shared row primitive remains conditional; create only if 2+ touched tabs need the same wrapper. -->

## Key Insights

- Many tab files repeat row classes, but current implementation is mostly healthy.
- KISS: do not introduce a big layout framework.
- Preferred first move: stable selectors plus a class constant/helper. Extract a component only if two or more touched tabs need the same source change.
- Active command row is the single horizontal scroll owner; avoid nested/double scroll.

## Requirements

- Functional: touched tab contents expose the same row selector/scroll contract.
- Non-functional: no visual layout regression at 1280px.
- Keep files under 200 lines where practical.

## Architecture

Preferred minimal design if a component is still justified:

```jsx
// ribbon-tab-content-row.jsx
const RibbonTabContentRow = React.forwardRef(function RibbonTabContentRow(
  { children, className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      data-ribbon-content-row
      className={cn('flex items-stretch gap-0 h-full overflow-x-auto', className)}
      {...props}
    >
      {children}
    </div>
  )
})

export default RibbonTabContentRow
```

If not extracting, add `data-ribbon-content-row` and consistent row classes only to currently touched wrappers. Do not change healthy tabs just for taxonomy cleanup.

## Related Code Files

- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-section.jsx`
- Modify likely: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-format-tab-element-position-size-rotation-controls.jsx`
- Modify only if a failing gate proves drift: `home-tab-content.jsx`, `ribbon-insert-tab-element-galleries-panel.jsx`, `design-tab-content.jsx`, `transitions-tab-content.jsx`, `ribbon-element-animation-effect-controls-tab-content.jsx`, `ribbon-view-mode-controls-content.jsx`
- Create only if justified: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-tab-content-row.jsx`
- Modify tests: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-ui-consistency.test.jsx`

## Implementation Steps

1. Add stable `data-ribbon-section` and `data-ribbon-section-label` to `RibbonSection`.
2. Decide whether Format-only row markup is enough. If yes, do not create `RibbonTabContentRow`.
3. If extracting `RibbonTabContentRow`, forward `ref`, `...props`, `data-*`, `aria-*`, and event handlers.
4. Ensure only the active row owns horizontal scroll; do not leave both panel and nested rows as competing scroll owners.
5. Keep no-selection Format for Phase 04, but make it use the same row selector now if simple.
6. Run targeted tests.

## Phase Tests

- `npm run test -- client/src/components/ribbon/ribbon-ui-consistency.test.jsx client/src/components/ribbon/ribbon-section.test.jsx`
- `npm run test -- client/src/components/ribbon/ribbon-shell-tab-navigation-and-rendering.test.jsx`
- `npm run lint`

## Todo List

- [x] Add stable ribbon section selectors.
- [x] Decide if `RibbonTabContentRow` is necessary.
- [x] Add unit coverage.
- [x] Replace only wrappers proven by failing gates.
- [x] Verify no import cycles.

## Success Criteria

- Touched rows and sections have stable selectors for E2E metrics.
- All tab wrappers still render same visible controls.
- Existing ribbon shell tests pass.
- No nested scroll ambiguity remains in measured active row.

## Risk Assessment

- Risk: adding a new file creates unnecessary churn. Mitigation: prefer selectors/helper constant unless repeated source changes prove a component is needed.
- Risk: className merge changes order. Mitigation: assert critical classes present, not exact string.
- Risk: double-scroll hides controls from metrics. Mitigation: document row as scroll owner and measure row overflow explicitly.

## Security Considerations

- None.

## Next Steps

- Phase 03 audits and adjusts group taxonomy/order without changing primitive behavior.

## Unresolved Questions

- None.

# Phase 01: Baseline And Classic Ribbon Contract

## Context Links

- [Plan overview](./plan.md)
- [Research summary](./research/powerpoint-classic-ribbon-research-summary.md)
- [Scout report](./reports/ribbon-alignment-scout-report.md)
- Existing files: `C:\Work\NavSlidesEditor\client\src\components\ribbon\*`
- Existing tests: `C:\Work\NavSlidesEditor\tests\e2e\ribbon-layout.spec.js`

## Overview

Priority: P0  
Status: Complete  
Goal: lock the narrow target contract before edits. Define what "PowerPoint desktop classic" means in testable behavior terms without broad ribbon redesign.

## Key Insights

- Current implementation is close; main known outlier is Format no-selection rhythm.
- Whole-tab centering is wrong for classic ribbon.
- Group-level centering is correct.
- Ribbon height is fixed at current `80px` for this plan.

## Requirements

- Functional: document explicit layout contract and state acceptance matrix.
- Functional: introduce stable ribbon DOM contract selectors if missing.
- Non-functional: no behavior change in this phase except tests/docs.
- TDD: failing/guard tests first, but do not leave shared branch/CI red.

## Architecture

Contract:

```text
RibbonPanel
  -> Tabs.Content
    -> TabContentRow: left-flow, single horizontal scroll owner
      -> RibbonSection: shrink-0 group with stable selector
        -> centered controls
        -> bottom centered group label
```

Stable selector contract:

- `data-ribbon-content-row`: active tab command row and horizontal scroll owner.
- `data-ribbon-section`: each ribbon group container.
- `data-ribbon-section-label`: visible group label.

## Related Code Files

- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-ui-consistency.test.jsx`
- Modify: `C:\Work\NavSlidesEditor\tests\e2e\ribbon-layout.spec.js`
- Create: no source file.
- Delete: none.

## Implementation Steps

1. Add a short test-only definition of classic contract in `ribbon-ui-consistency.test.jsx`.
2. Assert `RibbonSection` exposes stable selector attributes and accessible visible label structure; do not assert raw Tailwind class strings as the contract.
3. Add E2E helper assertion in `ribbon-layout.spec.js`: active tab's first visible section starts near left edge of `data-ribbon-content-row`, not centered in panel.
4. Add state matrix cases for Home idle/text-editing and Format empty/selected-shape before broader tab checks.
5. Mark tests with precise failure messages.
6. If a new assertion is intentionally red before implementation, keep it in the same atomic feature branch slice and make it pass before final review; do not commit unquarantined red tests.

## Phase Tests

- `npm run test -- client/src/components/ribbon/ribbon-ui-consistency.test.jsx`
- `npm run test:e2e -- tests/e2e/ribbon-layout.spec.js --project=chromium`

Expected during local TDD: new tests may fail for Format empty state or missing selectors. Before handoff/review, the phase must not leave unquarantined red tests.

## Todo List

- [x] Add classic contract unit assertions.
- [x] Add left-flow E2E geometry assertion.
- [x] Capture current failures in notes before implementation.

## Success Criteria

- Contract is testable.
- Failures identify exact tab/section issue.
- No app source modified in this phase.
- No known-red test is left active without a matching same-slice fix.

## Risk Assessment

- Risk: geometry tests flaky due animations. Mitigation: wait for tab panel stable, query only active `tabpanel`, and use bounding boxes with tolerance.
- Risk: class-level assertions become brittle. Mitigation: assert stable selectors and rendered geometry/semantics instead of Tailwind internals.

## Security Considerations

- None. UI layout only.

## Next Steps

- Phase 02 introduces shared layout primitive or helper classes to satisfy contract.

## Unresolved Questions

- None. Layout-only, but tests must preserve command visibility and keyboard access for existing actions.

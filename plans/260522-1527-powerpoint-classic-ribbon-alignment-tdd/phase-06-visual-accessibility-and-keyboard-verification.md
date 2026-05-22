# Phase 06: Visual Accessibility And Keyboard Verification

## Context Links

- Visual spec: `C:\Work\NavSlidesEditor\tests\e2e\visual\ribbon-tabs-across-all-seven-tabs-dark-theme.spec.js`
- Keyboard spec: `C:\Work\NavSlidesEditor\tests\e2e\a11y\keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js`
- UI guidelines: `C:\Work\NavSlidesEditor\docs\design-guidelines.md`

## Overview

Priority: P1  
Status: Blocked on canonical snapshot refresh  
Goal: verify classic ribbon visual consistency and keyboard/a11y behavior after layout changes.

<!-- Updated: Validation Session 1 - visual snapshot updates remain downstream of geometry and keyboard/a11y gates, using canonical Playwright/Linux workflow. -->

## Key Insights

- Classic ribbon must still be accessible.
- Visual baselines should be updated only after semantic/geometry tests pass.
- Format needs both empty and selected baselines.
- Missing required tabs must fail hard; optional/removed tab names must not be silently screenshot under the wrong baseline.

## Requirements

- Functional: tabs keyboard navigation unchanged.
- Functional: dropdowns still Enter/Space/Escape/focus return.
- Non-functional: dark theme visual snapshots deterministic.
- Non-functional: any snapshot update is generated in the repository's canonical Playwright/Linux environment, not local host rendering.

## Architecture

Verification layers:

1. Unit: DOM contract.
2. E2E geometry: clipping/overflow/left-flow.
3. A11y keyboard: tablist and menus.
4. Visual snapshots: final appearance.

Canonical required tabs: Home, Insert, Design, Format, Transitions, Animations, View.

## Related Code Files

- Modify: `C:\Work\NavSlidesEditor\tests\e2e\visual\ribbon-tabs-across-all-seven-tabs-dark-theme.spec.js`
- Modify if needed: `C:\Work\NavSlidesEditor\tests\e2e\a11y\keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js`
- Modify if needed: `C:\Work\NavSlidesEditor\tests\e2e\pages\visual-snapshot-deterministic-freeze-and-helper.js`

## Implementation Steps

1. Add visual test state for Format empty and selected shape/text only if geometry gates pass.
2. Keep existing all-tab dark baseline, but assert the canonical required tab list first.
3. Remove or fail any stale conditional `draw` handling unless the app explicitly reintroduces Draw as a required tab.
4. Run keyboard spec after layout changes.
5. Update snapshots only if intended and only from canonical Playwright/Linux workflow.
6. Attach/record before-after diff artifact paths in the final report.

## Phase Tests

- `npm run test:e2e -- tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js --project=chromium`
- `npm run test:e2e -- tests/e2e/visual/ribbon-tabs-across-all-seven-tabs-dark-theme.spec.js --project=chromium`
- Required if snapshots change: CI-equivalent visual baseline workflow from docs.

## Todo List

- [x] Assert canonical required tab list.
- [x] Add Format empty/selected visual cases if geometry gates pass.
- [x] Validate tab keyboard navigation.
- [x] Validate dropdown keyboard behavior still passes.
- [ ] Update intended snapshots only in canonical environment.

## Success Criteria

- Keyboard-only navigation passes.
- Visual snapshots reflect classic left-flow/centered group content.
- No accidental screenshot drift unrelated to ribbon.
- Required tab inventory cannot silently skip or screenshot the wrong active tab.

## Risk Assessment

- Risk: platform-specific screenshot diffs. Mitigation: use existing deterministic helper and mandatory CI Linux baseline workflow for updates.
- Risk: stale tab names hide missing-tab regressions. Mitigation: assert canonical required tabs before screenshots.

## Security Considerations

- None.

## Next Steps

- Phase 07 updates docs and final verification report.

## Unresolved Questions

- None.

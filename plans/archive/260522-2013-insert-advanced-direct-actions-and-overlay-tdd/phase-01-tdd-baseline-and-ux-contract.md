# Phase 01 - TDD Baseline And UX Contract

## Context Links

- [Investigation Report](./reports/ribbon-advanced-investigation-report.md)
- [Classic Ribbon Plan](../260522-1527-powerpoint-classic-ribbon-alignment-tdd/plan.md)
- `C:\Work\NavSlidesEditor\tests\e2e\ribbon-layout.spec.js`
- `C:\Work\NavSlidesEditor\tests\e2e\pages\RibbonInsertHelper.js`

## Overview

- Priority: P1
- Status: Complete
- Goal: lock intended behavior before implementation. Current tests encode old grouped behavior; update them to fail for current code and pass after direct-action refactor.

## Key Insights

- Existing E2E helper maps fixed Advanced actions to dropdown group.
- Existing layout spec expects `Advanced` grouped.
- Do not add visual-only tests first; semantic and geometry tests are more stable.

## Requirements

- Functional: tests assert five fixed Advanced actions are direct buttons inside Insert tab.
- Functional: tests assert `Games` and plugin items stay launcher/menu based.
- Non-functional: tests must use role/name selectors and `data-ribbon-*` metrics.

## Architecture

- No production architecture changes in this phase.
- Test contract becomes the source of truth for Phase 02-05.

## Related Code Files

- Modify: `C:\Work\NavSlidesEditor\tests\e2e\ribbon-layout.spec.js`
- Modify: `C:\Work\NavSlidesEditor\tests\e2e\pages\RibbonInsertHelper.js`
- Modify/create: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-insert-tab-element-galleries-panel.test.jsx`

## Implementation Steps

1. Update `CRITICAL_VISIBLE_CONTROLS.Insert` to include direct action names:
   - `Add kinetic text`
   - `Add math grid`
   - `Add Anime.js`
   - `Add Three.js`
   - `Add timeline`
2. Replace comments that say `Advanced grouped` with direct fixed actions + grouped dynamic launcher.
3. Update `RibbonInsertHelper.GROUPED_ITEMS`:
   - Remove fixed advanced actions.
   - Keep game flow through launcher.
4. Add source/component test proving fixed actions are direct `Button` instances, not `role="menuitem"`.
5. Add one negative assertion: direct fixed actions should be reachable without opening `Advanced`.

## Todo List

- [x] Update E2E helper contract.
- [x] Update ribbon layout expected controls.
- [x] Add unit/source test for direct Advanced action contract.
- [x] Run targeted tests and verify expected red on current implementation.

## Completion Notes

- Red state confirmed before implementation: updated direct-action tests failed against the old grouped Advanced menu.
- Final green state included the ribbon Vitest slice and Insert Playwright layout checks listed in the final verification report.

## Tests

- `npx vitest run client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx`
- `npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium -g "Insert tab"`

Expected before implementation: new/updated tests fail because fixed Advanced actions are still menu items.

## Success Criteria

- Failing tests clearly describe old behavior.
- No broad snapshots updated.
- No production code changed.

## Risk Assessment

- Risk: brittle source parsing. Mitigation: prefer component/role tests where practical.
- Risk: test names overfit labels. Mitigation: align names with existing `aria-label` contract.

## Security Considerations

- None; UI insertion surface only. Trusted author content policy unchanged.

## Next Steps

- Proceed to Phase 02 after TDD red state is confirmed.

## Unresolved Questions

- None.

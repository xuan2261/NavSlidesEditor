# Phase 05 - Responsive Keyboard And Visual Verification

## Context Links

- [Phase 04](./phase-04-ribbon-overlay-clipping-hardening.md)
- `C:\Work\NavSlidesEditor\tests\e2e\ribbon-layout.spec.js`
- `C:\Work\NavSlidesEditor\tests\e2e\a11y\keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js`
- `C:\Work\NavSlidesEditor\tests\e2e\visual\ribbon-tabs-across-all-seven-tabs-dark-theme.spec.js`

## Overview

- Priority: P1
- Status: Complete
- Goal: prove new Insert Advanced layout and ribbon-wide floating popup contract work across viewport pressure and keyboard-only usage.

## Key Insights

- Insert row may scroll horizontally at 1024/900/768, but visible controls must not clip or overlap.
- Visual snapshots are downstream; do not refresh them until semantic/geometry tests pass.
- Keyboard flows catch most portal regressions.
- Validation Session 1 expanded overlay verification beyond Insert to every ribbon popup migrated from `absolute top-full`.
- Red-team review added Header AI/Share because they use equivalent `top-full` placement in `ribbon-header-bar.jsx`.
- Validation Session 2 requires overlay geometry to remain correct after resize/scroll recompute and expects incremental surface verification as migrations land.

<!-- Updated: Validation Session 1 - verification broadened to all migrated ribbon popup surfaces. -->
<!-- Updated: Validation Session 2 - resize/scroll recompute and incremental migrated-surface checks added. -->

## Requirements

- Functional: all fixed Advanced direct buttons insert elements.
- Functional: keyboard can reach direct buttons and launcher.
- Functional: keyboard can open/close Advanced launcher, Games surface, Shape gallery, and Table picker with focus returning to the correct trigger.
- Functional: keyboard can open/close File, Header AI/Share, Design, Transitions, Animations, and Paragraph compact popups with Escape/outside-click/focus-return behavior preserved.
- Functional: open migrated overlays remain anchored and viewport-clamped after resize and scroll events.
- Functional: opening another popup in the same ribbon area closes the previous popup without a global popup manager.
- Non-functional: no vertical overflow in active row.
- Non-functional: 1280px should have no horizontal overflow if feasible; otherwise final verification must include measured row width and prove all controls remain reachable without clipping/overlap.
- Non-functional: if snapshots change, update only with canonical Playwright workflow.

## Architecture

- Use existing `EditorPage.getRibbonLayoutMetrics`.
- Add or extend a helper/selector contract to detect open overlay geometry, such as `getRibbonPopupGeometry(surfaceName)` or stable `data-ribbon-popup` attributes.
- Keep assertions scroll-aware: horizontal overflow allowed under narrow viewport.

## Related Code Files

- Modify: `C:\Work\NavSlidesEditor\tests\e2e\ribbon-layout.spec.js`
- Modify: `C:\Work\NavSlidesEditor\tests\e2e\pages\ribbon-tab-toolbar-helper.js`
- Modify: `C:\Work\NavSlidesEditor\tests\e2e\pages\RibbonInsertHelper.js`
- Modify: `C:\Work\NavSlidesEditor\tests\e2e\games\game-elements.spec.js`
- Modify: `C:\Work\NavSlidesEditor\tests\e2e\plugin-runtime-insert-render-persistence.spec.js`
- Modify/read: `C:\Work\NavSlidesEditor\tests\e2e\parallax-element-insertion-property-controls-and-rendering.spec.js`
- Modify/read: tests covering File, Header AI/Share, Design, Transitions, Animations, and Paragraph compact dropdown behavior.
- Maybe update snapshots under `C:\Work\NavSlidesEditor\tests\e2e\visual\...snapshots\`

## Implementation Steps

1. Add viewport matrix assertions for direct Advanced controls.
2. Add keyboard test:
   - focus Insert tab
   - tab to `Add kinetic text`
   - press Enter
   - verify element count increments
3. Add launcher keyboard test:
   - focus launcher
   - Enter opens menu
   - Escape closes menu and restores focus
4. Add Games keyboard test:
   - launcher opens
   - `Games...` opens Games surface
   - first game option receives focus
   - Escape closes Games and returns focus to launcher
5. Add Shape and Table keyboard/geometry checks.
6. Add File, Header AI/Share, Design, Transitions, Animations, and Paragraph compact popup regression checks.
7. Add overlay geometry test for 1280 and 768 widths across migrated surfaces.
8. Add resize/scroll recompute geometry checks for representative migrated surfaces and at least one right-edge trigger case.
9. Add sibling-popup close checks for ribbon areas with multiple local popups.
10. Update direct E2E callers that hard-code old Advanced behavior.
11. Run visual baseline only after all targeted semantic tests pass.

## Todo List

- [x] Add viewport direct-control checks.
- [x] Add keyboard insertion check.
- [x] Add launcher Escape/focus check.
- [x] Add Games Escape/focus check.
- [x] Add Shape/Table keyboard and overlay geometry checks.
- [x] Add File/Header AI/Share/Design/Transitions/Animations/Paragraph popup keyboard and overlay geometry checks.
- [x] Add overlay geometry check across 1280 and 768 widths.
- [x] Add resize/scroll recompute geometry checks.
- [x] Add local sibling-popup close checks.
- [x] Update direct E2E tests that bypass `RibbonInsertHelper`.
- [x] Run visual baseline and update snapshots only if intentional.

## Completion Notes

- No visual baseline refresh was needed; no snapshots were updated.
- The final Insert Playwright slice passed at 1280/1024/900/768 coverage with no clipping/overlap failures. The launcher is icon-only at 1280 to reduce row pressure.

## Tests

- `npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium`
- `npx playwright test tests/e2e/games/game-elements.spec.js --project=chromium`
- `npx playwright test tests/e2e/plugin-runtime-insert-render-persistence.spec.js --project=chromium`
- `npx playwright test tests/e2e/parallax-element-insertion-property-controls-and-rendering.spec.js --project=chromium`
- `npx playwright test tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js --project=chromium`
- `npx playwright test tests/e2e/visual/ribbon-tabs-across-all-seven-tabs-dark-theme.spec.js --project=chromium`
- `npm run build`

## Success Criteria

- 1280px Insert has no horizontal overflow if feasible; if not feasible, document why and require no clipping/overlap.
- 1024/900/768 can scroll horizontally but no hidden vertical clipping.
- Keyboard-only path reaches all direct buttons and launcher.
- Keyboard-only path reaches Games surface, Shape gallery, and Table picker; Escape returns focus predictably.
- Keyboard-only path reaches every migrated ribbon popup surface, including Header AI/Share; Escape/outside-click/focus return stay predictable.
- Open migrated overlays recompute after resize/scroll and remain clamped inside viewport.
- Opening a sibling popup closes the prior popup in that ribbon area without relying on a global popup manager.
- Visual diff matches intentional Insert Advanced changes only.

## Risk Assessment

- Risk: visual baseline differs by OS. Mitigation: use repo canonical Linux snapshot workflow if regenerating.
- Risk: Playwright selector ambiguity with old/new trigger names. Mitigation: exact accessible names.

## Security Considerations

- No new security behavior. Validate no accidental plugin sandbox change.

## Next Steps

- Phase 06 docs and final release gate.

## Unresolved Questions

- None.

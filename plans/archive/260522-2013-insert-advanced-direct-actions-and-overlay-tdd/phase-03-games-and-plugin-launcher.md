# Phase 03 - Games And Plugin Launcher

## Context Links

- [Phase 02](./phase-02-advanced-direct-icon-actions.md)
- `C:\Work\NavSlidesEditor\client\src\plugins\plugin-registry.js`
- `C:\Work\NavSlidesEditor\tests\e2e\pages\RibbonInsertHelper.js`

## Overview

- Priority: P1
- Status: Complete
- Goal: keep dynamic/multi-choice Advanced items discoverable without re-hiding fixed commands.

## Key Insights

- `Games...` is not a single insert command; it opens a second choice surface.
- Plugin items are dynamic and can overflow if rendered directly.
- One launcher is enough; avoid separate `Games` and `Plugins` dropdowns unless plugin count demands it later.

## Requirements

- Functional: `Games...` remains reachable through launcher.
- Functional: plugin insert items remain reachable through launcher.
- Functional: launcher has stable accessible name, e.g. `More advanced insert options`.
- Functional: Games second-level surface remains reachable through the launcher.
- Functional: after selecting a plugin insert item, close the launcher and return focus to the launcher trigger when using the shared overlay.
- Non-functional: overlay-dependent Games/plugin Escape, outside-click, first-option focus, and focus-return behavior is completed in Phase 04 with `RibbonFloatingOverlay`.

<!-- Updated: Validation Session 1 - selection close behavior returns focus to launcher trigger. -->

## Architecture

- Keep `RibbonDropdownMenuGroup` or replacement overlay trigger for dynamic items.
- Rename trigger label only if needed for clarity:
  - Preferred accessible name: `More advanced insert options`
  - Visible text may stay hidden on smaller breakpoints.
- Dynamic menu contains:
  - `Games...`
  - plugin items from `pluginTypes`
- Games surface is treated as its own popup contract, not an incidental fixed div. Its clipping-safe geometry/focus contract is implemented with Phase 04 overlay work.

## Related Code Files

- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-insert-tab-element-galleries-panel.jsx`
- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-dropdown-menu-group-trigger.jsx`
- Modify: `C:\Work\NavSlidesEditor\tests\e2e\pages\RibbonInsertHelper.js`
- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-plugin-insert.test.jsx`
- Modify: `C:\Work\NavSlidesEditor\tests\e2e\games\game-elements.spec.js`
- Modify: `C:\Work\NavSlidesEditor\tests\e2e\plugin-runtime-insert-render-persistence.spec.js`
- Read/update if needed: `C:\Work\NavSlidesEditor\tests\e2e\parallax-element-insertion-property-controls-and-rendering.spec.js`

## Implementation Steps

1. Keep dropdown item array limited to `Games...` and `pluginTypes`.
2. Hide launcher when there are no dynamic items? Recommendation: keep visible because `Games...` always exists.
3. Update `RibbonInsertHelper`:
   - Direct fixed actions click direct buttons.
   - Game insertion opens launcher, clicks `Games...`, then game button.
4. Add plugin case test: registered insertable plugin appears in launcher and calls `onAddPluginElement`.
5. Add empty-plugin test: launcher remains visible for `Games...`; plugin actions are absent.
6. Confirm launcher Escape closes and restores focus where the current primitive supports it.
7. Add plugin selection tests for callback, popup close, and focus return; finalize overlay-specific focus behavior in Phase 04.
8. Update direct E2E callers that hard-code `Advanced` trigger.

## Todo List

- [x] Split fixed vs dynamic advanced items.
- [x] Update helper game path.
- [x] Add plugin launcher test.
- [x] Add empty-plugin launcher test.
- [x] Add launcher keyboard close/focus restore test.
- [x] Add plugin selection close/focus-return tests.
- [x] Defer Games surface keyboard/outside-click/focus restore tests to Phase 04 overlay migration.
- [x] Update direct E2E callers for Games/plugin insertion.

## Completion Notes

- `Games...` and plugin insert items remain in `More advanced insert options`.
- Game/plugin E2E callers now use the launcher flow instead of the old grouped Advanced path.

## Tests

- `npx vitest run client/src/components/ribbon/ribbon-plugin-insert.test.jsx`
- `npx vitest run client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.test.jsx`
- `npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium -g "games are keyboard reachable"`
- `npx playwright test tests/e2e/games/game-elements.spec.js tests/e2e/plugin-runtime-insert-render-persistence.spec.js --project=chromium`

## Success Criteria

- `Games...` visible only after launcher opens.
- Plugin insert items remain available.
- Fixed Advanced direct buttons are not duplicated in launcher.
- Empty plugin list still shows launcher with `Games...` only.
- Plugin selection closes the launcher and restores focus to the launcher trigger where supported by the shared overlay primitive.
- Games surface close/focus behavior is covered by Phase 04, not accepted as complete in this phase alone.

## Risk Assessment

- Risk: test selectors conflict if trigger remains named `Advanced`. Mitigation: use exact accessible names and update helper.
- Risk: plugin list may be empty in unit tests. Mitigation: inject representative `pluginTypes`.

## Security Considerations

- Plugin sandbox/security unchanged. No plugin runtime permission changes.

## Next Steps

- Phase 04 fixes clipping for launcher and other ribbon popups.

## Unresolved Questions

- None.

---
phase: 4
title: "Advanced Flyout Hardening"
status: complete
effort: "3-4h"
---

# Phase 4: Advanced Flyout Hardening

## Context Links

- [Dropdown component](../../client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.jsx)
- [Insert tab](../../client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx)
- [Game E2E](../../tests/e2e/games/game-elements.spec.js)

## Overview

Priority: P1. Keep Advanced grouped but replace cramped 140px menu with a wider flyout/palette and robust keyboard behavior.

## Key Insights

- Advanced contains low-frequency items; grouping remains valid.
- Current menu width feels like a small dropdown and can obscure content.
- Focus trap is not appropriate. Need Escape close and focus restore.

## Requirements

Functional:
- `Advanced` trigger opens flyout with Kinetic Text, Math Grid, Anime.js, Three.js, Timeline, Games.
- Flyout width 240-280px, 2-column layout if practical.
- `Games...` opens existing game gallery.
- Selecting an item closes Advanced flyout.

Non-functional:
- `aria-haspopup="menu"`, `aria-expanded`.
- Menu items reachable by Tab and Enter/Space.
- Escape closes and returns focus to trigger.
- Click outside closes.

## Architecture

Option 1: Generalize `RibbonDropdownMenuGroup` with `menuClassName`/`grid` props.

Option 2: Create focused `RibbonAdvancedFlyoutMenu` component.

Recommended: Option 1 if small; Option 2 if generalization makes dropdown component unclear. KISS over premature reuse.

## Related Code Files

Modify:
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-dropdown-menu-group-trigger.jsx`
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-insert-tab-element-galleries-panel.jsx`

Optional create:
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-advanced-flyout-menu.jsx`
- `D:\NCKH_2025\NavSlidesEditor\client\src\components\ribbon\ribbon-advanced-flyout-menu.test.jsx`

## Implementation Steps

1. Add component test first if creating/expanding flyout component:
   - Opens on click.
   - `aria-expanded` toggles.
   - Escape closes and focuses trigger.
   - Enter/Space activates item.
2. Implement wider flyout:
   - Prefer `w-[260px]` or `min-w-[240px]`.
   - Use `grid grid-cols-2 gap-1` for items if labels fit.
   - Keep `Games...` readable.
3. Wire `Advanced` section to new flyout behavior.
4. Preserve game gallery flow.
5. Re-run layout + game reachability tests.

## Todo List

- [x] Add component test for Advanced flyout behavior.
- [x] Implement wider flyout/palette.
- [x] Preserve `Games...` flow.
- [x] Add focus restore on Escape.
- [x] Run layout and game E2E.

## Success Criteria

- Advanced no longer renders cramped 140px dropdown.
- Keyboard and Escape behavior pass tests.
- Game insertion still works.

## Verification

```powershell
npm run test -- --run client/src/components/ribbon
$env:PLAYWRIGHT_CLIENT_PORT=4286; $env:PLAYWRIGHT_SERVER_PORT=4315; npx playwright test tests/e2e/ribbon-layout.spec.js tests/e2e/games/game-elements.spec.js --project=chromium
```

## Risk Assessment

- Risk: 2-column labels overflow. Mitigation: use single-column 260px if measurement shows clipping.
- Risk: click-outside closes before nested game gallery opens. Mitigation: run item action before close or explicitly handle `Games...` by closing Advanced then opening fixed game gallery.

## Security Considerations

- No new security boundary.

## Next Steps

Update E2E helpers and regression specs.

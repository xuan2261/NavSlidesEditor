# Phase 02 - Advanced Direct Icon Actions

## Context Links

- [Phase 01](./phase-01-tdd-baseline-and-ux-contract.md)
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-insert-tab-element-galleries-panel.jsx`
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-section.jsx`

## Overview

- Priority: P1
- Status: Complete
- Goal: expose fixed Advanced commands as direct icon buttons while preserving insertion callbacks.

## Key Insights

- Direct actions match Insert UX: one command, one icon button.
- Keep all callbacks already passed into `InsertTabContent`.
- Avoid new abstractions until launcher split needs them.

## Requirements

- Functional: direct buttons for `onAddKineticText`, `onAddMathGrid`, `onAddAnime`, `onAddThree`, `onAddTimeline`.
- Functional: labels/titles remain stable for tests and accessibility.
- Non-functional: 1280px should have no horizontal overflow if feasible; reachable horizontal scroll is acceptable only when measured and proven no clipping/overlap.

<!-- Updated: Validation Session 1 - 1280px overflow rule aligned with measured acceptance. -->

## Architecture

`InsertTabContent` Advanced section becomes:

```jsx
<RibbonSection label="Advanced">
  <div className="flex items-center gap-0.5">
    <Button aria-label="Add kinetic text" title="Kinetic Text">...</Button>
    ...
    <AdvancedMoreLauncher />
  </div>
</RibbonSection>
```

Keep the section a single ribbon group. Do not create a second row.

## Related Code Files

- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-insert-tab-element-galleries-panel.jsx`
- Modify: `C:\Work\NavSlidesEditor\client\src\__tests__\sparkles-icon-semantic-separation.test.jsx`
- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-insert-tab-element-galleries-panel.test.jsx`

## Implementation Steps

1. Replace fixed advanced items in dropdown `items` with direct buttons.
2. Use existing icons:
   - `Wand2` for Kinetic Text
   - `Grid3x3` for Math Grid
   - `Clapperboard` for Anime.js
   - `Box` for Three.js
   - `Clock` for Timeline
3. Use `variant="icon"` with `h-7 w-7`, matching other Insert icon buttons.
4. Preserve `onMouseDown(e.preventDefault())` pattern to protect editor focus/TipTap state.
5. Preserve keyboard activation using `handleKeyboardActivation`.
6. Ensure text labels do not render visibly inside icon-only buttons; use `title` and `aria-label`.

## Todo List

- [x] Add direct buttons.
- [x] Remove fixed items from Advanced dropdown item array.
- [x] Update semantic icon test if it references old menu location.
- [x] Verify insertion callbacks still fire.

## Completion Notes

- Fixed Advanced actions now render as direct icon-only buttons with stable accessible names.
- The launcher was kept icon-only to reduce 1280px ribbon pressure while preserving keyboard access.

## Tests

- `npx vitest run client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx`
- `npx vitest run client/src/__tests__/sparkles-icon-semantic-separation.test.jsx`
- `npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium -g "Insert tab should show"`

## Success Criteria

- Five fixed Advanced actions visible as direct icon buttons at 1280px.
- `RibbonInsertHelper` can insert each item without opening a menu.
- No adjacent icon duplication regression for existing Embed section.
- If 1280px horizontal scroll remains, final verification includes row width measurement and proves all controls remain visible/reachable without clipping or overlap.

## Risk Assessment

- Risk: Insert row too wide. Mitigation: icon-only buttons; Phase 05 viewport gates.
- Risk: callback semantics change. Mitigation: no factory rewrite; direct reuse of existing callback props.

## Security Considerations

- No new content trust boundary. HTML/JS-capable elements remain author-controlled.

## Next Steps

- Phase 03 separates dynamic Advanced items into a launcher.

## Unresolved Questions

- None.

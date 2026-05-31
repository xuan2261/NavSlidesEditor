# Phase 04 - Ribbon Overlay Clipping Hardening

## Context Links

- [Investigation Report](./reports/ribbon-advanced-investigation-report.md)
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-dropdown-menu-group-trigger.jsx`
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-insert-tab-element-galleries-panel.jsx`
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-file-dropdown-menu.jsx`
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-header-bar.jsx`
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\design-tab-content.jsx`
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\transitions-tab-content.jsx`
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-element-animation-effect-controls-tab-content.jsx`
- `C:\Work\NavSlidesEditor\client\src\components\ribbon\controls\paragraph-compact-dropdown-controls.jsx`
- `C:\Work\NavSlidesEditor\client\src\index.css`

## Overview

- Priority: P1
- Status: Complete
- Goal: stop ribbon popups from being clipped by `.tour-step-ribbon` and command row overflow by migrating every ribbon popup currently using `absolute top-full` to a shared clipping-safe overlay.

## Key Insights

- `z-index` cannot escape ancestor clipping.
- Current Advanced dropdown, Shape gallery, Table picker, File dropdown, Header AI/Share dropdowns, Design dropdowns, Transitions dropdown, Animations dropdown, and Paragraph compact dropdown all use `top-full` popup placement.
- A shared anchored overlay is justified because the clipping issue is a ribbon-wide popup contract problem, not only an Insert Advanced problem.
- Validation Session 2 approved a shared `RibbonFloatingOverlay` primitive, recompute-on-scroll/resize positioning, incremental surface migration, and local-only one-open-popup coordination.

<!-- Updated: Validation Session 1 - overlay scope broadened to all ribbon popups using absolute top-full. -->
<!-- Updated: Validation Session 2 - shared primitive, recompute behavior, and rollout order confirmed. -->

## Requirements

- Functional: popup renders outside clipped ribbon ancestor, anchored to trigger rect.
- Functional: click outside closes; Escape closes; trigger focus restored.
- Functional: every ribbon popup currently using `absolute top-full` or equivalent `top-full` placement is migrated to the same clipping-safe overlay contract in this PR.
- Functional: migrated surfaces include File, Header AI/Share, Design, Transitions, Animations, Paragraph compact controls, Insert Advanced launcher, Shape gallery, Table picker, and Games surface.
- Functional: open overlays recompute position on window resize and scroll, then clamp to viewport.
- Functional: keep at most one relevant ribbon popup open by local component/section coordination; do not add a global popup manager.
- Non-functional: no external package; no broad popper library.
- Non-functional: layout handles viewport right edge with simple clamp.

## Architecture

Recommended primitive:

```jsx
// client/src/components/ribbon/ribbon-floating-overlay.jsx
createPortal(
  <div style={{ position: 'fixed', top, left, minWidth }}>...</div>,
  document.getElementById('root') ?? document.body
)
```

Portal target rationale: Tailwind is configured with `important: '#root'` in `client/tailwind.config.js`, so every utility class is emitted as `#root .className`. Mounting the portal directly onto `document.body` would put the overlay outside `#root`, breaking utility classes like `bg-card`, `border-border`, and `shadow-xl` — the popup would render but appear transparent. Mounting inside `#root` preserves `position: fixed` viewport anchoring (no transform/filter/perspective on `#root`, so it does not become a fixed containing block) while keeping Tailwind specificity intact. `document.body` remains a fallback for SSR/test environments where `#root` is absent.

Behavior:

- Measure `triggerRef.current.getBoundingClientRect()`.
- Position below trigger with 4px gap.
- Clamp `left` to viewport width minus menu width minus 8px.
- Recalculate on open, window resize, and scroll.
- No focus trap; menu/flyout only.
- Treat both anchor and overlay root as inside for outside-click detection.
- Games surface should be anchored to the launcher trigger. Centered placement is allowed only if geometry/focus tests prove no clipping and predictable focus return.
- After a menu item inserts or selects content and the popup closes, return focus to the invoking trigger unless that surface already has a stronger existing focus contract.
- Use local state coordination to close sibling popups in the same ribbon area when opening a new one. Avoid a global overlay registry/manager unless a concrete regression proves local coordination insufficient.

## Related Code Files

- Create: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-floating-overlay.jsx`
- Create/modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-floating-overlay.test.jsx`
- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-dropdown-menu-group-trigger.jsx`
- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-insert-tab-element-galleries-panel.jsx`
- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-file-dropdown-menu.jsx`
- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-header-bar.jsx`
- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\design-tab-content.jsx`
- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\transitions-tab-content.jsx`
- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-element-animation-effect-controls-tab-content.jsx`
- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\controls\paragraph-compact-dropdown-controls.jsx`
- Modify: `C:\Work\NavSlidesEditor\client\src\components\ribbon\ribbon-dropdown-menu-group-trigger.test.jsx`
- Modify/add focused popup tests for each migrated surface where existing coverage is missing.

## Implementation Steps

1. Add `RibbonFloatingOverlay` with portal, anchor ref, close handlers, resize/scroll recompute, and viewport clamp.
2. Add primitive tests before migrating surfaces: portal render, Escape, outside-click, trigger exception, resize/scroll recompute, right-edge clamp, and focus restore.
3. Migrate `RibbonDropdownMenuGroup` menu body to the overlay.
4. Migrate `ShapeGallery` and `TableSizePicker` to the overlay, because they currently use the same clipped `absolute top-full` pattern.
5. Migrate `GameGalleryDropdown` to the overlay with tests for clipping, Escape/outside-click, and focus return.
6. Migrate File, Header AI/Share, Design, Transitions, Animations, and Paragraph compact dropdowns from `top-full` placement to `RibbonFloatingOverlay`.
7. After each migrated surface, run or add focused tests for that surface before continuing to the next migration.
8. Preserve existing menu roles: `role="menu"`, `role="menuitem"`, `listbox`, or button-grid semantics per surface.
9. Preserve File-style click-to-open interaction, but make it clipping-safe and consistent with outside-click/Escape/focus-return behavior.
10. Add viewport clamp test for right-edge trigger.
11. Add inside-click tests:
   - clicking overlay whitespace does not close.
   - clicking a menu item runs action and closes.
   - clicking the trigger while open toggles once, not double-closes from outside handler.
12. Add popup geometry helper/selector contract for E2E checks, e.g. `getRibbonPopupGeometry(surfaceName)` or stable `data-ribbon-popup` attributes.
13. Add plugin and game selection tests proving popup close and focus return to launcher trigger.
14. Verify opening a sibling popup closes the prior popup in the same ribbon area without introducing global state.

## Todo List

- [x] Add shared overlay primitive.
- [x] Add primitive tests before migration.
- [x] Migrate Advanced launcher.
- [x] Migrate Shape popup.
- [x] Migrate Table picker.
- [x] Migrate Games popup.
- [x] Migrate File dropdown.
- [x] Migrate Header AI/Share dropdowns.
- [x] Migrate Design dropdowns.
- [x] Migrate Transitions dropdown.
- [x] Migrate Animations dropdown.
- [x] Migrate Paragraph compact dropdown.
- [x] Add unit tests for portal, Escape, outside click, focus restore.
- [x] Add Playwright geometry test for menu escaping ribbon bounds.
- [x] Add right-edge clamp and inside-click tests.
- [x] Add resize/scroll recompute tests.
- [x] Add popup geometry helper or stable popup selector contract.
- [x] Add game/plugin selection close and focus-return tests.
- [x] Add local sibling-popup close tests where multiple popups can coexist.

## Completion Notes

- All planned ribbon popup surfaces were migrated; no red-team scoped popup was deferred.
- Post-review fixes added vertical viewport clamp and hidden pre-measure render to avoid a visible first frame at `(0, 0)`.

## Tests

- `npx vitest run client/src/components/ribbon/ribbon-floating-overlay.test.jsx`
- `npx vitest run client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.test.jsx`
- `npx vitest run client/src/components/ribbon/ribbon-file-dropdown-menu.test.jsx`
- `npx vitest run client/src/components/ribbon/controls/paragraph-formatting-and-alignment-controls.test.jsx`
- `npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium -g "Advanced"`
- `npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium -g "Shape|Table|Games"`
- `npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium -g "File|Design|Transitions|Animations|Paragraph"`
- `npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium -g "Header|AI|Share"`

Geometry assertion:

- Open File, Header AI/Share, Design, Transitions, Animations, Paragraph compact controls, Insert launcher, Shape gallery, Table picker, and Games surface.
- Read popup bounding box.
- Assert `popup.top > ribbonPanel.bottom - 2` when anchored below the ribbon.
- Assert popup is visible and not clipped.
- Assert popup left/right are clamped inside viewport with at least 8px margin when possible.

## Success Criteria

- Advanced launcher menu appears below ribbon panel, not inside 80px command area.
- Shape and Table popups appear outside clipped ribbon panel with explicit tests proving no clipping.
- Games popup has deterministic Escape/outside-click/focus return behavior.
- File, Header AI/Share, Design, Transitions, Animations, and Paragraph compact popups use the same clipping-safe behavior and keep their existing command semantics.
- Escape/click-outside/focus restore pass.

## Risk Assessment

- Risk: portal breaks outside-click detection. Mitigation: overlay owns document listener and trigger ref exception.
- Risk: scroll owner changes position while menu open. Mitigation: close or recompute on scroll; choose recompute if simple.
- Risk: SSR/test env lacks `document.body`. Mitigation: guard in effect; Vitest jsdom/happy-dom supported.
- Risk: multiple open ribbon popups conflict. Mitigation: opening one popup closes sibling popups in Insert content where practical.
- Risk: wider migration increases regression surface. Mitigation: migrate one popup primitive at a time and keep focused tests for each affected tab/surface.

## Security Considerations

- Portal changes DOM placement only. No new script execution or data exposure.

## Next Steps

- Phase 05 verifies responsive, keyboard, and visual behavior across supported viewports.

## Unresolved Questions

- Portal target was initially mounted on `document.body`, which caused popups to render transparent because Tailwind's `important: '#root'` specificity gate excluded utility classes outside `#root`. Resolved by mounting on `document.getElementById('root') ?? document.body`. E2E `expectRibbonPopupGeometry` now also asserts non-transparent `backgroundColor` to guard against the same regression class.

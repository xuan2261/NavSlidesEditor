---
phase: 7
title: "Find Replace And Ribbon Responsive Overflow"
status: pending
priority: P1
dependencies: [1, 2, 6]
---

# Phase 7: Find Replace And Ribbon Responsive Overflow

## Overview

Make find/replace and ribbon behavior resilient under constrained widths while keeping advanced Insert actions discoverable.

## Requirements

- Functional: find/replace remains usable within viewport; Insert ribbon advanced actions remain reachable inline or through a tested overflow path.
- Non-functional: no advanced-action hiding by default, no broad ribbon redesign, no loss of keyboard access.

## Architecture

For find/replace, replace fixed minimum width with responsive max-width/docking behavior. For ribbon, keep existing group hierarchy and reuse current scroll/dropdown primitives before adding any new overflow mechanism. Current `More advanced insert options` already covers games/plugins; this phase only fixes constrained-width reachability and affordance clarity.

## Related Code Files

- Modify: `client/src/components/FindReplaceBar.jsx`
- Modify: `client/src/components/ribbon/ribbon-panel.jsx`
- Modify: `client/src/components/ribbon/ribbon-tab-content-row.jsx`
- Modify: `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`
- Modify: `client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.jsx` if overflow uses existing dropdown primitives.
- Test: `client/src/components/find-replace-vertical-slides.test.jsx`
- Test: `client/src/components/find-replace-helpers.test.js`
- Existing: `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx`
- Existing: `client/src/components/ribbon/ribbon-shell-tab-navigation-and-rendering.test.jsx`
- E2E: `tests/e2e/find-replace.spec.js`
- E2E: `tests/e2e/find-replace-responsive-overlay.spec.js`
- E2E: `tests/e2e/ribbon/all-tabs-overflow-matrix.spec.js`
- E2E: `tests/e2e/ribbon/responsive-pressure-points.spec.js`
- E2E: `tests/e2e/ribbon/insert-tab-critical-controls-visibility.spec.js`
- E2E: `tests/e2e/ribbon/advanced-actions-overflow-discoverability.spec.js`

## Implementation Steps

1. Confirm responsive overlay and advanced-action discoverability tests fail with current fixed-width/overflow assumptions.
2. Refactor `FindReplaceBar`:
   - Use `max-w-[calc(100vw-...)]`, responsive width, or docked mode.
   - Ensure close/search/replace buttons remain reachable.
   - Prevent horizontal document overflow.
3. Audit `RibbonTabContentRow` and panel overflow behavior at 1366, 1280, 1024, 900, 768 widths.
4. Keep visible advanced Insert actions (`Kinetic Text`, `Math Grid`, `Anime.js`, `Three.js`, `Timeline`) when space allows.
5. Under constrained widths, use existing scroll/overflow affordance or "More" path that exposes advanced actions with keyboard navigation.
6. Assert stable accessible names by role/name, including:
   - `Add kinetic text`
   - `Add math grid`
   - `Add Anime.js`
   - `Add Three.js`
   - `Add timeline`
   - `More advanced insert options`
7. Add keyboard-only coverage for overflow/dropdown/popover interactions:
   - open by keyboard,
   - close with Escape,
   - focus returns to trigger,
   - no keyboard trap,
   - Tab or arrow navigation is consistent.

## Tests And Verification

```bash
npx vitest run client/src/components/find-replace-vertical-slides.test.jsx client/src/components/find-replace-helpers.test.js
npx vitest run client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx client/src/components/ribbon/ribbon-shell-tab-navigation-and-rendering.test.jsx
npx playwright test tests/e2e/find-replace.spec.js tests/e2e/find-replace-responsive-overlay.spec.js
npx playwright test tests/e2e/ribbon/all-tabs-overflow-matrix.spec.js tests/e2e/ribbon/responsive-pressure-points.spec.js tests/e2e/ribbon/insert-tab-critical-controls-visibility.spec.js tests/e2e/ribbon/advanced-actions-overflow-discoverability.spec.js
```

## Success Criteria

- [ ] Find/replace fits inside viewport at constrained editor widths.
- [ ] Find/replace does not block critical header/ribbon actions without a close/dock path.
- [ ] Advanced Insert actions are still discoverable.
- [ ] Overflow path is keyboard-operable and visible enough to avoid hidden functionality.
- [ ] Advanced action labels or help text are reachable without relying on hover-only behavior.
- [ ] Overflow/dropdown/popover interactions close with Escape and restore focus to the trigger.
- [ ] Existing ribbon contextual tab and persistence behavior does not regress.

## Risk Assessment

- Risk: overflow changes make ribbon feel less like PowerPoint. Mitigation: keep existing groups and only add constrained-width behavior.
- Risk: visual tests become flaky due to scroll positions. Mitigation: assert control accessibility and bounding boxes, not screenshots only.

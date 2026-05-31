---
title: "Red-Team Plan Review - Insert Advanced Direct Actions And Overlay TDD"
created: 2026-05-22
scope: "Plan adversarial review before implementation"
status: done_with_concerns
---

# Red-Team Plan Review

## Summary

Plan direction is sound: fixed Advanced insert actions should become direct icon buttons, while Games/plugins stay behind a launcher. Main risk is under-scoped overlay/focus work. If implemented exactly as written, clipping and keyboard regressions can remain outside the narrow Advanced dropdown path.

## Findings

### P1 - Overlay scope can leave known clipped popups unfixed

- Evidence:
  - `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx:28` `ShapeGallery` uses `absolute top-full`.
  - `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx:117` `TableSizePicker` uses `absolute top-full`.
  - `client/src/components/ribbon/ribbon-panel.jsx:27` ribbon shell has `h-[80px] overflow-hidden`.
- Plan issue: Phase 04 says migrate Shape/Table only if tests prove same clipping risk, but the investigation already identifies them as same class of bug.
- Risk: Final behavior fixes Advanced only, while Shape/Table still clip in the same ribbon container.
- Recommendation: Make Shape/Table migration or explicit non-regression geometry tests mandatory in Phase 04. If deferred, document as known limitation, not success.

### P1 - Games second-level surface lacks keyboard/focus contract

- Evidence:
  - `Games...` currently calls `setShowGameGallery(true)` from Advanced menu.
  - `showGameGallery` renders a fixed centered wrapper at `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx:423`.
  - `GameGalleryDropdown` has no Escape/outside-click/focus-return handling.
- Plan issue: Phase 03/04 verify launcher Escape/focus, but not the second-level Games surface.
- Risk: Keyboard user can open Games but focus can remain on an unmounted menu item; Escape behavior is undefined.
- Recommendation: Add acceptance criteria for Games surface: focus first game option on open, Escape closes and returns focus to launcher, outside click closes, selection returns stable focus.

### P1 - Existing E2E direct selectors outside plan will break

- Evidence:
  - `tests/e2e/games/game-elements.spec.js:155` clicks `button[name="Advanced"]` then `Games...`.
  - `tests/e2e/plugin-runtime-insert-render-persistence.spec.js:64` expects `Advanced` trigger.
  - `tests/e2e/pages/RibbonInsertHelper.js` is planned, but direct spec callers are not fully listed.
- Plan issue: Related files focus on helper and layout spec; direct tests are under-scoped.
- Risk: implementation passes targeted tests but fails broader E2E.
- Recommendation: Add direct spec updates to Phase 03/05 related files and test commands.

### P2 - Sparkles semantic test likely fails after moving action out of item array

- Evidence:
  - `client/src/__tests__/sparkles-icon-semantic-separation.test.jsx` finds a source line matching `id: 'kinetic'` and `icon: Wand2`.
- Plan issue: Phase 02 notes updating the test, but success criteria do not pin the new assertion shape.
- Risk: source scan fails after direct JSX button implementation even if UI is correct.
- Recommendation: Replace this test with a source assertion around `aria-label="Add kinetic text"` and `<Wand2`, or a rendered component assertion if Button icon identity is testable.

### P2 - 1280 no-overflow criterion may conflict with direct buttons

- Evidence:
  - Current Insert row has Basic, Shapes, Content, Media, Embed, Advanced.
  - Replacing one Advanced trigger with five icon buttons plus launcher increases row width.
- Plan issue: Phase 02 says no 1280 horizontal overflow; Phase 05 relaxes this to "if feasible, document why."
- Risk: ambiguous pass/fail gate.
- Recommendation: Decide now: either 1280 must fit with no horizontal overflow, or 1280 may scroll but all controls must remain unclipped and reachable. Keep one rule across phases.

### P2 - Portal outside-click handling needs explicit trigger/menu exception

- Evidence:
  - Current dropdown detects outside via `containerRef.contains(e.target)`.
  - A portal menu will not be contained by the trigger container.
- Plan issue: Phase 04 mentions trigger exception, but not menu root exception.
- Risk: menu closes on internal clicks before item action/focus behavior stabilizes, depending on event propagation.
- Recommendation: Overlay should treat both anchor and overlay root as inside. Tests should click inside overlay whitespace and menu items.

### P3 - Plugin empty state conflicts with always-visible launcher wording

- Evidence:
  - `ribbon-plugin-insert.test.jsx` currently asserts no plugin action when `pluginTypes=[]`.
  - Plan recommends keeping launcher visible because `Games...` always exists.
- Plan issue: Good product choice, but tests must distinguish "no plugin actions" from "launcher still visible for Games".
- Recommendation: Add a test that empty plugins still show `More advanced insert options` and only `Games...` in menu.

## Recommended Plan Changes Before Implementation

1. Update Phase 04 to require overlay migration/tests for Advanced, Shape, Table, and Games or explicitly document a deferred scope.
2. Add Games second-surface focus/Escape/outside-click acceptance criteria.
3. Add `tests/e2e/games/game-elements.spec.js`, `tests/e2e/plugin-runtime-insert-render-persistence.spec.js`, and `tests/e2e/parallax-element-insertion-property-controls-and-rendering.spec.js` to affected test list.
4. Normalize the 1280 overflow rule across Phase 02 and Phase 05.
5. Replace source-scan assumptions in `sparkles-icon-semantic-separation.test.jsx`.

## Suggested Extra Verification

- `npx vitest run client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.test.jsx client/src/components/ribbon/ribbon-plugin-insert.test.jsx client/src/__tests__/sparkles-icon-semantic-separation.test.jsx`
- `npx playwright test tests/e2e/ribbon-layout.spec.js tests/e2e/games/game-elements.spec.js tests/e2e/plugin-runtime-insert-render-persistence.spec.js tests/e2e/parallax-element-insertion-property-controls-and-rendering.spec.js --project=chromium`
- `npm run build`

## Unresolved Questions

- Should Shape/Table/Games overlay migration be mandatory in this plan, or recorded as a follow-up?
- Should 1280px Insert require zero horizontal overflow, or only no clipping/overlap with reachable horizontal scroll?

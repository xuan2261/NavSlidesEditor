# Code Review Summary

## Scope

- Files: requested ribbon overlay, Insert Advanced, migrated popup surfaces, and related Vitest/Playwright tests.
- LOC: tracked diff shows 428 insertions / 186 deletions across 18 tracked files; untracked overlay files reviewed separately.
- Focus: current worktree changes for `plans/260522-2013-insert-advanced-direct-actions-and-overlay-tdd/plan.md`.
- Scout findings: checked overlay positioning contract, first-frame render, sibling popup ordering, Insert overflow/reachability, and game/plugin insertion/focus paths.

## Overall Assessment

Post-fix state resolves the major prior concerns: `RibbonFloatingOverlay` portals to `document.body`, hides pre-measure render with `opacity: 0`/`pointerEvents: none`, clamps horizontal/vertical position, recomputes on scroll/resize, and the requested ribbon `top-full` popup usages are migrated. Fixed Advanced actions are now direct icon buttons; Games and plugins stay in `More advanced insert options`.

One acceptance gap remains in the game selection focus path.

## Critical Issues

None found.

## High Priority

- `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx:124` and `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx:129` - Selecting a game calls `onSelect(type)` then `onClose()` directly from `GameGalleryDropdown`, so the close bypasses `RibbonFloatingOverlay.requestClose()` and does not restore focus to `advancedLauncherRef`. This conflicts with the plan decision: after a game/plugin insertion, focus returns to launcher trigger. Plugin selection does restore focus through `RibbonDropdownMenuGroup.closeMenu()`, so this is game-only.
  Fix: route game item activation through a close helper that focuses `anchorRef.current` before/after `onClose()`, or expose/pass a focus-restoring close callback. Add a regression test that clicks/keyboard-selects `Name Picker` and expects `More advanced insert options` trigger focused after insertion.

## Medium Priority

None.

## Low Priority

None.

## Edge Cases Found By Scout

- Vertical viewport clamp: addressed in `RibbonFloatingOverlay` and covered by unit test.
- First-frame `(0,0)` flash: addressed by invisible pre-measure render; no visible origin flash found.
- Insert row reachability/overflow: tests allow only trailing Advanced overflow when horizontal scroll exists; controls remain reachable by E2E helper updates.
- Game/plugin insertion: callbacks still route correctly, but game selection focus restore remains uncovered and currently fails by inspection.
- Public callback/API contracts: no callback signature regression found for fixed Advanced, plugin, table, shape, file, header, design, transition, animation, or paragraph popup paths.

## Positive Observations

- Shared overlay primitive removes ribbon clipping without increasing ribbon height.
- Stable `data-ribbon-popup` selectors make E2E geometry assertions practical.
- `Button` forwards refs, so anchor measurement/focus restore works for migrated triggers.
- Targeted Vitest and ESLint passed locally during review.

## Recommended Actions

1. Fix game item selection focus restore and add test coverage for selecting a game, not only Escape from the game gallery.
2. Keep full `npm run lint` caveat documented until `.claude` EPERM is resolved.

## Metrics

- Type Coverage: not measured; JSX project has no targeted type gate in this review.
- Test Coverage: targeted behavior covered by Vitest + Playwright assertions; one game-selection focus gap noted.
- Linting Issues: 0 from targeted ESLint command run during review.

## Verification

- `npm run test -- --run client/src/components/ribbon/ribbon-floating-overlay.test.jsx client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx client/src/components/ribbon/ribbon-plugin-insert.test.jsx client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.test.jsx` - pass, 4 files / 17 tests.
- `npx eslint client/src/components/ribbon/ribbon-floating-overlay.jsx client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.jsx client/src/components/ribbon/ribbon-file-dropdown-menu.jsx client/src/components/ribbon/ribbon-header-bar.jsx client/src/components/ribbon/design-tab-content.jsx client/src/components/ribbon/transitions-tab-content.jsx client/src/components/ribbon/ribbon-element-animation-effect-controls-tab-content.jsx client/src/components/ribbon/controls/paragraph-compact-dropdown-controls.jsx client/src/components/ribbon/ribbon-floating-overlay.test.jsx client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx client/src/components/ribbon/ribbon-plugin-insert.test.jsx` - pass.

## Review Checklist

- Concurrency: checked scroll/resize listeners, sibling popup ordering, async state batching in launcher -> game gallery.
- Error boundaries: no new thrown exceptions or async error path beyond existing upload handling.
- API contracts: checked callback names/shapes and trigger labels used by tests/helpers.
- Backwards compatibility: no public callback signature changes found.
- Input validation: no new external input boundary in reviewed scope.
- Auth/authz paths: no sensitive operation or auth path in reviewed scope.
- N+1/query efficiency: no DB/query path in reviewed scope.
- Data leaks: no PII/secrets/internal stack traces introduced in reviewed scope.
- Fact-checked: plan file, changed files, symbol names, and grep results verified against codebase.

## Unresolved Questions

- None.

# Red Team Review: Insert Ribbon Media/Embed Direct Actions

Date: 2026-05-18

## Findings

1. Width budget can fail silently if tests only assert trigger visibility.
   - Add metrics for `panel.hasHorizontalOverflow`, `outsideControls`, `clippedControls`, `overlaps`.
   - Add explicit direct button expectations for all Media/Embed actions.

2. Button accessible names may collide.
   - Existing aliases include `Video`, `Add video`, `Audio`, `Audio / Upload`.
   - Use stable call-site labels: `Add video`, `Audio / Upload`, `Open media library`, `Open file browser`, `Add HTML embed`, `Add SVG`, `Add drawing`, `Add divider`.

3. `Advanced` should not receive focus trap.
   - Trap is modal behavior and may block normal ribbon navigation.
   - Require Escape close and focus restore instead.

4. `RibbonInsertHelper` must preserve old public method contract.
   - Existing tests call `clickInsertMenuItem('Media Library')`, `clickInsertMenuItem('Embed HTML')`, and game aliases.
   - Update aliases, do not force tests to know new UI internals.

5. Component file already near size threshold.
   - If implementation grows `ribbon-insert-tab-element-galleries-panel.jsx` beyond readability, extract local helpers/components.
   - Do not create "enhanced" duplicate files; update current component or extract focused reusable component.

## Required Plan Adjustments

- Add Phase 1 failing layout/direct-access tests before component changes.
- Add helper contract tests/coverage in Phase 5.
- Add final verification matrix with layout, insertion, game flows, lint, build.

## Unresolved Questions

- None.


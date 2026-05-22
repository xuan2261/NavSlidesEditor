# Insert Advanced Direct Actions Overlay

Date: 2026-05-22

## Context

The Insert Advanced menu had fixed actions hidden inside a clipped ribbon dropdown. The same `absolute top-full` pattern appeared across ribbon popups, so fixing only Advanced would leave the shared clipping failure mode in place.

## Changes

- Reworked Insert Advanced so fixed commands are direct icon buttons.
- Kept Games and runtime plugin inserts in `More advanced insert options`.
- Added `RibbonFloatingOverlay` as the shared body-portal popup primitive.
- Migrated File, header AI/Share, Design, Transitions, Animations, Paragraph, Advanced, Shape, Table, and Games popup surfaces to the overlay contract.
- Added and updated Vitest/Playwright coverage for direct actions, launcher behavior, geometry, keyboard close, focus return, viewport clamping, and insertion flows.
- Fixed the post-review game-selection path so choosing a game from the Games popup restores focus to the Advanced launcher.

## Decisions

- Kept the ribbon command area at 80px.
- Used local popup coordination instead of a global popup manager.
- Made the launcher icon-only to relieve 1280px Insert row pressure while preserving the accessible name.
- Skipped visual snapshot refresh because semantic and geometry gates covered the intentional behavior change.

## Verification

- Ribbon Vitest: 16 files / 141 tests passed.
- Insert Playwright slice: 19 passed.
- Game/plugin/parallax insertion Playwright sweep: 42 passed.
- Build passed.
- Targeted ESLint passed; full lint blocked locally by existing `.claude` EPERM scan issue.

## Unresolved Questions

- None.

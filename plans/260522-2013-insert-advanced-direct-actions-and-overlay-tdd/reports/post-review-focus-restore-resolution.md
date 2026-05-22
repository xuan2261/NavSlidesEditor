# Post-Review Focus Restore Resolution

Date: 2026-05-22
Status: DONE

## Issue

Post-fix review found that selecting a game in `GameGalleryDropdown` closed the Games popup with `onClose()` directly. That bypassed the overlay close path that restores focus to `More advanced insert options`.

## Fix

- `GameGalleryDropdown` now uses a local selection handler that:
  - calls `onSelect(type)`
  - focuses `anchorRef.current`
  - closes the popup
- Added unit regression coverage proving `Name Picker` selection calls `onAddGame('name-picker')`, closes the Games popup, and restores focus to the Advanced launcher.

## Verification

| Command | Result |
| --- | --- |
| `npx vitest run client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx client/src/components/ribbon/ribbon-plugin-insert.test.jsx client/src/components/ribbon/ribbon-floating-overlay.test.jsx client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.test.jsx` | Passed: 4 files / 18 tests |
| `npx vitest run client/src/components/ribbon` | Passed: 16 files / 141 tests |
| `npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium -g "Insert"` | Passed: 19 tests |
| `npx playwright test tests/e2e/games/game-elements.spec.js tests/e2e/plugin-runtime-insert-render-persistence.spec.js tests/e2e/parallax-element-insertion-property-controls-and-rendering.spec.js --project=chromium` | Passed: 42 tests |
| `npm run build` | Passed |

## Unresolved Questions

- None.

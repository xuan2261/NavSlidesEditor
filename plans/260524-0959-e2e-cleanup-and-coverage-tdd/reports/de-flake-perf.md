# Phase 2 De-flake Verification

Date: 2026-05-24

## Summary

- Removed all `waitForTimeout(` calls under `tests/e2e/**`.
- Added ESLint `no-restricted-syntax` guard for future `page.waitForTimeout` usage in E2E files.
- Added portable unit guard `tests/unit/no-wait-for-timeout.test.js`.
- Full E2E wallclock improved from Phase 1 baseline 291.05s to 251.22s.
- Full E2E still exits 1 due to the same pre-existing `coverage-gaps.spec.js:104` failure captured in Phase 1 baseline.

## Evidence

Commands run during Phase 2:

- `rg -n "waitForTimeout\\(" tests\\e2e` -> no matches.
- `rg -n "Promise\\.race|waitForTimeout\\(" tests\\e2e` -> no matches.
- `npm test -- tests/unit/no-wait-for-timeout.test.js` -> 1 file / 1 test passed.
- `npm test -- tests/unit/no-wait-for-timeout.test.js tests/unit/playwright-config.test.js tests/unit/test-fixtures-loopback.test.js` -> 3 files / 15 tests passed.
- `npm run lint` -> exit 0, 97 existing warnings, 0 errors.
- `npx playwright test tests/e2e/undo-redo.spec.js` -> 4 passed.
- `npx playwright test tests/e2e/games/game-elements.spec.js tests/e2e/parallax-element-insertion-property-controls-and-rendering.spec.js` -> 41 passed.
- `npx playwright test tests/e2e/games/game-elements.spec.js` after code-review no-op wait cleanup -> 27 passed.
- `npx playwright test tests/e2e/a11y/axe-core-scans-across-editor-present-share-live-and-home-views.spec.js tests/e2e/a11y/touch-gestures-tap-double-tap-and-swipe-on-tablet-viewport.spec.js` -> 10 passed.
- `npx playwright test tests/e2e/visual/mobile-editor-explicit-device-scale-factor-pinned.spec.js tests/e2e/visual/present-speaker-share-and-live-viewer-baselines.spec.js tests/e2e/visual/ribbon-tabs-across-all-seven-tabs-dark-theme.spec.js` -> 12 skipped on Windows visual guard.
- `npx playwright test tests/e2e/undo-redo.spec.js tests/e2e/games/game-elements.spec.js tests/e2e/parallax-element-insertion-property-controls-and-rendering.spec.js tests/e2e/a11y/axe-core-scans-across-editor-present-share-live-and-home-views.spec.js tests/e2e/a11y/touch-gestures-tap-double-tap-and-swipe-on-tablet-viewport.spec.js --repeat-each=3` -> 165 passed.
- `rg -n "waitForElementCount\\(await editorPage\\.getElementCount\\(\\)\\)" tests\\e2e\\games\\game-elements.spec.js` -> no matches.

## Wallclock

- Phase 1 baseline: 291.05s (`baseline-wallclock.txt`), exit 1 from `coverage-gaps.spec.js:104`.
- Phase 2 de-flake: 251.22s (`de-flake-wallclock.txt`), exit 1 from same `coverage-gaps.spec.js:104`.
- Delta: -39.83s (-13.69%), within `<= baseline + 5%`.

## Known Open Failure

- `tests/e2e/coverage-gaps.spec.js:104` remains failing in full E2E. This failure is not introduced by Phase 2; it is already present in `baseline-wallclock-command-output.txt`.

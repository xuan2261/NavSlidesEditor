# Phase 6 Games And Visual Matrix Validation

Date: 2026-05-24

## Summary

Phase 6 implementation completed. Added game keyboard shortcut E2E coverage and a 36-cell themes/transitions/layouts present-mode matrix. Fixed a real keyboard scope bug so active game shortcuts work when a game element exists while preserving editor/canvas shortcuts.

## Implemented

- `client/src/hooks/use-keyboard.js`: includes `presentation-game` shortcuts whenever `activeGameType` exists and keeps canvas shortcuts available outside present mode.
- `tests/e2e/games/keyboard-shortcuts.spec.js`: covers G HUD toggle, L leaderboard toggle, and Enter/R/P no-error stub behavior.
- `tests/e2e/pages/game-page.js`: small helper for game insertion and overlay locators.
- `tests/e2e/visual/themes-transitions-layouts-matrix.spec.js`: 3 themes × 3 transitions × 4 layouts = 36 structural assertions through the real present endpoint.
- `tests/e2e/fixtures/visual-matrix.js`: shared themes, transitions, representative layouts, and 3 Linux snapshot baseline keys.
- `tests/unit/game-shortcuts-registry.test.js`: pins G/L registry entries in `presentation-game` scope.
- `tests/unit/game-handlers-real-vs-stub.test.js`: pins G/L as real state toggles and Enter/R/P as console stubs.

## Validation

- `npm test -- tests/unit/game-shortcuts-registry.test.js tests/unit/game-handlers-real-vs-stub.test.js client/src/hooks/use-keyboard.test.js client/src/hooks/use-keyboard-contract.test.js` — 31 passed.
- `npx playwright test tests/e2e/games/keyboard-shortcuts.spec.js tests/e2e/visual/themes-transitions-layouts-matrix.spec.js` — 39 passed.
- `rg waitForTimeout tests/e2e/games/keyboard-shortcuts.spec.js tests/e2e/visual/themes-transitions-layouts-matrix.spec.js tests/e2e/pages/game-page.js tests/e2e/fixtures/visual-matrix.js` — no matches.
- `npm run lint` — exit 0, 97 existing warnings.
- `npm run build` — exit 0, existing empty `vendor-reveal` and chunk-size warnings.

## Notes

- Initial Red found game shortcuts did not dispatch because `useKeyboard` only enabled `presentation-game` when `isPresenting && activeGameType`. The implementation now enables game shortcuts whenever `activeGameType` is present.
- Visual matrix snapshots are not generated on Windows. Snapshot capture is implemented behind `process.platform === 'linux' && E2E_VISUAL_BASELINES === '1'`.
- Existing visual snapshot specs were left in place; this phase adds structural matrix coverage only.

## Unresolved Questions

- Linux baseline PNG generation for the 3 gated snapshot cells remains for the Linux visual workflow / Phase 8 verification.

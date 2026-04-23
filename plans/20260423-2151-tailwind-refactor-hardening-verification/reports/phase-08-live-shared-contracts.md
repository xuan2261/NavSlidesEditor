# Phase 08 Live Shared Contracts

Date: 2026-04-24

## Result

Pass.

## Evidence

- `npx vitest run server/services/live-rooms.test.js shared/tests/htmlGenerator.test.js client/src/utils/slide-notes.test.js`: pass, 3 files / 17 tests.
- `npm run build`: pass.
- `npx playwright test --list`: live spec discovered.
- `npx playwright test tests/e2e/live.spec.js --workers=1 --retries=0`: pass, 8/8.
- `npx playwright test --retries=0`: pass, 101/101 including live specs.
- `npm run test:e2e`: pass, 101/101 with no flaky retries.
- `npm run test:load:ws`: skipped, `k6` not found in PATH.

## Interface Changes

- `shared/src/slideNotes.js` provides canonical notes helpers.
- `shared/src/index.js` exports slide notes helpers.
- `shared/src/htmlGenerator.js` escapes notes and supports vertical/fragment live navigation state.
- Live room service tracks `presenter`, `viewer`, and `controller`; viewer count excludes controllers.
- Socket handler emits `presentation-meta`, supports `control-navigate`, and includes `verticalIndex`.
- Presentation storage writes now use the existing file lock to avoid concurrent JSON write/read races during browser tests and live route activity.
- Docker/vendor packaging now generates `server/vendor/socket.io/socket.io.min.js` during the builder stage and copies `server/vendor` into the production image.

## Risks

- `k6` not found in PATH, so load tests are skipped.

## Unresolved Questions

- None.

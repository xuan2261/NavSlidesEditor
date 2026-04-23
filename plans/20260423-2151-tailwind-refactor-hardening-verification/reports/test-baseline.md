# Test Baseline

Date: 2026-04-24

## Commands

- `git diff --check`: pass.
- `npm run build`: pass, Vite production build succeeded. Existing bundle-size warning remains.
- `npm run lint`: pass with warnings only; no errors.
- `npm run test`: pass, 15 files / 71 tests.
- `npx playwright test --list`: pass, 101 tests discovered.
- `npx playwright test --retries=0`: pass, 101/101 tests.
- `npm run test:e2e`: pass, 101/101 tests, 0 flaky retries after scoping Version History dialog Save, fixing single replace semantics, and locking presentation writes.
- `npm run test:load:api`: skipped, `k6` not found in PATH.
- `npm run test:load:ws`: skipped, `k6` not found in PATH.

## Targeted TDD Gates

- `npx vitest run client/src/utils/tailwind-inline-style-audit.test.js client/src/components/find-replace-helpers.test.js client/src/hooks/slide-operation-helpers.test.js client/src/components/ProductTour.test.js`: pass, 4 files / 11 tests.
- `npx vitest run server/services/live-rooms.test.js shared/tests/htmlGenerator.test.js client/src/utils/slide-notes.test.js`: pass, 3 files / 17 tests.
- `npx vitest run client/src/utils/import-project.test.js client/src/utils/markdown-import.test.js client/src/utils/media-detector.test.js shared/tests/htmlGenerator.test.js`: pass, 4 files / 30 tests.
- `npx vitest run client/src/components/find-replace-helpers.test.js server/routes/ai.test.js server/services/live-rooms.test.js shared/tests/htmlGenerator.test.js`: pass, 4 files / 16 tests.
- `npx playwright test tests/e2e/live.spec.js --workers=1 --retries=0`: pass, 8/8.
- `npx playwright test tests/e2e/find-replace.spec.js --workers=1 --retries=0`: pass, 7/7.

## Coverage Map

- Dashboard/navigation: Playwright `dashboard`, `explore`, `settings`, `templates`, `smoke`.
- Editor shell/canvas: Playwright `editor`, `toolbar-elements`, `keyboard-shortcuts`, `find-replace`, `slide-management`, `undo-redo`, `elements`, `slides`.
- Properties: Playwright `properties-panel`, `toolbar-elements`, `undo-redo`.
- Overlays: Vitest `ProductTour`; Playwright `ai`, `media`, `sharing`, `templates`, `version-history`.
- Live/shared: Vitest live rooms + shared HTML + slide notes; Playwright `live`.
- Export/import/persistence: Vitest import/markdown/media/html; Playwright `export`, `sharing`, `media`, `templates`, `ai`.

## Browser Smoke

- Viewports: `1440x900`, `1024x768`, `390x844`.
- Result: nonblank home page, no console errors, no failed requests.
- Artifact path: `test-results/viewport-smoke-20260423222227/screenshots/`.

## Unresolved Questions

- None.

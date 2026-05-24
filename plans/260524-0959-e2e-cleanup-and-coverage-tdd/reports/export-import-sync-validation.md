# Phase 5 Export/Import/Sync Validation

Date: 2026-05-24

## Summary

Phase 5 completed. Added E2E coverage for PPTX export, Markdown import, and rclone Proton Drive sync while mocking only real `/api/rclone/*` endpoints. Added unit contracts for server route surface and fabricated `/api/sync/*` regression prevention.

## Implemented

- `tests/e2e/export/pptx-export.spec.js`: exports a seeded presentation through File menu and validates `.pptx` ZIP structure plus slide text.
- `tests/e2e/import/markdown-import.spec.js`: imports `sample.md`, verifies 3 slides and heading content, then cleans up created presentations.
- `tests/e2e/sync/rclone-proton-drive.spec.js`: covers Settings modal open, Proton Drive configure, sync all, sync single from editor, and 500 error display.
- `tests/e2e/fixtures/rclone-mock.js`: mocks `GET /api/rclone/status`, `POST /api/rclone/config`, `POST /api/rclone/sync`, and `POST /api/rclone/sync-single`.
- `tests/unit/sync-routes-contract.test.js`: pins server route methods/paths and rejects legacy `/push`/`/pull`.
- `tests/unit/no-fabricated-sync-endpoints.test.js`: Windows-portable guard against `/api/sync/*` in E2E specs.
- `client/src/pages/HomePage.jsx`: moved Markdown import testids from the PPTX import row to the actual Markdown import row.

## Validation

- `npm ls jszip` — available (`jszip@3.10.1` in root/workspace tree).
- `npm test -- tests/unit/sync-routes-contract.test.js tests/unit/no-fabricated-sync-endpoints.test.js tests/unit/data-testid-presence.test.js` — 43 passed.
- `npx playwright test tests/e2e/export/pptx-export.spec.js tests/e2e/import/markdown-import.spec.js tests/e2e/sync/rclone-proton-drive.spec.js` — 8 passed.
- `npx playwright test tests/e2e/sync/rclone-proton-drive.spec.js` — 5 passed.
- `rg waitForTimeout tests/e2e/export/pptx-export.spec.js tests/e2e/import/markdown-import.spec.js tests/e2e/sync/rclone-proton-drive.spec.js tests/e2e/fixtures/rclone-mock.js` — no matches.
- `rg "/api/sync/|api/sync/" tests/e2e` — no matches.
- `npm run lint` — exit 0, 97 existing warnings.
- `npm run build` — exit 0, existing empty `vendor-reveal` and chunk-size warnings.
- Post-review fix: rclone mocks now assert HTTP method per route. `npx playwright test tests/e2e/sync/rclone-proton-drive.spec.js` — 5 passed.

## Notes

- SyncModal starts with `syncStatus === null`, so mocks must include `installed: true` and account for React StrictMode duplicate status calls.
- Mocking only URL paths was insufficient; the helper now fails on method drift so a regressed `GET /api/rclone/sync` cannot pass E2E.
- Settings opens SyncModal without `presentationId`; single-presentation push is therefore tested from the editor File menu.
- Product tour is disabled in editor E2E setup before using ribbon file menu.

## Unresolved Questions

- None.

# Release Verification Summary

Date: 2026-05-31

## Matrix Evidence

- Command: `npm run matrix:gate`
- Latest local result: PASS, 90/100 editor-core verified, 10 ALLOWED, 0 failures, 0 orphans.
- Fixed denominator: 100 editor-core capabilities.
- Staleness note: `docs/feature-coverage-matrix.md` currently warns that run results are stale/missing. Treat PASS counts as matrix/gate evidence, not a full fresh-suite proof.

## Release-Blocking MVP

| Area | Evidence | Status |
|---|---|---|
| Editor-core P0/P1 coverage | `baseline-gap-report.json`: 90 PASS, 10 ALLOWED, all remaining gaps are P2/low risk debt | Pass with debt |
| Create/edit/persist/export HTML | `tests/e2e/critical-user-journeys.spec.js` plus artifact inspection | Verified in selected E2E |
| Share password/revoke | `tests/e2e/critical-user-journeys.spec.js` | Verified in selected E2E |
| PPTX import/edit/export smoke | `tests/e2e/critical-pptx-journey.spec.js` | Verified in selected E2E |
| Live reconnect/authz smoke | `tests/e2e/critical-live-reconnect.spec.js` and presenter-token security spec | Verified in selected E2E/security |

## Bounded Coverage

- Extended domain matrix: 18 IDs classified with risk/layer/coverage mode, 0 orphans.
- Extended report is intentionally TAGGED when run results are stale, so it does not claim false PASS.
- Artifact journeys parse exported HTML/PPTX outputs rather than checking toast-only success.
- CI release-confidence contract pins `matrix:gate`, warn-first rollout, required-check fan-in, loopback load targets, and release docs.

## Contract-Only Coverage

| Area | Evidence | Reason |
|---|---|---|
| AI endpoint/failure | `server/services/ai-endpoint-guard.test.js`, `server/services/ai-provider.test.js`, `server/routes/ai.test.js` | External providers are not hermetic. |
| rclone/sync status | `server/routes/api-surface.test.js` | Real remote credentials are excluded from default verification. |
| GitHub push/release artifacts | CI/report contracts and manual scan checklist | Secrets and external repository writes require operator context. |

## Remaining Debt

All dated debt is owner `qa`, allowed until 2026-06-30:

- `canvas.lock`
- `canvas.move`
- `command.insertLink`
- `command.insertSlide`
- `command.startSlideshow`
- `control.file.menu`
- `shortcut.eraseAnnotations`
- `shortcut.highlighterTool`
- `shortcut.laserPointer`
- `shortcut.penTool`

Critical journey quarantine: none recorded in this plan.

## Verification Commands Run

- `npx vitest run server/routes/ai.test.js server/services/live-rooms.test.js server/routes/api-surface.test.js`
- `npx playwright test tests/e2e/critical-user-journeys.spec.js tests/e2e/critical-live-reconnect.spec.js tests/e2e/critical-pptx-journey.spec.js --project=chromium`
- `npx vitest run server/services/ai-provider.test.js server/services/ai-endpoint-guard.test.js server/routes/api-surface.test.js scripts/feature-inventory/extended-domain-report.test.mjs scripts/feature-inventory/build-matrix.test.mjs`
- `npx playwright test tests/e2e/critical-live-reconnect.spec.js --project=chromium`
- `npx vitest run tests/unit/github-actions-ci-release-confidence-contract.test.js tests/unit/test-fixtures-loopback.test.js`
- `npm test` -> 249 files passed, 1 skipped; 2195 tests passed, 8 skipped.
- `npm run matrix:extended-report`
- `npm run matrix:gate`

Known not proven green in this session: full Playwright suite.

Unresolved questions:

- None.

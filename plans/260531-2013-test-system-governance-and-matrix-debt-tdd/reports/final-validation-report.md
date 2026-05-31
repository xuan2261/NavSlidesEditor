# Final Validation Report

Date: 2026-05-31

## Commands

| Command | Result | Notes |
|---|---|---|
| `npx vitest run tests/unit/plan-completion-gate.test.js tests/unit/github-actions-ci-release-confidence-contract.test.js tests/unit/release-verification-docs-contract.test.js` | PASS | 2 files passed, 1 skipped; 7 passed, 1 skipped |
| `RUN_PLAN_GATE=1 npx vitest run tests/unit/plan-completion-gate.test.js` | PASS | 8 archived phase files passed through archive-safe resolver |
| `npx vitest run client/src/components/canvas/use-canvas-pointer-interaction.test.js client/src/components/canvas/canvas-geometry-ops.smoke.test.js` | PASS | 20 tests passed; locked direct and mixed-selection drag paths covered |
| `npm run matrix:gate` | PASS | 100/100 verified, 0 ALLOWED, 0 failures, 0 orphans |
| tagged Vitest refresh for `scripts/feature-inventory/run-results-vitest.json` | PASS | 30 tagged Vitest files completed |
| `npm run test:coverage` | PASS | 250 files passed, 1 skipped; 2215 passed, 1 skipped; coverage thresholds passed |
| `npm run build` | PASS | Vite production build completed |
| `npm run lint` | PASS_WITH_WARNINGS | 0 errors, 23 existing warnings |

## Outcome

- Governance tests no longer require movable top-level plan reports as the only evidence source.
- `RUN_PLAN_GATE` unset no longer performs a skipped-suite filesystem read.
- `RUN_PLAN_GATE=1` resolves archived plan directories instead of hard-coding a movable top-level plan path.
- Release lane, branch protection, rollback, quarantine, scan, manual smoke, and matrix facts live in evergreen docs.
- Feature coverage matrix is fully closed for editor-core: 100/100 PASS, empty allowlist.

## Unresolved Questions

- None.

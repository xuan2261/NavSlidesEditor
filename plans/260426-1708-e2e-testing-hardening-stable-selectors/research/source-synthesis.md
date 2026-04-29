# Source Synthesis

## Inputs
- `plans/reports/brainstorm-260426-1547-e2e-testing-comprehensive.md`
- `plans/reports/debug-260426-1651-e2e-testing-brainstorm-review.md`
- `plans/reports/researcher-260426-1552-e2e-testing.md`
- `plans/reports/researcher-260426-1552-e2e-canvas-testing-patterns.md`
- `plans/reports/researcher-260426-1552-element-testing-patterns.md`
- Current code: `tests/e2e/`, `playwright.config.js`, `client/src/components/properties/`

## Confirmed Baseline
- Playwright remains correct tool.
- `npx playwright test --list` discovered 110 tests in 23 files.
- Targeted E2E subset passed 10/10:
  - `tests/e2e/properties-panel.spec.js`
  - `tests/e2e/coverage-gaps.spec.js`
- `tests/e2e/pages/EditorPage.js` is 537 lines with 55 async methods.

## Decisions Applied
- Keep current canvas IDs.
- Add property test IDs selectively.
- Keep optimistic autosave state on failure.
- Prefer API seeding for property tests.
- Use Playwright screenshot baseline only after deterministic setup.
- Defer CI sharding until runtime threshold proves need.

## Main Gaps To Plan
- Property controls lack stable selectors.
- Type-specific property persistence coverage is thin.
- Autosave failure UI is not visible enough.
- POM is large and should be split after stronger coverage.
- Visual regression is smoke-level only.

## Deferred
- Table merge tests unless UI exists.
- `window.__store` E2E bridge.
- Broad rapid-insert stress tests.
- CI sharding based only on test count.

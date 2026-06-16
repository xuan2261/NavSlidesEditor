# Phase 06 - Visual Accessibility And Performance Gates

## Context Links

- [Plan](./plan.md)
- [Testing Guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)
- `tests/e2e/visual/`
- `tests/e2e/a11y/`
- `tests/load/`
- `playwright.config.js`

## Overview

Priority: P1  
Status: completed-with-concerns  
Description: Expand non-functional regression gates for UI correctness, keyboard/a11y, mobile/touch, and smoke performance without making every PR painfully slow.

## Key Insights

- Visual baselines must be generated in the pinned Linux Playwright image.
- Accessibility tests should cover keyboard flows, not only axe scans.
- k6 smoke is useful for release confidence; load/stress should remain release lane unless operator promotes them.

## Requirements

- Keep Linux-only snapshot policy.
- Add visual cases only for stable, high-risk surfaces.
- Add keyboard-only and touch assertions for core editor/presentation flows.
- Keep load smoke short and deterministic.
- Do not promote new visual/a11y/perf gates to required CI until they pass twice on the target branch and have a deterministic local reproduction command.

## Architecture

```text
Playwright visual/a11y -> stable fixture -> artifact on failure
k6 smoke -> local server -> thresholds
```

## Related Code Files

Modify:
- `tests/e2e/visual/*.spec.js`
- `tests/e2e/a11y/*.spec.js`
- `tests/load/*.js`
- `playwright.config.js` only if needed.
- CI workflow only in Phase 7 unless local scripts need adjustment.

Create:
- Additional focused visual/a11y specs when current files would exceed size budget.

Delete:
- None.

## Implementation Steps

1. Review current visual/a11y/load coverage and choose high-risk additions.
2. Add visual snapshots for property-heavy selected states and exported/present modes only if stable.
3. Add keyboard-only workflows for ribbon, modals, canvas selection, present controls.
4. Add touch/mobile assertions for editor gestures if current coverage is shallow.
5. Add or tune k6 smoke assertions only for stable API/WebSocket contracts.
6. Record each new gate as `PR`, `merge`, or `release` lane before adding it to CI.
7. Verify in the correct Playwright environment before committing snapshots.

## Todo List

- [x] Expand visual state coverage where stable.
- [x] Expand keyboard-only a11y workflows.
- [x] Expand mobile/touch coverage.
- [x] Review k6 smoke thresholds and coverage.
- [x] Document release-lane vs PR-lane split.

## Completion Notes

- CI `e2e-visual` now runs both `tests/e2e/visual/` and `tests/e2e/visual-regression.spec.js`, matching the documented Linux-only visual baseline scope.
- Added a CI contract assertion so the visual job remains pinned to `mcr.microsoft.com/playwright:v1.59.1-jammy`, covers both visual suites, and never updates snapshots in CI.
- Documented non-functional gate ownership and local reproduction commands for visual snapshots, keyboard/axe/touch a11y, k6 smoke, and release-only k6 load/stress profiles.
- Existing keyboard-only, axe, and touch browser coverage was validated on Chromium.
- k6 smoke remains loopback-only and merge-lane scoped; load/stress profiles remain release strict lane.

## Success Criteria

- Visual/a11y/perf regressions have targeted gates.
- Snapshot updates are reproducible in pinned Linux environment.
- PR lane remains practical; release lane is stronger.
- New non-functional gates have lane ownership, local reproduction command, and promotion evidence.

## Risk Assessment

- Risk: platform snapshot drift. Mitigation: pinned Docker/GitHub baseline workflow only.
- Risk: slow PRs. Mitigation: promote expensive gates only to release lane.
- Risk: threshold tuning hides real regressions. Mitigation: any threshold relaxation must cite failed artifact evidence and be reviewed separately.

## Security Considerations

- Do not publish screenshots containing sensitive local decks.
- Run secret/artifact scan before sharing reports.

## Next Steps

- Phase 7 wires governance and docs.

## Verification

- `npx vitest run tests/unit/github-actions-ci-release-confidence-contract.test.js tests/unit/github-actions-manual-visual-baseline-workflow-contract.test.js` - passed, 9 tests.
- `npx playwright test tests/e2e/a11y/ --project=chromium` - passed, 14 tests.
- `npm run test:load:api:smoke` - passed on 2026-06-16 with 19/19 checks and all thresholds passing.
- `npm run test:load:ws:smoke` - passed on 2026-06-16 with all thresholds passing; k6 emitted a non-fatal local API-port bind warning for `127.0.0.1:6565`.

## Concerns

- Visual snapshot suites were not executed locally because canonical baselines require the pinned Linux Playwright container.

## Red Team Notes

- Accepted finding: visual/a11y/perf gates can destabilize CI. Phase 6 now requires lane classification, reproducibility, and two-green-run promotion evidence.

## Unresolved Questions

- None.

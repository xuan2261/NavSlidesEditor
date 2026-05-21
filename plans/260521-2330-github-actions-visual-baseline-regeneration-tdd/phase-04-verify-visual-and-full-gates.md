---
phase: 4
title: "Verify Visual and Full Gates"
status: blocked
priority: P1
effort: "1-2h plus CI time"
dependencies: [1, 2, 3]
---

# Phase 4: Verify Visual and Full Gates

## Context Links

- [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)
- [Icon plan Phase 4](../260521-1130-icon-consistency-pass-tdd/phase-04-verify-and-pr.md)

## Overview

Prove the regenerated snapshots are correct and the original icon PR gates are still clean. Local Windows can run non-visual gates; the authoritative visual verification is the Linux GitHub Actions run.

## Requirements

### Functional

- Re-run workflow verify step or full CI on branch after applying artifacts.
- Run local non-visual gates that previously passed to detect accidental edits.
- Confirm visual-only failure count is now zero in Linux CI.

### Non-functional

- Do not accept flaky visual pass without artifact review.
- Do not loosen test thresholds.
- Do not skip the older `visual-regression.spec.js` family.

## Related Code Files

### Read / Verify

- `.github/workflows/manual-update-playwright-visual-baselines.yml`
- `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml`
- `tests/e2e/visual/`
- `tests/e2e/visual-regression.spec.js`

## Implementation Steps

1. Run targeted contract test:
   ```bash
   npm run test -- tests/unit/github-actions-manual-visual-baseline-workflow-contract.test.js
   ```
2. Run local gates:
   ```bash
   npm run lint
   npm run test
   npm run build
   npx playwright test --grep-invert "visual|Visual" --reporter=list
   ```
3. Push artifact changes to branch.
4. Trigger existing CI or rely on PR CI:
   - `e2e-visual` should pass in `mcr.microsoft.com/playwright:v1.59.1-jammy`.
   - If existing CI only runs `tests/e2e/visual/`, manually run/update workflow still proves `visual-regression.spec.js`.
5. Record command results in plan notes and PR body.

## Todo List

- [x] Contract test green.
- [x] Local lint green.
- [ ] Local unit green.
- [ ] Local build green.
- [ ] Local non-visual Playwright green.
- [ ] Linux visual workflow green.
- [ ] Existing CI `required-checks` green or documented if waiting.

## Test Strategy

| Gate | Environment | Expected |
|---|---|---|
| Contract test | Local Windows | Pass |
| Lint | Local Windows | Pass; existing warnings acceptable |
| Unit | Local Windows | Pass |
| Build | Local Windows | Pass |
| Non-visual Playwright | Local Windows | Pass |
| Visual update+verify | GitHub Linux container | Pass |
| PR CI visual | GitHub Linux container | Pass |

## Success Criteria

- [ ] No visual snapshot diffs remain in Linux container.
- [ ] Full PR CI can proceed without visual baseline blocker.
- [ ] Verification results are concrete and dated.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Existing CI visual job misses `visual-regression.spec.js` | Manual workflow includes it; consider separate future plan to align CI scope |
| Local non-visual flaky test repeats | Retry once, inspect trace/log, fix real root cause only |
| Snapshot artifact includes unintended UI changes | Review PNG diffs and affected icon surfaces before final commit |

## Security Considerations

- CI uses read-only repository token for workflow.
- No secrets needed.

## Next Steps

Update docs and finish the PR handoff in Phase 5.

## Blocker Notes

- Local contract gate is green: `npm run test -- tests/unit/github-actions-manual-visual-baseline-workflow-contract.test.js`.
- Local lint gate is green: `npm run lint` exits 0 with 36 existing warnings.
- Linux visual verification cannot run yet because Phase 3 cannot dispatch the brand-new manual workflow until GitHub registers it from the default branch.

## Unresolved Questions

_None._

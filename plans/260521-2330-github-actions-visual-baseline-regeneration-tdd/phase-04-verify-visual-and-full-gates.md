---
phase: 4
title: "Verify Visual and Full Gates"
status: complete
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
- [x] Local unit green.
- [x] Local build green.
- [x] Local non-visual Playwright green.
- [x] Linux visual workflow green.
- [x] Existing CI `required-checks` green or documented if waiting.

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

- [x] No visual snapshot diffs remain in Linux container.
- [x] Full PR CI can proceed without visual baseline blocker.
- [x] Verification results are concrete and dated.

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
- Linux visual verification run `26240623328` dispatched after registering the workflow on `master`, but completed with failure at `npm ci` before build/visual steps. Root cause: `package-lock.json` missing npm 10 lock entries for `esbuild@0.28.0`; lockfile sync fix is in progress before rerun.
- Rerun `26241153971` on commit `2da23289` passed `npm ci` and `npm run build`; awaiting visual update/verify result.
- Run `26241153971` visual verify failed only on `live-viewer-no-presenter.png`; root cause was random room code text in the screenshot. Added a Playwright screenshot mask for the dynamic room code line and will rerun the workflow.
- Run `26241432529` on commit `138584bf` passed the Linux visual update and verify steps. The job conclusion is failure only because artifact uploads hit the repository GitHub Actions storage quota.
- Run `26262072930` on commit `bfd7f11c` passed the Linux visual update, verify, snapshot upload, and report upload steps. Visual suite result: 17 passed during update and 17 passed during verify.
- Local verification on 2026-05-22: contract test 4/4 passed; `npx eslint tests/e2e/visual-regression.spec.js` passed; `npm run lint` passed with 36 existing warnings; `npm run test` passed with 146 files / 1278 tests passed / 1 skipped; `npm run build` passed with existing chunk-size warnings; `npx playwright test --grep-invert "visual|Visual" --reporter=list` exited 0 with 377 passed / 1 skipped / 1 flaky retried/pass.

## Unresolved Questions

_None._

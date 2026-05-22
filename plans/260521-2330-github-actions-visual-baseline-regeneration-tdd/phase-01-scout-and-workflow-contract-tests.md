---
phase: 1
title: "Scout and Workflow Contract Tests"
status: complete
priority: P1
effort: "0.5-1h"
dependencies: []
---

# Phase 1: Scout and Workflow Contract Tests

## Context Links

- [Testing guide](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)
- [Existing CI workflow](../../.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml)
- [Existing nightly Playwright container workflow](../../.github/workflows/nightly-ribbon-layout-768px-soft-warning-no-pr-gate.yml)
- [Icon plan Phase 4](../260521-1130-icon-consistency-pass-tdd/phase-04-verify-and-pr.md)

## Overview

Establish the executable contract before adding the new workflow. The test should fail initially because `.github/workflows/manual-update-playwright-visual-baselines.yml` does not exist, then pass in Phase 2.

## Key Insights

- Existing CI already pins `mcr.microsoft.com/playwright:v1.59.1-jammy`.
- Existing docs mandate Docker-only visual baseline regeneration.
- Current visual failures are baseline diffs, not non-visual E2E failures.
- Local host cannot regenerate acceptable baselines.

## Requirements

### Functional

- Add a Vitest contract test that reads the future workflow file as text.
- Assert manual-only trigger via `workflow_dispatch`.
- Assert pinned container image.
- Assert workflow runs `npm ci`, `npm run build`, `--update-snapshots`, then a verification run without `--update-snapshots`.
- Assert artifact upload uses `actions/upload-artifact@v4`.
- Assert artifact paths are limited to approved snapshot PNG directories.

### Non-functional

- No new YAML parser dependency unless already available.
- Test should be readable and robust enough for workflow refactors.
- Do not make the test brittle on harmless step names.

## Related Code Files

### Create

- `tests/unit/github-actions-manual-visual-baseline-workflow-contract.test.js`

### Read

- `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml`
- `.github/workflows/nightly-ribbon-layout-768px-soft-warning-no-pr-gate.yml`
- `package.json`

## Implementation Steps

1. Confirm no existing manual baseline workflow exists.
2. Create the contract test with `fs.readFileSync`.
3. Normalize CRLF to LF before assertions.
4. Assert exact canonical image string appears.
5. Assert update command includes both:
   - `tests/e2e/visual/`
   - `tests/e2e/visual-regression.spec.js`
6. Assert verify command appears after update command and does not include `--update-snapshots`.
7. Assert artifact includes only:
   - `tests/e2e/visual/**/*-snapshots/*.png`
   - `tests/e2e/visual-regression.spec.js-snapshots/*.png`
8. Run targeted Vitest and confirm it fails for missing workflow.

## Todo List

- [x] Create contract test.
- [x] Run targeted test red.
- [x] Save red output summary in Phase 1 notes.

## Test Strategy

| Test | Type | Red Condition | Green Condition |
|---|---|---|---|
| Workflow file exists | Vitest source scan | File missing | Workflow added |
| Manual trigger | Vitest source scan | Missing `workflow_dispatch` | Trigger present |
| Canonical container | Vitest source scan | Image absent/wrong | Jammy image present |
| Snapshot command scope | Vitest source scan | Missing one visual suite | Both suites included |
| Artifact path allowlist | Vitest source scan | Broad artifact path | Only snapshot PNG paths |

## Success Criteria

- [x] Targeted contract test fails before Phase 2 for the expected reason.
- [x] Failure is not due syntax/import errors.
- [x] Test documents the workflow contract clearly enough to catch future unsafe changes.

## Phase Notes

- Red run: `npm run test -- tests/unit/github-actions-manual-visual-baseline-workflow-contract.test.js` failed because `.github/workflows/manual-update-playwright-visual-baselines.yml` did not exist. Import/syntax path was valid.
- Green proof moved to Phase 2 after workflow creation.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Source-scan test too brittle | Match meaningful command fragments, not full YAML formatting |
| Test misses broad artifact path | Assert forbidden broad paths like `tests/e2e/**`, `playwright-report/` in snapshot artifact step |
| New dependency bloat | Use Node `fs` and string assertions only |

## Security Considerations

- Workflow test should assert `permissions: contents: read`; snapshot generation does not need write tokens.
- No secrets required.

## Next Steps

Proceed to Phase 2 and add the workflow until this contract turns green.

## Unresolved Questions

_None._

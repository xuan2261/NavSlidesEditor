---
phase: 2
title: "Add Manual GitHub Actions Workflow"
status: complete
priority: P1
effort: "1-1.5h"
dependencies: [1]
---

# Phase 2: Add Manual GitHub Actions Workflow

## Context Links

- [Phase 1 contract test](./phase-01-scout-and-workflow-contract-tests.md)
- [Existing CI workflow](../../.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml)
- [Testing guide visual baseline section](../../docs/navslides-editor-vitest-playwright-k6-testing-guide.md)

## Overview

Add a manual workflow that performs snapshot regeneration in the same Linux Playwright container used by CI, verifies those snapshots immediately, then uploads only snapshot PNGs as an artifact for human review.

## Requirements

### Functional

- Workflow name: `Manual Update Playwright Visual Baselines`.
- File path: `.github/workflows/manual-update-playwright-visual-baselines.yml`.
- Trigger: `workflow_dispatch`.
- Job container: `mcr.microsoft.com/playwright:v1.59.1-jammy`.
- Steps:
  1. checkout
  2. setup Node 20 with npm cache
  3. `npm ci`
  4. `npm run build`
  5. update snapshots for both visual suites
  6. verify both visual suites without update flag
  7. upload snapshot PNG artifact
  8. upload Playwright report on failure or always if useful

### Non-functional

- Use `permissions: contents: read`.
- Keep workflow manual-only; no `push`, `pull_request`, or `schedule`.
- Avoid committing from CI.
- Keep artifact retention short but useful, e.g. 7 or 14 days.

## Related Code Files

### Create

- `.github/workflows/manual-update-playwright-visual-baselines.yml`

### Modify

- `tests/unit/github-actions-manual-visual-baseline-workflow-contract.test.js` only if contract needs a small correction.

## Architecture

### Workflow flow

```text
workflow_dispatch
  -> checkout branch
  -> npm ci
  -> npm run build
  -> playwright --update-snapshots
  -> playwright verify
  -> upload linux-visual-baseline-snapshots artifact
```

### Recommended commands

```bash
npx playwright test tests/e2e/visual/ tests/e2e/visual-regression.spec.js --update-snapshots
npx playwright test tests/e2e/visual/ tests/e2e/visual-regression.spec.js
```

Environment:

```yaml
CI: 'true'
PLAYWRIGHT_CLIENT_PORT: '4173'
PLAYWRIGHT_SERVER_PORT: '3202'
```

## Implementation Steps

1. Add the workflow with minimal permissions.
2. Use existing CI patterns for `actions/checkout@v4` and `actions/setup-node@v4`.
3. Run update and verify in separate named steps so logs show which step failed.
4. Upload snapshot artifact with an allowlist:
   ```yaml
   path: |
     tests/e2e/visual/**/*-snapshots/*.png
     tests/e2e/visual-regression.spec.js-snapshots/*.png
   ```
5. Upload `playwright-report/` as a separate diagnostic artifact with `if: always()`.
6. Run targeted Vitest contract and make it green.

## Todo List

- [x] Create manual workflow.
- [x] Run targeted contract test green.
- [x] Run `npm run lint` if YAML/test file changes are covered by lint.
- [ ] Confirm workflow appears in `gh workflow list`.

## Test Strategy

| Test | Type | Asserts |
|---|---|---|
| Phase 1 contract | Vitest | Workflow shape and safety contract |
| `gh workflow list` | CLI smoke | New workflow discoverable |
| YAML readability | GitHub Actions parser via run | Workflow can start |

## Success Criteria

- [x] Contract test passes.
- [x] Workflow is manual-only.
- [x] Workflow cannot write to repo.
- [x] Artifact path is narrow enough to avoid accidental non-snapshot files.

## Phase Notes

- Added `.github/workflows/manual-update-playwright-visual-baselines.yml`.
- Green run: `npm run test -- tests/unit/github-actions-manual-visual-baseline-workflow-contract.test.js` passed 4/4.
- Lint run: `npm run lint` passed with 0 errors and 36 existing warnings.
- `gh workflow list --all` does not show the new workflow yet because GitHub has not registered it from the default branch.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Workflow green but artifact misses nested snapshots | Include recursive `tests/e2e/visual/**/*-snapshots/*.png` |
| `visual-regression.spec.js` creates snapshots outside artifact | Include its dedicated `*-snapshots` dir explicitly |
| Workflow consumes too much CI time | Scope to visual suites only; keep timeout around 20 minutes |

## Security Considerations

- `contents: read` prevents accidental write-back.
- No third-party actions beyond GitHub official checkout/setup/upload-artifact.

## Next Steps

Trigger workflow from the branch and wait for artifact in Phase 3.

## Unresolved Questions

_None._

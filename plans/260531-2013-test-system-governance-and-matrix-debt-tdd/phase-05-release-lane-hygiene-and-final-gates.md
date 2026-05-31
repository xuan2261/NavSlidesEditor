---
status: completed
priority: P1
effort: 1d
---

# Phase 05 - Release Lane Hygiene And Final Gates

## Context Links

- Workflow: `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml`
- Docs: `docs/navslides-editor-vitest-playwright-k6-testing-guide.md`, `docs/manual-smoke-checklist.md`
- Scripts: `scripts/feature-inventory/*`

## Overview

Finalize release-lane hygiene after governance and matrix debts are fixed. Keep CI practical and avoid premature platform expansion.

## Key Insights

- Report recommends keeping feature coverage warn-first until two consecutive green CI runs after Phase 1.
- Branch protection should require `required-checks`, not every shard.
- Manual smoke stays under 45 minutes.

## Requirements

- Functional: docs state current PR, merge, and release strict lanes.
- Functional: matrix gate policy states promotion criteria and rollback.
- Functional: final validation commands are recorded.
- Non-functional: do not promote warn-first to blocking without evidence.

## Architecture

Release confidence remains layered:

```text
PR fast lane -> practical signal
Merge full lane -> blocking required-checks fan-in
Release strict lane -> manual + strict import/export/load gates
Feature matrix -> warn-first until two consecutive green CI runs after Phase 1
```

## Related Code Files

| Action | Path | Notes |
|---|---|---|
| Modify | `docs/navslides-editor-vitest-playwright-k6-testing-guide.md` | Final lane policy and matrix promotion criteria |
| Modify | `docs/manual-smoke-checklist.md` | Only if runtime/mapping drift appears |
| Optional modify | `.github/workflows/github-actions-ci-pipeline-lint-unit-coverage-e2e-load-smoke.yml` | Only if current wiring contradicts docs |
| Create | `plans/260531-2013-test-system-governance-and-matrix-debt-tdd/reports/final-validation-report.md` | Final command results |

## TDD Plan

1. RED: add/update docs contract assertions for warn-first policy, two-green promotion rule, required-checks mapping, manual smoke runtime.
2. GREEN: update docs/workflow only where assertions prove drift.
3. GREEN: run final gates.
4. REFACTOR: remove stale implementation notes from docs if they conflict with current scripts.

## Tests For This Phase

| Test | Command | Expected |
|---|---|---|
| Docs contract | `npx vitest run tests/unit/release-verification-docs-contract.test.js tests/unit/github-actions-ci-release-confidence-contract.test.js` | Pass |
| Matrix gate | `npm run matrix:gate` | Pass; target 0 ALLOWED warnings |
| Unit coverage | `npm run test:coverage` | Pass |
| Build | `npm run build` | Pass |
| Lint | `npm run lint` | Pass or only documented pre-existing warnings if repo policy allows |

## Todo List

- [x] Add final docs contract expectations if missing.
- [x] Update lane/promotion docs.
- [x] Run full final command set.
- [x] Save final validation report.
- [x] Update `docs/project-changelog.md` after implementation.

## Success Criteria

- Governance is green.
- Matrix debt is reduced, ideally 0 allowlisted editor-core warnings.
- Docs tell maintainers what blocks PR/merge/release.
- No new CI platform or external credential dependency added.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Full coverage slow | Medium | Still required before finishing; use focused tests during development |
| Lint exposes unrelated warnings | Low | Do not over-fix unrelated code; record if pre-existing |

## Security Considerations

- Final validation report must not include secrets or full artifact dumps.
- External provider tests remain contract/mock/local-only.

## Next Steps

After implementation, update roadmap/changelog and run code review before commit.

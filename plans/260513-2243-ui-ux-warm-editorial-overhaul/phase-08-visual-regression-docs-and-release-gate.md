# Phase 08 - Visual Regression Docs And Release Gate

## Context Links

- [Plan](./plan.md)
- [Red team review](./reports/red-team-review.md)
- [Validation checklist](./reports/validation-checklist.md)
- `docs/design-guidelines.md`
- `docs/project-changelog.md`
- `docs/project-roadmap.md`
- `tests/e2e/visual-regression.spec.js`

## Overview

- Priority: P1
- Status: Pending
- Effort: 5h
- Goal: lock the overhaul with tests, screenshots, docs, and release notes.

## Key Insights

- Broad UI changes need visual review.
- Docs currently describe older token values.
- Prior UI plans show regressions are realistic.

## Requirements

- Functional:
  - Run full build/test gate.
  - Update visual snapshots only after manual acceptance.
  - Update design docs.
  - Update roadmap/changelog.
  - Produce final verification report in plan reports.
- Non-functional:
  - Do not ignore failed tests.
  - Document remaining risks.

## Architecture

Verification outputs stay plan-scoped:

```text
plans/260513-2243-ui-ux-warm-editorial-overhaul/reports/
  final-verification-report.md
```

Evergreen docs updated in `docs/`.

## Related Code Files

- Modify: `docs/design-guidelines.md`
- Modify: `docs/project-changelog.md`
- Modify: `docs/project-roadmap.md`
- Create: `plans/.../reports/final-verification-report.md`
- Optional modify: visual snapshots under `tests/e2e/*-snapshots/`

## Implementation Steps

1. Run unit/build/e2e gate.
2. Capture screenshots for dashboard/editor light/dark if Playwright setup supports.
3. Review visual diffs.
4. Update snapshots only when diffs are intended.
5. Update docs with final token/component rules.
6. Update changelog and roadmap.
7. Write final verification report.
8. Run code review agent per repo rule after implementation.

## Todo List

- [ ] Run build.
- [ ] Run unit tests.
- [ ] Run e2e smoke/dashboard/visual tests.
- [ ] Review visual diffs.
- [ ] Update docs.
- [ ] Write final verification report.
- [ ] Complete code review.

## Verify / Tests

- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:e2e -- tests/e2e/smoke.spec.js`
- `npm run test:e2e -- tests/e2e/dashboard.spec.js`
- `npm run test:e2e -- tests/e2e/visual-regression.spec.js`
- Optional if time: `npm run test:e2e`

## Success Criteria

- All required checks pass or failures are documented as unrelated pre-existing blockers.
- Docs match implemented design system.
- Visual snapshots intentional.
- No unresolved correctness concern from review.

## Risk Assessment

- Risk: full e2e suite may be slow/flaky.
- Mitigation: required targeted suite first; full suite optional unless release candidate.

## Security Considerations

- Confirm no secrets/docs sensitive data included.
- Confirm no CSP/sandbox weakening.

## Next Steps

- Commit with conventional message after user approval.

## Unresolved Questions

- Whether final release gate requires full e2e or targeted e2e only.

# Phase 06 - Test Gate And Regression Sweep

## Context Links

- [Plan](./plan.md)
- [Research 02](./research/researcher-02-project-validation-and-risk.md)
- [Validation](./reports/validation-report.md)

## Overview

- Priority: P1
- Status: Pending
- Goal: verify merged code with unit/component tests and targeted E2E.

## Key Insights

- Full E2E can be expensive; run targeted suites based on changed areas.
- Do not update snapshots until visual behavior is manually reviewed.
- Tests must validate final merged code.

## Requirements

- Functional:
  - Run Vitest.
  - Run targeted Playwright suites for impacted flows.
  - Fix failing tests with root cause.
- Non-functional:
  - No fake test passing.
  - No deleting tests to pass.
  - No snapshot update without inspection.

## Architecture

```text
unit/component tests -> targeted e2e -> optional full e2e -> final confidence
```

## Related Code Files

- Modify:
  - Test files only if expected behavior changed.
  - Source files if tests reveal merge regression.
- Create: new tests only if merge introduces untested behavior or fixes a regression.
- Delete: none unless duplicate/dead tests confirmed.

## Implementation Steps

1. Run unit/component tests:
   ```powershell
   npm run test
   ```
2. If UI/editor files changed, run:
   ```powershell
   npm run test:e2e -- tests/e2e/editor.spec.js
   ```
3. If AI/modal files changed, run:
   ```powershell
   npm run test:e2e -- tests/e2e/ai.spec.js
   ```
4. If game files changed, run:
   ```powershell
   npm run test:e2e -- tests/e2e/games/game-elements.spec.js
   ```
5. If visual snapshot files changed, run visual suite and inspect screenshots:
   ```powershell
   npm run test:e2e -- tests/e2e/visual-regression.spec.js
   ```
6. Optional full gate before final merge:
   ```powershell
   npm run test:e2e
   ```
7. Fix failures and repeat relevant command until pass.

## Verification And Tests

- `npm run test` passes.
- Targeted E2E suites pass for all touched domains.
- Any snapshot updates have human-reviewed visual reason.
- Failed tests have root cause fixed, not suppressed.

## Todo List

- [ ] Run unit/component tests.
- [ ] Run editor E2E if needed.
- [ ] Run AI/modal E2E if needed.
- [ ] Run game E2E if needed.
- [ ] Run visual regression if snapshots/UI chrome changed.
- [ ] Fix failures.
- [ ] Record final test commands and results.

## Success Criteria

- Test suite evidence is strong enough to merge back to `master`.

## Risk Assessment

- Risk: E2E environment flakes.
  - Mitigation: rerun once; if still failing, debug root cause.
- Risk: tests miss manual UX regression.
  - Mitigation: add manual smoke in Phase 07.

## Security Considerations

- Pay special attention to tests around share links, uploads, GitHub token config, cloud sync.

## Next Steps

- Proceed to Phase 07.

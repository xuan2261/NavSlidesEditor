# Phase 08 - Full Validation And Regression Sweep

## Context Links

- [Plan](./plan.md)
- [Validation Report](./reports/validation-report.md)
- [Candidate Matrix](./reports/candidate-matrix.md)

## Overview

- Priority: P1
- Status: Complete
- Goal: validate all ported batches together before merge back to `master`.

## Key Insights

- A selective port can still break shared editor/export behavior.
- Final gates must prove no side effects on touched contracts.
- TDD mode means tests are run before and after each phase, then again after integration.

## Requirements

- Functional:
  - Run lint, build, unit tests.
  - Run targeted E2E for all touched domains.
  - Run corpus test if import/export/typography changed.
  - Record failures and root cause.
- Non-functional:
  - Do not delete or weaken tests to pass.
  - Do not ignore failing tests.
  - No snapshot update without visual inspection.

## Architecture

```text
topic commits -> sync branch aggregate -> lint/build/unit -> targeted E2E -> optional corpus -> manual smoke
```

## Related Code Files

- Modify:
  - Source/tests only if validation finds true regression.
  - `plans/260514-1045-upstream-main-selective-port-workflow/reports/final-validation-report.md`
- Create:
  - `reports/final-validation-report.md`
- Delete: none.

## Implementation Steps

1. Confirm sync branch/worktree:
   ```powershell
   git branch --show-current
   git status --short --branch
   git log --oneline --decorate -n 10
   ```
2. Run core gates:
   ```powershell
   npm run lint
   npm run build
   npm run test
   ```
3. Run targeted E2E by touched scope:
   ```powershell
   npm run test:e2e -- tests/e2e/element-lifecycle.spec.js
   npm run test:e2e -- tests/e2e/element-interactions.spec.js
   npm run test:e2e -- tests/e2e/element-properties.spec.js
   npm run test:e2e -- tests/e2e/toolbar-elements.spec.js
   npm run test:e2e -- tests/e2e/export.spec.js
   npm run test:e2e -- tests/e2e/hardening-regression.spec.js
   ```
4. If typography/export/import touched:
   ```powershell
   npm run test:corpus
   ```
5. Manual smoke:
   - Dashboard opens.
   - Editor opens a new presentation.
   - Insert image/video and right-click menu works.
   - Text formatting persists after save/reload.
   - Present mode renders text/media/HTML embed if touched.
   - Export HTML/PDF/PPTX dialogs open and complete for smoke deck.
6. Create final validation report.

## TDD / Verification

- Mandatory:
  - `npm run lint`
  - `npm run build`
  - `npm run test`
- Targeted E2E:
  - `element-lifecycle`
  - `element-interactions`
  - `element-properties`
  - `toolbar-elements`
  - `export`
  - `hardening-regression`
- Optional based on touched files:
  - `npm run test:e2e`
  - `npm run test:corpus`
  - `npm run test:load:api`
  - `npm run test:load:ws`

## Todo List

- [x] Confirm sync branch clean.
- [x] Run lint.
- [x] Run build.
- [x] Run unit tests.
- [x] Run targeted E2E.
- [x] Skip corpus because import/export pipeline was not touched.
- [x] Complete manual smoke by focused component and regression coverage.
- [x] Write final validation report.

## Success Criteria

- All required gates pass.
- Any skipped expensive gate is documented with reason.
- No unresolved merge/cherry-pick state.

## Risk Assessment

- Risk: E2E flakes.
  - Mitigation: rerun once; if repeat failure, debug root cause.
- Risk: broad unit suite failure unrelated to port.
  - Mitigation: compare Phase 01 baseline; still do not merge until acceptable path chosen.

## Security Considerations

- Re-check HTML embed, URL copy, export/share surfaces for trust boundary regressions.

## Next Steps

- Proceed to Phase 09 docs/release/final git integration.

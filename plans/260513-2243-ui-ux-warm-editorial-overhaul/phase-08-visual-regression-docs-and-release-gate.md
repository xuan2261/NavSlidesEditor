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
- Status: Complete
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

- [x] Run build.
- [x] Run unit tests.
- [x] Run e2e smoke/dashboard/visual tests.
- [x] Review visual diffs.
- [x] Update docs.
- [x] Write final verification report.
- [x] Complete code review.

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

## Implementation Notes

- Production build passed on 2026-05-13 after the final toolbar a11y fix.
- Targeted unit tests passed for toolbar/properties/common UI contracts.
- Targeted e2e passed for toolbar insertion, properties panel, and keyboard shortcuts.
- Docs synced for design guidelines, changelog, roadmap, and codebase summary.
- Code review completed; low-priority highlight palette selected-state finding fixed with `aria-selected`.
- 2026-05-14 verification after modal-shell migrations:
  - `npm run test -- --run client/src/components/ui/ModalShell.test.jsx client/src/components/AnimationPreviewModal.test.jsx client/src/components/Toolbar.test.jsx client/src/components/PropertiesPanel.test.jsx client/src/components/CollapsibleSection.test.jsx client/src/components/ui/Button.test.js client/src/components/ui/form-primitives.test.jsx` passed: 7 files, 20 tests.
  - `npm run build` passed with existing bundle-size and empty `vendor-reveal` warnings.
  - `npm run lint` passed with 3 existing unused-arg warnings in `tests/e2e/games/game-elements.spec.js`.
  - `npm run test:e2e -- tests/e2e/smoke.spec.js` passed: 1 test.
  - `npm run test:e2e -- tests/e2e/dashboard.spec.js` passed after restoring `ModalShell` titles to `h2`: 11 tests.
  - Visual diff reviewed: authored slide canvas content stayed stable; app chrome/token drift was intended by the overhaul.
  - `npx playwright test tests/e2e/visual-regression.spec.js --update-snapshots` updated the intended warm editor chrome baseline.
  - `npm run test:e2e -- tests/e2e/visual-regression.spec.js` passed: 1 test.
  - Code-review medium feedback fixed: Share/Media async failures now render inline alert/status feedback.
  - Post-fix verification passed: targeted Vitest 7 files / 20 tests, lint with only existing game test warnings, build, dashboard e2e 11/11, visual e2e 1/1.
  - 2026-05-14 Escape rerender regression fixed in shared `useEscapeClose`; targeted Vitest now passes 7 files / 22 tests.
  - 2026-05-14 small viewport / keyboard release gate passed: keyboard shortcuts, animation preview narrow viewport, and coverage-gaps responsive smoke passed 10/10.
  - 2026-05-14 EditorPage POM modal waits updated from heading-level selectors to role-based dialog locators; Sync/History modal e2e passed 1/1.

## Unresolved Questions

- Whether to run full e2e before commit/release, beyond the targeted release gate already passed.

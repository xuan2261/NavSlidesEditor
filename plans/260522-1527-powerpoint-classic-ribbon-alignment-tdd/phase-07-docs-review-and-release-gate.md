# Phase 07: Docs Review And Release Gate

## Context Links

- Docs: `C:\Work\NavSlidesEditor\docs\design-guidelines.md`
- Docs: `C:\Work\NavSlidesEditor\docs\code-standards.md`
- Docs: `C:\Work\NavSlidesEditor\docs\project-changelog.md`
- Docs: `C:\Work\NavSlidesEditor\docs\project-roadmap.md`

## Overview

Priority: P1  
Status: In Progress  
Goal: document the final classic ribbon contract, run final gates, and prepare review handoff.

<!-- Updated: Validation Session 1 - full E2E remains conditional unless implementation blast radius expands outside ribbon. -->

## Key Insights

- Docs already describe Ribbon architecture but not detailed alignment contract.
- Changelog/roadmap must reflect actual implementation after code lands.
- Code-reviewer agent required by project rules after implementation.
- Docs should stay proportional to actual changes; do not document abstractions that were not created.

## Requirements

- Functional: docs explain alignment and group behavior.
- Non-functional: final verification passes before marking complete.
- Process: code review after tests.
- Process: final report records whether package/lockfile changed and where visual artifacts came from.

## Architecture

Docs update should be minimal and conditional:

- `design-guidelines.md`: add "PowerPoint classic ribbon layout contract" only if contract becomes public guidance.
- `code-standards.md`: add shared primitive expectation only if `RibbonTabContentRow` is actually created.
- `project-changelog.md`: add dated entry if user-facing behavior or tests/docs materially changed.
- `project-roadmap.md`: update current status only if release scope changes.

## Related Code Files

- Modify: `C:\Work\NavSlidesEditor\docs\design-guidelines.md`
- Modify: `C:\Work\NavSlidesEditor\docs\code-standards.md`
- Modify: `C:\Work\NavSlidesEditor\docs\project-changelog.md`
- Modify if needed: `C:\Work\NavSlidesEditor\docs\project-roadmap.md`
- Create report: `C:\Work\NavSlidesEditor\plans\260522-1527-powerpoint-classic-ribbon-alignment-tdd\reports\final-verification-report.md`

## Implementation Steps

1. Update docs after source/tests are final.
2. Write final verification report with commands/results.
3. Record `git diff -- package.json package-lock.json` status; dependency changes are not expected.
4. Run complete targeted suite.
5. Run `npm run lint`.
6. Run `npm run build`.
7. Run full unit suite if shared source primitives or test helpers changed.
8. Run curated editor/a11y/visual Chromium gates if shared ribbon DOM/scroll/focus behavior changed.
9. Delegate to `code-reviewer` after tests pass.
10. Address correctness concerns from review.

## Phase Tests

Required final gate:

- `npm run test -- client/src/components/ribbon`
- `npm run test:e2e -- tests/e2e/ribbon-layout.spec.js --project=chromium`
- `npm run test:e2e -- tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js --project=chromium`
- `npm run test:e2e -- tests/e2e/visual/ribbon-tabs-across-all-seven-tabs-dark-theme.spec.js --project=chromium`
- `npm run lint`
- `npm run build`

Conditional required gates:

- `npm run test` if shared source primitives or shared test helpers changed.
- Canonical Playwright/Linux snapshot regeneration workflow if screenshots are updated.

Optional if time:

- `npm run test:e2e`

## Todo List

- [x] Update docs.
- [x] Write final verification report.
- [x] Run final targeted non-visual gates.
- [ ] Refresh canonical Linux visual baselines and re-run visual gate.
- [x] Run code review.
- [x] Update plan status/progress.

## Success Criteria

- Docs match implementation.
- Final report lists exact commands/results.
- Final report lists package/lockfile status and visual snapshot generation environment.
- No unresolved review blockers.
- Plan ready to mark complete.

## Risk Assessment

- Risk: full Playwright suite too slow locally. Mitigation: targeted gates required; full suite optional unless changes spill outside ribbon.

## Security Considerations

- None.

## Next Steps

- Ship via normal git workflow if user requests commit/push.

## Unresolved Questions

- None.

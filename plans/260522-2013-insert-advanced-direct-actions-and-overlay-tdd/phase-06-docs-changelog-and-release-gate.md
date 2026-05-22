# Phase 06 - Docs Changelog And Release Gate

## Context Links

- `C:\Work\NavSlidesEditor\docs\design-guidelines.md`
- `C:\Work\NavSlidesEditor\docs\code-standards.md`
- `C:\Work\NavSlidesEditor\docs\project-changelog.md`
- `C:\Work\NavSlidesEditor\docs\project-roadmap.md`

## Overview

- Priority: P2
- Status: Complete
- Goal: sync docs with final Insert Advanced behavior and record verification.

## Key Insights

- Docs currently say dropdowns open below trigger, but do not mention clipping-safe portal overlays.
- Code standards already define ribbon content row as scroll owner.
- Changelog required after feature/bugfix.
- Validation Session 1 requires docs/final report to cover all migrated ribbon popups, not only Insert Advanced surfaces.
- Red-team review added Header AI/Share to the covered surface list because they use `top-full` placement.

<!-- Updated: Validation Session 1 - docs and final report must cover ribbon-wide popup overlay migration. -->

## Requirements

- Functional: docs describe direct Advanced actions and dynamic launcher.
- Functional: docs describe clipping-safe overlay behavior for all migrated ribbon popup surfaces, including Header AI/Share.
- Functional: changelog records UX fix and tests.
- Non-functional: concise updates only; no broad docs rewrite.

## Architecture

- Documentation only.
- No production behavior change in this phase.

## Related Code Files

- Modify: `C:\Work\NavSlidesEditor\docs\design-guidelines.md`
- Modify: `C:\Work\NavSlidesEditor\docs\code-standards.md`
- Modify: `C:\Work\NavSlidesEditor\docs\project-changelog.md`
- Modify: `C:\Work\NavSlidesEditor\docs\project-roadmap.md`
- Create: `C:\Work\NavSlidesEditor\plans\260522-2013-insert-advanced-direct-actions-and-overlay-tdd\reports\final-verification-report.md`

## Implementation Steps

1. Update `design-guidelines.md` ribbon section:
   - fixed Advanced actions direct icon buttons.
   - dynamic Games/plugins in launcher.
   - File, Header AI/Share, Design, Transitions, Animations, Paragraph compact controls, Advanced, Shape, Table, and Games ribbon popups use clipping-safe anchored overlay or document any deferred surface explicitly.
2. Update `code-standards.md` selector/overlay guidance if a shared overlay primitive is added.
3. Add changelog entry with impact and tests.
4. Update roadmap if this qualifies as ribbon UX hardening milestone.
5. Write final verification report:
   - changed files
   - test commands
   - results
   - 1280px overflow measurement and final rule used
   - overlay surfaces covered: File, Header AI/Share, Design, Transitions, Animations, Paragraph compact controls, Advanced, Shape, Table, Games
   - snapshot notes

## Todo List

- [x] Update design docs.
- [x] Update code standards if new primitive exists.
- [x] Update changelog.
- [x] Update roadmap if milestone status changes.
- [x] Create final verification report.
- [x] Record whether any red-team scope item was deferred and why.

## Completion Notes

- Docs/changelog/roadmap now record the direct Advanced actions and shared overlay contract.
- No red-team scoped popup migration was deferred.

## Tests

- `npm run lint`
- `npm run build`
- `npx vitest run client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.test.jsx client/src/components/ribbon/ribbon-file-dropdown-menu.test.jsx client/src/components/ribbon/controls/paragraph-formatting-and-alignment-controls.test.jsx`
- `npx playwright test tests/e2e/ribbon-layout.spec.js tests/e2e/games/game-elements.spec.js tests/e2e/plugin-runtime-insert-render-persistence.spec.js tests/e2e/parallax-element-insertion-property-controls-and-rendering.spec.js --project=chromium`

## Success Criteria

- Docs match actual implementation.
- Final report lists all verification outcomes.
- Final report explicitly answers validation decisions and whether any migrated popup surface was deferred.
- No unresolved implementation blockers.

## Risk Assessment

- Risk: docs overstate behavior not implemented. Mitigation: docs after tests pass only.
- Risk: noisy roadmap churn. Mitigation: update only if progress/status changed.

## Security Considerations

- Document no change to trusted author content policy or plugin sandbox.

## Next Steps

- Ready for code review and commit after all gates pass.

## Unresolved Questions

- None.

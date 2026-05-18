---
phase: 7
title: "Full Browser Verification And Docs"
status: complete
effort: "3-4h"
---

# Phase 7: Full Browser Verification And Docs

## Context Links

- [Ribbon UI Review](../reports/ribbon-ui-review-260517-2235.md)
- [Project changelog](../../docs/project-changelog.md)
- [Design guidelines](../../docs/design-guidelines.md)
- [Code standards](../../docs/code-standards.md)

## Overview

Priority: P1. Run final verification across unit, E2E, build, and live browser metrics. Update project docs with outcome and screenshots.

## Key Insights

- Browser audit is necessary because jsdom cannot catch clipping/overflow reliably.
- Existing screenshot folder `docs/ui-review/` already contains baseline evidence.
- Docs management requires roadmap/changelog updates after significant UI fix.

## Requirements

Functional:
- Verify all ribbon tabs in normal state.
- Verify Home text-editing state.
- Verify Format selected-element state.
- Capture final screenshots at 1366, 1280, 1024, 900, 768 for key tabs.
- Update docs with concise outcome.

Non-functional:
- No failing tests ignored.
- Build must pass.
- Screenshots named clearly with date or `final`.

## Architecture

Final gate matrix:
- Unit: Button + ribbon components.
- E2E: editor, toolbar-elements, new ribbon-layout if created.
- Browser metrics: `agent-browser` script matching report method.
- Docs: changelog + design guideline note only if behavior contract changes.

## Related Code Files

Modify:
- `D:\NCKH_2025\NavSlidesEditor\docs\project-changelog.md`
- Optional: `D:\NCKH_2025\NavSlidesEditor\docs\design-guidelines.md`
- Optional: `D:\NCKH_2025\NavSlidesEditor\docs\project-roadmap.md`

Create:
- `D:\NCKH_2025\NavSlidesEditor\plans\260517-2252-editor-ribbon-layout-hardening-tdd\reports\final-verification-report.md`
- Final screenshots under `D:\NCKH_2025\NavSlidesEditor\docs\ui-review\`

Delete: None.

## TDD Tests First

This phase does not add feature code. It locks final behavior:
1. Ensure all tests added in phases 1-6 pass.
2. Add final regression test only if a gap appears during verification.

## Implementation Steps

1. Run unit tests for Button/ribbon.
2. Run targeted E2E: `editor.spec.js`, `toolbar-elements.spec.js`, new `ribbon-layout.spec.js`.
3. Run `npm run build`.
4. Start/confirm dev server.
5. Use `agent-browser` to collect final metrics and screenshots.
6. Compare against baseline report.
7. Update docs/changelog.
8. Write final verification report.

## Todo List

- [ ] Unit tests pass.
- [ ] Targeted E2E pass.
- [ ] Build passes.
- [ ] Browser metrics pass at 1280/1024/900/768.
- [ ] Screenshots captured.
- [ ] Docs/changelog updated.
- [ ] Final verification report written.

## Success Criteria

- All phase tests green.
- Final browser metrics show no clipped visible-label controls.
- Critical controls visible/grouped at target viewports.
- User can open and use grouped controls.
- Changelog documents fix and impact.

## Risk Assessment

- Full E2E suite slow/flaky. Mitigate with targeted suites first.
- Screenshots can contain user data. Mitigate with temporary test presentation only.

## Security Considerations

- No new API/data surface.
- File upload and trusted HTML behavior unchanged.

## Verification

```powershell
npm run test -- --run client/src/components/ui/Button.test.js
npm run test -- --run client/src/components/ribbon
npm run test:e2e -- tests/e2e/editor.spec.js
npm run test:e2e -- tests/e2e/toolbar-elements.spec.js
npm run build
```

Browser verification:

```powershell
agent-browser --session ribbon-final set viewport 1280 720
agent-browser --session ribbon-final open http://localhost:5173/editor/<test-id>
agent-browser --session ribbon-final screenshot docs/ui-review/ribbon-final-1280-home.png
```

## Next Steps

After verification, request code-reviewer review before merge/commit.

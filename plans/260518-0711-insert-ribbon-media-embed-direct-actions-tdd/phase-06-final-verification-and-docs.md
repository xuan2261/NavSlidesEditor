---
phase: 6
title: "Final Verification And Docs"
status: complete
effort: "2-3h"
---

# Phase 6: Final Verification And Docs

## Context Links

- [Project changelog](../../docs/project-changelog.md)
- [Final verification report target](./reports/final-verification-report.md)

## Overview

Priority: P1. Run final gates, document behavior, and record verification.

## Key Insights

- Previous ribbon work already has broad tests; this plan needs focused regression plus lint/build.
- Playwright ports may conflict; use explicit env ports.

## Requirements

Functional:
- All touched behavior verified by targeted E2E.
- Component tests pass if Advanced flyout component added.
- Changelog updated with actual delivered UX change.
- Final report records commands/results.

Non-functional:
- No failing lint/build.
- Existing Vite chunk-size warning acceptable if unchanged.

## Architecture

No new architecture. Documentation-only after tests pass.

## Related Code Files

Modify:
- `D:\NCKH_2025\NavSlidesEditor\docs\project-changelog.md`
- `D:\NCKH_2025\NavSlidesEditor\plans\260518-0711-insert-ribbon-media-embed-direct-actions-tdd\reports\final-verification-report.md`

Create:
- `D:\NCKH_2025\NavSlidesEditor\plans\260518-0711-insert-ribbon-media-embed-direct-actions-tdd\reports\final-verification-report.md`

Delete: None.

## Implementation Steps

1. Run component tests:
   - `npm run test -- --run client/src/components/ribbon client/src/components/ui/Button.test.js`
2. Run layout E2E:
   - `ribbon-layout.spec.js`.
3. Run insertion/coverage/game E2E:
   - `toolbar-elements.spec.js`
   - `coverage-gaps.spec.js`
   - `games/game-elements.spec.js`
4. Run lint and build.
5. Update `docs/project-changelog.md` under 2026-05-18 or current date.
6. Write `reports/final-verification-report.md`.
7. Mark phase statuses complete only after commands pass.

## Todo List

- [x] Run component tests.
- [x] Run Playwright layout tests.
- [x] Run Playwright insertion/coverage/game tests.
- [x] Run lint.
- [x] Run build.
- [x] Update changelog.
- [x] Write final verification report.

## Success Criteria

- Targeted test gates pass.
- Lint passes.
- Build passes.
- Report/changelog match actual implementation.

## Verification

```powershell
npm run test -- --run client/src/components/ribbon client/src/components/ui/Button.test.js
$env:PLAYWRIGHT_CLIENT_PORT=4290; $env:PLAYWRIGHT_SERVER_PORT=4319; npx playwright test tests/e2e/ribbon-layout.spec.js --project=chromium
$env:PLAYWRIGHT_CLIENT_PORT=4291; $env:PLAYWRIGHT_SERVER_PORT=4320; npx playwright test tests/e2e/toolbar-elements.spec.js tests/e2e/coverage-gaps.spec.js tests/e2e/games/game-elements.spec.js --project=chromium
npm run lint
npm run build
```

## Risk Assessment

- Risk: full E2E too slow/flaky locally. Mitigation: run targeted required gates; full suite optional unless touching broader behavior.
- Risk: docs drift. Mitigation: final report lists exact commands/results and changed files.

## Security Considerations

- Confirm no change to trusted content model and no new external dependency.

## Next Steps

Cook implementation with TDD command in `plan.md`.

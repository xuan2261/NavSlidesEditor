---
phase: 6
title: "Full Validation"
status: pending
priority: P0
dependencies: [2, 3, 4, 5]
effort: "0.5-1 dev-day"
---

# Phase 6: Full Validation

## Overview

Run the complete verification gate after all fixes land. This phase proves the verified findings are fixed without regressions in lint, unit tests, build, and browser-level UI behavior.

## Requirements

- Functional: every F1-F12 success criterion is verified by passing tests or explicit manual/browser evidence.
- Functional: no skipped/todo/fails tests remain from this plan.
- Non-functional: full project validators pass before completion claim.

## Architecture

Validation order is standardized by the red-team review:
1. Source/static tests for hard-coded colors, emoji, layout classes.
2. Component tests for semantics and keyboard behavior.
3. Playwright scoped a11y/responsive flows.
4. Lint.
5. Existing full unit suite.
6. Build.

## Related Code Files

- Read/verify: all files touched in phases 2-5
- Modify only if validators expose real defects
- Inspect: `package.json` scripts
- Inspect: `tests/e2e/a11y/*`, `tests/e2e/responsive/*`

## Implementation Steps

1. Run targeted finding tests:
   - `npx vitest run client/src/components/command-palette.test.jsx`
   - `npx vitest run client/src/components/SlidePanel.test.jsx`
   - `npx vitest run client/src/components/canvas/canvas-element-wrapper.test.jsx`
   - `npx vitest run client/src/components/ShareModal.test.jsx`
   - `npx vitest run client/src/components/ribbon/ribbon-file-dropdown-menu.test.jsx`
   - `npx vitest run client/src/__tests__/ui-accessibility-findings-regression.test.js`
2. Run scoped Playwright:
   - `npx playwright test tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js`
   - `npx playwright test tests/e2e/responsive/ui-modal-toolbar-responsive.spec.js`
3. Run full validators:
   - `npm run lint`
   - `npm run test`
   - `npm run build`
4. If any validator fails, debug root cause before changing code.
5. Do a final source sweep:
   - no `mt-[80px] h-[calc(100%-80px)]`;
   - no canvas selection raw purple/teal literals;
   - no structural emoji in ShareModal controls/table;
   - no label + `className="hidden"` import controls for Home/Media upload actions.
6. Produce final implementation report with fixed findings, commands run, and any skipped validator with explicit user-approved reason.

## Success Criteria

- [ ] All targeted unit/component/static tests pass.
- [ ] Scoped Playwright tests pass.
- [ ] `npm run lint` passes.
- [ ] `npm run test` passes.
- [ ] `npm run build` passes.
- [ ] Every F1-F12 finding is marked fixed or explicitly deferred with reason.
- [ ] No new accessibility regression is observed in command palette, slide panel, file imports, canvas keyboard nudge, file menu, share modal, TemplatePicker, or MediaLibrary.

## Risk Assessment

- Risk: full suite duration is high. Mitigation: run targeted tests during iteration, full suite only at final gate.
- Risk: Playwright environment differences. Mitigation: use existing project e2e setup and deterministic routes/fixtures.
- Risk: build surfaces unrelated existing failures. Mitigation: report exact pre-existing evidence only if reproducibly unrelated; otherwise fix.

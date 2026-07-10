---
phase: 8
title: "Final Verification"
status: pending
priority: P0
dependencies: [2, 3, 4, 5, 6, 7]
effort: "1 dev-day"
---

# Phase 8: Final Verification

## Overview

Run the final regression, accessibility, build, and consistency gates before declaring the UI/UX remediation complete.

## Requirements

- Functional: every finding has a passing regression test or documented browser verification.
- Functional: no high-priority accessibility regression remains.
- Non-functional: full project validators pass; no skipped/failing tests are left behind.

## Architecture

Use a layered verification gate: targeted tests first, full unit suite, lint, build, then Playwright a11y/dashboard/ribbon slices. Finish with a whole-plan consistency sweep and a short implementation report.

## Browser Fixture Requirements

Before Playwright gates, define deterministic setup for:

- A seeded presentation with at least one text element, one chart, one markdown element, one table, and one image/shape if needed for canvas focus tests.
- Editor route loading from clean server state.
- Share route setup if axe scans include shared/present views.
- Live route setup if axe scans include live/remote/speaker pages, including room creation and teardown.
- Viewports: 320, 375, 414, tablet, and desktop for Home/editor smoke checks.
- Fallback rule: if a route requires runtime-created tokens, the test must create them through the public API or skip that route only with explicit user-approved rationale.

## Related Code Files

- Read/verify all touched files from Phases 2-7.
- Verify plan files:
  - `plan.md`
  - all `phase-*.md`
- Test commands from `package.json`

## Implementation Steps

1. Search touched test files for leftover skipped/todo tests:
   - `it.skip`
   - `test.skip`
   - `describe.skip`
   - `it.fails`
   - `it.todo`
   - `test.todo`
2. Prepare the deterministic browser fixtures above.
3. Run targeted Vitest matrix:
   ```powershell
   npx vitest run client/src/components/canvas/canvas-element-wrapper.test.jsx
   npx vitest run client/src/components/SlideCanvas.test.jsx
   npx vitest run client/src/components/ribbon/ribbon-big-button.test.jsx
   npx vitest run client/src/components/ribbon/ribbon-dropdown-menu-group-trigger.test.jsx
   npx vitest run client/src/components/ribbon/ribbon-shell-tab-navigation-and-rendering.test.jsx
   npx vitest run client/src/components/ui/ModalShell.test.jsx
   npx vitest run client/src/components/ProductTour.test.js
   npx vitest run client/src/components/canvas/element-renderers/chart-element-renderer.test.jsx
   npx vitest run client/src/components/canvas/element-renderers/markdown-element-renderer.test.jsx
   npx vitest run client/src/components/canvas/element-renderers/table-element-renderer.test.jsx
   npx vitest run client/src/utils/tailwind-token-contract.test.js
   npx vitest run client/src/pages/home-editor-responsive-source.test.js
   npx vitest run client/src/App.suspense-fallback.test.jsx
   ```
4. Run browser gates:
   ```powershell
   npm run test:e2e -- tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js
   npm run test:e2e -- tests/e2e/a11y/axe-core-scans-across-editor-present-share-live-and-home-views.spec.js
   npm run test:e2e -- tests/e2e/dashboard.spec.js
   npm run test:e2e -- tests/e2e/ribbon
   ```
5. Run full validators:
   ```powershell
   npm run lint
   npm run test
   npm run build
   ```
6. Manually verify with browser if needed:
   - `/not-a-real-route`
   - 375px Home dashboard
   - editor keyboard-only canvas selection
   - modal focus trap
   - light-background chart/markdown/table slide
7. Read `plan.md` and all phase files for stale terms or contradicted acceptance criteria.
8. Produce final implementation report with:
   - findings fixed
   - tests added
   - validation output
   - unresolved questions, if any

## Success Criteria

- [ ] All targeted tests pass.
- [ ] Deterministic browser fixtures are documented and used by Playwright gates.
- [ ] Browser a11y/dashboard/ribbon slices pass.
- [ ] `npm run lint`, `npm run test`, and `npm run build` pass.
- [ ] No skipped/failing/todo regression tests remain in tests touched by this plan.
- [ ] Final report maps each original finding to evidence and validator output.

## Risk Assessment

- Risk: full e2e suite is expensive or flaky.
  - Mitigation: targeted Playwright slices are required; if full suite is skipped, report exact reason and user approval.
- Risk: validations reveal older unrelated failures.
  - Mitigation: isolate with targeted commands, document unrelated failures, but do not claim completion if touched behavior is failing.

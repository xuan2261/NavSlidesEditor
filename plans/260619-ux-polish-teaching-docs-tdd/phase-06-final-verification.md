---
phase: 6
title: "Final Verification"
status: completed
priority: P1
effort: "0.5-1d"
dependencies: [2, 3, 4, 5]
---

# Phase 6: Final Verification

## Overview

Run final validators, review side effects, and produce release-ready evidence for the UX polish plan without bumping version.

## Requirements

- Functional: verify every acceptance criterion from prior phases.
- Functional: document final evidence in a plan report.
- Non-functional: no lint, test, docs build, or targeted E2E failures.
- Non-functional: no public contract changes unless intentionally documented.

## Architecture

Validation layers:
- Vitest for component/contracts.
- Playwright for keyboard, teaching, dashboard, and accessibility flows.
- VitePress build for docs.
- Existing matrix/count tests for element/game count stability.

## Related Code Files

- Create: `plans/260619-ux-polish-teaching-docs-tdd/reports/final-verification-report.md`
- Create: `plans/260619-ux-polish-teaching-docs-tdd/reports/code-review-report.md` if reviewer output needs persistence
- Create: `plans/260619-ux-polish-teaching-docs-tdd/reports/docs-parity-report.md` if docs parity output needs persistence
- Modify: phase files to completed only after evidence passes
- Modify: `plans/260619-ux-polish-teaching-docs-tdd/plan.md` status only after all criteria pass

## Implementation Steps

1. Run focused Vitest tests for changed app/docs guard files.
2. Run targeted Playwright checks for teaching smoke, keyboard/a11y, dashboard/template paths.
3. Run `npm run lint`.
4. Run `npm run test`.
5. Run `npm run docs:build`.
6. Run `npm run build` if source changes affect the client app.
7. Run code-reviewer, tester, and docs-manager subagents.
8. Write final verification report and mark plan complete only after all blockers are resolved.

## Required Validation Commands

Focused commands, adjusted only to match files changed during implementation:

```bash
npx vitest run client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx client/src/components/content-editor-modals.test.jsx client/src/components/stem-simulation-preset-modal.test.jsx client/src/data/slide-templates.test.js client/src/data/element-defaults.test.js tests/unit/website-content-port-pages-and-sidebar-coverage.test.js tests/unit/release-verification-docs-contract.test.js <updated-v1.15-website-content-guard-test>
npx playwright test tests/e2e/teaching-interactivity-smoke.spec.js tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js tests/e2e/a11y/axe-core-scans-across-editor-present-share-live-and-home-views.spec.js tests/e2e/dashboard.spec.js tests/e2e/templates.spec.js tests/e2e/games/game-elements-player-join-page.spec.js
npm run lint
npm run test
npm run docs:build
npm run build
```

Replace `<updated-v1.15-website-content-guard-test>` with the renamed or updated successor to `tests/unit/website-content-accuracy-v1-14-guards.test.js`; it must assert v1.15 facts including 19 canonical element types and 10 game subtypes.

If `npm` is unavailable on PATH, use direct local `.cmd` binaries as in the previous release verification and record the exact fallback commands.

## Success Criteria

- [x] Focused and full validators pass or any accepted skip is explicitly approved.
- [x] Code-reviewer reports no side-effect regressions.
- [x] Tester validates changed UX flows.
- [x] Docs-manager validates English/Vietnamese parity.
- [x] Game player join accessibility coverage is included through `tests/e2e/games/game-elements-player-join-page.spec.js` or an equivalent targeted spec.
- [x] Final verification report is created only after implementation and records actual command outcomes, not planned commands.
- [x] Final verification report lists exact commands and outcomes.
- [x] Working tree contains no unrelated/unexplained changes.

## Risk Assessment

Risk: full E2E flakes. Mitigation: rerun failed spec once and inspect trace; fix only real regressions.

Risk: docs build catches broken links late. Mitigation: run docs build before final full validation where possible.

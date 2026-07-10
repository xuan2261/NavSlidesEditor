---
phase: 8
title: "Final Verification Release Gate"
status: pending
priority: P0
dependencies: [2, 3, 4, 5, 6, 7]
---

# Phase 8: Final Verification Release Gate

## Overview

Run the final whole-plan verification matrix, reconcile any contradictions, and confirm the UI hygiene/UX improvements are regression-safe.

## Requirements

- Functional: every confirmed finding F1-F8 has a green test proving the fix; F9 decision remains enforced by ribbon tests.
- Non-functional: lint, unit, build, targeted E2E, and full E2E gates pass before completion unless an objective blocker is documented and the user explicitly approves skipping full E2E.

## Architecture

This phase does not add product features. It is a release gate and consistency sweep across the plan files, changed code, tests, and user-visible behavior.

## Related Code Files

- Modify: only if final gate exposes defects.
- Read/check: `plan.md`, every `phase-*.md`, `red-team-review.md`, `validation-report.md`.
- Run: targeted tests from Phases 1-7.
- Run: full validators from root package scripts.

## Implementation Steps

1. Re-read `plan.md` and all phase files for stale assumptions.
2. Run static tests:
   - App fallback.
   - Tailwind token contract.
   - Native dialog audit.
   - Presentation token audit.
3. Run component tests:
   - Command palette.
   - Status bar.
   - PropertiesPanel/text guidance.
   - Ribbon insert/panel tests.
   - Find/replace tests.
4. Run Playwright scoped E2E:
   - Dashboard semantics/a11y.
   - Keyboard navigation.
   - Minimum hit targets.
   - Find/replace responsive overlay.
   - Ribbon responsive/advanced discoverability.
   - Present/speaker/remote visual or DOM checks.
5. Run final project validators:
   - `npm run lint`
   - `npm run test`
   - `npm run build`
   - `npm run test:e2e`
6. Fix failures at source and rerun failing commands.
7. If `npm run test:e2e` cannot run because of infrastructure/time/resource failure, stop and report the blocker. Do not mark the final gate passed unless the user explicitly approves skipping or substituting the scoped matrix.
8. Summarize evidence: command, result, and any intentionally deferred items.

## Tests And Verification

Full matrix:

```bash
npx vitest run client/src/App.suspense-fallback.test.jsx client/src/utils/tailwind-token-contract.test.js client/src/utils/native-dialog-audit.test.js client/src/utils/presentation-ui-token-audit.test.js
npx vitest run client/src/components/command-palette.test.jsx client/src/components/layout/StatusBar.test.jsx client/src/components/PropertiesPanel.test.jsx client/src/components/properties/text-properties-panel-render.test.jsx
npx vitest run client/src/components/find-replace-vertical-slides.test.jsx client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx client/src/components/ribbon/ribbon-shell-tab-navigation-and-rendering.test.jsx
npx playwright test tests/e2e/dashboard.spec.js tests/e2e/a11y/dashboard-card-semantics.spec.js tests/e2e/a11y/minimum-hit-targets.spec.js tests/e2e/find-replace-responsive-overlay.spec.js tests/e2e/ribbon/advanced-actions-overflow-discoverability.spec.js tests/e2e/ribbon/responsive-pressure-points.spec.js
npm run lint
npm run test
npm run build
npm run test:e2e
```

## Success Criteria

- [ ] F1-F8 each have passing regression coverage.
- [ ] F9 is enforced: advanced actions are discoverable, not hidden by default.
- [ ] No unresolved stale terms or contradictions remain in plan artifacts.
- [ ] Full validators pass, including `npm run test:e2e`, or skipped full E2E is explicitly approved by the user after a documented blocker.
- [ ] Final report includes exact verification evidence.

## Risk Assessment

- Risk: full Playwright suite is long/flaky. Mitigation: run scoped matrix during iteration, full suite at milestone or report exact blocker.
- Risk: final fixes creep scope. Mitigation: only fix failures caused by this plan unless user approves broader work.

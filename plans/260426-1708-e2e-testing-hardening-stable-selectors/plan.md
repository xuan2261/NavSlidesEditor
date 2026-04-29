---
title: "E2E Testing Hardening With Stable Selectors"
description: "Harden NavSlides E2E coverage around property panels, lifecycle flows, autosave failures, and visual/CI gates without destabilizing existing canvas selectors."
status: completed
priority: P1
effort: "6-8d"
branch: "master"
tags: [testing, e2e, frontend, refactor, quality]
blockedBy: []
blocks: []
created: "2026-04-26T10:09:08.876Z"
createdBy: "ck:plan"
source: skill
---

# E2E Testing Hardening With Stable Selectors

## Overview

Implementation-ready hard-mode plan for E2E testing gaps after reviewing `brainstorm-260426-1547-e2e-testing-comprehensive.md`.

Final decisions:
- Keep existing canvas test IDs stable: `slide-element-*`, `resize-handle-*`, `rotation-handle`, `top-ruler`, `persistent-guide-*`.
- Prefer role/label/text selectors first; add `data-testid` only for ambiguous property controls.
- Autosave failure keeps optimistic local state, shows visible error, supports retry. No rollback.
- Use Playwright built-in `toHaveScreenshot()` for visual regression. No Percy.
- Do not expose `window.__store` for E2E. Verify via API persistence, DOM state, and `expect.poll()`.
- Add one bounded undo/redo stress test. Avoid broad stress suites unless flake data proves need.

Baseline:
- `npx playwright test --list` => 110 tests in 23 files.
- `properties-panel.spec.js` + `coverage-gaps.spec.js` => 10/10 passed.

Not in scope:
- Replacing Playwright.
- Renaming existing canvas test IDs.
- Adding table merge UI.
- CI sharding before runtime data proves need.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Baseline And Selector Contract](./phase-01-baseline-and-selector-contract.md) | Completed |
| 2 | [Property Panel Test IDs](./phase-02-property-panel-test-ids.md) | Completed |
| 3 | [Element Property Coverage](./phase-03-element-property-coverage.md) | Completed |
| 4 | [Lifecycle And Autosave Failure Coverage](./phase-04-lifecycle-and-autosave-failure-coverage.md) | Completed |
| 5 | [Editor POM Helper Split](./phase-05-editor-pom-helper-split.md) | Completed |
| 6 | [Visual Regression And CI Runtime Gates](./phase-06-visual-regression-and-ci-runtime-gates.md) | Completed |
| 7 | [Final Verification And Documentation](./phase-07-final-verification-and-documentation.md) | Completed |

## Dependencies

- No active same-scope blocking plan found. `260426-1129-trusted-hardening-without-html-embed-regression` is completed.
- Reference reports:
  - `plans/reports/brainstorm-260426-1547-e2e-testing-comprehensive.md`
  - `plans/reports/debug-260426-1651-e2e-testing-brainstorm-review.md`
  - `plans/reports/researcher-260426-1552-e2e-testing.md`
  - `plans/reports/researcher-260426-1552-e2e-canvas-testing-patterns.md`
  - `plans/reports/researcher-260426-1552-element-testing-patterns.md`

## Success Metrics

- Current E2E discovery remains valid: at least 110 tests, no accidental test loss.
- Property panel selectors stable for common, shape, image, chart, code, table, misc/latex controls.
- New property tests verify persisted state through real API saves.
- Autosave failure has visible UI and retry test.
- POM helper split keeps all existing tests passing.
- Visual baseline test uses deterministic seeded deck and disabled animation.
- Final gates pass or every failure is documented with owner and reason.


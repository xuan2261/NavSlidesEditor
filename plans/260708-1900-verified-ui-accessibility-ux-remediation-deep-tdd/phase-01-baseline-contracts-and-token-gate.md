---
phase: 1
title: "Baseline Contracts And Token Gate"
status: pending
priority: P0
dependencies: []
effort: "0.5-1 dev-day"
---

# Phase 1: Baseline Contracts And Token Gate

## Overview

Create the red/characterization harness before UI changes. This phase proves the missing focus token, records current accessibility gaps, and adds guardrails so later phases cannot silently regress keyboard, route, and token contracts.

## Requirements

- Functional: add tests that fail or characterize current behavior for missing `ring-ring`, blank unknown route, ribbon keyboard activation gaps, modal focus trap expectations, canvas element semantics, renderer contrast defaults, Home mobile layout, and Joyride overlay config.
- Non-functional: tests must be scoped, deterministic, and avoid brittle screenshots unless browser layout is required.

## Architecture

Use a layered harness:

1. Static/source contract tests for class tokens, route declarations, and disallowed patterns.
2. Component tests for reusable primitives.
3. Playwright a11y flows for keyboard-only runtime behavior.

Do not implement fixes in this phase except the smallest test fixture setup needed to make tests runnable.

## Related Code Files

- Modify tests: `client/src/utils/tailwind-token-contract.test.js`
- Modify tests: `client/src/App.suspense-fallback.test.jsx` or create `client/src/App.route-recovery.test.jsx`
- Modify tests: `client/src/components/ribbon/ribbon-big-button.test.jsx`
- Modify tests: `client/src/components/ui/ModalShell.test.jsx`
- Modify tests: `client/src/components/canvas/canvas-element-wrapper.test.jsx`
- Modify tests: `client/src/components/canvas/element-renderers/*-element-renderer.test.jsx`
- Modify tests: `client/src/pages/home-editor-responsive-source.test.js`
- Modify e2e: `tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js`

## Implementation Steps

1. Add a Tailwind token contract test that scans production client files for `ring-*`, `bg-*`, and `text-*` aliases that must exist in `client/tailwind.config.js` or be native Tailwind colors.
2. Add route recovery test that proves unknown paths render a Not Found state. It should fail initially and be labeled `red defect`.
3. Add ribbon activation tests for controls known to use only `onMouseDown`, starting with `ClipboardButtons` and `ribbon-view-mode-controls-content`.
4. Add ModalShell tests for Tab/Shift+Tab loop, Escape close, initial focus, and focus restoration. Use this as the contract for migrated modals.
5. Add canvas wrapper test asserting selected element wrappers expose focusable semantics and keyboard activation. It should fail initially.
6. Add renderer tests asserting chart/markdown/table default text/grid/border colors are token or contrast-aware, not hardcoded white. They should fail where current code hardcodes white.
7. Add Home mobile source or Playwright test for 320/375/414px header usability: search visible, New reachable, no horizontal overflow, touch targets acceptable.
8. Add ProductTour config test for overlay opacity/target clarity contract.
9. Label every baseline test as `safe baseline` or `red defect`. Do not let characterization tests lock in bad behavior without a later phase that converts them.
10. Run targeted tests and capture failing output in implementation notes before fixing.

## Success Criteria

- [ ] Tests exist for each verified finding.
- [ ] Each test either fails for the known defect or characterizes current safe behavior before refactor.
- [ ] Every characterization test has an explicit `safe baseline` or `red defect` label.
- [ ] No implementation fix is hidden inside the baseline phase.
- [ ] Targeted test commands run and produce expected red/characterization evidence.

## Risk Assessment

- Risk: static token test may over-flag dynamic Tailwind classes.
  - Mitigation: scope to known UI chrome paths and allow explicit safelist.
- Risk: baseline suite becomes too large.
  - Mitigation: write one focused test per finding, defer exhaustive matrices to implementation phases.

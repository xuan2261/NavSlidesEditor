---
phase: 1
title: "Regression Characterization"
status: pending
priority: P0
dependencies: []
effort: "0.5-1 dev-day"
---

# Phase 1: Regression Characterization

## Overview

Create the failing/characterization test harness for all 12 verified findings before implementation. This phase locks the bug surface and prevents subjective UI polish from expanding scope.

## Requirements

- Functional: each finding has at least one test, source audit, or Playwright assertion proving current behavior and desired behavior.
- Functional: test names reference `F1`-`F12` so implementation can map fixes to findings.
- Non-functional: tests must be deterministic, not depend on network, and not introduce skipped/todo tests.

## Architecture

Use three test layers:
1. **Component tests** for semantic markup and keyboard handling in React components.
2. **Static/source tests** for hard-coded colors, structural emoji, and magic layout offsets.
3. **Playwright specs** for tab order, focus visibility, modal focus trapping, and narrow viewport overflow.

## Finding-To-Test Matrix

| Finding | Primary test location |
|---|---|
| F1 Command Palette dialog/focus | `client/src/components/command-palette.test.jsx` |
| F2 Hidden slide actions | `client/src/components/SlidePanel.test.jsx` |
| F3 Import controls | `client/src/pages/HomePage.import-accessibility.test.jsx` |
| F4 Canvas labels | `client/src/components/canvas/canvas-element-wrapper.test.jsx` |
| F5 Canvas nudge step | `client/src/components/canvas/canvas-element-wrapper.test.jsx` |
| F6 Canvas raw colors | `client/src/__tests__/ui-accessibility-findings-regression.test.js` |
| F7 Right panel offset | `client/src/__tests__/ui-accessibility-findings-regression.test.js` plus editor layout test |
| F8 File menu keyboard | `client/src/components/ribbon/ribbon-file-dropdown-menu.test.jsx` |
| F9 ShareModal semantics | `client/src/components/ShareModal.test.jsx` |
| F10 TemplatePicker responsive | `tests/e2e/responsive/ui-modal-toolbar-responsive.spec.js` |
| F11 MediaLibrary responsive | `tests/e2e/responsive/ui-modal-toolbar-responsive.spec.js` |
| F12 Structural emoji | `client/src/__tests__/ui-accessibility-findings-regression.test.js` |

## Related Code Files

- Modify: `client/src/components/command-palette.test.jsx`
- Modify/Create: `client/src/components/SlidePanel.test.jsx`
- Modify: `client/src/components/canvas/canvas-element-wrapper.test.jsx`
- Modify/Create: `client/src/pages/HomePage.import-accessibility.test.jsx`
- Modify/Create: `client/src/components/ShareModal.test.jsx`
- Modify/Create: `client/src/components/ribbon/ribbon-file-dropdown-menu.test.jsx`
- Modify/Create: `client/src/__tests__/ui-accessibility-findings-regression.test.js`
- Modify/Create: `tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js`
- Modify/Create: `tests/e2e/responsive/ui-modal-toolbar-responsive.spec.js`

## Implementation Steps

1. Add a findings matrix test or inline comments mapping F1-F12 to test files.
2. F1: assert open `CommandPalette` exposes `role="dialog"`, `aria-modal`, labelled title/input, and traps Tab.
3. F2: assert slide thumbnail hidden action buttons are not focusable until container hover/focus-within state is active, or have `tabIndex=-1` while hidden.
4. F3: assert Home import actions are discoverable as buttons by accessible name and unit-test that keyboard activation calls the hidden input ref `.click()`. Do not assert native file picker behavior in Playwright.
5. F4/F5: extend canvas wrapper tests for enriched `aria-label` and Arrow/Shift+Arrow nudge values.
6. F6/F7/F12: add source tests for raw selection chrome colors, fixed `mt-[80px]`/`calc(100%-80px)`, and structural emoji in UI controls.
7. F8: add dropdown keyboard tests for first-item focus, ArrowUp/Down, Home/End, Escape close, and trigger focus restore.
8. F9: add ShareModal tests for `tablist`/`tab`/`tabpanel`, `aria-selected`, `aria-controls`, `scope="col"`, and labelled protected column.
9. F10/F11: add responsive class or Playwright assertions for TemplatePicker grid and MediaLibrary toolbar at 375px.
10. Add a no-snapshot rule for new ARIA/focus tests. Role/name/focus assertions are required for accessibility behavior.
11. Run targeted tests and record expected failures before implementation.

## Success Criteria

- [ ] Every finding F1-F12 has at least one test location.
- [ ] New tests fail on current code for true defects.
- [ ] No test uses brittle snapshots where role/name assertions are possible.
- [ ] No skipped/todo/fails tests are introduced.
- [ ] File picker activation is covered by unit tests, while Playwright covers only reachability/tab order.
- [ ] Targeted test commands are documented in commit notes or task log.

## Risk Assessment

- Risk: tests may overfit implementation. Mitigation: prefer observable behavior and accessibility roles.
- Risk: Playwright file input tests can be flaky. Mitigation: test visible button semantics in component tests and use Playwright only for tab flow.
- Risk: source tests may flag valid content emoji in slide data. Mitigation: scope structural emoji audit to UI chrome files only.

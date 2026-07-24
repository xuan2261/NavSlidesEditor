---
phase: 1
title: "Discovery And UX Contracts"
status: completed
priority: P1
effort: "1d"
dependencies: []
---

# Phase 1: Discovery And UX Contracts

## Overview

Define testable UX contracts before changing UI. Lock onboarding, empty-state, keyboard, and bilingual-doc expectations so later phases cannot drift into broad redesign.

## Requirements

- Functional: inventory current teaching entry points, modal warnings, dashboard empty states, template cards, and keyboard paths.
- Functional: write contract tests/fixtures for expected UX outcomes before implementation.
- Non-functional: preserve existing architecture, element counts, game counts, and app routes.
- Non-functional: no backend schema or persistent data migration.

## Architecture

This phase is contract-only. It maps current UI surfaces to tests and a local plan report:
- Editor shell mounts onboarding and ribbon actions.
- Home dashboard renders presentation/template states.
- Modals expose validation, warnings, and apply/cancel behavior.
- Keyboard handlers dispatch by scope and must not fire while editing text.

## Related Code Files

- Create: `plans/260619-ux-polish-teaching-docs-tdd/reports/ux-contracts.md`
- Modify: test files only; production files are read-only source context in this phase
- Modify: `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.test.jsx`
- Modify: `client/src/components/content-editor-modals.test.jsx`
- Modify: `client/src/pages/__tests__/*` or nearby HomePage tests if present
- Modify: `tests/e2e/a11y/keyboard-only-navigation-across-editor-ribbon-and-modals.spec.js`
- Modify: `tests/e2e/teaching-interactivity-smoke.spec.js`

## Implementation Steps

1. Add/adjust failing tests for teaching feature discoverability targets.
2. Add failing tests for modal accessible descriptions and warnings.
3. Add failing tests for HomePage empty/search/template keyboard contracts.
4. Add guard assertions for 19 canonical element types and 10 game subtypes if touched.
5. Record the final UX contract list in this phase before implementation phases start.

## Success Criteria

- [x] UX contract tests fail for missing desired polish before implementation.
- [x] Contract list identifies exact UI surfaces and selectors/roles.
- [x] Contract report lists expected role/name, Enter/Space behavior, Escape behavior, focus restoration, and validation announcement behavior.
- [x] No production behavior changes are made in this phase except test scaffolding.
- [x] No plan overlap/blocker requires changing another active plan.

## Risk Assessment

Risk: tests become too brittle around copy. Mitigation: assert role, affordance, and core phrase only, not full marketing prose.

Risk: contract phase expands scope. Mitigation: reject new feature families and keep scope to discoverability/accessibility/empty-state polish.

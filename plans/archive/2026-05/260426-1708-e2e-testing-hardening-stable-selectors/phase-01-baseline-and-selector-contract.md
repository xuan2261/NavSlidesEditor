---
phase: 1
title: "Baseline And Selector Contract"
status: completed
priority: P1
effort: "0.75d"
dependencies: []
---

# Phase 1: Baseline And Selector Contract

## Context Links
- `plans/reports/debug-260426-1651-e2e-testing-brainstorm-review.md`
- `plans/reports/researcher-260426-1552-e2e-canvas-testing-patterns.md`
- `tests/e2e/coverage-gaps.spec.js`
- `tests/e2e/properties-panel.spec.js`
- `client/src/components/SlideCanvas.jsx`
- `docs/code-standards.md`

## Overview
Priority P1. Establish exact baseline and selector rules before adding tests. This prevents duplicate coverage and accidental breaking of current canvas selectors.

## Key Insights
- Current repo has 23 E2E spec files and 110 Playwright-discovered tests.
- Existing canvas IDs are used by passing tests. Keep them.
- Property panel controls are fragile because current tests rely on input order and CSS selectors.
- Accessibility-first selectors remain preferred. `data-testid` is for ambiguous controls only.

## Requirements
- Functional: inventory current E2E files, selector usage, and property controls needing stable selectors.
- Non-functional: no source behavior change, no test rewrite yet, no selector rename.
- Compatibility: existing `coverage-gaps.spec.js` and `properties-panel.spec.js` must still pass.

## Architecture
Selector priority:
1. `getByRole`, `getByLabel`, `getByText` when accessible and unique.
2. `data-testid` for ambiguous property controls, color/range inputs, repeated series/cell controls.
3. Existing canvas `data-testid` names stay unchanged.
4. CSS class selectors allowed only for legacy canvas wrappers and unavoidable dynamic DOM.

## Related Code Files
- Modify: `docs/code-standards.md` selector convention section.
- Read: `client/src/components/properties/*.jsx`
- Read: `client/src/components/SlideCanvas.jsx`
- Read: `tests/e2e/*.spec.js`
- Create: none required unless adding a plan-scoped report.
- Delete: none.

## Implementation Steps
1. Run and save baseline:
   - `npx playwright test --list`
   - `npx playwright test tests/e2e/properties-panel.spec.js tests/e2e/coverage-gaps.spec.js --reporter=list`
2. Inventory existing stable selectors:
   - `slide-element-*`
   - `resize-handle-*`
   - `rotation-handle`
   - `top-ruler`, `left-ruler`
   - `persistent-guide-*`, `smart-guide-*`
3. Inventory property panel controls by file:
   - `common-element-controls.jsx`
   - `shape-properties.jsx`
   - `image-properties.jsx`
   - `chart-properties.jsx`
   - `code-properties.jsx`
   - `table-properties.jsx`
   - `misc-properties.jsx`
4. Define naming convention:
   - common: `prop-x`, `prop-y`, `prop-width`, `prop-height`, `prop-rotation`, `prop-lock-toggle`, `prop-delete`
   - shape: `prop-shape-fill`, `prop-shape-stroke`, `prop-shape-stroke-width`, `prop-shape-border-radius`
   - image: `prop-image-object-fit`, `prop-image-brightness`, `prop-image-contrast`, `prop-image-grayscale`, `prop-image-border-radius`
   - chart: `prop-chart-type`, `prop-chart-labels`, `prop-chart-values-0`, `prop-chart-add-series`
   - code: `prop-code-language`, `prop-code-font-size`, `prop-code-border-radius`
   - table: `prop-table-add-row`, `prop-table-remove-row`, `prop-table-add-col`, `prop-table-remove-col`
   - misc: `prop-latex-edit`, `prop-html-edit`
5. Update `docs/code-standards.md` with the selector contract and "do not rename canvas IDs" rule.
6. Do not change tests or components in this phase except docs/inventory notes.

## Todo List
- [ ] Baseline test discovery captured.
- [ ] Existing passing subset captured.
- [ ] Property selector inventory complete.
- [ ] Selector contract added to `docs/code-standards.md`.
- [ ] Confirm no canvas test ID rename planned.

## Verification & Tests
- `npx playwright test --list`
- `npx playwright test tests/e2e/properties-panel.spec.js tests/e2e/coverage-gaps.spec.js --reporter=list`
- `npm run lint -- --quiet` if lint covers changed docs/imports.

## Success Criteria
- [ ] Baseline says 110+ tests in 23+ files, or changed count is explained.
- [ ] `properties-panel.spec.js` and `coverage-gaps.spec.js` pass before selector implementation.
- [ ] `docs/code-standards.md` documents selector priority and current canvas ID preservation.
- [ ] No source behavior change.

## Risk Assessment
- Risk: adding too many test IDs creates noisy JSX.
- Mitigation: add only where role/label selectors are ambiguous.
- Risk: future implementer renames canvas IDs.
- Mitigation: explicit `do not rename` rule in docs and phase instructions.

## Security Considerations
- Do not add `window.__store`.
- Test IDs must not include presentation content, tokens, or secrets.

## Next Steps
- Phase 2 adds selected `data-testid` attributes after this contract is accepted.


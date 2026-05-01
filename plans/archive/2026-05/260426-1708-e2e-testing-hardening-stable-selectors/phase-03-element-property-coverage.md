---
phase: 3
title: "Element Property Coverage"
status: completed
priority: P1
effort: "1.5-2d"
dependencies: [2]
---

# Phase 3: Element Property Coverage

## Context Links
- `phase-02-property-panel-test-ids.md`
- `tests/e2e/properties-panel.spec.js`
- `tests/e2e/fixtures/test-fixtures.js`
- `tests/e2e/pages/EditorPage.js`
- `client/src/data/element-defaults.js`
- `client/src/components/properties/*.jsx`

## Overview
Priority P1. Add focused E2E coverage for true property-panel gaps. Verify user-visible control changes persist through the real backend API.

## Key Insights
- Element insertion is already broadly covered; do not duplicate it.
- API seeding is faster and less flaky for property tests.
- Use `expect.poll()` + `apiGetPresentation()` after `waitForAutoSave()`.
- Test existing UI capabilities only. Do not add image URL editing or table merge behavior here.

## Requirements
- Functional: cover common, shape, image, chart, code, table, and latex/html edit-entry controls.
- Non-functional: deterministic tests, no external network, no fake pass-through assertions.
- Coverage: verify persisted JSON changes, not only DOM values.

## Architecture
New E2E specs stay flat under `tests/e2e/`, matching current project style.

Suggested files:
- `tests/e2e/element-properties.spec.js`
- `tests/e2e/element-interactions.spec.js`

Shared setup:
- Use `apiCreatePresentation`, `apiUpdatePresentation`, `apiGetPresentation`, `apiDeletePresentation`.
- Seed one element per test unless multi-element behavior is required.
- Reuse `EditorPage.gotoPresentation()` and `selectElement()`.

## Related Code Files
- Create: `tests/e2e/element-properties.spec.js`
- Create: `tests/e2e/element-interactions.spec.js`
- Modify: `tests/e2e/pages/EditorPage.js` only if a small helper removes duplication.
- Modify: property components only if a missing test ID is discovered.
- Delete: none.

## Implementation Steps
1. Create deterministic seed helpers inside the spec or `fixtures/test-fixtures.js` if reused 3+ times.
2. Add common control tests:
   - X/Y/W/H update persists.
   - Rotation input normalizes and persists.
   - Lock toggle hides resize handle and persists.
   - Shadow X/Y/blur/color persists for supported element types.
3. Add shape tests:
   - Fill color persists.
   - Stroke color and width persist.
   - Border radius persists for rectangle shapes.
   - Label text/text color/text size persist.
4. Add image tests:
   - Object fit persists.
   - Brightness/contrast/grayscale/radius persist.
   - Do not test URL update unless UI exists.
5. Add code tests:
   - Language selection persists.
   - Font size and border radius persist.
   - Edit Code button opens dialog; apply changes persists content/language.
6. Add chart tests:
   - Chart type persists.
   - Labels update persists.
   - Series label/values/color persist.
   - Add/remove series works and persists.
7. Add table tests:
   - Add/remove row persists.
   - Add/remove column persists.
   - Header row toggle persists.
   - Table colors/font size/cell text update persists.
8. Add LaTeX/html edit-entry tests:
   - LaTeX edit button opens dialog and Apply persists content.
   - HTML edit button opens dialog and Apply persists trusted embed content.
   - Do not require invalid-LaTeX visible error unless current UI exposes one.
9. Keep assertions state-based:
   - `await editor.waitForAutoSave()`
   - `const saved = await apiGetPresentation(request, presId)`
   - `expect(saved.slides[0].elements[0]).toMatchObject(...)`

## Todo List
- [ ] `element-properties.spec.js` added.
- [ ] `element-interactions.spec.js` added.
- [ ] Tests avoid external images/network.
- [ ] Tests avoid `.nth()` except unavoidable indexed chart/table series controls.
- [ ] Tests use current canvas IDs, not proposed renamed IDs.

## Verification & Tests
- `npx playwright test tests/e2e/element-properties.spec.js --reporter=list`
- `npx playwright test tests/e2e/element-interactions.spec.js --reporter=list`
- `npx playwright test tests/e2e/properties-panel.spec.js tests/e2e/coverage-gaps.spec.js --reporter=list`
- `npm run build`

## Success Criteria
- [ ] New tests pass alone.
- [ ] Existing property/canvas tests still pass.
- [ ] No duplicated broad insertion suite.
- [ ] No test swallows failures with `.catch(() => {})`.
- [ ] No new feature behavior hidden inside tests.

## Risk Assessment
- Risk: property UI updates on change but autosave debounce delays persisted state.
- Mitigation: always call `waitForAutoSave()` and use `expect.poll()`.
- Risk: chart/table repeated controls make selectors brittle.
- Mitigation: indexed `data-testid` per series/cell only where needed.

## Security Considerations
- HTML embed tests must preserve trusted programmable HTML regression coverage.
- Do not sanitize/strip trusted embed content as part of test work.

## Next Steps
- Phase 4 expands lifecycle and failure-mode tests after core properties are covered.


---
phase: 5
title: "Editor POM Helper Split"
status: completed
priority: P2
effort: "1d"
dependencies: [4]
---

# Phase 5: Editor POM Helper Split

## Context Links
- `tests/e2e/pages/EditorPage.js`
- `tests/e2e/pages/HomePage.js`
- `tests/e2e/pages/SettingsPage.js`
- `tests/e2e/pages/ExplorePage.js`
- `plans/reports/researcher-260426-1552-e2e-testing.md`

## Overview
Priority P2. Split the 537-line `EditorPage.js` POM into focused helpers after tests protect behavior. This is a zero-behavior refactor.

## Key Insights
- `EditorPage.js` currently has 55 async methods.
- Repo rule targets files under 200 lines where practical.
- POM split before coverage is risky; after Phases 2-4 it is safer.
- Avoid inheritance. Use composition with helper instances.

## Requirements
- Functional: all existing imports of `EditorPage` keep working.
- Non-functional: helper files small, focused, no test behavior change.
- Compatibility: no spec rewrites beyond imports if needed.

## Architecture
Proposed helper ownership:
- `CanvasHelper.js`: selection, element count, canvas handles, drag/resize/rotate helpers.
- `InsertMenuHelper.js`: insert menu, element creation helpers.
- `PropertiesPanelHelper.js`: panel selection, property fills, save barriers.
- `SlidePanelHelper.js`: slide add/delete/select/multi-select helpers.
- `EditorPage.js`: orchestrates helpers and preserves existing public method names.

No cross-helper imports. Helpers receive `page` and any locator needed via constructor.

## Related Code Files
- Modify: `tests/e2e/pages/EditorPage.js`
- Create: `tests/e2e/pages/CanvasHelper.js`
- Create: `tests/e2e/pages/InsertMenuHelper.js`
- Create: `tests/e2e/pages/PropertiesPanelHelper.js`
- Create: `tests/e2e/pages/SlidePanelHelper.js`
- Modify: specs only if direct helper imports are intentionally added.
- Delete: none.

## Implementation Steps
1. Snapshot current method list:
   - `rg -n "^\\s*async\\s+" tests/e2e/pages/EditorPage.js`
2. Move insert methods first:
   - `clickInsertMenuItem`
   - `addTextNode`
   - `addShape`
   - `addCodeBlock`, `addLatexBlock`, `addMarkdownBlock`, `addChart`, `addCallout`, `addHtmlEmbed`, `addDrawing`, `addLine`, `addTable`
3. Move slide panel methods:
   - `addSlide`, `addSlideFromTemplate`, `deleteSlide`, `selectSlide`, multi-select slide helpers.
4. Move properties/panel methods:
   - `waitForElementPanelSelected`
   - `waitForElementPanelCleared`
   - `selectElement`, `deselectAll`
   - property-specific helpers added in Phase 3 if any.
5. Move canvas/lifecycle methods:
   - `getElementCount`, `waitForElementCount`
   - copy/paste/delete/duplicate/undo/redo wrappers.
6. Keep `EditorPage` public API stable by delegating:
   - `async addTextNode() { return this.insert.addTextNode() }`
7. Run targeted tests after each helper group extraction.
8. Only after all tests pass, optionally remove dead methods.

## Todo List
- [ ] Helper files created.
- [ ] `EditorPage.js` public API preserved.
- [ ] No cross-helper imports.
- [ ] Each helper has one concern.
- [ ] Tests pass after each extraction.

## Verification & Tests
- `npx playwright test tests/e2e/toolbar-elements.spec.js --reporter=list`
- `npx playwright test tests/e2e/properties-panel.spec.js tests/e2e/element-properties.spec.js --reporter=list`
- `npx playwright test tests/e2e/coverage-gaps.spec.js tests/e2e/element-lifecycle.spec.js --reporter=list`
- `npx playwright test tests/e2e/slide-management.spec.js tests/e2e/slides.spec.js --reporter=list`
- `npm run build`

## Success Criteria
- [ ] `EditorPage.js` materially smaller.
- [ ] No spec loses existing behavior.
- [ ] New helper files follow current POM style.
- [ ] No test import churn except optional additions.

## Risk Assessment
- Risk: helper extraction breaks `lastInsertedElementIndex`.
- Mitigation: keep shared state in `EditorPage` or pass explicit setter/getter to helpers.
- Risk: circular helper dependencies.
- Mitigation: helpers are leaf classes; `EditorPage` orchestrates.

## Security Considerations
- None.

## Next Steps
- Phase 6 can add visual/CI gates once the test structure is stable.


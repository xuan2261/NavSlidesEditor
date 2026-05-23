---
phase: 4
title: "Editor Elements Controls E2E Parity"
status: pending
priority: P0
effort: "4-5d"
dependencies: [3]
---

# Phase 4: Editor Elements Controls E2E Parity

## Context Links

- [Phase 3 fixtures](./phase-03-golden-fixtures-and-state-assertions.md)
- `docs/code-standards.md`
- `tests/e2e/elements/`

## Overview

Verify editor actions, elements, ribbon controls, keyboard shortcuts, and properties panel match upstream behavior.

## Requirements

**Functional:**
- Cover editor core: create, select, drag, resize, rotate, delete, lock, z-order, group, align/distribute.
- Cover clipboard and undo/redo.
- Cover representative MVP element families deeply: text, image/media, shape/line, code/markdown/math, table/chart.
- Cover remaining element types with insert/render/reload smoke unless matrix marks them MVP P0.
- Cover ribbon tab controls and Format contextual controls by behavior group, not every control multiplied by every element type.
- Assert state after every important action.

**Non-functional:**
- Prefer existing POM helpers.
- Avoid brittle CSS selectors; follow code standards selector priority.
- Keep new helper files below 200 LOC.
- Do not enable Playwright traces for credential/share/cloud flows unless artifact redaction is in place.

## Architecture

```text
Playwright action -> visible assertion -> normalized state assertion -> reload assertion
```

## Related Code Files

**Read:**
- `tests/e2e/pages/EditorPage.js`
- `tests/e2e/pages/canvas-helper.js`
- `tests/e2e/pages/ribbon-insert-helper.js`
- `tests/e2e/pages/properties-panel-helper.js`
- `tests/e2e/elements/*.spec.js`
- `tests/e2e/keyboard-shortcuts.spec.js`

**Modify/Create:**
- targeted specs only where matrix gaps exist
- helper additions in `tests/e2e/helpers/`

## Implementation Steps

1. Run current targeted suites:
   ```powershell
   npx playwright test tests/e2e/editor.spec.js tests/e2e/element-interactions.spec.js
   npx playwright test tests/e2e/elements
   npx playwright test tests/e2e/ribbon-layout.spec.js
   ```
2. Fill matrix gaps for P0 controls.
3. Add missing state assertions after UI assertions.
4. Use risk slicing:
   - deep E2E for MVP element/control families
   - smoke checks for extended element types
   - matrix backlog for optional combinations
5. Run with trace on failures only for non-sensitive flows or sanitized artifacts.
6. Record result in phase report.

## TDD / Tests

- Red: add failing parity test for one missing P0 matrix row.
- Green: implement selector/helper/test data needed for pass.
- Refactor: move repeated action/state checks into helper.

## Todo List

- [ ] Run existing editor/elements/ribbon suites.
- [ ] Add missing P0 element/control specs.
- [ ] Add state assertions to critical flows.
- [ ] Update matrix statuses.
- [ ] Write phase report.

## Success Criteria

- MVP P0 editor and element rows in matrix are `Pass` or covered by signed waiver.
- `Fail with ticket` is not release-ready for MVP P0.
- No `Unknown` remains for editor core.
- Targeted Playwright suites pass.

## Risk Assessment

| Risk | Impact | Mitigation |
|---|---|---|
| Canvas drag/resize flake | High | Use stable handles, tolerant polling, trace on failure |
| Control labels differ from upstream | Medium | Record intentional divergence in matrix |
| Combinatorial explosion across 20 elements and all controls | Critical | Deep-test representative families; smoke-test extended element types |
| Failure traces expose sensitive data | High | Sanitize or disable traces for credential/token flows |

## Security Considerations

- HTML/Markdown/SVG tests must respect trusted-author model from README.
- Trusted-author model does not waive security invariant rows from Phase 2.

## Red Team Adjustment

- Phase 4 is now risk-sliced. It no longer requires exhaustive deep E2E for every element/control combination.
- MVP P0 release semantics are strict: pass or signed waiver only.

## Next Steps

- Move to export/present/live/game parity.

## Unresolved Questions

- None.

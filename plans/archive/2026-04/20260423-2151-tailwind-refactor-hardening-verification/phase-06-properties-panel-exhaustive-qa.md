---
phase: 6
title: "Properties Panel Exhaustive QA"
status: completed
priority: P1
effort: "2 days"
dependencies: [1, 2, 4, 5]
---

# Phase 6: Properties Panel Exhaustive QA

## Overview

Exhaustively verify property controls for each editable element family. This is the highest-risk UI phase because Tailwind/refactor changes can silently break labels, inputs, controlled values, and model updates.

## Requirements

- Every property control must render, accept input, update the selected element, and survive undo/redo.
- Controls must be stable across no selection, single selection, unsupported element type, and deleted selected element.
- Property panel must remain scrollable and readable at desktop/tablet/mobile widths.
- Control state must reflect the actual model, not stale local UI state.
- Dynamic style values for authored elements must remain data-driven and valid.

## Architecture

Property flow:

Selected element -> `PropertiesPanel` router -> type-specific controls -> normalized property update -> presentation state -> canvas rerender -> undo history.

Shared controls should be reusable and deterministic. Element-specific panels must not duplicate normalization logic unless unavoidable.

## Related Code Files

- `client/src/components/PropertiesPanel.jsx`
- `client/src/components/properties/common-element-controls.jsx`
- `client/src/components/properties/image-properties.jsx`
- `client/src/components/properties/table-properties.jsx`
- `client/src/components/properties/chart-properties.jsx`
- `client/src/components/properties/code-properties.jsx`
- `client/src/components/properties/media-properties.jsx`
- `client/src/components/properties/misc-properties.jsx`
- Any shape/text/line property files touched by the refactor.
- `tests/e2e/properties-panel.spec.js`
- `tests/e2e/elements.spec.js`
- `tests/e2e/toolbar-elements.spec.js`
- `tests/e2e/undo-redo.spec.js`

## Implementation Steps

1. Build element-property matrix:
   - Text: content, font, size, weight, alignment, color, background, line height.
   - Shape: fill, stroke, opacity, radius, position, size, rotation.
   - Image: source, fit/crop, alt/title if present, opacity, border.
   - Table: rows/columns, cell text, header style, border, alignment.
   - Chart: type, data, labels, colors, legend, axes/options.
   - Code: language, theme, content, font size, wrapping.
   - Media: URL/file, playback options, dimensions, poster if present.
   - Misc: latex, html, markdown, iframe/embed, speaker notes, fragments/animation if present.
2. Validate shared controls:
   - Text input.
   - Number input.
   - Slider/stepper.
   - Toggle/checkbox.
   - Select/menu.
   - Color swatch/picker.
   - Segmented controls.
   - Icon buttons.
3. Check state transitions:
   - No selection.
   - Select supported element.
   - Select unsupported/missing element.
   - Delete selected element while panel open.
   - Switch between element types.
4. Verify updates:
   - Model changes immediately.
   - Canvas reflects changes.
   - Undo/redo restores control values and canvas.
   - Saved/reloaded presentation preserves values.
5. Fix UI issues:
   - Labels do not overlap controls.
   - Long values wrap/truncate correctly.
   - Scrollbars are usable.
   - Focus rings visible.
   - Disabled states clear.
6. Expand E2E tests where a property family has no coverage.

## Verification & Tests

- `npx playwright test tests/e2e/properties-panel.spec.js`
- `npx playwright test tests/e2e/elements.spec.js`
- `npx playwright test tests/e2e/toolbar-elements.spec.js`
- `npx playwright test tests/e2e/undo-redo.spec.js`
- Manual exhaustive matrix:
  - Text, shape, image, table, chart, code, media, latex/html/markdown/misc.
  - Every shared control type listed above.
  - Values at min, max, empty, invalid, and normal cases.
  - Undo/redo after each property family.
  - Save, reload, verify property persistence.
- Accessibility/UX checks:
  - Tab order through panel controls.
  - Focus visible on keyboard navigation.
  - Labels associated or clearly adjacent.
  - No color-only state for critical actions.
- Responsive checks:
  - 1440x900: full panel usable.
  - 1024x768: panel scroll works.
  - 390x844: primary controls visible without incoherent overlap.

## Success Criteria

- [ ] Every element family has explicit pass/fail evidence.
- [ ] Every shared control type is exercised.
- [ ] Property changes update model, canvas, undo/redo, and persistence.
- [ ] No property panel clipping/overlap blocks use at target viewports.

## Risk Assessment

- Risk: tests only cover one element type. Mitigation: maintain the element-property matrix in report.
- Risk: controlled inputs desync from model after undo. Mitigation: run undo/redo per property family.
- Risk: invalid values corrupt persisted presentation. Mitigation: min/max/empty/invalid cases for numeric and URL controls.

## Security Considerations

- HTML/code/media URL controls must keep existing sanitization and validation.
- No property input should allow script execution in dashboard/editor chrome.

## Todo List

- [ ] Element-property matrix complete.
- [ ] Shared control matrix complete.
- [ ] E2E property specs pass.
- [ ] Persistence checks complete.

## Next Steps

Proceed to Phase 7 when properties are stable and every selected element type has proof.

---
phase: 5
title: "Resolution-Aware Ribbon Alignment"
status: completed
priority: P1
dependencies: [1]
---

# Phase 05: Resolution-Aware Ribbon Alignment

## Overview

Make Format ribbon Align Center and Align Right respect custom presentation resolution instead of always using the default 960px canvas width.

## Requirements

- Functional: horizontal align buttons calculate `x` from the active slide/presentation width when available.
- Non-functional: keep existing behavior unchanged for presentations without custom resolution.

## Architecture

Use resolution data already available to `FormatTabContent` if the ribbon shell forwards `presentation` props. Add an optional `resolution` or `canvasWidth` prop only if needed, defaulting to `CANVAS_WIDTH` for tests and non-editor callers.

## Related Code Files

- Modify: `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.jsx`
- Modify: `client/src/components/ribbon/ribbon-format-tab-element-position-size-rotation-controls.test.jsx`
- Review / modify only if required: `client/src/pages/EditorPage.jsx`
- Review: ribbon shell component that calls `FormatTabContent`
- Review: `client/src/data/slide-constants.js`

## Implementation Steps

1. Confirm Phase 01 D4 custom-width tests fail with the old 960px result.
2. Record D4 red evidence in `reports/implementation-evidence.md`: command, failing assertion, old-bug reason, and setup-noise exclusion.
3. Inspect existing ribbon prop flow. Prefer reading `presentation?.resolution?.width` or an already-forwarded prop inside `FormatTabContent`.
4. Add a dedicated `resolution` or `canvasWidth` prop only if existing prop flow cannot supply presentation width cleanly.
5. Compute `slideWidth = Number(resolution?.width) || CANVAS_WIDTH`.
6. Use `slideWidth` in Align Center and Align Right.
7. Thread `presentation.resolution` from `EditorPage` only if tests prove it is not already reaching the component.
8. Tests:
   - default no-resolution center remains `330` for width `300`.
   - custom width `1280` center becomes `490` for width `300`.
   - custom width `1280` right becomes `980` for width `300`.
   - invalid width falls back to `CANVAS_WIDTH`.
   - multi-select mixed-value display still shows placeholders/mixed state for divergent fields after resolution prop changes.
9. Run ribbon targeted tests and any EditorPage smoke tests touched by prop wiring. Record green evidence in `reports/implementation-evidence.md`.

## Success Criteria

- [x] Align Center/Right use custom width when provided.
- [x] Default behavior remains unchanged.
- [x] Prop addition does not break no-selection or contextual control rendering.
- [x] Multi-select mixed values still display correctly.
- [x] D4 red/green evidence is recorded in `reports/implementation-evidence.md`.

## Risk Assessment

Risk: prop threading through ribbon shell is not direct. Mitigation: inspect current component ownership first, pass only the minimal width prop, and avoid broad ribbon state changes.

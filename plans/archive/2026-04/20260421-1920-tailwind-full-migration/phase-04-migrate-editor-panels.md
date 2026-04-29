---
phase: 4
title: 'Migrate Editor Panels'
status: completed
priority: P2
effort: '4h'
dependencies: [1, 2]
---

# Phase 4: Migrate Editor Panels

## Overview

Migrate the side panels of the Editor (SlidePanel and PropertiesPanel) and all of their subcomponents from legacy CSS (`slide-panel.css`, `properties-panel.css`) to Tailwind utility classes.

## Requirements

- Functional: Accordion behaviors, collapsible sections, and input grids must remain functional and visually stable.
- Non-functional: Consistent padding, tight spacing, and distinct borders in both themes.

## Architecture

- Replace `.properties-panel`, `.prop-section`, `.prop-row` with Tailwind flex columns/rows and padding utilities.
- Replace `.slide-panel`, `.slide-list`, `.slide-thumbnail` with Tailwind grid/flex classes.
- Ensure the `<Input>` and `<Select>` components built in Phase 1 are used within the `components/properties/*` files.

## Related Code Files

- Modify: `client/src/components/PropertiesPanel.jsx` and all files in `client/src/components/properties/`
- Modify: `client/src/components/SlidePanel.jsx`
- Modify: `client/src/components/SlideSorterView.jsx`
- Delete: `client/src/styles/properties-panel.css`
- Delete: `client/src/styles/slide-panel.css`

## Implementation Steps

1. Refactor `PropertiesPanel.jsx` and its sub-components (`chart-properties.jsx`, `shape-properties.jsx`, etc.) to Tailwind.
2. Refactor `SlidePanel.jsx` layout wrapper and thumbnail iterations to use Tailwind classes.
3. Remove `properties-panel.css` and `slide-panel.css`.

## Verification & Testing

- **Test:** Verify unit test for property change dispatch.
- **Browser Subagent:** Navigate to Editor, select different elements (Text, Shape, Image) on the Canvas to force the Properties Panel to swap sections. Verify rendering using screenshots via `browser_subagent`. Check the slide thumbnails for correct active-state border coloring.

## Success Criteria

- [x] `properties-panel.css` and `slide-panel.css` are deprecated.
- [x] Properties inputs align correctly and handle theme switches smoothly.

## Risk Assessment

- **Risk:** High density of small UI elements in the properties panel might look cluttered if spacing isn't perfectly mapped.
- **Mitigation:** Use strict scale mapping (e.g., replace `10px` gap with `gap-2.5` or `gap-2`).

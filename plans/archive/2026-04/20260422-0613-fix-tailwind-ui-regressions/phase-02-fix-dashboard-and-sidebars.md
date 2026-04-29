---
phase: 2
title: 'Fix Dashboard and Sidebars'
status: completed
effort: '2h'
---

# Phase 2: Fix Dashboard and Sidebars

## Overview

This phase addresses the layout breakage and styling omissions in the `HomePage.jsx` dashboard, as well as the Editor's `SlidePanel` and `PropertiesPanel`. We will fix the Search bar width, sidebar item spacing/styling, thumbnail rendering logic, and control alignments in the properties panel.

## Requirements

- Functional: Ensure all inputs, thumbnails, and sidebars render consistently without overlapping text. Slide/Template thumbnails must show fallback backgrounds if blank.
- Non-functional: Use Tailwind styling. Eliminate legacy CSS classes and inline style hacks that were used as quick-fixes.

## Architecture

- Refactor the dashboard Header and Sidebar layout to use standardized flexbox constraints.
- Refactor properties panels to use robust flexbox/grid for label-input pairing.

## Related Code Files

- Modify: `client/src/pages/HomePage.jsx`
- Modify: `client/src/components/SlidePanel.jsx`
- Modify: `client/src/components/PropertiesPanel.jsx`

## Implementation Steps

1. **HomePage.jsx (Dashboard)**:
   - **Search Bar**: Adjust the flex basis or maximum width (`w-full max-w-md`) so it doesn't take over the entire header.
   - **Sidebar**: Ensure the `active` state of the sidebar items applies a clear background (e.g., `bg-primary/10 text-primary`) and border radius. Fix the icon-to-text spacing (`gap-3`).
   - **Thumbnails**: The `bgProp` object logic needs to be mapped to inline styles effectively, or the thumbnail renderer needs to ensure it applies standard background styles properly.
   - **New Presentation Card**: Convert inline styles and the thick dashed border to `border-dashed border-2 border-border text-text-muted hover:border-accent hover:text-accent`.
2. **SlidePanel.jsx (Left Sidebar)**:
   - **Thumbnails**: Fix the thumbnail background logic for slides so they do not render as completely black/blank.
   - **Buttons**: Refactor "Add Slide" and "Insert Template" buttons to use standard `Button` variants with proper padding and layout.
3. **PropertiesPanel.jsx (Right Sidebar)**:
   - **Checkbox Alignment**: For elements like `Auto-slide` or `Loop`, ensure the label and checkbox flexbox uses `items-center` and standard gaps so the text does not overlap the checkbox.
   - **Inputs**: Ensure inputs like `Slide Footer` have adequate width to prevent placeholder clipping.

## Success Criteria

- [x] Dashboard search bar is appropriately sized.
- [x] Dashboard and Sidebar active items highlight correctly.
- [x] Thumbnails render background colors/gradients instead of black squares.
- [x] Properties panel checkboxes align nicely with labels.

## Risk Assessment

- **Risk**: Modifying properties panel inputs might break the sync state if `onChange` events are accidentally removed.
- **Mitigation**: Be highly precise during the replacement of classNames. Do not alter the component's core logic or event handlers.

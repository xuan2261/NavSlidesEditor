---
phase: 1
title: 'Fix Dropdowns and Toolbars'
status: pending
effort: '2h'
---

# Phase 1: Fix Dropdowns and Toolbars

## Overview

This phase addresses the severe layout breakage in the editor header, particularly the `DropdownMenu` and `InsertMenu` components which lost their styling when legacy CSS was deleted. We will also fix the `Toolbar` legacy classes to ensure proper spacing, alignment, and appearance.

## Requirements

- Functional: Dropdown menus must display items vertically, not horizontally. Popups must float above the canvas. Inputs must fit properly in the toolbar.
- Non-functional: Utilize pure Tailwind utility classes. Maintain Light/Dark theme consistency.

## Architecture

- Replace hardcoded legacy classes (`dropdown-menu-wrapper`, `dropdown-panel`, `bg-popup-container`, `prop-input`) with semantic Tailwind utility classes.

## Related Code Files

- Modify: `client/src/components/DropdownMenu.jsx`
- Modify: `client/src/components/InsertMenu.jsx`
- Modify: `client/src/components/Toolbar.jsx`
- Modify: `client/src/components/EditorMenuBar.jsx`

## Implementation Steps

1. **DropdownMenu.jsx**:
   - Convert `dropdown-menu-wrapper` to `relative inline-block text-left`.
   - Update `menu-trigger` with proper flex, padding, and text sizing.
   - Convert `dropdown-panel` to an absolute container with shadow, rounded borders, z-index 50, and flex-col layout.
   - Update `dropdown-item` to standard padding, gap, flex, hover states.
   - Fix `dropdown-separator` to a 1px border colored line.
2. **InsertMenu.jsx**:
   - Replicate the layout structure fixes from `DropdownMenu.jsx`.
3. **Toolbar.jsx**:
   - Replace `bg-popup-container` with Tailwind equivalent (absolute positioning, z-index 1000, shadow, border, bg-bg-card).
   - Replace `bg-type-tabs` and `bg-type-tab` with flex row layout and active state tailwind classes.
   - Replace `prop-input` with standard Tailwind input styling.
4. **EditorMenuBar.jsx**:
   - Validate and ensure that any remaining legacy classes are replaced.

## Success Criteria

- [ ] Dropdowns render as vertical lists and don't overlap horizontally.
- [ ] Z-index is correctly configured so menus overlay the editor canvas.
- [ ] Toolbar inputs and popups render correctly without visual corruption.

## Risk Assessment

- **Risk**: Z-index conflicts between overlapping components in the Editor.
- **Mitigation**: Standardize z-index usage across dropdowns (`z-50`) and toolbars (`z-40`).

---
phase: 2
title: 'Restore Editor Icons'
status: complete
priority: P1
effort: '4h'
dependencies: []
---

# Phase 02: Restore Editor Icons

## Overview

This phase targets the massive icon loss across the Editor UI after the Tailwind migration. Critical tools (Draw Line, Arrow, Grid, Undo/Redo) are currently rendering as empty squares or emojis, and dropdown menus lack shadows/borders, making the UI feel broken and unprofessional.

## Requirements

- Functional: All toolbar, sidebar, and menu icons must be visible, properly sized, and respond to hover states.
- Non-functional: The icon system must be unified (using `lucide-react` or `FontAwesome` as configured) to ensure a consistent aesthetic.

## Architecture

- Replace broken or missing icons with valid React components from the designated icon library (`lucide-react`).
- Update Dropdown Menu styles to include Tailwind shadow (`shadow-lg`) and border (`border-border`) utilities to ensure they float above the canvas.

## Related Code Files

- Modify: `client/src/components/EditorMenuBar.jsx`
- Modify: `client/src/components/EditorToolbar.jsx`
- Modify: `client/src/components/SlideList.jsx`
- Modify: `client/src/components/DropdownMenu.jsx`
- Modify: `client/src/components/AddSlideModal.jsx`

## Implementation Steps

1. Audit `EditorToolbar.jsx` and replace missing tool icons (Draw Line, Arrow, Grid, Rulers) with appropriate `lucide-react` components.
2. In `EditorMenuBar.jsx`, fix the "Back" button icon and adjust the size of Undo/Redo icons to `size={18}`.
3. In `SlideList.jsx`, ensure the Duplicate and Delete button icons are present and adequately sized with proper padding.
4. Update `DropdownMenu.jsx` wrapper classes to include `shadow-lg border border-border bg-panel`.
5. Replace emojis in `AddSlideModal.jsx` with professional SVGs/icons.

## Success Criteria

- [x] All empty squares in the Toolbar are replaced with valid icons.
- [x] Dropdown menus have a distinct background, border, and drop-shadow.
- [x] Slide List action buttons (Duplicate/Delete) render correctly.
- [x] No raw emojis are used for UI controls.

## Risk Assessment

- Risk: Icon sizing might affect flexbox alignment in the toolbars.
- Mitigation: Use consistent sizing props (e.g., `size={16}` or `size={18}`) and verify vertical alignment (`items-center`) in the parent containers.

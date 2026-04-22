---
phase: 3
title: 'Migrate Editor Toolbars'
status: complete
priority: P2
effort: '3h'
dependencies: [1, 2]
---

# Phase 3: Migrate Editor Toolbars

## Overview

Refactor the upper toolbars in the Editor workspace (`Toolbar.jsx`, `MiniToolbar.jsx`, `QuickAccessToolbar.jsx`, `EditorMenuBar.jsx`) to Tailwind, allowing the deprecation of `canvas-toolbar.css`.

## Requirements

- Functional: Ensure dropdown menus, tooltips, and active states (`.active`) within the toolbar function perfectly.
- Non-functional: High precision padding/margins to maintain the compact Pro Max look.

## Architecture

- Map `.canvas-toolbar`, `.toolbar-section`, `.tool-btn`, `.toolbar-divider` to Tailwind layout classes.
- Use `gap`, `flex`, `items-center` for standardizing spacing.
- The `Button` component from Phase 1 should be utilized here for tool buttons (`variant="icon"`).

## Related Code Files

- Modify: `client/src/components/Toolbar.jsx`
- Modify: `client/src/components/MiniToolbar.jsx`
- Modify: `client/src/components/QuickAccessToolbar.jsx`
- Modify: `client/src/components/EditorMenuBar.jsx`
- Delete: `client/src/styles/canvas-toolbar.css`

## Implementation Steps

1. Replace `.canvas-toolbar` with `flex h-14 w-full items-center justify-between bg-bg-panel border-b border-border px-4`.
2. Migrate all `.tool-btn` items to the `<Button variant="icon">` component.
3. Migrate dividers (`.toolbar-divider`) to `w-[1px] h-6 bg-border mx-2`.
4. Remove `canvas-toolbar.css`.

## Verification & Testing

- **Test:** Verify unit test for Toolbar action dispatching still functions correctly.
- **Browser Subagent:** Navigate to Editor, hover over toolbar buttons, and capture visual proof of the tooltips and active states working without shifting the layout.

## Success Criteria

- [ ] `canvas-toolbar.css` is deprecated.
- [ ] Toolbars perfectly adapt to light/dark themes.

## Risk Assessment

- **Risk:** Button active states may not highlight correctly if the Tailwind overrides are improper.
- **Mitigation:** Use `clsx` to dynamically append `bg-accent text-white` when `isActive` is true.

---
phase: 3
title: 'Fix Canvas and Presentation Controls'
status: completed
effort: '1h'
---

# Phase 3: Fix Canvas and Presentation Controls

## Overview

This phase targets the visual regressions on the Canvas `StatusBar` (zoom controls) and the `PresentationPage` / `LiveViewPage` UI controls.

## Requirements

- Functional: Ensure Zoom controls (+, -, Fit) and Presentation controls (Fullscreen, FontSize, Exit) have adequate hit areas and clear iconography.
- Non-functional: Use standard Tailwind design tokens for hover states, active states, and padding.

## Architecture

- Replace the tiny, primitive zoom control buttons in `SlideCanvas.jsx` (previously in `StatusBar.jsx`) with standard icon `Button` components using the Tailwind design system.
- Refactor floating controls in `SpeakerViewPage.jsx` and `RemoteControlPage.jsx` (equivalent to Presentation controls) to ensure proper layout spacing and size.

## Related Code Files

- Modify: `client/src/components/SlideCanvas.jsx` (Zoom controls)
- Modify: `client/src/pages/SpeakerViewPage.jsx` (Presentation controls)
- Modify: `client/src/pages/RemoteControlPage.jsx` (Presentation controls)

## Implementation Steps

1. **SlideCanvas.jsx**:
   - Refactor the right-side Zoom controls. Use the standardized `Button variant="icon"` component instead of raw `<button>` tags with inline styles.
   - Set fixed width/height (`w-7 h-7`) for the -, +, and Fit buttons to ensure they aren't cramped.
2. **SpeakerViewPage.jsx / RemoteControlPage.jsx**:
   - Locate the top navigation and presentation controls.
   - Replace inline styles with standard Tailwind utility classes (`flex`, `items-center`, `gap-1`, `text-slate-400`, `hover:text-white`).

## Success Criteria

- [x] Zoom controls are easily clickable, aligned, and have hover styles.
- [x] Presentation controls are legible and not cramped.

## Risk Assessment

- **Risk**: Presentation controls overlapping content if they are made too large.
- **Mitigation**: Use a semi-transparent floating container with standard backdrop-blur.

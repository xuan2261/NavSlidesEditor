---
phase: 5
title: 'Migrate Canvas and Timelines'
status: completed
priority: P3
effort: '2h'
dependencies: [2, 4]
---

# Phase 5: Migrate Canvas and Timelines

## Overview

Perform a deep clean of the `SlideCanvas.jsx` to remove any lingering inline styles or legacy wrapper classes not caught in the initial progressive phase. Also migrate bottom/floating panels like `AnimationTimeline.jsx`, `FindReplaceBar.jsx`, and `SelectionPane.jsx`.

- **Current Status**: Completed

## Requirements

- Functional: The Canvas area must scale and center exactly as before. The animation timeline must overlay correctly.
- Non-functional: Zero impact on the exact coordinates or rendering of slide elements.

## Architecture

- Move remaining inline layout wrappers in `SlideCanvas.jsx` to Tailwind.
- Migrate `.timeline-container`, `.timeline-track` in `AnimationTimeline.jsx`.

## Related Code Files

- Modify: `client/src/components/SlideCanvas.jsx`
- Modify: `client/src/components/AnimationTimeline.jsx`
- Modify: `client/src/components/FindReplaceBar.jsx`
- Modify: `client/src/components/SelectionPane.jsx`

## Implementation Steps

- [x] Scan `SlideCanvas.jsx` for any remaining CSS classes outside of Tailwind norms.
- [x] Convert layout wrappers in `AnimationTimeline.jsx` to use Tailwind flex/grid and exact positioning (`absolute bottom-0 w-full` etc.).
- [x] Convert `FindReplaceBar.jsx` to Tailwind.
- [x] Convert `SelectionPane.jsx` to Tailwind.

## Verification & Testing

- **Test:** Run e2e tests for slide rendering.
- **Browser Subagent:** Open the editor, invoke the Find/Replace bar (`Ctrl+F`), and toggle the Animation Timeline. Take screenshots to ensure z-indices and positioning are flawless.

## Success Criteria

- [x] Timeline and floating bars render correctly over the workspace.
- [x] No inline style regressions on the canvas scaling logic.

## Risk Assessment

- **Risk:** Breaking the dynamic transform/scale matrix of the SlideCanvas.
- **Mitigation:** DO NOT touch dynamic inline `style={{ transform: ... }}` properties. Only touch static layout classes.

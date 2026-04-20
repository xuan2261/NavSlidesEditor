---
phase: 1
title: "Research"
status: completed
priority: P2
effort: "30m"
dependencies: []
---

# Phase 1: Research

## Overview
Analyze the current rendering logic for Presenter Tools and Fullscreen button in `htmlGenerator.js` and `presenterTools.js`. Confirm the CSS classes used by external Reveal.js plugins (RevealMenu, CustomControls/Chalkboard) to ensure accurate styling. This phase is complete due to prior brainstorming.

## Requirements
- Functional: Identify target DOM elements for Fullscreen, Slide Menu, Custom Controls, and Toolbar.
- Non-functional: Determine minimal CSS footprint to implement the translucent state.

## Architecture
- `shared/src/htmlGenerator.js`: Injects `#fs-btn`.
- `shared/src/presenterTools.js`: Manages `.presenter-toolbar` and configures external plugins (`.slide-menu-button`, `.customcontrols`).

## Related Code Files
- Read: `shared/src/htmlGenerator.js`
- Read: `shared/src/presenterTools.js`

## Implementation Steps
1. Scan `htmlGenerator.js` for `#fs-btn` injection.
2. Scan `presenterTools.js` for toolbar generation and CSS.
3. Formulate the CSS payload to reduce opacity to 0.15 and set a hover transition to 1.

## Success Criteria
- [x] Identified CSS target classes (`.presenter-toolbar`, `.slide-menu-button`, `.customcontrols`).
- [x] Confirmed `#fs-btn` can be grouped into `.presenter-toolbar`.

## Risk Assessment
- None.

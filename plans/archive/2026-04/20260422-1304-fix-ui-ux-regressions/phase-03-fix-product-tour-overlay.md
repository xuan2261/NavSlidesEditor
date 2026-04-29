---
phase: 3
title: 'Fix Product Tour Overlay'
status: complete
priority: P2
effort: '2h'
dependencies: []
---

# Phase 03: Fix Product Tour Overlay

## Overview

The Joyride Product Tour currently displays with a Light mode tooltip background while the application is in Dark mode, causing severe contrast issues and unreadable text. Additionally, the overlay dimmer is either missing or incorrectly positioned due to z-index conflicts.

## Requirements

- Functional: The Product Tour must clearly highlight the active UI element while dimming the rest of the screen.
- Non-functional: Tooltips must inherit the application's current theme (Dark/Light) to maintain visual harmony.

## Architecture

- Override `react-joyride` default styles to use CSS variables defined in Tailwind (`var(--bg-panel)`, `var(--text-primary)`, `var(--accent)`).
- Ensure the overlay has a sufficiently high `z-index` to cover all headers, sidebars, and panels.

## Related Code Files

- Modify: `client/src/components/ProductTour.jsx`
- Modify: `client/src/index.css` (if global overrides are required for Joyride classes)

## Implementation Steps

1. Open `ProductTour.jsx` and locate the `Joyride` component configuration.
2. Update the `styles` prop to inject theme variables:
   - `backgroundColor: 'var(--bg-panel)'`
   - `textColor: 'var(--text-primary)'`
   - `primaryColor: 'var(--accent)'`
3. Ensure the `overlayColor` is set to a semi-transparent dark value (e.g., `rgba(0,0,0,0.6)`).
4. Check z-index settings for `.react-joyride__overlay` and `.react-joyride__tooltip` to ensure they sit above the Navbar (usually `z-50`).

## Success Criteria

- [x] Tour tooltip background matches the application's panel background color.
- [x] Tooltip text is legible in both Dark and Light modes.
- [x] The screen behind the targeted element is properly dimmed.

## Risk Assessment

- Risk: Overriding third-party library styles can be brittle if the library updates.
- Mitigation: Use the official `styles` prop API provided by `react-joyride` rather than relying heavily on forced CSS `!important` tags where possible.

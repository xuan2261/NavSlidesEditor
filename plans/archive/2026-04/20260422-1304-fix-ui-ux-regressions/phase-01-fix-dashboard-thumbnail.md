---
phase: 1
title: 'Fix Dashboard Thumbnail'
status: complete
priority: P1
effort: '2h'
dependencies: []
---

# Phase 01: Fix Dashboard Thumbnail

## Overview

This phase addresses the severe visual bug on the Dashboard where the `SlideThumbnail` footer is obscured by a large white block. This is caused by a hardcoded `bg-white` class failing in Dark Mode, alongside iframe aspect-ratio sizing issues that cause the content to overflow and clip the card's details.

## Requirements

- Functional: Thumbnails must render the presentation preview accurately without overflowing their container boundaries.
- Non-functional: Must support both Light and Dark themes seamlessly without hardcoded background colors that break contrast.

## Architecture

- Replace hardcoded background colors with theme-aware CSS variables (e.g., `bg-card` or `bg-workspace`).
- Ensure the `ResizeObserver` logic in `SlideThumbnail` correctly calculates the scale factor to fit within a standard `aspect-video` ratio.

## Related Code Files

- Modify: `client/src/components/SlideThumbnail.jsx`
- Modify: `client/src/components/Dashboard.jsx` (if card container constraints are needed)

## Implementation Steps

1. Open `SlideThumbnail.jsx` and locate the `div` wrapper.
2. Replace `bg-white` with `bg-card` or `bg-workspace`.
3. Verify that the iframe's inline styles (`width: 1920px`, `height: 1080px`) scale properly to fit the parent container's dimensions using CSS `aspect-ratio: 16/9` and `overflow-hidden`.
4. Test the dashboard rendering on both Dark Mode and Light Mode to ensure no white blocks obscure the card metadata.

## Success Criteria

- [x] No white block covers the bottom half of presentation cards on the Dashboard.
- [x] Thumbnails are visible and correctly scaled.
- [x] Background colors respect the current theme (Light/Dark).

## Risk Assessment

- Risk: Changing `SlideThumbnail` might affect other components using it (e.g., Slide List in Editor).
- Mitigation: Verify `SlideThumbnail` rendering in the Editor's left sidebar after applying the fix to ensure cross-component compatibility.

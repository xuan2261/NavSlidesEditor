---
phase: 5
title: "Rebuild Speaker View"
status: completed
priority: P1
effort: "3h"
dependencies: [3]
---

# Phase 5: Rebuild Speaker View

## Overview

Replace placeholder speaker view with a working live-presenting controller surface.

## Requirements

- Functional: speaker page shows current preview, next preview, notes, timer, clock, viewer count, thumbnails.
- Non-functional: share read-only Reveal iframe bootstrap with live viewer where practical.

## Related Code Files

- Modify: `client/src/pages/SpeakerViewPage.jsx`, `client/src/pages/LiveViewPage.jsx`, `client/src/components/LivePresentationModal.jsx`
- Create: `client/src/hooks/use-reveal-preview-frame.js`

## Implementation Steps

1. Add reusable read-only Reveal iframe hook.
2. Use hook in live viewer and speaker current/next preview frames.
3. Speaker joins as `controller` and navigates via `control-navigate`.
4. Render notes and thumbnails from `presentation-meta`.
5. Add speaker URL to live modal.

## Success Criteria

- [x] Speaker page shows real notes.
- [x] Current and next previews update on navigation.
- [x] Thumbnail navigation syncs viewer.
- [x] No placeholder-only preview remains.

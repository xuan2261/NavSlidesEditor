---
title: "Phase 01 - Preview Modal And Step Logic"
status: completed
priority: P1
---

# Phase 01 - Preview Modal And Step Logic

## Context Links

- [AnimationTimeline](../../client/src/components/AnimationTimeline.jsx)
- [EditorPage](../../client/src/pages/EditorPage.jsx)
- [use-reveal-preview-frame](../../client/src/hooks/use-reveal-preview-frame.js)

## Overview

Replace the Timeline `Preview` button wiring from `presentInWindow()` to an editor modal that previews only the active slide and steps fragment states in place.

## Requirements

- Preview opens in modal/iframe inside editor
- Preview HTML contains only current slide, not full deck
- Fragment stepping supports initial state plus each actual fragment step
- No new navigation to `/present` or any full-deck tab/window

## Related Code Files

- Modify: `client/src/pages/EditorPage.jsx`
- Modify: `client/src/components/AnimationTimeline.jsx`
- Create: `client/src/components/AnimationPreviewModal.jsx`
- Create: `client/src/components/animation-preview-helpers.js`
- Create: `client/src/components/AnimationPreviewModal.test.jsx`
- Create: `client/src/components/animation-preview-helpers.test.js`

## Implementation Steps

1. Add helper functions for preview slide extraction and fragment-step mapping.
2. Write tests for unique step mapping and single-slide HTML generation.
3. Build modal UI with iframe preview and play/prev/next/replay controls.
4. Wire `EditorPage` Timeline Preview to open the modal instead of `presentInWindow`.
5. Verify lint, build, and targeted tests.

## Success Criteria

- `Preview` opens an in-app modal
- Preview state starts at initial slide state
- Next/play advances fragments step by step
- Second slide or deck content never appears inside preview HTML

## Risks

- Reveal fragment indices can be sparse; preview must map unique indices, not naive `0..max`
- Iframe/deck polling cleanup must not leak timers

## Unresolved Questions

- None.

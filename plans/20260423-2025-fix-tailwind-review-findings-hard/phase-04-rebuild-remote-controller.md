---
phase: 4
title: "Rebuild Remote Controller"
status: completed
priority: P1
effort: "2h"
dependencies: [3]
---

# Phase 4: Rebuild Remote Controller

## Overview

Make `RemoteControlPage` a real mobile controller surface.

## Requirements

- Functional: join as `controller`; show current slide, total slides, notes, viewer count; Prev/Next send `control-navigate`.
- Non-functional: UI resyncs from presenter state; no presenter role or direct `navigate` event.

## Related Code Files

- Modify: `client/src/pages/RemoteControlPage.jsx`, `client/src/components/LivePresentationModal.jsx`, `tests/e2e/live.spec.js`

## Implementation Steps

1. Consume `presentation-meta`, `sync-state`, and `viewer-count`.
2. Replace optimistic presenter navigation with controller commands.
3. Keep laser toggle via controller permission.
4. Show remote link in modal as controller URL.

## Success Criteria

- [x] Remote page does not claim presenter role.
- [x] Remote navigation moves presenter/viewer.
- [x] Remote opening does not increase viewer count.
- [x] Mobile viewport smoke passes.

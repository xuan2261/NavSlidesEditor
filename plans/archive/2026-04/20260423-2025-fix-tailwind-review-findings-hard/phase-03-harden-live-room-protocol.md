---
phase: 3
title: "Harden Live Room Protocol"
status: completed
priority: P1
effort: "3h"
dependencies: [1]
---

# Phase 3: Harden Live Room Protocol

## Overview

Fix live-room ownership and sync protocol before remote/speaker UI depends on it.

## Requirements

- Functional: presenter, controllers, viewers are distinct; controllers never inflate viewer count or replace presenter.
- Functional: state is `{ slideIndex, verticalIndex, fragmentIndex }`.
- Non-functional: preserve existing `presentation-data`, `navigate`, and `sync-state` compatibility.

## Related Code Files

- Modify: `server/services/live-rooms.js`, `server/services/socket-handler.js`, `shared/src/htmlGenerator.js`, `client/src/hooks/use-live-presentation.js`
- Tests: `server/services/live-rooms.test.js`

## Implementation Steps

1. Extend room state with `controllers`, `viewers`, `presentationId`, and vertical state.
2. Add `presentation-meta` and `control-navigate`.
3. Keep presenter as source of viewer navigation broadcasts.
4. Emit correct `verticalIndex` from generated presenter HTML.
5. Allow controller laser without presenter takeover.

## Success Criteria

- [x] Controller join preserves presenter.
- [x] Viewer count excludes controllers.
- [x] Vertical slide state syncs correctly.
- [x] Controller navigation reaches presenter and viewers sync from presenter.

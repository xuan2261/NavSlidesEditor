---
phase: 6
title: "Live Presentation Realtime"
status: complete
priority: P2
effort: "1d"
dependencies: []
---

# Phase 6: Live Presentation Realtime

## Overview
Live core trust boundary is sound; fix the two important realtime gaps:
per-slide annotation sync on navigate, and the live-room memory leak when a
presenter closes their tab.

## Findings Covered
- **I-R4.1** — annotations not cleared/re-synced on slide change (old-slide strokes bleed; other-slide strokes never show).
- **I-R4.2** — live rooms leak: presenter tab-close only nulls `presenterId`; room never removed (live has no TTL, game does).
- **M-R4 (timer)** — running timer not re-armed with `timer:ended` after presenter reconnect.
- **M-R4 (socket-per-element)** — each game element opens its own socket; `LiveSocketContext` sits unused (cross-ref Phase 1; share the context here).

## Requirements
- Functional: switching slides shows that slide's annotations only; rejoin
  restores per-slide annotations (README promise); presenter disconnect releases
  the room within a bounded window.
- Non-functional: no unbounded room growth; one shared live socket.

## Architecture

### I-R4.1 — per-slide annotation sync
- `client/src/pages/LiveViewPage.jsx:18` holds a flat `annotationStrokes`;
  `navigate` (`:89`) doesn't clear; `annotations:sync` only fires on join
  (`server/services/socket-handler.js:159`).
- Fix: key strokes by slide index; on `navigate`, swap to the target slide's
  strokes; server emits `annotations:sync` (scoped to slide) on slide change too,
  not only join. Preserve the existing dedup logic (it has a test).

### I-R4.2 — room cleanup
- `server/services/live-rooms.js:97` `leaveRoom` only sets `presenterId=null`.
- Fix: mirror game TTL — when presenter leaves and no viewers remain (or after a
  grace window), schedule room removal; cancel on presenter reconnect.
- Open Q2 (user): persist annotations across server restart? If yes, cleanup must
  flush to storage before removal; if no, in-memory removal is fine.
  <!-- Updated: Validation Session 1 — RESOLVED: in-memory only, no storage flush; cleanup does plain in-memory removal. -->

### Mediums
- Timer: on presenter reconnect, recompute remaining and re-arm `timer:ended`.
- Socket-per-element: route game element sockets through `LiveSocketContext`
  (coordinate with Phase 1 namespace decision).

## Related Code Files
- Modify: `client/src/pages/LiveViewPage.jsx`, `server/services/socket-handler.js`, `server/services/live-rooms.js`
- Modify: `client/src/contexts/live-socket-context-provider.jsx`, `client/src/contexts/timer-context-state-provider.jsx`
- Reference (read): `server/services/socket-handler.test.js`, `client/src/hooks/use-annotation-sync.js`, `use-live-timer-sync.js`
- Create: `server/services/live-room-cleanup.test.js`, annotation per-slide sync test (extend existing annotation test file)

## TDD — Tests First
1. **I-R4.1**: draw on slide 1, navigate to slide 2 → slide 2 shows no slide-1
   strokes; navigate back → slide-1 strokes restored (red today).
2. **I-R4.2**: presenter joins then disconnects, no viewers → room removed after
   grace window (red today — leaks).
3. **timer**: presenter reconnects mid-countdown → `timer:ended` still fires at correct time.

## Implementation Steps
1. Write failing tests 1–3.
2. Per-slide annotation keying + slide-scoped sync emit → test 1.
3. Room TTL/grace cleanup mirroring game → test 2.
4. Timer re-arm on reconnect → test 3.
5. Share live socket context for game elements (with Phase 1).

## Success Criteria
- [x] Tests 1–3 green.
- [x] Annotations are per-slide on navigate and rejoin.
- [x] Orphaned live rooms removed; 50-presenter soak shows bounded room count.

## Risk Assessment
- **Risk:** cleanup races a reconnecting presenter → kills a live session.
  *Mitigation:* grace window + cancel-on-rejoin (same pattern as Phase 1 game TTL).
- **Risk:** slide-scoped sync increases socket chatter. *Mitigation:* emit only
  on actual slide change; payload is per-slide subset, smaller than full flat set.

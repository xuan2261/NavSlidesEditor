---
phase: 4
title: "Live Poll Game Subtype"
status: completed
priority: P1
effort: "3-4d"
dependencies: [1]
---

# Phase 04: Live Poll Game Subtype

## Overview

Add `poll` as a new subtype under existing canonical `game`, reusing the game socket/player flow.

## Requirements

- Functional: Presenter authors poll, players vote, presenter sees live aggregate.
- Non-functional: No raw private responses in static export; no changes to existing seven games.

## Architecture

Extend game constants/defaults/properties with `poll`. Add subtype-specific server events and reducer:

- client event: `game-poll-submit` with `{ gameId, optionId }`
- server validates socket-local `currentGameId` exists and payload `gameId` equals it
- server validates socket/player belongs to the joined room and stale/reused `playerId` is rejected
- host-only actions reject non-host and cross-room attempts
- one vote per player, last-write-wins update
- presenter receives aggregate counts only

Export uses game live-only fallback and excludes raw votes.

Game state migration contract:
- Keep existing seven game types behavior covered by regression tests before changing room lifecycle.
- Store poll votes in subtype-specific room state, not `player.answers[]`.
- Store only aggregate/count state for presenter broadcasts.
- Define disconnect vs explicit leave: disconnect uses a short reconnect grace window; explicit leave removes player.
- Never serialize raw votes to static HTML/PPTX exports.
- If reconnect support requires lifecycle changes, tests must prove existing name-picker, hot-potato, jeopardy, four-corners, relay-race, trivia-champ, and scattergories behavior remains unchanged.

## Related Code Files

- Modify: `client/src/constants/game-element-types-constants.js`
- Modify: `client/src/components/properties/game-properties.jsx`
- Modify: `client/src/components/canvas/element-renderers/game-element-renderer.jsx`
- Modify: `client/src/hooks/use-game-socket.js`
- Modify: `client/src/pages/game-player-join-page.jsx`
- Modify: `server/services/game-socket-handler.js`
- Modify: `server/services/game-room-manager-singleton-service.js`
- Test: game defaults, properties, socket, export, e2e smoke

## Implementation Steps

1. Write failing defaults/properties tests for `poll`.
2. Write failing server tests for vote submit, last-write-wins duplicate handling, socket-local `gameId` binding, stale socket/player rejection, host-only controls, reconnect behavior, and aggregate broadcast.
3. Write failing regression tests for existing game subtype lifecycle before altering disconnect/leave behavior.
4. Implement subtype UI and reducer.
5. Add export tests proving only prompt/options/static placeholder export.
6. Add one e2e presenter/player poll flow.

## Success Criteria

- [x] Author can configure prompt and 2-6 options.
- [x] Player can vote once and update vote; aggregate adjusts.
- [x] Presenter sees live aggregate.
- [x] Host can start/end/reveal poll; non-host cannot.
- [x] Reconnect preserves one logical voter identity without duplicate votes.
- [x] Static exports do not leak raw participant data or per-player votes.

## Risk Assessment

Risk: current game scoring assumes quiz answers. Mitigation: subtype-specific reducers and tests before UI.

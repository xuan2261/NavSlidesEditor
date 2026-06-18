---
phase: 5
title: "Word Cloud Game Subtype"
status: completed
priority: P2
effort: "2-3d"
dependencies: [4]
---

# Phase 05: Word Cloud Game Subtype

## Overview

Add `word-cloud` as a game subtype for classroom free-text aggregation.

## Requirements

- Functional: Players submit words/phrases; presenter sees frequency-weighted cloud.
- Non-functional: Cap length/count, aggregate by default, do not export raw participant text.

## Architecture

Reuse live poll room primitives but add text normalization and rate limits. Store aggregate counts separately from `player.answers[]`; raw text is not serialized to exports.

Bounds:
- max phrase length: 40 characters
- max submissions per player per prompt: 5
- aggregate display cap: top 50 phrases
- event: `game-word-cloud-submit` with `{ gameId, text }`
- server validates socket-local `currentGameId` exists and payload `gameId` equals it
- server validates socket/player belongs to the joined room
- raw text is reduced into aggregate room state and omitted from static exports

## Related Code Files

- Modify: `client/src/constants/game-element-types-constants.js`
- Modify: `client/src/components/properties/game-properties.jsx`
- Modify: `client/src/components/canvas/element-renderers/game-element-renderer.jsx`
- Modify: `server/services/game-socket-handler.js`
- Modify: `server/services/game-room-manager-singleton-service.js`
- Test: normalization, rate limit, aggregate renderer, export fallback

## Implementation Steps

1. Write failing normalization/rate-limit/session-binding tests.
2. Add authoring defaults and properties.
3. Implement server aggregate-only reducer.
4. Implement presenter/player renderers.
5. Add export no-leak tests and matrix evidence.

## Success Criteria

- [x] Players submit text bounded to 40 characters and 5 submissions/player/prompt.
- [x] Presenter sees aggregate cloud.
- [x] Duplicate/rate-limit behavior is deterministic.
- [x] Export excludes raw submissions by default.

## Risk Assessment

Risk: abusive free text. Mitigation: length caps, rate limits, presenter clear action; advanced moderation deferred.

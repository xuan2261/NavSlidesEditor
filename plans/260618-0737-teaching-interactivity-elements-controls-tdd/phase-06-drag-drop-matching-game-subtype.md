---
phase: 6
title: "Drag Drop Matching Game Subtype"
status: completed
priority: P2
effort: "3-4d"
dependencies: [5]
---

# Phase 06: Drag Drop Matching Game Subtype

## Overview

Add `matching` as a game subtype for pair matching and labeling exercises.

## Requirements

- Functional: Author defines prompts/targets/answers; players submit pair mapping; presenter can reveal.
- Non-functional: Accessible non-drag fallback; deterministic scoring; existing games unchanged.

## Architecture

Extend game authoring with pair data. Player UI supports drag/drop plus click-select fallback. Server validates submitted IDs against answer key and broadcasts score/summary.

Bounds and event contract:
- pairs: 2-8
- event: `game-matching-submit` with `{ gameId, pairs: [{ promptId, targetId }] }`
- server validates socket-local `currentGameId` exists and payload `gameId` equals it
- server validates socket/player belongs to the joined room
- IDs only; no arbitrary labels accepted in submit payload
- submitted mappings live in subtype-specific room state and are omitted from static exports unless a future explicit saved-results feature is designed

## Related Code Files

- Modify: `client/src/constants/game-element-types-constants.js`
- Modify: `client/src/components/properties/game-properties.jsx`
- Modify: `client/src/components/properties/game-properties-question-editor.jsx`
- Modify: `client/src/pages/game-player-join-page.jsx`
- Modify: `server/services/game-socket-handler.js`
- Modify: `server/services/game-room-manager-singleton-service.js`
- Test: authoring, scoring, player UI, accessibility path, export fallback

## Implementation Steps

1. Write failing pair-authoring persistence tests.
2. Write failing server scoring and session-binding tests.
3. Implement accessible player matching UI.
4. Add reveal/summary presenter path.
5. Add export/static answer policy tests.

## Success Criteria

- [x] Author creates 2-8 pairs.
- [x] Player can complete using keyboard/click fallback.
- [x] Server scores correct, partial, incorrect.
- [x] Presenter reveal works.
- [x] Existing game subtypes still pass tests.

## Risk Assessment

Risk: drag/drop e2e flakiness. Mitigation: click/select fallback is required, not optional.

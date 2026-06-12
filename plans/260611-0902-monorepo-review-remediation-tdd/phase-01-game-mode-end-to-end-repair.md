---
phase: 1
title: "Game Mode End-to-End Repair"
status: complete
priority: P1
effort: "1.5d"
dependencies: []
---

# Phase 1: Game Mode End-to-End Repair

## Overview
Game mode is dead end-to-end (C1): client connects default namespace while server
attaches handlers on `/games`, plus client/server field-name mismatch. Restore the
full join→answer→score→leaderboard flow over a real socket, and close the game
authorization + anti-cheat + room-leak gaps found alongside it.

## Findings Covered
- **C1** (Critical) — game socket namespace + field mismatch. *Lead-verified.*
- **I-R4.3** — duplicate answer submission inflates score (anti-cheat).
- **I-R4.4** — waiting/active game rooms leak (TTL only armed in `endGame`).
- **I-R4.5** — game presenter-only events unauthorized (no host check).
- **M-R4 (random)** — server random index diverges from client-sent winner.

## Requirements
- Functional: a player joining a live game over Socket.IO receives state, can
  answer once per question, sees leaderboard; presenter-only events reject
  non-host sockets; rooms clean up when empty/finished.
- Non-functional: no silent event drops; unit test must traverse the real socket
  layer, not call `GameEngine` directly (the gap that hid C1).

## Architecture

### C1 root cause (verified)
- Client: `client/src/hooks/use-game-socket.js:27` → `io({ path:'/ws' })` (default
  namespace); join payload `{roomId, playerName, role}` at `:33`.
- Also `client/src/hooks/use-game-player.js:64` same default-namespace connect.
- Server: `server/services/game-socket-handler.js:9` → `io.of('/games')`;
  handler reads `{gameId, ...}` at `:15`, `{gameId, answerIndex, timeSpentMs}` at `:38`.
- Renderer emit path: `name-picker-interactive-game-renderer.jsx:405` (and sibling
  game renderers) send `{roomId, answer, timeSpent}`.

### Decision gate (locked: "plan decides")
Phase scout STEP 0 must evaluate both fixes and record the choice + rationale
in this file before coding:
- **Option A — client → `/games`**: change `io({path:'/ws'})` to
  `io('/games',{path:'/ws'})` in the 2 hooks; align field names client-side.
  Smaller server blast radius; keeps game traffic isolated from live.
- **Option B — server → default namespace**: drop `io.of('/games')`, attach game
  handlers to the same `io` as live with event-name prefixing. Unifies transport
  but risks event-name collisions with live handlers.
- Lean A unless scout finds live/game event-name overlap that makes isolation
  valuable. **Whichever chosen, field names MUST be unified on both sides.**

### Supporting fixes
- I-R4.3: `game-room-manager-singleton-service.js:52` `submitAnswer` — track
  `answeredQuestions` per player per questionId; reject/ignore repeat, no score add.
- I-R4.4: schedule empty-room cleanup on `leave`/`disconnect` (mirror live TTL),
  not only in `endGame:109`.
- I-R4.5: add host/presenter check to `game-next/end/random`
  (`game-socket-handler.js:63,77,96`) analogous to live `canControlRoom`.
- M-random: server authoritative — emit the server-chosen index to all; client
  renders server value, does not send its own winner.

## Related Code Files
- Modify: `client/src/hooks/use-game-socket.js`
- Modify: `client/src/hooks/use-game-player.js`
- Modify: `server/services/game-socket-handler.js`
- Modify: `server/services/game-room-manager-singleton-service.js`
- Modify: game renderer emit sites (e.g. `client/src/components/canvas/element-renderers/game-interactive/name-picker-interactive-game-renderer.jsx` + siblings) — only field-name alignment
- Create: `server/services/game-socket-end-to-end.test.js` (socket-layer integration)
- Reference (read): `server/services/game-engine-singleton-room-management-...test.js`

## TDD — Tests First
1. **Failing integration test** `game-socket-end-to-end.test.js`: boot a real
   Socket.IO server with `setupGameSocketHandlers`, connect a `socket.io-client`
   the SAME way the hook does (namespace + path), emit `game-join` with the
   SAME payload shape the renderer sends → assert `game-player-joined` received.
   This fails today (wrong namespace/fields) and is the C1 tripwire.
2. **Anti-cheat test**: same question answered twice → score increments once.
3. **Authorization test**: non-host socket emits `game-next` → rejected, state unchanged.
4. **Room-cleanup test**: last player leaves a waiting room → room removed after TTL.
5. **Random determinism test**: server emits a single winner index; two clients
   receive identical value.

## Implementation Steps
1. Scout STEP 0: decide Option A/B, write decision block above, get it green-lit in plan.
2. Write the 5 failing tests (red).
3. Apply namespace + field unification (C1) until test 1 passes.
4. Apply I-R4.3 / I-R4.4 / I-R4.5 / random fixes until tests 2–5 pass.
5. Manual smoke: open a game element, join from `/player/...`, answer, see leaderboard.

## Success Criteria
- [x] `game-socket-end-to-end.test.js` green (was red).
- [x] Duplicate answer cannot inflate score.
- [x] Non-host rejected from presenter-only events.
- [x] Empty/finished rooms removed; no unbounded growth in a 50-join soak.
- [x] Manual: full join→answer→leaderboard works in browser.

## Red-Team Amendments (2026-06-11)

Override the scout gate and authz/cleanup approach below:

- **Namespace decision is PRE-SETTLED — Option A, forced (no scout needed).**
  E2E already connects to `/games` (`tests/e2e/.../game-scoring-and-leaderboard.spec.js:11`)
  and game-timer events run on the live DEFAULT namespace (`socket-handler.js`),
  so Option B (server→default) would collide with live event names. C1 shrinks to:
  (a) client hooks connect `io('/games', {path:'/ws'})`; (b) unify field names.
- **Answer payload cite corrected.** The answer emit is NOT
  `name-picker-...renderer.jsx:405` (that line is `game-random`). Real answer path:
  `client/src/hooks/use-game-player.js:50-54`. All 3 fields mismatch:
  `roomId→gameId`, `answer→answerIndex`, `timeSpent→timeSpentMs`. Align at the hook,
  not (only) the renderer.
- **I-R4.4 + I-R4.5 blocked on a real gap, NOT a deferred question.** Players are
  keyed by `socket.id` (`game-room-manager-singleton-service.js:39`) and game rooms
  have NO `presenterId`/host field, so:
  - `canControlRoom` (`live-rooms.js:146`) cannot be reused for game authz.
  - TTL grace-cancel-on-reconnect cannot correlate a reconnecting player (new
    `socket.id`).
  **Required design (do in this phase, do not defer):** add a stable identity —
  on `game-join`, accept an optional client-persisted `playerId` (localStorage),
  key players by `playerId` not `socket.id`; designate the FIRST joiner with
  `role:'host'` (or the element-owner socket) as host and store `hostPlayerId` on
  the room. Authz checks compare `hostPlayerId`; cleanup grace correlates by
  `playerId`. Update tests 3 & 4 to drive reconnect via a stable `playerId`.


  *Mitigation:* scout greps live event names first; prefer Option A.
- **Risk:** field rename breaks other game renderers not in sample.
  *Mitigation:* grep all `emit('game-` sites; align in one pass; contract test per renderer if cheap.
- **Risk:** TTL cleanup races with a reconnecting player. *Mitigation:* cancel
  pending cleanup on rejoin (debounce), grace window.

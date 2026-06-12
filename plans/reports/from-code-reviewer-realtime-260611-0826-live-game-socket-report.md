# Realtime Review — Live Presentation + Game Mode (R4)

Date: 2026-06-11
Reviewer: code-reviewer (realtime scope)
Mode: READ-ONLY. Findings only, no code changed.

## Scope

- server/services/socket-handler.js, live-rooms.js, game-socket-handler.js, game-room-manager-singleton-service.js
- server/routes/live.js, games-rest-api-handler.js
- client hooks: use-live-presentation.js, use-annotation-sync.js, use-live-timer-sync.js, use-game-socket.js, use-game-player.js
- client contexts: live-socket-context-provider.jsx, timer-context-state-provider.jsx
- client pages/components: LiveViewPage.jsx, annotation-canvas.jsx, name-picker-interactive-game-renderer.jsx
- Tests read for intent: socket-handler.test.js, game-engine...test.js, use-annotation-sync.test.js

## Severity counts

- Critical: 1
- Important: 5
- Medium: 3
- Low: 3

---

## CRITICAL

### C1. Game mode entirely non-functional: client connects to default namespace, server handlers live on `/games`
- Server: `server/services/game-socket-handler.js:9` registers all game events on `io.of('/games')`.
- Client: `client/src/hooks/use-game-socket.js:27` and `client/src/hooks/use-game-player.js:64` both connect with `io({ path: '/ws', reconnection: true })` — i.e. the DEFAULT namespace, NOT `/games`.
- The default namespace handler (`socket-handler.js`) has no `game-join`, `game-answer`, `game-next`, `game-end`, `game-random` listeners. Every game event emitted by the client lands on a namespace with no listener and is silently dropped.
- Impact: All game modes (name-picker, hot-potato, quiz, leaderboard) are dead end-to-end. `game-join` never reaches `GameEngine`, no player list, no scoring, no leaderboard, no question advance. CI unit tests pass because they exercise `GameEngine` directly and never cross the Socket.IO namespace boundary.
- Compounding contract mismatches (would still break even if namespace fixed):
  - `use-game-socket.js:33` emits `{ roomId, playerName, role }`; server `game-socket-handler.js:15` destructures `{ gameId, playerName }`. `gameId` is `undefined` → server replies `game-error: "gameId and playerName are required"`.
  - `use-game-player.js:50` emits `game-answer` as `{ roomId, answer, timeSpent }`; server `game-socket-handler.js:38` expects `{ gameId, answerIndex, timeSpentMs }`. All three fields mismatch.
  - `name-picker-interactive-game-renderer.jsx:405` emits `game-random` as `{ roomId, gameType, mode, winner, allItems }`; server reads `{ gameId }`.
- Fix direction: Pick one namespace contract. Either connect game clients to `/games` (`io('/games', { path: '/ws' })`) AND align field names to `gameId`/`answerIndex`/`timeSpentMs`, or move game handlers onto the default namespace. Add an integration test that drives a real socket client through join→answer→leaderboard rather than calling `GameEngine` directly.

---

## IMPORTANT

### I1. Annotations are not cleared or re-synced on slide change (viewer)
- `client/src/pages/LiveViewPage.jsx:18` holds `annotationStrokes` as a single flat array, not keyed by slide.
- On `navigate` (`LiveViewPage.jsx:89-91`) only `liveState.slideIndex` changes; nothing clears `annotationStrokes`. Strokes drawn on slide 0 keep rendering on slide 1, 2, ...
- `use-annotation-sync.js:60-73` `handleAnnotationsSync` only reads `slideAnnotations[slideIndex]` and only runs when an `annotations:sync` event arrives. The server sends `annotations:sync` once at join (`socket-handler.js:159`). After a slide change there is no re-fire, so pre-existing annotations for the newly shown slide are never rendered, while stale ones from the previous slide remain on screen.
- Impact: Viewers see wrong-slide annotations bleeding across slides and miss annotations that were created on other slides before they joined. Task brief explicitly calls out "annotations persist per slide on rejoin" — this is violated for in-session navigation.
- Fix direction: Key strokes by slide index (render `slideAnnotations[currentSlide]`), clear/reselect on `navigate`, and either keep the full server map client-side or re-emit a per-slide annotations request on slide change.

### I2. Live rooms never expire — memory leak for abandoned presentations
- `server/services/live-rooms.js`: rooms are only removed via `removeRoom`, called solely from the `DELETE /api/live/room/:code` route (`server/routes/live.js:66`).
- If a presenter closes the tab/crashes without calling DELETE (the common case), `leaveRoom` (`live-rooms.js:97`) sets `presenterId = null` and clears timer timeouts but leaves the room object — with its annotations and `state` — in the `rooms` Map forever.
- `POST /api/live/room` mints a new room on every presenter session (`use-live-presentation.js:27`), so orphaned rooms accumulate unbounded for the server lifetime.
- Contrast: game rooms have a `ROOM_TTL_MS` cleanup (`game-room-manager-singleton-service.js:8,109`); live rooms have none.
- Fix direction: Add a TTL / idle sweep for live rooms (e.g. remove a presenter-less room after N minutes with no viewers), or remove the room when the last socket leaves.

### I3. Game answer can be resubmitted — scoring exploit
- `game-room-manager-singleton-service.js:52-76` `submitAnswer` does not check whether the player already answered `currentQuestion`. It unconditionally adds `points` and pushes to `player.answers`.
- A client can emit `game-answer` repeatedly for the same question and accumulate points (plus repeated speed bonus). No idempotency key, no per-question answered guard.
- Impact: Leaderboard integrity is broken; a single player can inflate score arbitrarily.
- Fix direction: Reject if `player.answers` already contains an entry for `question.id` (or track `answeredQuestionIndex`). Return a distinct result so the client shows "already answered".

### I4. Abandoned "waiting"/"active" game rooms leak (cleanup only after endGame)
- `game-room-manager-singleton-service.js`: the TTL cleanup timer is armed only in `endGame` (`:109`). `leaveRoom`/`disconnect` (`game-socket-handler.js:113-140`) remove the player but never schedule cleanup when the room empties.
- A game that is created and joined but never explicitly ended (presenter leaves) stays in the `rooms` Map indefinitely.
- Fix direction: When the last player leaves or on a creation-idle timeout, schedule cleanup even if the game never reached `finished`.

### I5. Game presenter-only events have no authorization
- `game-socket-handler.js`: `game-next` (`:77`), `game-end` (`:96`), `game-random` (`:63`) accept the call from any connected socket in the room. There is no presenter/host check (unlike the live side, which uses `canControlRoom`).
- Impact: Any player can advance questions, end the game, or trigger the random picker. Trust-boundary violation on the game realtime path.
- Fix direction: Track the host socket per game room and gate presenter-only events on it (mirror `live-rooms.canControlRoom`).

---

## MEDIUM

### M1. Server-authoritative random diverges from client winner
- `name-picker-interactive-game-renderer.jsx:405` sends the client-chosen `winner`, but `triggerRandom` (`game-room-manager-singleton-service.js:78-91`) picks its OWN random index and broadcasts that via `game-random-result` (`game-socket-handler.js:73`). Even with the namespace fixed, the spun wheel result and the broadcast result will disagree.
- Fix direction: Decide a single source of truth — either the server picks and the client animates to that index, or the client result is authoritative and the server just records/excludes it.

### M2. Per-element game socket connections (connection storm)
- `name-picker-interactive-game-renderer.jsx:397` calls `useGameSocket(element.id, ...)` per renderer instance. A slide with multiple game elements opens multiple independent socket connections (each `io({ path: '/ws' })`). Live view already maintains its own socket; this duplicates connections.
- Fix direction: Share a single socket via context (the unused `LiveSocketContext` in `live-socket-context-provider.jsx` looks intended for exactly this) instead of one per element.

### M3. Timer end never fires after presenter reconnect
- On presenter disconnect, `live-rooms.js:101-106` clears `timerTimeouts` but leaves the `timers` entries (still `running` with a past/future `endedAt`). No code re-arms `scheduleTimerEnd` on presenter rejoin (`socket-handler.js:124-139` reloads presentation/state but not timer timeouts).
- Impact: A running timer that crosses a presenter reconnect will emit `timer:sync` on join but never emit `timer:ended`; viewers' countdowns may hang at 0 without the end signal.
- Fix direction: On presenter rejoin, re-arm timeouts for any still-running timers (or recompute on join).

---

## LOW

### L1. Always-on 100ms interval in LiveViewPage
- `LiveViewPage.jsx:165-181` runs a `setInterval(…, 100)` writing `window.__timerStates` continuously even when no timers exist. Minor wasted work for the whole live session. Consider gating on presence of timers.

### L2. Duplicate game join overwrites player score
- `game-room-manager-singleton-service.js:39` `room.players.set(socketId, { score: 0, ... })` resets an existing player to score 0 on a repeated `game-join` for the same socket. Low risk today (one join per session) but a reconnect that re-emits join would wipe score.

### L3. `_playerId`/`role` sent by client are ignored server-side
- `use-game-socket.js:36` sends `role`; `game-socket-handler.js:15` ignores it. There is no concept of host vs player on the server, which is the root of I5. Noting for the authorization fix.

---

## Verified-correct (calibration)

- Live-side trust boundaries are sound: `navigate` checks `presenterId === socketId` (`updateRoomState`, `live-rooms.js:139-144`); `control-navigate`, `laser`, and all `annotation:*` handlers gate on `canControlRoom` (`socket-handler.js:189-255`); presenter-token validation on join is enforced and tested (`socket-handler.test.js:356`).
- Annotation dedup against the add/sync race is handled via `seenIds` (`use-annotation-sync.js:25-37`) and covered by tests.
- Presenter disconnect keeps the room alive and clears timer timeouts (`live-rooms.js:97-108`); viewers get `presenter-disconnected`.
- Timer input validation (duration 1–7200, delta ≤3600, elementId format) is enforced and tested (`socket-handler.js:258-359`, `socket-handler.test.js:399-456`).
- Socket listener cleanup in client hooks is correct (`useEffect` returns `socket.off(...)` / `disconnect()` in use-annotation-sync, use-live-timer-sync, use-game-socket, use-game-player).

## Unresolved questions

1. Is game mode expected to be wired through `/ws` default namespace or `/games`? The server commits to `/games` but no client connects there — confirm intended contract before fixing C1.
2. Should live-room annotations persist server-side across full server restart, or is in-memory acceptable (affects I2 fix shape)?
3. Is there a host/presenter identity for games beyond socket id (for I5 authorization)?

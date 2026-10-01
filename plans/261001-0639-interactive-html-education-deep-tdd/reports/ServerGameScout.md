## 1. Room/API model

`createRoom(gameId, gameType, options = {}, owner = null)` (engine lines 105–164) creates a room unless ID exists. Model fields include public `gameId`, `gameType`, normalized owner, opaque socket room ID, `status: waiting|active|finished`, `players: Map` keyed by stable client playerId, hashed session/host capability data, host player/socket IDs, `currentQuestion: -1`, timing, `allowLate`, normalized `questions`, poll/word-cloud/matching configuration and response Maps, `teams`, mutable picker `items`, `excludeAfterPick`, timestamps and cleanup timers. Capability is returned separately by REST/bootstrap and kept pending until host claims; only its hash resides in room state (105–164, 166–180).

Server presenter-bootstrap allowlist is `SUPPORTED_GAME_TYPES` in `presenter-game-bootstrap.js:3-14`: name-picker, hot-potato, jeopardy, four-corners, relay-race, trivia-champ, scattergories, poll, word-cloud, matching. This allowlist governs presentation bootstrap only; REST `POST /api/games` passes any nonempty `gameType` to `createRoom` (games REST lines 20–43), with no same allowlist check observed.

`submitAnswer(gameId, playerId, answerIndex, timeSpentMs, options)` (engine lines 496 onward) binds current question ID optionally/required, player session/socket, duplicate answer, server elapsed time and deadline; compares answerIndex to `question.correctIndex`, awards points plus speed bonus, records answer and score. It does not visibly validate that `answerIndex` is integer/in range or a supported structured answer shape: incorrect arbitrary values record zero points (security/robustness risk). `nextQuestion` increments index, starts server timer, activates room; end-of-list ends room (engine around lines 615–652). Leaderboard sorts player entries descending score (around lines 669–681). Random picker chooses `Math.random()` index, optionally splices picked item, returns index; empty list => -1 (around lines 574–592). Finished rooms schedule 5-minute cleanup; unclaimed rooms same default TTL; empty disconnected rooms use 30-second grace. Cleanup removes room/pending capability and notifies socket handler; configurable test seams `_setEmptyRoomTtl`, `_setUnclaimedRoomTtl` (around lines 686–888).

## Socket event table

Handlers in `game-socket-handler.js`; `/games` namespace and `path: /ws` on hooks/runtime.

| Direction | Event | Purpose / auth |
|---|---|---|
| client→server | `game-join` | Join player or host; host role requires capability, established player session required for reconnect. |
| server→client | `game-session` | Server-issued playerId/session token; client persists it. |
| server→room | `game-player-joined` | Current player names/scores. |
| server→client | `game-leaderboard` | Join hydration/score update. |
| player→server | `game-answer` | `{gameId,questionId,answerIndex,timeSpentMs}`; session-bound. |
| server→client | `game-answer-result` | Correctness, correct/selected indices, points, score. |
| host→server | `game-next`, `game-end`, `game-random` | Host capability + active host socket/session required. |
| server→room | `game-question`, `game-ended`, `game-random-result` | Question is redacted of answer/solution fields; end includes final scores. |
| player→server | `game-poll-submit`; `game-word-cloud-submit`; `game-matching-submit` | Session-bound poll vote / phrase / pair mapping. |
| host→server | `game-poll-start/reveal`; `game-word-cloud-start/reveal/clear`; `game-matching-start/reveal` | All host-gated; corresponding subtype must exist. |
| server→room/player | `game-poll-started/results/vote-accepted`; `game-word-cloud-started/results/submit-accepted`; `game-matching-started/results/submit-accepted` | Hydration, aggregates and acknowledgements. |
| either/error lifecycle | `game-error`, `game-room-expired`; client→server `game-leave` | Error signaling, expired-room notification, remove membership. |

Exact handlers: join `game-socket-handler.js:160-230`; answer `233-284`; poll `287-340`; word cloud `343-416`; matching `418-496`; random/next/end/leave/disconnect `497-605`. Host event mapping also in `shared/src/live-presenter-game-runtime.js:155-192`.

## 2. Player UI and extension points

Current join page renders generic multiple-choice question card (`QuestionCard`, `game-player-join-page.jsx:81-127`), poll card (`129-164`), word-cloud text card (`166-220`), matching pairs card (`236 onward`), answer/result/wait/final states (around 300 onward). Main routing branches only on hook statuses `question`, `poll`, `word-cloud`, `matching` (around lines 425–510); no gameType-based route or dedicated four-corners/relay-race/trivia-champ/scattergories UI exists. Those game types are represented in canvas/presenter renderers but client-player hook/server currently provide no dedicated player submit protocol. Therefore add status/state/submit APIs in `use-game-player.js`, matching event listeners in hook, new card components and branches in page. Use existing `MatchingCard` + `game-player-matching-card.test.jsx` as component pattern.

- Four-corners: add choice payload/state/card under new status; server validates configured corner IDs/count and one choice/player/round. Existing type/config in bootstrap `:7-8,20-23`; engine has no implementation for this type.
- Relay-race: answer + team/turn ownership needs protocol/state; do not assume quiz `submitAnswer` implies team semantics. Config projected bootstrap `:21`.
- Trivia-champ: buzz arbitration and answer phases require server-authoritative first-buzz/team/round state; existing config `:22` only.
- Scattergories: submit category words, bounded and deduplicated/scored server-side; existing config `:23`, no player submission path.
- New question types: keep shared `game-question` delivery and expand `QuestionCard` by explicit type; hook currently insists `options` array and question string (`use-game-player.js:228-240`) and submit emits only `answerIndex` (`:116-129`), so multi-choice may map indices but fill-blank/ordering need typed answer payload. True/false can map to two indices. Server public question redaction must include new answer-key fields (`game-socket-handler.js:13-23`) and scoring must validate typed answer semantics.

Room creation options are whitelisted in `presenter-game-bootstrap.js:16-27`; include every new game config here or presenter won't pass it into room creation. Shared host runtime maps shortcut actions to events at `live-presenter-game-runtime.js:155-192`; add host controls/events there only as needed.

## 3. Existing security to reuse / gaps

- Host authority: random 32-byte base64url capability, SHA-256 stored, checked in `isHost`; coupled to host player/socket/session. Engine `createSessionToken`, hash/validation and `isHost` (lines 64–103, 670 onward); REST `requireHost` (games REST lines 10–18); socket `requireHost` (game socket lines 157 onward). Presenter owner/generation/capability checks are in bootstrap and presentation route.
- Player authority: server-issued session token hash, socket binding, stable player ID, stale-session check on mutations (`joinRoom` and `hasValidPlayerSession`, engine lines 75–103, 398 onward). Reuse for all newly added player submissions.
- Existing input bounds: question timeLimit 5–300 seconds and points 1–1000; poll max 6 options; word cloud max phrase length 40, submissions/player max 5, display 50; matching max 8 pairs (engine lines 127–164, 229 onward, 270 onward, 355 onward). Join form name max 30 chars (page lines 12–18), but server `joinRoom` only checks nonempty string (engine lines 398 onward); no broad socket event rate limiter observed. Word-cloud's per-player submission cap is the reusable semantic rate-limit precedent.
- Answer validation currently relies on client-supplied value equality and deadline/session; no integer/range/schema validation apparent. Matching validates known IDs and uniqueness; poll validates option membership. New payloads should follow these server-side semantic checks. REST create endpoint explicitly documents local single-user bootstrap boundary; internet-facing auth not implemented (REST lines 20–23). Host capability issuance through generic REST create is intentionally local trust boundary, not safe as internet-facing unauthenticated provisioning.

## 4. LOC and test strategy

Approximate file LOC from read tool totals: engine 888, socket handler 605, bootstrap 181, use-game-player 381, use-game-socket 390, join page 537, shared runtime 337. REST handler LOC is [INFERENCE] ~191 based on displayed contents; exact count not provided by tool. Rule files under 200 LOC conflicts with current substantial game engine/socket/client modules; do not expand monoliths casually. Existing separation for subtype rules is not consistent; preserve shared engine authoritative state and consider well-scoped modules only if repository architecture accepts it. Bootstrap is already just below the limit.

Recommended tests to extend:
- `server/services/game-engine-singleton-room-management-join-leave-answer-scoring-random-picker-leaderboard-cleanup.test.js`: create model, answer validation/scoring boundaries, next/leaderboard/picker/cleanup and new subtype invariants.
- `server/services/game-socket-end-to-end.test.js`: actual wire event contracts, player lifecycle, host-only event rejection, redaction, answer protocol and scoring.
- `server/services/game-matching-reveal-persistence.test.js`: extend pattern for late join hydration/revealed state for newly stateful rounds where relevant.
- `server/routes/games-rest-api.test.js`: API payload/auth/error paths; `server/routes/presentations-game-bootstrap.test.js`: supported types/options/capability mapping.
- `client/src/hooks/use-game-player.test.js`: hook event->state and emitted submit payloads; `use-game-socket.test.js`: host/event-state integration if adding event handling there.
- `client/src/pages/game-player-join-page.test.jsx`: only direct-link lifecycle currently; add per-game/card rendering and actions. `game-player-matching-card.test.jsx`: interaction/component-level pattern.

## Risks

1. Server and presenter-bootstrap type support differ: generic REST accepts arbitrary type while bootstrap filters to its allowlist.
2. Existing quiz answer protocol is index-only and uses `correctIndex`; non-choice types need explicit typed payload and authoritative normalization/scoring without leaking answer keys.
3. Main page currently lacks gameType input from room/hook (question-only state), so type-specific UI needs public question metadata or event state; avoid exposing solutions while adding it.
4. Team games require server-authoritative team assignment, turn/buzz arbitration, phase transitions, reconnect hydration, and prevention of duplicate scoring. Local interactive renderer state does not provide multiplayer authority.
5. Existing socket handlers are long and duplicated subtype start/reveal logic; adding game families here risks exceeding maintainability limits and inconsistent host checks.
6. Existing rate limiting is semantic per-player word-cloud quota, not transport/IP throttling; generic answer/poll/matching submissions have no broad throttle observed.
7. Client input bounds are not server-authoritative for player names; new text submissions must bound raw and normalized lengths on server.
8. `toPublicQuestion` redacts a fixed key list. New answer fields may inadvertently leak unless explicitly stripped or split into public/private model.
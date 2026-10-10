---
phase: 12
title: 'Server live authoritative, typed quiz và round protocols hoàn chỉnh'
status: in_progress
priority: P1
dependencies: [3, 5, 6]
---

# Phase 12 — Server là nguồn sự thật duy nhất của live game

## Execution progress

Live server authority/projection implementation đã có. Final generated host + hai independent learner/real-socket receipts còn mở cho supported games/typed quiz/Jeopardy, score/deadline/team consensus, correct/wrong/late/buzz/turn, duplicate/stale replay, reconnect/auth/redaction và bounded inputs. [Root progress](./plan.md#execution-progress) giữ implementation khác acceptance; existing canonical-live checkpoint không qualify expansion này.

## Goal

Giữ các game live hiện có, hoàn thiện protocols four-corners/relay-race/trivia-champ/scattergories và quiz bảy question kinds; deadline, membership, turn/buzz, reveal và scoring đều do server quyết định. Chia engine/socket thành cohesive modules dưới 200 LOC rồi cutover một lần, không shim cũ.

## Context/evidence

- `server/services/game-room-manager-singleton-service.js:13-15,173-214` giữ Maps process-wide nhưng state mutable thuộc từng room; `joinRoom:501-584` cấp session; `isHost:736` kiểm tra authority.
- `submitAnswer` tại manager `:587-629` kiểm session/question/duplicate/deadline; `:610,698` dùng Date.now; `:634-645` so correctIndex và cộng speed bonus. Typed quiz không được kế thừa bonus ngoài Hot Potato.
- `server/services/game-socket-handler.js:13-25` clone question rồi blacklist secrets; `:121-158` hydrate question hoặc poll/cloud/matching; `:178-229` join xong mới hydrate.
- Socket answer `:233-283` và REST `server/routes/games-rest-api-handler.js:105-131` gọi cùng `submitAnswer`; cả hai phải cutover typed command, không để REST bypass deadline/generation.
- `server/services/presenter-game-bootstrap.js:16-27,48-54,63-73` whitelist options còn thiếu teams/questions cho vài game; collect descriptors không phải implementation live rules.
- Jeopardy board `client/src/components/canvas/element-renderers/game-renderers/jeopardy-interactive-board.jsx:49-82,155-167` có hai scoring paths; double-score chỉ là INFERENCE, phải tái hiện trước sửa quy tắc. Wager bounds hiện tại `jeopardy-wager-modal.jsx:9-12` là max(teamScore,maxWager).
- Real socket harness `server/services/game-socket-end-to-end.test.js:11-38,70-85` dùng HTTP port ephemeral + Socket.IO thật, đúng `/games` và `/ws`, cùng CommonJS singleton.

## Deep scout gate

- [ ] Re-grep toàn bộ engine/socket imports và các mutations; trace host authentication trước subtype dispatch, không suy từ tên handler.
- [ ] Đọc outputs phase 03/05/06; khóa config/quiz payloads/scoring policies và dùng evaluator/public projection chung, không redesign kiến trúc fixed contract.
- [ ] Tái hiện Jeopardy local action + event sequence; ghi score trước/sau, event producer và negativePoints/wager policy trước cutover server ownership.
- [ ] Kiểm tra room/session/socket lifetime và cleanup: reset một room không đụng room khác; reconnect giữ identity nhưng socket cũ mất mutation rights.
- [ ] Xác minh supported types ở REST/bootstrap/catalog thống nhất; unsupported classroom-local types trả lỗi rõ, không tạo phòng giả hoạt động.

## Requirements

- Host commands reuse opaque capability + host player/session/socket binding; learner không được chọn team của người khác, reveal, reset, adjudicate hoặc gửi điểm.
- Client timestamp, timeSpentMs và points không có quyền quyết định outcome; deadline chỉ dùng monotonic server clock, không wall-clock delta.
- Mọi mutation bind room instance, generation, roundId/questionId, actor session, unique command/attempt ID. Duplicate trả receipt cũ, stale generation/round/session không đổi state.
- Public question là allowlist projection, không spread config rồi blacklist. Không answerKey/solution/private feedback trong public nested media/options hoặc hydration trước reveal.
- Reconnect/late join nhận current phase, remaining deadline, own accepted answer, team/turn/buzz và public scoreboard; reveal đã xảy ra vẫn hydrate đúng policy.
- Giữ Poll, WordCloud, Matching lifecycle/aggregates/quota/reveal; Matching events và `{promptId,targetId}` không đổi ý nghĩa hoặc chuyển thành indices.
- New livegames có actual submit protocols; typed quiz hỗ trợ single/multi/true-false/fill/ordering/matching/hotspot, exact-match, attempts và once-only award.

## Architecture/contracts

- Data flow: trusted bootstrap author config → shared normalizer → room-private config/state → authenticated command validation → pure rule transition/evaluator → atomic ledger commit → public projection + recipient-specific receipt.
- Process Maps giữ room references; room owns generation/round counter/deadline/teams/answers/dedup; per-socket connection context giữ actor. Không thêm mutable round state vào singleton global hay shared reducer module.
- Envelope mới `E={gameId,roomInstanceId,generation,roundId,commandId}`; typed answers thêm `questionId,attemptId,answer`. Session/capability vẫn qua established join context, không nhận actor từ payload để thay socket owner.
- `roomInstanceId` server-issued chống reuse gameId sau expiry; generation tăng khi replay/reset; roundId tăng mỗi start/next. Dedup key gồm actor+session+generation+round+command, bounded theo round/room TTL; duplicate payload khác cùng ID trả conflict.
- Validate auth/envelope/shape/quota trước mutation; xử lý một transition đồng bộ, publish sau commit; reset hủy timers/callback old generation và clear round ledgers, không callback async tự ghi điểm.
- Monotonic internal `deadlineMs` từ clock server; serialize `timeRemainingMs,serverTimeMs,stateVersion` cho display, không serialize monotonic origin như timestamp UTC. Callback deadline recheck room instance/generation/round.
- Local timer pause khi leave thuộc phase 04/05; live deadline tiếp tục bất kể slide/host tab. `allowLate` có policy explicit per supported game, không áp late bypass cho mọi subtype.
- Typed quiz reuse phase 03 proposed `shared/src/education/answer-evaluator.js`, API `evaluateAnswer(question,answer)->{valid,correct,error}`; phase 06 quiz-session sở hữu points/attempts, quiz-public-projection sở hữu allowlist. `answer` kind-specific stable IDs/NFC/normalized hotspot; Hot Potato `answerIndex` giữ normalize tại boundary hiện có, không alias evaluator.
- Matching events/pairs/accepted fields được bảo toàn; envelope thêm metadata và ALL shipped command emitters cutover trong checkpoint12. Không đổi local Matching protocol ở10;13 nhận working protocol/bridge rồi hoàn thiện learner cards, không old-envelope shim.
- Quiz result trước reveal chỉ own validity/correctness/points/totalScore/attempt availability; private explanation/keys chỉ qua authorized accepted-terminal/reveal policy phase 06, không leak từ rejected/stale commands.
- `educationView:'audience'` from04 applies to EVERY live presentation-data fanout/fallback/regeneration; serialize only public config for current/future/hidden slides, not private full-normalizer input. Authenticated host retains private config; audience mounts read-only live observers and never gets a local evaluator. Socket game redaction alone does not protect generated HTML.
- Generic `POST /api/games` MUST reject presenter-owned rooms before reading pending host capability, without changing that room. Only trusted presenter bootstrap may hand off owned-room authority; ownerless intentional local provisioning remains unchanged. No new deployment-wide auth scope is introduced.
- Team assignment server-owned: host `game-team-assign` chỉ trong waiting; validate configured IDs, assign every learner once, lock during round. Late learner chờ round kế nếu cần turn roster, không giành baton/buzz.
- Four corners: start chọn authored question/correctCorner; mỗi learner chọn một known corner trong deadline; reveal thưởng authored points cho đúng, elimination theo config; replay reset roster eligibility.
- Relay: server chọn activeTeam/turnPlayerId, chỉ holder submit; correct tăng lane theo phase 05 policy, wrong/passOnWrong và expiry chuyển lượt đúng một lần; shuffleTeams server-owned, goal từ questionsPerRound, không client declare winner.
- Trivia: configured rounds individual/team/buzzer và lightning/jackpot được thực thi; buzz winner theo server receipt order. Accepted buzz awards configured buzzPoints once (legacy/default10), independently of later answer correctness; only winner answers, answer multipliers apply separately. Duplicate/replayed buzz cannot award again and explicit authored0 alone disables buzz points.
- Scattergories: server chọn letter/categories/deadline; mỗi team có một submitter từ roster, gửi bounded `{categoryId,text}`; NFC+trim+case normalization, dấu giữ nghĩa, wrong initial letter/unknown category bị từ chối.
- Scatter scoring: reveal đóng submissions, server tính uniqueness per category; duplicated normalized word không được unique bonus; existing unique policy +10 tại `scattergories-live-game-renderer-with-letter-wheel-timer-unique-scoring.jsx:84-97`. Host validity adjudication cho meaning theo category nếu config cần, không pretend có dictionary/AI chấm nghĩa.
- Jeopardy: server owns stable cellId mapping, usedCells, activeTeam, wager, reveal/adjudication status và team score. Host select/wager/adjudicate là commands; server derives points/negativePoints/clamp từ config và đóng cell once, không nhận client point delta.
- Live commands consume cùng pure game reducers phase 05 `shared/src/education/games/`; server bổ sung auth/roster/clock/ledger quanh transition, không CREATE bộ four-corners/relay/trivia/scatter rules thứ hai hoặc copy local scoring.
- Reuse collectEffectiveGameDescriptors04 and the owner-bound `{effectiveSlideId,elementId,transportGameId}` mapping for bootstrap, join URLs, commands and resets; never dedup inherited games by raw element ID. Returning/reconnecting reuses that tuple's instance, hidden overrides have no room.
- Minimal live-host-bridge is CREATED in12, not13: hydrate E from session/round snapshots, map all host controls/shortcuts to real events, subscribe absolute state, and bind existing generated presenters to the bootstrap-owned socket. Complete shipped hook/REST command emitters in the same server checkpoint so server GREEN never needs undelivered13 client code.
- Input caps: IDs <=128, playerName <=30, raw text <=256; đề xuất 200 questions/16 teams/200 learners/8 KiB command cùng shared caps phase 03. Giữ poll<=6, Matching<=8, cloud<=40 chars/5 submissions/50 displayed; reject oversized arrays/NaN/Infinity trước normalization.

### Event/payload contract phải ghi vào docs sau smoke

| Direction / event                                                        | Payload ngoài E                                                                                                | Authority và response                                                             |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| C→S `game-join`; S→C `game-session`                                      | Existing identity/role/capability/session; response bổ sung roomInstanceId/generation/gameType                 | Reuse current auth, hydrate sau join                                              |
| H→S `game-next`,`game-end`,`game-random`,`game-reset`,`game-team-assign` | team assignment có playerId/teamId                                                                             | Host-gated; reset/next publish game-round-state; existing events giữ semantics    |
| S→C `game-round-state`                                                   | gameType,phase,stateVersion,question public,teams,turn,buzz,timeRemainingMs,ownSubmission,revealed public data | Projection theo recipient; score absolute, không delta                            |
| P→S `game-answer`                                                        | questionId,attemptId,typed answer; Hot Potato giữ answerIndex boundary                                         | S→P game-answer-result + S→room game-leaderboard; once-only award                 |
| H→S `game-fourcorners-start/reveal`; P→S `game-fourcorners-choice`       | choice có cornerId                                                                                             | State + game-command-result; choice receipt không correctCorner                   |
| H→S `game-relay-start/next`; P→S `game-relay-answer`                     | questionId,attemptId,answer                                                                                    | Only turn holder; next không double-advance turn                                  |
| H→S `game-trivia-start/next/reveal`; P→S `game-trivia-buzz/answer`       | start roundConfigId; answer questionId/attemptId/answer                                                        | Atomic winner/answer/phase result, leaderboard absolute                           |
| H→S `game-scatter-start/reveal/adjudicate`; P→S `game-scatter-submit`    | entries[{categoryId,text}]; adjudicate submissionId/categoryId/valid                                           | Server scoring once after validity settled; all clients same scoreboard           |
| H→S `game-jeopardy-select/wager/reveal/adjudicate`                       | cellId; wager amount; adjudicate correct boolean                                                               | Known cell/team/turn required; points never client input                          |
| Existing poll/cloud/matching start/reveal/submit/results                 | Existing optionId/text/pairs plus E                                                                            | Preserve limits/aggregates/reveal hydration; additive lifecycle metadata          |
| S→C `game-command-result`,`game-error`                                   | commandId,accepted/duplicate/error code,current envelope/stateVersion                                          | Safe errors, no secrets/raw token; reject mismatched state without score mutation |

## File inventory

CREATE paths proposed; production files mới/split <200 LOC. Integration owner sở hữu entrypoints/dispatch/REST/bootstrap, domain owner chỉ viết modules cho đến sequential checkpoint.

| Full path                                                                      | Action / fact                           | Ownership và test impact                                                                                                |
| ------------------------------------------------------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| C:/Work/NavSlidesEditor/server/services/game-room-manager-singleton-service.js | MODIFY / known :173,587,850             | Entry becomes real orchestration, preserve public service contract; remove moved bodies                                 |
| C:/Work/NavSlidesEditor/server/services/game-socket-handler.js                 | MODIFY / known :38,178                  | Entry composes handlers <200 LOC, preserve setupGameSocketHandlers                                                      |
| C:/Work/NavSlidesEditor/server/services/games/room-store.js                    | CREATE / proposed                       | Room/pending capability Maps, <200 LOC                                                                                  |
| C:/Work/NavSlidesEditor/server/services/games/room-auth.js                     | CREATE / proposed                       | Capability hash/session/host checks, <200 LOC                                                                           |
| C:/Work/NavSlidesEditor/server/services/games/player-membership.js             | CREATE / proposed                       | Join/reconnect/leave/disconnect, <200 LOC                                                                               |
| C:/Work/NavSlidesEditor/server/services/games/room-lifecycle.js                | CREATE / proposed                       | Reset/TTL/cleanup/monotonic deadlines, <200 LOC                                                                         |
| C:/Work/NavSlidesEditor/server/services/games/command-ledger.js                | CREATE / proposed                       | Validation/dedup/session/round binding, <200 LOC                                                                        |
| C:/Work/NavSlidesEditor/server/services/games/quiz-commands.js                 | CREATE / proposed                       | Shared evaluator consumption + Hot Potato policy, <200 LOC                                                              |
| C:/Work/NavSlidesEditor/server/services/games/poll-commands.js                 | CREATE / proposed                       | Preserve votes/aggregate, <200 LOC                                                                                      |
| C:/Work/NavSlidesEditor/server/services/games/word-cloud-commands.js           | CREATE / proposed                       | Preserve normalized quota/clear, <200 LOC                                                                               |
| C:/Work/NavSlidesEditor/server/services/games/matching-commands.js             | CREATE / proposed                       | Preserve pair-ID submissions/reveal, <200 LOC                                                                           |
| C:/Work/NavSlidesEditor/server/services/games/picker-commands.js               | CREATE / proposed                       | Existing random/exclusion + phase 05 weight policy, <200 LOC                                                            |
| C:/Work/NavSlidesEditor/server/services/games/live-round-commands.js           | CREATE / proposed                       | Teams + pure rule dispatch, <200 LOC                                                                                    |
| C:/Work/NavSlidesEditor/server/services/games/jeopardy-commands.js             | CREATE / proposed                       | Cell/turn/wager/score ownership, <200 LOC                                                                               |
| C:/Work/NavSlidesEditor/server/services/games/public-state.js                  | CREATE / proposed                       | Recipient projections/hydration, <200 LOC                                                                               |
| C:/Work/NavSlidesEditor/server/services/games/socket-membership.js             | CREATE / proposed                       | Connection context/opaque channel/leave, <200 LOC                                                                       |
| C:/Work/NavSlidesEditor/server/services/games/socket-host-commands.js          | CREATE / proposed                       | Host auth before dispatch, <200 LOC                                                                                     |
| C:/Work/NavSlidesEditor/server/services/games/socket-player-commands.js        | CREATE / proposed                       | Player binding/submit/receipts, <200 LOC                                                                                |
| C:/Work/NavSlidesEditor/shared/src/education/live-round-state.js               | CREATE / proposed                       | Shared envelope/phase/team contracts, <200 LOC                                                                          |
| C:/Work/NavSlidesEditor/shared/src/education/answer-evaluator.js               | REUSE / proposed phase 03 output        | Sole evaluateAnswer matcher; do not copy or add quiz evaluator                                                          |
| C:/Work/NavSlidesEditor/shared/src/education/quiz-session.js                   | REUSE / proposed phase 06 output        | Exact-match points/attempt invariants with server authority                                                             |
| C:/Work/NavSlidesEditor/shared/src/education/quiz-public-projection.js         | REUSE / proposed phase 06 output        | Fixed public allowlist/controlled reveal                                                                                |
| C:/Work/NavSlidesEditor/shared/tests/education/live-round-rules.test.js        | CREATE / proposed                       | Unit transitions for teams/buzz/lanes/unique scoring with deterministic clock                                           |
| C:/Work/NavSlidesEditor/shared/src/education/games/four-corners.js             | REUSE/MODIFY / proposed phase 05 output | Same scoring/elimination with server state; integration owner serial; <200 LOC                                          |
| C:/Work/NavSlidesEditor/shared/src/education/games/relay-race.js               | REUSE/MODIFY / proposed phase 05 output | Same baton/lane policy; integration owner serial; <200 LOC                                                              |
| C:/Work/NavSlidesEditor/shared/src/education/games/trivia-champ.js             | REUSE/MODIFY / proposed phase 05 output | Same configured rounds/buzz/answer rules; integration owner serial; <200 LOC                                            |
| C:/Work/NavSlidesEditor/shared/src/education/games/scattergories.js            | REUSE/MODIFY / proposed phase 05 output | Same uniqueness/validity/letter rules; integration owner serial; <200 LOC                                               |
| C:/Work/NavSlidesEditor/shared/src/education/games/jeopardy.js                 | REUSE/MODIFY / proposed phase 05 output | Same cell/turn/wager/clamp policy; integration owner serial; <200 LOC                                                   |
| C:/Work/NavSlidesEditor/shared/src/education/game-score-policy.js              | REUSE / proposed phase 05 output        | Common award identity, explicit game scoring; not another matcher                                                       |
| C:/Work/NavSlidesEditor/server/services/presenter-game-bootstrap.js            | MODIFY / known :57-73                   | Integration owner; shared effective descriptors04, bounded tuple-to-room mapping and trusted capability handoff         |
| C:/Work/NavSlidesEditor/server/routes/games-rest-api-handler.js                | MODIFY / known :33-43,105-131           | Same typed command authority; generic create cannot retrieve/alter presenter-owned room capability                      |
| C:/Work/NavSlidesEditor/shared/src/education/browser/live-host-bridge.js       | CREATE / proposed                       | Integration owner12; E/session/round hydration, generated control event mapping and borrowed-socket snapshots; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/live-transport.js         | MODIFY / proposed phase 04 output       | Integration owner12; complete E construction, retries and absolute subscriptions before generated-host gate             |
| C:/Work/NavSlidesEditor/shared/src/education/browser/mount.js                  | MODIFY / proposed phase 04 output       | Integration owner12; inject completed host bridge, no dependence on13 card creation                                     |
| C:/Work/NavSlidesEditor/shared/src/live-presenter-game-runtime.js              | MODIFY / known :123-127,156-205         | Shipped bootstrap/shortcuts hydrate envelope metadata and consume effective transport IDs in checkpoint12               |
| C:/Work/NavSlidesEditor/shared/src/htmlGenerator.js                            | MODIFY / known :262,478-491             | Role-specific public projection04 plus new round/typed state; no full private audience config                           |
| C:/Work/NavSlidesEditor/server/services/socket-handler.js                      | MODIFY / known :130-141                 | All live audience HTML producers/fallbacks honor server-derived public view and typed projection                        |
| C:/Work/NavSlidesEditor/client/src/hooks/use-game-player.js                    | MODIFY / known :211-242                 | Shipped existing learner emitter/session hydration adopts E now;13 later extracts full shared UX                        |
| C:/Work/NavSlidesEditor/client/src/hooks/use-game-socket.js                    | MODIFY / known                          | Shipped host/player command emitters use complete E in the SAME12 checkpoint                                            |
| C:/Work/NavSlidesEditor/shared/src/index.js                                    | MODIFY / known                          | Integration owner; one export contract for shared round/envelope helpers, no alias shim                                 |
| C:/Work/NavSlidesEditor/server/services/game-live-rounds-socket.test.js        | CREATE / proposed                       | Real transport, four games, team/buzz/deadline                                                                          |
| C:/Work/NavSlidesEditor/server/services/game-quiz-authority-socket.test.js     | CREATE / proposed                       | Typed answers, projections, duplicate/stale/reconnect                                                                   |
| C:/Work/NavSlidesEditor/server/services/game-jeopardy-authority-socket.test.js | CREATE / proposed                       | Reproduced cell/wager/once-only score sequence                                                                          |
| C:/Work/NavSlidesEditor/server/services/game-socket-end-to-end.test.js         | MODIFY / known :70-85                   | Preserve current public contracts; update additive envelopes                                                            |
| C:/Work/NavSlidesEditor/server/routes/games-rest-api.test.js                   | MODIFY / known import :8                | Same REST authority/bounds/error behavior                                                                               |
| C:/Work/NavSlidesEditor/server/routes/presentations-game-bootstrap.test.js     | MODIFY / known import :10               | Full authored options and host capability ownership                                                                     |
| C:/Work/NavSlidesEditor/tests/e2e/live/education-server-contract.spec.js       | CREATE / proposed                       | Actual generated host + two wire learners; <=200 LOC                                                                    |
| C:/Work/NavSlidesEditor/docs/system-architecture.md                            | MODIFY / known                          | Events/payloads/ownership only after smoke                                                                              |
| C:/Work/NavSlidesEditor/docs/project-changelog.md                              | MODIFY / known                          | Observed behavior receipt only after smoke                                                                              |

### Enumerated caller cutover

Engine production consumers: `server/routes/games-rest-api-handler.js:6,120`; `server/services/game-socket-handler.js:11,243`; `server/services/presenter-game-bootstrap.js:1,135`. Engine test consumers: `server/routes/games-rest-api.test.js:8`; `server/routes/presentations-game-bootstrap.test.js:10`; `server/services/game-engine-singleton-room-management-join-leave-answer-scoring-random-picker-leaderboard-cleanup.test.js:7`; `server/services/game-matching-reveal-persistence.test.js:6`; `server/services/game-socket-end-to-end.test.js:21`; `server/services/presenter-game-bootstrap.test.js:5`. Socket setup consumers: `server/index.js:23,521`; socket end-to-end `:22,74`; Matching persistence `:7,31`. Preserve their entry contracts without alias exports; re-enumerate after dependencies change.

## Tests Before — RED scenarios

Tests proposed must be created first; no RED/GREEN claims are made in this plan.

- All seven typed quiz answers: accepted/wrong/invalid/duplicate/attempt exhaustion; wrong IDs, arbitrary objects, NaN/oversize inputs and fake points/timestamp cannot award points. Speed bonus stays Hot Potato-only.
- Before reveal, public question/state/hydration contains no secret at any depth; unknown private config fields never appear. Late join after reveal sees only intended revealed data.
- Real host + two sockets complete four new games: correct/wrong/late, host auth denied for learner, simultaneous buzz total ordering, relay non-holder rejected, team roster immutable during round.
- Replay generation and room replacement reject old commands; reconnect same token hydrates accepted receipt and remaining deadline; superseded socket cannot mutate; reset/TTL callbacks cannot score new room.
- Jeopardy select→wager→reveal→adjudicate twice + incoming scoreboard has one score transaction; preserve verified negativePoints/wager rules rather than speculative double-score fix.
- Existing poll/cloud/matching/name-picker/hot-potato live behavior, quotas/reveal and cleanup remain; two rooms with same player names do not share state.
- Master-only poll/quiz inherited on two parents and a vertical child: separate tuple IDs, rooms, rounds, scores/reset; hidden override absent and reconnect/return reuse only the matching instance.
- REST-vs-trusted-bootstrap race before host claim: generic POST cannot disclose/reclaim pending owned authority, rightful host still joins, ownerless local create still works.
- Actual presentation-room audience join/reconnect/regeneration: serialized HTML/config for hidden/future questions omits keys/accepted fill strings/correct hotspot geometry/private feedback; no local evaluator or score fallback.

## Implementation steps

1. Fresh scout, capture RED scenarios with real sockets and ephemeral ports; pure clock fake allowed only unit timing tests, transport is never mocked for authority proof.
2. Extract room storage/auth/membership/lifecycle and subtype handlers; entry orchestrates real modules, deletes moved old bodies and keeps every exercised public method functional.
3. Add envelope/command ledger and monotonic deadline state, atomic generation-aware reset/cleanup; bound IDs/text/arrays before mutation and reuse shared schema/evaluator phase 06.
4. Implement four pure live rules and server commands fully; settle teams/turn/buzz/scatter adjudication, validate each transition, publish versioned absolute state/score.
5. Implement server-owned Jeopardy cell lifecycle and typed quiz results/projections; shared public allowlist never accepts private fields from arbitrary config spread.
6. Integration owner connects server/socket/bootstrap/REST AND creates minimal live-host-bridge; hydrate E, map actual generated host controls, update every shipped hook/shortcut emitter atomically, remove old-envelope paths.13 REUSES this completed bridge and owns full learner UX; run contract cases at each checkpoint.
7. Browser smoke actual generated presenter + two real learners via wire clients; phase 13 supplies all native learner cards but server phase cannot defer protocol completion.
8. Update architecture/changelog after observed smoke, include payload/envelope/error/reveal/late policies and local provisioning boundary; no new internet authentication scope.

## Refactor

Không thêm generic plugin-handler framework. Các service modules nhận room/actor/dependencies explicit, pure shared rules không tự lấy singleton. Một scoring ledger cho team/player answers; public entry không còn monolithic duplicate logic hoặc forwarding compatibility shims.

## Tests After — GREEN

Chạy đúng RED files và existing socket/REST/bootstrap contracts; observe leaderboard agreement, private-key absence, deadline expiry, cleanup and receipt replay. Fixtures luôn disconnect clients, close server, reset only their instance, không poll fixed sleeps.

## Behavior matrix

| Mức      | Scenario                                  | Kết quả quan sát                                              |
| -------- | ----------------------------------------- | ------------------------------------------------------------- |
| Critical | Duplicate/stale/session/room replacement  | No second score, safe rejection, fresh generation unaffected  |
| Critical | Projection + late reveal hydration        | Không keys trước policy reveal, đủ public state khi reconnect |
| High     | Four games + typed quiz + Jeopardy        | Protocol hoàn chỉnh, team/buzz/turn/score authoritative       |
| High     | Fake timing/points + monotonic expiry     | Không client lợi dụng deadline, Hot Potato-only bonus         |
| Medium   | Bounded malformed input/cleanup/two rooms | Không crash/hang/state leak, existing games giữ behavior      |

## Executable focused commands

Chỉ implementation được chạy; CREATE tests trước. Không full suite/build/lint trong planning. `chromium-live` match thật tại `playwright.config.js:88-91`.

```powershell
npx vitest run shared/tests/education/live-round-rules.test.js
npx vitest run server/services/game-live-rounds-socket.test.js server/services/game-quiz-authority-socket.test.js server/services/game-jeopardy-authority-socket.test.js
npx vitest run server/services/game-socket-end-to-end.test.js server/routes/games-rest-api.test.js server/routes/presentations-game-bootstrap.test.js
npm run vendor
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'
npx playwright test tests/e2e/live/education-server-contract.spec.js --project=chromium-live --workers=1
```

## ACTUAL browser smoke journey

Tạo deck có đủ livegames + quiz/Jeopardy; mở generated Present `?live=roomCode` thật bằng host bootstrap capability, không thay bằng React host. Hai independent learner wire clients join, host assigns teams/starts; hoàn thành correct/wrong/late/buzz/turn, disconnect/reconnect một learner, replay rồi gửi payload generation cũ. Quan sát generated host bootstrap và existing controls hoạt động trên browser thật; thu absolute scoreboard/revealed state qua real sockets và so hai learners, lưu received payloads redacted. Full native card reflection trên cả ba screens được ký tại phase 13, không giả claim UI mới đã có ở phase server. Mở generated local file `file://` để kiểm honest local mode/no websocket; portable Download final thuộc phase 14.

## Success criteria + unchecked actionable checklist

- [ ] Mọi supported existing game và bốn livegames/typed quiz/Jeopardy có protocol thật, server score/deadline/teams consensus và bounded inputs.
- [ ] Replay/duplicate/stale/late/reconnect/auth/redaction được chứng minh real sockets và generated host, không mock transport.
- [ ] Engine/socket split modules <200 LOC, mọi listed callers cutover sạch, không obsolete shim hoặc public-key leak.
- [ ] Docs/events cập nhật sau smoke; phase 13 nhận contract hoàn chỉnh, không phase boundary giả delivery.

## Security/risks and failure protocol

High (cao × cao): scoring/projection/auth lệch giữa handlers; giảm bằng một ledger/auth gate/public allowlist và actual socket adversarial tests. High (vừa × cao): wall-clock jumps/reset callback gây thưởng sai; monotonic deadlines + room/generation binding. High (vừa × cao): cutover module tạo singleton thứ hai hoặc leak room state; kiểm CommonJS instance và two-room tests. High (vừa × cao): server thiếu semantic dictionary Scattergories; host adjudication explicit, không tuyên bố auto chấm nghĩa. Rollback: kết thúc rooms mới, revert atomic server checkpoint + paired shipped client protocol, không restore active room snapshots/capabilities hoặc xóa saved deck config; phase 13 không triển khai lên server cũ. REST provisioning tại `games-rest-api-handler.js:30-32` vẫn local single-user boundary, không thêm claim internet-safe. Failure: lưu redacted command/stateVersion/room/generation/trace, dừng dispatcher checkpoint, sửa root cause rồi rerun đúng scenario; không tin client points, bỏ redaction hoặc suppress invalid commands để vượt gate.

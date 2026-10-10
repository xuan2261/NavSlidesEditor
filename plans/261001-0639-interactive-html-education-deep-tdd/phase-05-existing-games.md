---
phase: 5
title: 'Mười game hiện có chạy thật trên standalone runtime'
status: in_progress
priority: P1
dependencies: [3, 4]
---

# Phase 05 — Existing games

## Execution progress

Existing-game reducers/presenters implementation đã bàn giao, không còn unstarted. Còn thiếu final current-subject all-ten generated/native/Share/portable round, score, timer và replay receipts theo checklist; native-only hoặc preliminary runs không thay generated/file proof. Integration owner đã exercise Jeopardy DOM region repair bằng current-source isolated compiled runtime trên real generated Present: cell → question → reveal → award100 → reset0, không có nested inert regions; visual `.tmp/region-input-smoke.png` trong worktree. Đây là bounded source smoke, chưa qualify published runtime/full frozen subject hoặc surfaces khác. [Root progress](./plan.md#execution-progress) giữ qualification boundaries; không đổi scoring policy/checklist.

## Goal

Chuyển đủ10 existing game presentations sang shared pure reducers + DOM presenters đã mount04; local classroom chơi được từ authoring tới Present/Share/portable file, có scoring/timers/replay đồng nhất.
Không giữ React play implementation ẩn không có production caller; live protocol expansion thuộc12/13, không lấy local React UI làm bằng chứng multiplayer.

## Context/evidence

- Dispatch hiện ở `client/src/components/canvas/element-renderers/game-element-renderer.jsx:45-67`; Hot Potato tại `client/src/components/canvas/element-renderers/game-renderers/hot-potato.jsx:2-17` chỉ hiện câu đầu, không nhận isPresenting thực.
- Jeopardy local answer tại `client/src/components/canvas/element-renderers/game-renderers/jeopardy-interactive-board.jsx:155-167` tự cộng/clamp điểm nhưng không emit game-answer; event effect tại49-82 xử lý answer-result độc lập.
- Actual socket `server/services/game-socket-handler.js:233-284` gửi game-answer-result chỉ về submitter, payload không teamId; hook tại `client/src/hooks/use-game-socket.js:236-238` đổi event name thành answer-result.
- Vì không tìm được event production tương ứng local Jeopardy action, double scoring vẫn INFERENCE, không phải bug đã reproduced; không áp dụng scoring policy từ socket quiz vào Jeopardy.
- Jeopardy board lookup tại `client/src/components/canvas/element-renderers/game-renderers/jeopardy-shared.js:5-22` dùng category/points; correct local +points, wrong zero trừ khi negativePoints, clamp0 tại interactive155-164.
- Four Corners reads parent timer tại `client/src/components/canvas/element-renderers/game-interactive/four-corners-live-game-renderer-with-timer-scoring-leaderboard.jsx:76-98`, lấy q.corner/random fallback100-104 và +10/eliminate115-137.
- Relay movement/passOnWrong tại `client/src/components/canvas/element-renderers/game-interactive/relay-race-live-game-renderer-with-team-lanes-baton-pass.jsx:99-145`; timed callbacks và parent timer phải chuyển deadline04.
- Trivia hardcoded rounds/points-on-buzz tại `client/src/components/canvas/element-renderers/game-interactive/trivia-championship-live-game-renderer-with-round-tabs-lightning-jackpot.jsx:7-10,108-124`; authored rounds hiện không điều khiển play.
- Scatter đã có reset tại `client/src/components/canvas/element-renderers/game-interactive/scattergories-live-game-renderer-with-letter-wheel-timer-unique-scoring.jsx:188-194`; không trình bày reset như thiếu toàn bộ.
- Poll/WordCloud/Matching React host controls đang phụ thuộc connection tại `client/src/components/canvas/element-renderers/game-renderers/poll.jsx:49-65`, `word-cloud.jsx:58-81`, `matching.jsx:60-85`; generated local cần submission path thực.
- Hot Potato current server speed bonus/duplicate/deadline policy tại `server/services/game-room-manager-singleton-service.js:610-645`; giữ game-specific policy, không lan sang quiz mới.

## Deep scout gate

- Glob lại inventory và mọi import/caller của React play files; đọc phase03/04 modules đã tồn tại sau execution trước khi MODIFY proposed paths.
- Tái hiện Jeopardy actual event sequence bằng host/local controls và real socket observer: cell→team→reveal→correct/wrong→delayed close→leaderboard; ghi payload và điểm từng bước.
- Nếu không double-score được, ghi corrected receipt; regression vẫn kiểm accepted result/duplicate cùng action chỉ award một lần, không nói đã sửa bug chưa thấy.
- Scout Scatter unique scoring normalization/letter/team entry path, Relay passOnWrong branch, Trivia buzzer transition và active timer callbacks trước migrate policy.
- Kiểm config identity/lifetime: saved deck immutable, state per-root/session generation, không name-keyed team collisions hoặc static globals.
- Reconfirm native Try production entry + generated mounts hoạt động04 và catalog local/live thật; thiếu thì chặn05, không tạo adapter fallback React.

## Requirements

- Tất cả10 subtypes dưới đây có presenter thật reachable từ native Try và generated Present/Preview/Share; không generic clickable placeholder thay game board.
- Pure reducer nhận canonical config + command + clock/random inputs, trả state; DOM chỉ nhập/render, transport live không giữ local authority.
- Dùng timer deadlines04, shared accepted-command identity/session generation, replay reset mọi transient state; hide/show bảo toàn progress, local pause và server live continue.
- Local poll/word-cloud/matching có một-device classroom input, start/submit/reveal/reset thật, không cần room hoặc phone connection.
- Question/option/pair/team/cell IDs ổn định; media/alt load safe và portable; no display-index correctness sau reorder.
- Live đang hỗ trợ phải giữ existing transport/auth/redaction; FourCorners/Relay/Trivia/Scatter và Jeopardy authoritative cell lifecycle hoàn thiện12/13, không optimistic chấm local trong live mode.
- Mọi controls keyboard/touch/native buttons activation một lần, status feedback không focus theft; 320/768/desktop/reduced motion chơi được.

## Architecture/contracts

Config03 → state factory → per-game pure reducer → reusable DOM feedback/score/timer controls → same mount04. Shared answer-evaluator03 là nguồn match duy nhất, HotPotato bonus thuộc policy riêng.
Local command có identity gắn root/session generation/round/question, accepted ledger không award lại khi double-click, replay hoặc callback pending; replay clear ledger rồi đổi generation.
Live presenter command đi transport04 tới bootstrap socket; pending chỉ hiển thị waiting, score/results thay bằng authoritative snapshots/accepted state, không cộng delta thêm snapshot.
Jeopardy local adjudication một source reducer; preserve configured negativePoints, clamp0 và wager bounds/cell-used/turn lifecycle. Phase12 server áp dụng cùng policy, browser chỉ mirror server state.
Poll không có correct-score giả; Word Cloud count/limit đúng, Matching exact accepted mapping rõ ràng. Scoring reuse mechanics không ép mọi game cùng formula.
Integration owner nối runtime-entry/renderer/registry/assets/adapter và xóa import obsolete tuần tự; game worker chỉ modules games/, browser/games/ và behavioral tests.

## File inventory

| Đường dẫn đầy đủ                                                                                                                                                                   | Thao tác/trạng thái               | Owner/kích thước/test impact                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| C:/Work/NavSlidesEditor/shared/src/education/games/name-picker.js                                                                                                                  | MODIFY, tạo bởi04                 | Game worker05 serial; weighted/exhaustion/modes/replay, <200 LOC.                                                 |
| C:/Work/NavSlidesEditor/shared/src/education/browser/games/name-picker.js                                                                                                          | MODIFY, tạo bởi04                 | Game worker05 serial; same reachable presenter, <200 LOC.                                                         |
| C:/Work/NavSlidesEditor/shared/src/education/games/hot-potato.js                                                                                                                   | CREATE, đề xuất                   | Game worker; question/bonus/deadline reducer, <200 LOC.                                                           |
| C:/Work/NavSlidesEditor/shared/src/education/browser/games/hot-potato.js                                                                                                           | CREATE, đề xuất                   | Game worker; answer/feedback/leaderboard presenter, <200 LOC.                                                     |
| C:/Work/NavSlidesEditor/shared/src/education/games/jeopardy.js                                                                                                                     | CREATE, đề xuất                   | Game worker; board/turn/wager/scoring state, split <200 LOC.                                                      |
| C:/Work/NavSlidesEditor/shared/src/education/browser/games/jeopardy.js                                                                                                             | CREATE, đề xuất                   | Game worker; board/question/wager controls, split <200 LOC.                                                       |
| C:/Work/NavSlidesEditor/shared/src/education/games/four-corners.js                                                                                                                 | CREATE, đề xuất                   | Game worker; round/vote/elimination state, <200 LOC.                                                              |
| C:/Work/NavSlidesEditor/shared/src/education/browser/games/four-corners.js                                                                                                         | CREATE, đề xuất                   | Game worker; participant/corner input and reveal, <200 LOC.                                                       |
| C:/Work/NavSlidesEditor/shared/src/education/games/relay-race.js                                                                                                                   | CREATE, đề xuất                   | Game worker; teams/turn/baton/win, <200 LOC.                                                                      |
| C:/Work/NavSlidesEditor/shared/src/education/browser/games/relay-race.js                                                                                                           | CREATE, đề xuất                   | Game worker; lanes/question/turn/feedback, <200 LOC.                                                              |
| C:/Work/NavSlidesEditor/shared/src/education/games/trivia-champ.js                                                                                                                 | CREATE, đề xuất                   | Game worker; configured rounds/buzz/answer policy, <200 LOC.                                                      |
| C:/Work/NavSlidesEditor/shared/src/education/browser/games/trivia-champ.js                                                                                                         | CREATE, đề xuất                   | Game worker; rounds/lightning/jackpot/score controls, <200 LOC.                                                   |
| C:/Work/NavSlidesEditor/shared/src/education/games/scattergories.js                                                                                                                | CREATE, đề xuất                   | Game worker; letter/answers/unique scoring/reset, <200 LOC.                                                       |
| C:/Work/NavSlidesEditor/shared/src/education/browser/games/scattergories.js                                                                                                        | CREATE, đề xuất                   | Game worker; category/team text/review controls, <200 LOC.                                                        |
| C:/Work/NavSlidesEditor/shared/src/education/games/poll.js                                                                                                                         | CREATE, đề xuất                   | Game worker; local vote/change/reveal aggregate, <200 LOC.                                                        |
| C:/Work/NavSlidesEditor/shared/src/education/browser/games/poll.js                                                                                                                 | CREATE, đề xuất                   | Game worker; actual local form/host results, <200 LOC.                                                            |
| C:/Work/NavSlidesEditor/shared/src/education/games/word-cloud.js                                                                                                                   | CREATE, đề xuất                   | Game worker; normalized words/count/quota/clear, <200 LOC.                                                        |
| C:/Work/NavSlidesEditor/shared/src/education/browser/games/word-cloud.js                                                                                                           | CREATE, đề xuất                   | Game worker; local submissions + counted cloud, <200 LOC.                                                         |
| C:/Work/NavSlidesEditor/shared/src/education/games/matching.js                                                                                                                     | CREATE, đề xuất                   | Game worker; stable mapping/correctness/reset, <200 LOC.                                                          |
| C:/Work/NavSlidesEditor/shared/src/education/browser/games/matching.js                                                                                                             | CREATE, đề xuất                   | Game worker; click-select/place+keyboard play, <200 LOC; drag enhancement10.                                      |
| C:/Work/NavSlidesEditor/shared/src/education/game-score-policy.js                                                                                                                  | CREATE, đề xuất                   | Game worker; award identity/mechanics, not duplicate answer evaluator, <200 LOC.                                  |
| C:/Work/NavSlidesEditor/shared/src/education/browser/game-feedback-controls.js                                                                                                     | CREATE, đề xuất                   | Game worker; score/timer/status/replay UI, <200 LOC.                                                              |
| C:/Work/NavSlidesEditor/shared/src/education/browser/runtime-entry.js                                                                                                              | MODIFY, tạo bởi04                 | Integration owner; connect10 presenters sequentially, no parallel writes.                                         |
| C:/Work/NavSlidesEditor/shared/src/education/browser/live-transport.js                                                                                                             | MODIFY / proposed phase 04 output | Integration owner; consume04 transport boundary without server event redesign;12/13 own authoritative extensions. |
| C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-element-renderer.jsx                                                                                   | MODIFY, đã có                     | Integration owner; inert authoring snapshots và same Try adapter, remove old play dispatch.                       |
| C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-renderers/shared.jsx                                                                                   | MODIFY, đã có                     | Integration owner; remove lazy React getters khi callers chuyển, giữ preview-only helpers cần thiết.              |
| C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-renderers/jeopardy-interactive-board.jsx                                                               | DELETE sau cutover, đã có         | Integration owner; obsolete score/timer reducer, không còn reachable consumer.                                    |
| C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-interactive/name-picker-interactive-game-renderer.jsx                                                  | DELETE sau cutover, đã có         | Integration owner; remove duplicate picker state/animation after reuse owned presenter.                           |
| C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-interactive/four-corners-live-game-renderer-with-timer-scoring-leaderboard.jsx                         | DELETE sau cutover, đã có         | Integration owner; remove parent timer/local duplicate reducer.                                                   |
| C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-interactive/relay-race-live-game-renderer-with-team-lanes-baton-pass.jsx                               | DELETE sau cutover, đã có         | Integration owner; remove duplicate turn/timer callbacks.                                                         |
| C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-interactive/trivia-championship-live-game-renderer-with-round-tabs-lightning-jackpot.jsx               | DELETE sau cutover, đã có         | Integration owner; remove hardcoded play rounds.                                                                  |
| C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-interactive/scattergories-live-game-renderer-with-letter-wheel-timer-unique-scoring.jsx                | DELETE sau cutover, đã có         | Integration owner; preserve reset/unique scoring in migrated behavior first.                                      |
| C:/Work/NavSlidesEditor/shared/tests/existing-game-state.test.js                                                                                                                   | CREATE, đề xuất                   | Deterministic10 reducer transitions; split focused suites if lengthy.                                             |
| C:/Work/NavSlidesEditor/shared/tests/jeopardy-score-policy.test.js                                                                                                                 | CREATE, đề xuất                   | Accepted/duplicate/wager/clamp/turn outcomes, not inferred bug text.                                              |
| C:/Work/NavSlidesEditor/tests/e2e/games/existing-games-present.spec.js                                                                                                             | CREATE, đề xuất                   | Actual generated10 games; ≤200 LOC concern split.                                                                 |
| C:/Work/NavSlidesEditor/tests/e2e/games/existing-games-portable.spec.js                                                                                                            | CREATE, đề xuất                   | Real Download/file network-blocked parity, ≤200 LOC.                                                              |
| C:/Work/NavSlidesEditor/docs/feature-coverage-matrix.md                                                                                                                            | MODIFY sau smoke, đã có           | Integration owner; local10 vs live verified capabilities.                                                         |
| C:/Work/NavSlidesEditor/docs/project-changelog.md                                                                                                                                  | MODIFY sau smoke, đã có           | Integration owner; actual reducer/presentation cutover receipts.                                                  |
| Existing React static game-renderers files remain useful previews; integration owner removes only play branches/imports after fresh caller inventory, not unrelated JSX wholesale. |

## Concrete success per game

| Game          | Observable round/play/reset result                                                                                                                                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name-picker   | Wheel/dice/button show same sampled item identity, positive weights respected, exclude removes picked item, exhausted list explicit; replay restores original authored list.                                                                                                      |
| hot-potato    | Start actual question, submit correct/wrong/late, accepted correct gains base+explicit speed bonus once, next/shuffle/end/leaderboard work; replay clears answers/scores/current question.                                                                                        |
| jeopardy      | Select authored cell/category, team/reveal/adjudicate once; daily-double wager bounded; wrong follows negativePoints/clamp0, used cell locked, winner after real cells; replay restores board/turn/wager/timer/scores.                                                            |
| four-corners  | Local named participant chooses configured corner ID, timer/reveal uses authored correct corner, each reveal awards once and wrong elimination follows config; replay restores all players/rounds.                                                                                |
| relay-race    | Teams/lanes authored, active team answers actual question; correct advances one position, wrong/timeout applies verified passOnWrong policy, baton and winning position bounded; replay resets lanes/turn/questions/timer.                                                        |
| trivia-champ  | Authored rounds/order/mode/time/questions drive UI; accepted buzz awards buzzPoints once (legacy/default10), separately from answer points/lightning/jackpot. Explicit authored0 enables answer-only mode; replay clears buzz/round/answers/scores without changing saved policy. |
| scattergories | Letter chosen per letterMode, all category/team responses editable in play, same normalized nonempty answer loses uniqueness as intended, deadline/end reveals review; new round reset preserved and full replay clears scores/letter/answers.                                    |
| poll          | Start local session, submit stable option for classroom participant, allowVoteChange changes existing vote not total count, showResults/reveal controls obey config; reset empties aggregate and identities.                                                                      |
| word-cloud    | Actual local text input submits bounded phrases, quota enforced per classroom participant, normalized duplicate counts aggregate and displayLimit caps display; clear/replay remove counts/quota/timer.                                                                           |
| matching      | Local select prompt then target or keyboard mapping, one-to-one stable IDs, actual submit reveals correctness and accepted score once; images render, replay clears selections/accepted/results; drag/touch enhancement10 uses same reducer.                                      |

## Tests Before — RED scenarios

1. Actual generated HotPotato, FourCorners, Relay, Trivia, Scatter, Poll, WordCloud, Matching currently unplayable; capture user-visible failing control/state, not placeholder wording.
2. Jeopardy trace local correctness plus duplicate accepted transport/snapshot receipt; test expected one award without asserting unobserved double scoring claim.
3. Ten subtypes replay while animation/feedback/timer pending then jump clock: no old generation score/turn/selection callback can survive.
4. Poll vote change, cloud quotas/duplicate normalization, matching reorder/duplicate target, picker exhaustion and two roots isolation have deterministic behavioral assertions.
5. Trivia accepted/duplicate buzz preserves legacy +10 default, wrong answer never erases an accepted buzz award, explicit buzzPoints0 alone disables it; authored rounds/replay honored. Relay wrong/pass/timeout transitions once; Scatter new-round reset equivalent.
6. Local leave/resume deadlines and file zero HTTP/WS; live disconnect must reject local adjudication and retain waiting/read-only, existing live Socket.IO test remains real.

## Numbered implementation steps

1. Reproduce original behaviors/event sequences, settle Jeopardy policy from source+receipt and existing game settings; do not rewrite policy to generic quiz speed scoring.
2. Create focused RED for per-game table, then pure reducers reuse schema/evaluator03, clock/session04 and shared score identity mechanics.
3. Complete picker04 behavior; implement HotPotato full local answer/progress/shuffle/leaderboard; stable question IDs and canonical media required.
4. Implement Jeopardy board/wager/team/turn lifecycle one-source local scoring; live control requests only, authoritative server completion12.
5. Implement FourCorners input, Relay answers/lanes/pass policy and Trivia configurable rounds with distinct accepted-buzz and correctness awards; sole score ledger preserves default buzzPoints10 and rejects duplicate/stale award identities.
6. Implement Scatter category/team answer form and verified uniqueness scoring; preserve existing new-round reset alongside standardized full replay.
7. Implement Poll/WordCloud local submission/result forms and Matching local selection/map/evaluation; existing live supported modes use same DOM presenter with transport.
8. Integration owner connects10 runtime entries, Try/generated/static snapshot paths and removes obsolete React play reducers/imports only after equivalent behavior receipts.
9. Run per-game GREEN, actual generated10 and portable file; update docs/changelog after smoke, publish live capability status truthful pending12/13.

## Refactor

Split complex Jeopardy board/question/wager and Trivia phases into cohesive under200 LOC modules; shared policies stay under shared/, no React duplicate reducers or dynamic import play graph.
Cutover11 caller locations, first10 verified: `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-element-renderer.jsx:16-27,45-67`; `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-renderers/shared.jsx:6-24`; `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-renderers/four-corners.jsx:6-13`; `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-renderers/relay-race.jsx:6-13`; `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-renderers/trivia-champ.jsx:6-13`; `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-renderers/scattergories.jsx:6-13`; `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-renderers/name-picker.jsx:139-145`; `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-renderers/jeopardy-renderer.jsx:3`; `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-renderers/poll.jsx:17-23`; `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-renderers/word-cloud.jsx:20-26`.
Caller11 là `C:/Work/NavSlidesEditor/client/src/components/canvas/element-renderers/game-renderers/matching.jsx:17-23`. Những wrappers/static renderer files trên là MODIFY existing bởi integration owner để bỏ play branches nhưng giữ inert preview; fresh grep ghi tổng thực tế trước xóa, không xóa server/client player hooks vẫn có consumers live12/13.

## Tests After — GREEN

Từng row table có deterministic reducer proof + DOM input/state transitions + generated URL/browser receipt; no test-source/wording/render-not-throw assertions.
Accepted action identity không award lại, deadline có monotonic elapsed đúng, reset restore config baseline và hidden/leave không mutate saved deck; actual live existing types vẫn hợp đồng auth/redaction.

## Behavior matrix

| Mức      | Scenario                                               | Unit / integration / E2E                                                       |
| -------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| critical | Ten actual presentations/local progress/scoring/replay | Per-game reducer + DOM actions + generated/file play hết vòng.                 |
| critical | Jeopardy accepted scoring policy và duplicate events   | Event trace + score/turn/used-cell invariant + real socket boundary.           |
| high     | Timers/pending callbacks/leave/reset/root isolation    | Fake clock only unit + actual Reveal/visibility/portable multiple roots.       |
| high     | Poll/cloud/matching one-device and live authority      | Actual local submit/results + existing real Socket.IO + no local live scoring. |
| medium   | Configurable rounds/media/keyboard/touch               | Save/reload→Try/Present→Download;320/768/desktop reduced motion.               |

## Executable focused commands

CREATE tests phải được tạo trước, phase03 evaluator và04 bundle đã chạy; lệnh sau dành execution, không run planning/midflight gates.

```powershell
npx vitest run shared/tests/existing-game-state.test.js shared/tests/jeopardy-score-policy.test.js
npx vitest run server/services/game-socket-end-to-end.test.js client/src/hooks/use-game-socket.test.js
npm run vendor
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'; npx playwright test tests/e2e/games/existing-games-present.spec.js tests/e2e/games/existing-games-portable.spec.js --project=chromium --workers=1
```

Real socket test uses actual server/transport isolation, không fake echo result để chứng minh multiplayer; phase12/13 full host+two-learners new-mode gates chưa chạy ở05.

## ACTUAL browser smoke journey

Author đủ10 games với real questions/images/teams/settings03; save/reload/undo/duplicate rồi Try hoàn thành một vòng mỗi game, scores đúng và reset fresh state.
Present từ UI popup, Preview endpoint và Share URL: từng game board/controls tác dụng thật, đa blocks + vertical navigation preserve progress, Enter/Space không kích slide/action wrapper.
Download file thật, mở file:// trong fresh context network blocked; hoàn thành từng applicable local game và replay, images/sound theo browser gesture policy, không HTTP/WS/parent polling.
HotPotato/Jeopardy/Relay/Trivia reset trong pending timer/result và quay lại slide; Scatter new-round path giữ nguyên outcome; thử320/768/desktop/touch/reduced motion, record scores/generation/events.

## Success criteria + unchecked actionable checklist

- [ ] Đủ10 rows success table có RED-before/GREEN-after và generated/portable actual receipts, không game chỉ tồn tại trong hidden React branch.
- [ ] Jeopardy sequence investigated trước sửa; local score policy preserved và accepted command/snapshot không double award, live server boundary rõ.
- [ ] HotPotato full question play/bonus, FourCorners correct-corner input, Relay real answer/baton, Trivia authored rounds/buzz score policy hoạt động.
- [ ] Scatter answer/unique score/new-round reset giữ đúng; Poll/WordCloud/Matching local forms submit/reveal/reset không cần network.
- [ ] Replay clears every timer/listener/pending feedback và increments generation; leave/hide giữ progress/local remaining, saved config không đổi.
- [ ] Adapter cutover xong rồi obsolete React play reducers/imports bị xóa; modules <200 LOC và docs/changelog update sau observed smoke.

## Security/risks and failure protocol

High (cao × cao): scoring replay/duplicate/delta+snapshot; source-of-truth state với command/session identity, authoritative live replaces state, không optimistic điểm.
High (cao × cao): mất intended Jeopardy/Relay/Scatter policy; actual event/transition reproduction và canonical fixtures trước cutover, không generic formula thay mọi game.
High (vừa × cao): local/live capabilities bị thổi phồng; catalog honest, disconnected live read-only, new server-authoritative modes12/13 bắt buộc trước integrated release16.
High (cao × cao): delayed callback old generation/parent timer dependency; deadline/session04 guard, timer expiry/replay race tests và actual file smoke.
Medium (vừa × vừa): cloud/name/question text injection; textContent và media safety, portable answer keys không bí mật, live projection không gửi answerKey trước reveal.
Rollback: restore runtime-entry/bundle+old adapters checkpoint đồng bộ trước removal, giữ normalized config03 và deck backup; không restore duplicate scoring song song như compatibility shim.
Nếu một game thiếu actual finish/reset/file receipt, chặn dependent12/14/15 acceptance; ghi root/game/question/event/deadline và sửa đúng behavior, không mark subset done hay suppress network lỗi.
Unchecked facts: Jeopardy double scoring chưa reproduced; intended Relay passOnWrong corner case và Scatter scoring normalization phải có fresh receipt; no current browser/test execution evidence.

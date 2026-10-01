---
phase: 13
title: "Learner cards và presenter bridge trên một transport authoritative"
status: pending
priority: P1
dependencies: [4, 7, 12]
---

# Phase 13 — Host và hai người học hoàn thành live journey thật

## Goal
Generated presenter và learner page cùng hiển thị server-owned state cho bốn livegames mới, typed quiz và Jeopardy; bridge chỉ mượn existing bootstrap socket của đúng game, không tạo host socket thứ hai. Refactor hooks/page theo lifecycle và bảo toàn Poll/WordCloud/Matching.

## Context/evidence
- `client/src/pages/game-player-join-page.jsx:82-127,129-164,165-218,229-315` chứa Question/Poll/WordCloud/Matching cards; `:429,465-515` route theo hook status, chưa có dedicated four-games cards.
- `client/src/hooks/use-game-player.js:116-144` gửi index/poll/text/pairs; `:224-241` chỉ nhận questions có options array + question string. Typed fill/ordering/hotspot cần bỏ giả định này.
- Hook timers tại `use-game-player.js:88-106` dùng local Date.now; `:196-200,347-354` disconnect/cleanup. Local remaining display không được thay authority server deadline.
- `client/src/hooks/use-game-socket.js:104,170-180,370-378` đang tạo socket và cleanup trong hook; generated host đã có socket riêng ở `shared/src/live-presenter-game-runtime.js:106-146`.
- Generated bridge `live-presenter-game-runtime.js:156-192` map shortcuts sang events; `:254-282` kiểm opener source/origin; `:326-334` disconnect bootstrap-owned sockets lúc unload.
- `shared/src/live-presenter-runtime.js:2,7` gọi bootstrap runtime, không mount React game. `shared/src/reveal-runtime-assets.js:3` chốt asset Reveal 6.0.2 hiện tại.
- `plans/261001-0639-interactive-html-education-deep-tdd/research/learning-accessibility-research.md:25-54` khóa native activation, click/tap alternative, scoped keyboardCondition, local pause/live continue và replay cleanup.

## Deep scout gate
- [ ] Re-grep mọi hook/page/host-runtime consumer, socket constructor và dependency identity; trace actual generated host tới phase 04 mount và phase 12 events.
- [ ] Đọc finalized phase 12 event/envelope/reveal policies và phase 06 answer payloads; typed quiz UI không invent một question shape khác.
- [ ] Xác nhận output phase 04 live-transport/mount/deadline-clock tồn tại; đọc chúng trước sửa để giữ một owner/listener convention.
- [ ] Xác minh editor inert preview/Try/local/live mode selection; chỉ live bootstrap mới có host capability, authored JSON không lưu credential/session.
- [ ] Kiểm tra old parent timer consumers đã bị phase 05 cutover và hidden slide/fragment accessibility tree; nếu còn caller thì liệt kê/rỡ trong checkpoint, không thêm parent compatibility globals.

## Requirements
- Host generated document + hai learner browser contexts độc lập hoàn thành four-corners, relay, trivia, scattergories và quiz; không dùng cùng localStorage/session context cho hai identities.
- Learner UI đúng type/kind, hiểu waiting/active/submitted/revealed/finished/disconnected; wrong/late/invalid/attempt-limit là observable state, không mất draft vô lý.
- Score/team/turn/buzz/reveal/deadline chỉ lấy server state/receipt, không cộng điểm optimistic hoặc suy correct từ answerKey client.
- Reconnect restore own accepted submission, round/remaining time/score; replay/reset clear drafts và reject stale generation responses. Disconnect read-only/waiting, không fallback local.
- Poll votes/results, cloud caps/accepted count/clear, Matching pair IDs/reveal hydration giữ semantics existing server; local một thiết bị được ghi honest label, không mời phones nếu catalog không live.
- Keyboard, click/tap, mobile focus đầy đủ; native controls không bị Reveal hoặc action delegation phase 07 hijack/double-submit.

## Architecture/contracts
- Data flow host: trusted bootstrap → existing per-game socket/auth state → borrowed transport → shared mount/presenter → authorized command envelope → phase 12 → versioned public state → DOM.
- Data flow learner: join page → connection owner → server-issued identity/session → shared event-state reducer → type/kind-specific shared DOM card → submit envelope → receipt/hydration → absolute scoreboard.
- Một socket cho một host game instance theo owner-bound effective tuple mapping04/12, không raw element ID. Widget borrows that socket; inherited copies/vertical roots have distinct bounded transportGameIds, returning/reconnecting reuses only its own instance and destroy never disconnects owner.
- React hook adapters lấy lifecycle/state từ cùng shared connection/state modules; generated DOM dùng cùng transition semantics, không copy React reducer sang runtime.
- Proposed transport surface nội bộ giữ `subscribe/emit/getSnapshot/release`; khớp actual phase 04 API sau scout. Public API không đổi: `NavSlidesEducation.mount(root,{mode,transport,clock,random}) -> {getState,reset,destroy}`.
- Host bridge expose transport qua module-owned registry injected vào mount, không `window.parent.__timerStates`, host capability global hoặc second `game-join` của presenter widget.
- Session persistence giữ learner identity/reconnect storage boundary hiện có, host capability chỉ session-scoped; shared helper nhận storage/role rõ ràng, không chung state giữa game rooms/contexts.
- Event state dùng `roomInstanceId/generation/roundId/stateVersion` phase 12; older versions ignored, new generation atomically clears transient drafts/pending commands, new room identity không reuse old receipt.
- Typed quiz answer giữ phase 06 contract: single `{optionId}`, multi `{optionIds}`, true-false `{value}`, fill `{text}`, ordering `{itemIds}`, matching `{pairs:[{leftId,rightId}]}`, hotspot point/region payload; neutral region labels không tiết lộ key.
- Ordering/matching reuse phase 06 native controls và stable IDs; click/tap là đường không-drag đầy đủ. Matching live riêng giữ `{promptId,targetId}` wire fields, không đổi thành quiz left/right hay display indices.
- Khi submit: mark pending, giữ draft, disable duplicate activation, đợi receipt; invalid không consume attempt và UI sửa được; wrong consume attempt theo server, terminal/reveal feedback theo policy phase 06, duplicate receipt không cộng score.
- Four corners card hiển thị known corners và chosen ID/receipt; reveal mới biết correctCorner/elimination. Relay card hiển thị team/lane/turn holder, non-holder không gửi answer; server expiry đổi baton một lần.
- Trivia card phân biệt rounds/buzz/lightning/jackpot; accepted buzz snapshot includes server-awarded buzzPoints (legacy/default10), independently of answer points. UI never adds a local delta; pending/winner lock and holder answer controls follow server consensus, explicit authored0 alone disables buzz award.
- Scatter card có categories/letter/deadline + bounded input per category; non-submitter thấy waiting, reveal hiển thị unique/duplicate/invalid/adjudicated results và team score server tính.
- Jeopardy host card select/wager/reveal/adjudicate gửi commands; board/usedCells/activeTeam/scores render từ snapshots, không apply local delta rồi apply socket lần hai.
- Countdown display dùng `performance.now()` anchored tới server timeRemainingMs và stateVersion; visibility/reconnect rehydrate, không decrement interval, không pause live deadline khi host leave slide.
- Local live-capable game dùng catalog local mode explicit và reducer phase 05; no HTTP/WS trên file. Classroom-local word/sorting/memory không được tạo live room vì có learner page.
- Resolve mode per capability: deck interactionVariables and bound classroom-local scoreboards remain presenter-document local even inside a live-enabled deck. Eligible live-game scores/deadlines remain authoritative/read-only when disconnected; variableId is never a game/player score key.
- Live audience join/reconnect/regeneration uses educationView audience04/public projection12 for all current/future/hidden config. Borrow scoped read-only observer transport rather than a host/learner scoring connection or local evaluator; inspect actual presentation-data/config payloads for secret markers and stable projected state.
- Hide/show preserve progress; local pending feedback/timer pause theo phase 04 remaining schedule, live callbacks không score; replay/destroy hủy subscriptions/capture/timers và old-generation pending commands.

## File inventory
CREATE paths proposed; modules production mới/split <200 LOC. Dependency outputs phải được scout trước MODIFY; integration owner độc quyền shared chokepoints trong checkpoint tuần tự.

| Full path | Action / fact | Ownership, size và test impact |
| --- | --- | --- |
| C:/Work/NavSlidesEditor/client/src/hooks/use-game-player.js | MODIFY / known :62-144 | Thin hook adapter/lifecycle, retain public consumer behavior; <200 LOC |
| C:/Work/NavSlidesEditor/client/src/hooks/use-game-socket.js | MODIFY / known :104-180 | Thin host/player/observer adapter, no duplicate generated host join; <200 LOC |
| C:/Work/NavSlidesEditor/client/src/pages/game-player-join-page.jsx | MODIFY / known :394-429 | Join/router + native presenter adapter; remove embedded moved card bodies; <200 LOC |
| C:/Work/NavSlidesEditor/client/src/components/education/game-player-shell.jsx | CREATE / proposed | Join/wait/final/error controls, no scoring rules; <200 LOC |
| C:/Work/NavSlidesEditor/client/src/components/education/live-player-adapter.jsx | CREATE / proposed | Mount shared DOM card with borrowed transport; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/live-player-state.js | CREATE / proposed | Shared receipt/hydration/generation reducer; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/game-connection.js | CREATE / proposed | Owned vs borrowed socket/listener lifecycle; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/game-session-storage.js | CREATE / proposed | Explicit storage/role/room scope; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/live-player-presenter.js | CREATE / proposed | Type routing/mount/destroy; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/live-four-corners-card.js | CREATE / proposed | Learner choices/receipt/reveal DOM; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/live-relay-card.js | CREATE / proposed | Team/turn/answer DOM; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/live-trivia-card.js | CREATE / proposed | Buzz/round/winner/typed answer DOM; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/live-scattergories-card.js | CREATE / proposed | Category form/reveal/validity DOM; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/live-poll-card.js | CREATE / proposed | Poll votes/accepted/public aggregate DOM; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/live-word-cloud-card.js | CREATE / proposed | Cloud bounded text/quota/clear DOM; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/live-matching-card.js | CREATE / proposed | Matching pair-ID click/tap/keyboard/reveal DOM; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/quiz-presenter.js | REUSE / proposed phase 06 output | Same seven-kind DOM controls, no learner-specific evaluator |
| C:/Work/NavSlidesEditor/shared/src/education/browser/live-host-bridge.js | REUSE/MODIFY / proposed phase 12 output | Working E/host event/snapshot bridge already qualified12;13 extends learner/observer UX, not first protocol wiring |
| C:/Work/NavSlidesEditor/shared/src/education/browser/live-transport.js | MODIFY / proposed phase 04 output | Integration owner, finalized phase 12 envelopes/subscriptions, no socket constructor for borrowed host |
| C:/Work/NavSlidesEditor/shared/src/education/browser/deadline-clock.js | MODIFY / proposed phase 04 output | Integration owner, anchor server remaining; <200 LOC |
| C:/Work/NavSlidesEditor/shared/src/education/browser/mount.js | MODIFY / proposed phase 04 output | Integration owner, inject borrowed transport/typed routes sequentially |
| C:/Work/NavSlidesEditor/shared/src/education/browser/runtime.css | MODIFY / proposed phase 04 output | Integration owner, standalone card focus/mobile styles |
| C:/Work/NavSlidesEditor/shared/src/live-presenter-game-runtime.js | MODIFY / known :106-146,254-282 | Integration owner, keep secure bootstrap/shortcuts, move cohesive bridge into bundle; <200 LOC target |
| C:/Work/NavSlidesEditor/shared/src/live-presenter-runtime.js | MODIFY / known :2,7 | Integration owner only if bridge injection call contract changes, not a second socket |
| C:/Work/NavSlidesEditor/client/src/pages/LiveViewPage.jsx | MODIFY / known :234-237 | Audience receives projected HTML and scoped read-only transport; no private normalization/local grading fallback |
| C:/Work/NavSlidesEditor/server/services/socket-handler.js | MODIFY / known :130-141 | Preserve atomic role-specific producer04/12 through audience reconnect/regeneration |
| C:/Work/NavSlidesEditor/shared/tests/education/live-player-state.test.js | CREATE / proposed | StateVersion/generation/receipt invariants, deterministic |
| C:/Work/NavSlidesEditor/client/src/components/education/live-player-controls.test.jsx | CREATE / proposed | DOM draft/focus/attempt/disabled state, not mock-emit echoes |
| C:/Work/NavSlidesEditor/client/src/hooks/use-game-player.test.js | MODIFY / known consumer :93 | Preserve/revise behavior contracts for typed question/lifecycle |
| C:/Work/NavSlidesEditor/client/src/hooks/use-game-socket.test.js | MODIFY / known consumer :67 | Ownership/lifecycle/state behavior; remove forwarding-only tests |
| C:/Work/NavSlidesEditor/client/src/pages/game-player-join-page.test.jsx | MODIFY / known | Existing direct join/name lifecycle retained |
| C:/Work/NavSlidesEditor/client/src/pages/game-player-matching-card.test.jsx | MODIFY / known | Cutover obsolete embedded MatchingCard import to real adapter, preserve interaction assertions |
| C:/Work/NavSlidesEditor/tests/e2e/live/education-four-corners-relay.spec.js | CREATE / proposed | Three independent contexts, both games; <=200 LOC |
| C:/Work/NavSlidesEditor/tests/e2e/live/education-trivia-scatter.spec.js | CREATE / proposed | Three contexts, buzz/uniqueness; <=200 LOC |
| C:/Work/NavSlidesEditor/tests/e2e/live/education-typed-quiz.spec.js | CREATE / proposed | Seven kinds + attempts/results, three contexts; <=200 LOC |
| C:/Work/NavSlidesEditor/tests/e2e/live/education-player-lifecycle.spec.js | CREATE / proposed | Reconnect/late/reset/stale + existing engagement; <=200 LOC |
| C:/Work/NavSlidesEditor/tests/e2e/games/education-live-local-file.spec.js | CREATE / proposed | Generated file honest local mode/no sockets; <=200 LOC |
| C:/Work/NavSlidesEditor/docs/system-architecture.md | MODIFY / known | Integration owner after smoke, socket ownership and live modes |
| C:/Work/NavSlidesEditor/docs/manual-smoke-checklist.md | MODIFY / known | Integration owner after smoke, actual three-context journey |
| C:/Work/NavSlidesEditor/docs/project-changelog.md | MODIFY / known | Integration owner after observed smoke receipts |

### Enumerated caller cutover
Current production consumers: `client/src/pages/game-player-join-page.jsx:429` calls useGamePlayer; `client/src/components/canvas/element-renderers/game-renderers/matching.jsx:17`, `poll.jsx:17`, `word-cloud.jsx:20`, `game-interactive/name-picker-interactive-game-renderer.jsx:404` call useGameSocket; `client/src/hooks/use-editor-game-leaderboard.js:17` legitimately uses observer; `game-renderers/jeopardy-interactive-board.jsx:15-21` dynamically loads/calls hook via gameSocketFn. These renderer paths are all under `client/src/components/canvas/element-renderers/`; re-enumerate after phase 05 replacement and remove only obsolete play consumers, not observer. Generated runtime consumer `shared/src/live-presenter-runtime.js:2,7` remains single bootstrap injection. Hooks tests useGamePlayer/useGameSocket have 12/10 callsites respectively in current grep; first listed examples `use-game-player.test.js:93,110,148,164,187,211,232,253,276,299`, `use-game-socket.test.js:67,87,111,132,165,187,226,263,286,306`; remaining player callsites :314,:336 must also migrate.

## Tests Before — RED scenarios
Tạo proposed tests trước commands; chưa có RED/GREEN execution evidence trong plan này.
- Actual generated host has one owned socket per game, mount/hide/show/reset không tạo host membership thứ hai; borrowed widget destroy không disconnect host owner hoặc observer.
- Three-context journeys: four corners correct/wrong/eliminate; relay holder/nonholder/wrong/expiry; trivia simultaneous buzz + allowed answer; scatter unique/duplicate/wrong-letter + host adjudication.
- Quiz seven kinds all submit through canonical payload; invalid draft không consume attempt, wrong allows authored retry, repeated attempt/generation-old result không đổi score. Images/neutral region keyboard path không lộ keys.
- Disconnect while pending, reconnect before/after deadline/reveal, late join and reset; every screen reflects same team/buzz/score and old result cannot replace new generation draft.
- Poll change vote policy/results, cloud quota/clear, Matching accepted/reveal late hydration retain server semantics; no local score fallback when connection drops.
- Button Space/form Enter produces one submit; native child control inside action wrapper does not fire deck action; select/radio arrows don't navigate Reveal; Tab exits game, hidden clues/keys absent before reveal.
- 320/768/desktop, hasTouch/reduced-motion: controls visible/targetable, keyboard focus survives accepted/result/reset, timers don't spam aria-live or jump on tab backgrounding.
- Mixed live game + local score variable/two bound boards: local boards update together while disconnected eligible game rejects mutation. Two inherited master roots plus vertical child keep distinct round/score/reset; audience HTML never contains current/future/private answer config.

## Implementation steps
1. Fresh scout transport ownership/callsites; create RED state/DOM/socket-browser scenarios with unique test rooms and three contexts, not three pages sharing storage.
2. Extract connection/session storage/state reducer; preserve player reconnect identity and host capability lifecycle, track roomInstance/generation/round/version before publishing state.
3. Thin use-game-player/use-game-socket adapters subscribe to same shared state; hook cleanup cancels pending bootstrap and listeners, owned connection disconnects once, borrowed connection releases subscription only.
4. Build complete four-game learner DOM cards and existing engagement cards; typed questions mount shared phase 06 presenter/controls, no React-only replacement or second evaluator.
5. REUSE completed host bridge12 and effective tuple mapping04/12; extend cards/observer rendering without recreating command/session protocol. Absolute snapshots include separate configured buzz/answer awards; remove old score mutations/parent polling after verified caller cutover.
6. Integration owner sequentially connects mount/live-transport/deadline-clock/runtime injection and styles; chain scoped Reveal keyboardCondition and preserve action phase 07 native-child exclusion, no blanket keyboard=false.
7. Run three-context generated host/learner journeys, force disconnect/reset/stale packets with real transport harness; compare scoreboard/turn/buzz on all screens and server receipts.
8. Run local generated file smoke, verify unsupported local-only types never invite phone play, then update docs/changelog with modes and receipts; normal Download closure remains phase 14 gate.

## Refactor
Xóa moved embedded page cards/hook duplicate listener/state code và obsolete play socket consumers sau cutover; không giữ exported MatchingCard shim chỉ để tests cũ import được. Poll/cloud/matching có ba DOM card modules riêng được inventory nêu rõ, mỗi module <200 LOC; không mở rộng generic component framework.

## Tests After — GREEN
Rerun đúng RED cases và existing hook/page behavior tests; full server authority suite không cần rerun project-wide giữa siblings. Permanent tests assert focus/state/score/transitions, không source text, labels wording, bare emit forwarding hoặc mocked result echoes.

## Behavior matrix
| Mức | Scenario | Kết quả quan sát |
| --- | --- | --- |
| Critical | Host + two learners, four games + seven quiz kinds | Complete submissions/results; all scores/team/buzz/turn agree |
| Critical | Late/disconnect/reconnect/reset/stale generation | Waiting read-only, correct hydration, no obsolete result/scoring |
| High | Single existing host socket + clean destruction | No duplicate membership/listeners, borrowed owner remains functional |
| High | Poll/cloud/Matching + public projection | Existing state preserved, no keys before reveal |
| Medium | Focus/mobile/keyboard/touch/reduced motion + file | Single activation, no Reveal conflict; local honest/no network |

## Executable focused commands
Chỉ implementation được chạy, CREATE tests trước, use built/staged runtime artifact từ integration owner. Các live specs match `chromium-live`, file spec match `chromium`; touch context được tạo trong spec.
```powershell
npx vitest run shared/tests/education/live-player-state.test.js client/src/components/education/live-player-controls.test.jsx client/src/hooks/use-game-player.test.js client/src/hooks/use-game-socket.test.js client/src/pages/game-player-join-page.test.jsx client/src/pages/game-player-matching-card.test.jsx
npm run vendor
$env:PLAYWRIGHT_USE_DEV_SERVERS='1'
npx playwright test tests/e2e/live/education-four-corners-relay.spec.js tests/e2e/live/education-trivia-scatter.spec.js tests/e2e/live/education-typed-quiz.spec.js tests/e2e/live/education-player-lifecycle.spec.js --project=chromium-live --workers=1
npx playwright test tests/e2e/games/education-live-local-file.spec.js --project=chromium --workers=1
```

## ACTUAL browser smoke journey
Author/save/reload/undo/duplicate deck, host mở actual generated `/api/presentations/{id}/present?live={roomCode}`. Tạo hai `browser.newContext()` độc lập và join learner URL lấy từ host, không hardcode inferred route; host assigns teams và completes từng four new livegame rồi quiz đủ seven kinds. Learner A correct, B wrong/late; race buzz, reject non-holder relay, identical Scatter word không unique bonus. Disconnect A trước/after submit, reconnect và late-join sau reveal; host replay/reset rồi stale command/result không đổi score mới. Đối chiếu scoreboard/turn/buzz cả ba screens, focus/mobile keyboard/touch và clock display. Mở hosted share/local Present không live query rồi `file://` network blocked; local gameplay/reset chạy và UI không giả hứa multiplayer. Lưu screenshot/trace/redacted receipts, không claim complete portable Download đến khi phase 14 closure xanh.

## Success criteria + unchecked actionable checklist
- [ ] Host + hai contexts hoàn thành bốn games/quiz, correct/wrong/late/reconnect/reset/stale, server-owned team/buzz/score agreement quan sát được.
- [ ] Existing Poll/WordCloud/Matching public state và late reveal vẫn hoạt động; không key leak hoặc local fallback sau disconnect.
- [ ] Generated runtime dùng single existing socket per host game; hooks/page split <200 LOC và mọi current consumers cutover không obsolete shim.
- [ ] Keyboard/touch/mobile focus, actual hosted/local/file modes có receipts; docs cập nhật sau smoke, không window.parent timer globals.

## Security/risks and failure protocol
High (cao × cao): host React hook tạo socket thứ hai cạnh bootstrap; mitigate borrowed ownership explicit + membership/browser check. High (vừa × cao): late event/receipt override generation mới; reducer reject room/generation/round/version mismatch, replay clears pending commands. High (vừa × cao): public UI đọc saved answerKey hoặc optimistic score; only public projection/server absolute score, kiểm hidden accessibility content. Medium (cao × vừa): timers/focus mất sau re-render/reconnect; monotonic display anchor, native controls và measured mobile smoke. Rollback: revert paired phase 13 client/runtime bridge cùng phase 12 protocol checkpoint hoặc giữ server contract compatible với shipped owned clients; kết thúc active rooms nếu rollback protocol, không local-scoring fallback hoặc resurrect stale session tokens. Facts chưa kiểm chứng: resulting phase 05 consumers và finalized internal transport signatures phải fresh scout; chưa có browser/AT receipts trong planning. Khi smoke sai, ghi context/room/generation/stateVersion và redacted payload/trace, dừng integration checkpoint, sửa lifecycle/auth root cause rồi rerun đúng journey, không mock server hoặc skip game type để ký hoàn tất.

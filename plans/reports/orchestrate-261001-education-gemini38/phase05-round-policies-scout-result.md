## Findings

**Preserve game-specific policies, not the generic socket quiz formula.** Current source has already corrected two stale phase-05 observations: Four Corners uses authored answer identity; Trivia reads authored rounds and `buzzPoints`. Neither change constitutes complete native playback.

Read-only scout completed using read/glob/grep. No edits, delegation, tests, browser, build, lint, formatting, or git. Runtime outcomes remain unverified; **Jeopardy double scoring remains unobserved**.

Citation prefixes:
- **GR** = `client/src/components/canvas/element-renderers/game-renderers/`
- **GI** = `client/src/components/canvas/element-renderers/game-interactive/`
- **E** = `shared/src/education/`
- **P05** = `plans/261001-0639-interactive-html-education-deep-tdd/phase-05-existing-games.md`

## Canonical configuration

All five have `title`. Nested subtype values override flat authored values before defaults; explicit zero survives. Canonical questions carry stable IDs, typed answer keys, points/time limits, feedback, and optional media. Runtime scores/transients are not authored policy.  
Evidence: `E/normalize-game-config.js:17-30`, `E/question-schema.js:5-16`, `E/game-config-projection.js:1-10,30-52`.

| Game | Config and defaults |
|---|---|
| Jeopardy | `teams[{id,name,color}]`, `categories[{id,title,questions}]`, `dailyDouble[cellId]`; `showTimer:true`, `timerDuration:30`, `negativePoints:false`, `wagerLimit:1000`. Cell IDs unique across categories; point values distinct within each category; DD references must resolve. |
| Four Corners | `questions`, `cornerCount:4` bounded 2–4, `eliminateMode:'wrong'|'none'`, `showTimer:true`, `timerDuration:30`. Single-choice only; option count must equal corner count. **No canonical players field.** |
| Relay | `teams`, `questions`, `questionsPerRound:4` bounded 1–1000, `shuffleTeams:true`, `passOnWrong:true`, `timerDuration:30`. |
| Trivia | `teams`, `questions`, `rounds[{id,name,mode,questionIds,timeLimit}]`; modes `individual|team|buzzer`, round limit 1–86400 integer seconds; `buzzPoints:10`, including explicit `0`; lightning `{enabled:false,timePerQ:10}`; jackpot `{enabled:false,multiplier:2}`. Round references must resolve and cannot repeat within a round. |
| Scatter | `teams`, `categories[{id,label}]`, `timePerRound:60`, `letterMode:'random'|'manual'`, `letter:'A'`, `scoring:'unique'|'all'`. Letter must normalize to one Unicode letter. |

Evidence: `E/game-registry.js:4-8`, `E/game-defaults.js:27-36`, `E/game-field-rules.js:1-10,24-33`, `E/game-question-validation.js:26-75`, `E/game-schema.js:23-30`.

## Present implementation versus intended migration

### Jeopardy

**Current policy**
- Scores keyed by **team ID**; used cells and lookup keyed by **canonical question/cell ID**, not category index or point string. Board rows use sorted distinct authored point values; absent cells remain empty.  
  `GR/jeopardy-interactive-board.jsx:25-45`; `GR/jeopardy-shared.js:4-21`; `GR/jeopardy-board.jsx:49-61,94-108`.
- Select team on board → select unused cell → optional DD wager → reveal → correct/wrong → delayed close. Selecting a used cell is rejected.
- Ordinary cells start the timer unless `showTimer === false`. Reveal stops it. Countdown reaching zero **does not adjudicate, consume, or close** the cell. DD wager submission selects the team but **does not start a timer**.  
  `GR/jeopardy-interactive-board.jsx:85-138,170-173`.
- Exact local score rule:  
  `max(0, oldScore + (correct ? stake : negativePoints ? -stake : 0))`, where stake is DD wager or authored cell points. Thus `negativePoints:true` permits deductions, **not negative totals**. `clamp0` is behavior, not a config field. No active team → close with no award.  
  `GR/jeopardy-interactive-board.jsx:156-167`.
- Wager initialization/team switch uses `min(teamScore, wagerLimit)`; allowed input range is **0 through `max(teamScore, wagerLimit)`**. Input uses integer parsing and clamping. `wagerLimit` is therefore not a hard ceiling when score exceeds it. Cancel leaves the cell unused.  
  `GR/jeopardy-wager-modal.jsx:3-12,31-35,62-68`; `GR/jeopardy-interactive-board.jsx:180-188`.
- Close—including manual return without an answer—marks the cell used, clears question/reveal/DD/wager/timer, and ends when **all actual lookup cells** are used. Adjudication schedules close after 800 ms. Local adjudication **does not advance the active team**; socket `answer-result` does rotate teams. Final control can end early; results sort teams by score.  
  `GR/jeopardy-interactive-board.jsx:49-65,140-167,210-232,254-262`.

**Intended:** one reducer adjudication source, accepted-action deduplication, complete replay, same wager/clamp/cell lifecycle. Do not introduce local auto-rotation or expiry deductions as “existing policy.”  
`P05:47-49,101,112`.

**Transport boundary:** local answer emits no `game-answer`. Server results are sent only to submitter and contain no `teamId`; the hook renames them to `answer-result`, whereas the React score branch requires `teamId`. This does **not** prove a double-scoring production sequence.  
`server/services/game-socket-handler.js:219-273`; `client/src/hooks/use-game-socket.js:236-238`; `GR/jeopardy-interactive-board.jsx:49-57,156-167`.

### Four Corners

**Current policy**
- Setup → randomly selected authored question → guessing → revealed → next round or ended.
- Correct corner derives from `answerKey.optionId` within current option order; corner order is **NW, NE, SE, SW**. No current `q.corner`/random-answer fallback.  
  `GI/four-corners-live-game-renderer-with-timer-scoring-leaderboard.jsx:8-13,102-117`.
- Manual reveal evaluates selected option identity; correct voter gets **+10**, irrespective of question points; wrong voter is eliminated only for `eliminateMode:'wrong'`. Identity is currently **player name**, not stable participant ID.
- Non-voters are not adjudicated. Winner is detected when the reveal eliminates exactly `playerCount − 1`, with more than one player. Starting another round clears votes/eliminations but retains scores.  
  Same file: `73-74,109-111,119-142`.
- **Missing reachable input:** vote state is only initialized/reset; corners are non-interactive divs. Canonical config contains no roster. Timer polling merely switches to `revealed`; it does **not call the scoring/elimination handler**. Revealed styling compares eliminated player names against corner IDs.  
  Same file: `73-98,119-142,165-193,201-216`.

**Intended:** named participant submission with stable identity, authored-option correctness, timer/manual reveal sharing one accepted adjudication, elimination per config, full replay restoring participants/rounds. Participant lifetime across rounds needs coordinator verification; current source explicitly clears elimination each round.  
`P05:102`.

### Relay

**Current policy**
- Positions are **team-array-indexed**, initially zero; active team starts at index 0. Setup start randomly chooses a question. `shuffleTeams` currently **resets positions**, rather than shuffling team order; round label remains 1.  
  `GI/relay-race-live-game-renderer-with-team-lanes-baton-pass.jsx:60-97`.
- Correct/wrong controls perform presenter adjudication; there is no learner answer form. Active → waiting for 1200 ms → movement/baton/question/timer update.
- Correct: active lane advances one, capped at `questionsPerRound`; active-team finish sets winner/ended and returns.
- Wrong with `passOnWrong:false`: no movement; baton moves to `(i+1)%N`.
- Wrong with `passOnWrong:true`: next lane advances one, capped at finish; next active team becomes `(i+2)%N`. For two teams, the original team becomes active again. For one team, “opponent” resolves to itself.  
  Same file: `99-146,208-226`.
- Timeout invokes wrong **only when `passOnWrong` is enabled**, polling parent state every 200 ms. Disabled policy has no automatic timeout transition.  
  Same file: `148-167`.
- **[INFERENCE] Opponent-finish risk:** wrong-pass branch sets ended inside a position updater, but execution then unconditionally selects another question, sets active, and restarts timer. Verify actual rendered terminal state before choosing the fix. Unlike correct finish, this branch has no terminal return. Zero teams are schema-permitted and need an explicit no-play outcome.  
  Same file: `123-145`; `E/game-question-validation.js:12-15`.

**Intended:** stable team-ID lanes, real answers, preserved movement/baton policy, bounded terminal outcome, accepted wrong/timeout once, full replay. Do not silently replace pass-on-wrong with ordinary baton rotation.  
`P05:103,115`.

### Trivia

**Current policy**
- Authored first round ID initializes selection; tabs use authored order/names; question IDs resolve against canonical questions. Authored rounds are **already consumed**.
- Modes affect buzzer visibility, but individual/team rounds have no answer progression. Round time limit is **displayed only**, not enforced.  
  `GI/trivia-championship-live-game-renderer-with-round-tabs-lightning-jackpot.jsx:97-109,167-199`.
- Buzz awards configured `buzzPoints` to **team ID**, synchronously locks with a ref, then unlocks after 2 s. Only the first authored team has a buzz button. Unlock permits another award without question advancement.
- Canonical normalization supplies default **10**; explicit **0** remains zero. Never use `buzzPoints || 10`.  
  Same file: `112-125,233-235`; `shared/tests/education-authoring-schema.test.js:32-36`.
- Lightning displays ×3, counts down `timePerQ`, then reveals. Question index is initialized/reset to zero but never advanced. Jackpot reveals the selected round’s first question and displays authored multiplier. **Neither currently awards answer points.**
- Lightning/jackpot flags can both become active; round changes do not clear these flags or buzzer state. End selects highest score; ties follow existing team order.  
  Same file: `27-36,47-64,69-91,127-142,187-195,223-242`.

**Intended:** enforce authored round/mode/time/question progression; accepted buzz award remains **distinct from correct-answer/lightning/jackpot awards**. Wrong answer must not erase an accepted buzz award; explicit zero enables answer-only scoring. Current ×3 text is not evidence of an implemented ×3 award.  
`P05:104,115`.

### Scattergories

**Current policy**
- Setup → spinning → playing → scoring. Spinner samples A–Z; manual letter policy is not consumed. Score Now enters review; deadline effect does likewise on a render with stopped/zero parent timer.  
  `GI/scattergories-live-game-renderer-with-letter-wheel-timer-unique-scoring.jsx:129-176,182-185`.
- Scoring expects **`answers[categoryId][teamId]`**. Within each category: `trim()` → discard empty → `toLowerCase()` → group. Exactly one team in a group gets **+10**; all teams sharing that normalized answer get zero.
- No NFC normalization, internal-space folding, punctuation removal, or letter check in scoring. Letter-prefix check is visual only. `scoring:'all'` is not consumed. Scores are recomputed for this review, not accumulated.  
  Same file: `36-44,67-101`.
- **Missing reachable answer input:** grid renders spans; unused answer handler writes category→string, inconsistent with scorer’s category→team→string structure.
- **New Round already exists:** clears letter, answers, score visibility, winner, and phase to setup. It does not cancel pending spinner/timeout or stop parent timer; there is no separate full replay/cumulative score state.  
  Same file: `178-194,242-279`.

**Intended:** editable category/team responses, manual/random letter behavior, preserved nonempty uniqueness semantics, deadline review, existing new-round reset plus generation-safe full replay. Do not claim reset was wholly absent or import fill-blank NFC behavior into legacy uniqueness without an explicit decision.  
`P05:105`.

## Server/runtime boundary

- These five currently have **neither implemented local nor implemented live capability**. Only name-picker is native-local; live bootstrap admits Hot Potato/Poll/Word Cloud/Matching. Native mount rejects other local types; Try launcher hides them.  
  `E/game-registry.js:22-27`; `E/browser/mount.js:17-27`; `server/services/presenter-game-bootstrap.js:8-12`; `client/src/components/education/game-try-launcher.jsx:6-12`.
- Legacy parent bridge forwards timer payloads unchanged. These React games send only `elementId`; current server requires `(effectiveSlideId, elementId)` and permits duration 1–7200 s. Legacy lookup also uses bare element ID, while current timer state uses tuple keys. Preserve the native transport boundary, **not parent polling**.  
  `client/src/pages/LiveViewPage.jsx:16-23,363-383`; `server/services/live-timer-handlers.js:34-49`; `E/effective-slide-identity.js:4-8`; `E/browser/live-host-commands.js:16-22`.
- Existing `runtime-session` owns generation-safe scheduling/reset; deadline clock handles monotonic expiry and local pause versus live continuation. Session dispatch itself does **not** supply accepted-command deduplication.  
  `E/runtime-session.js:16-19,27-33,58-83`; `E/browser/deadline-clock.js:10-45`.
- Server quiz scoring is player/question-based with speed bonus and duplicate receipts—not Jeopardy, corner, baton, buzz, or uniqueness policy.  
  `server/services/game-room-manager-singleton-service.js:565-639`.

## Retain, cut over, preserve tests

**Retain static consumers**
- `GR/jeopardy-renderer.jsx:7-25` → inert `JeopardyBoard`; keep authored point rows/DD identity helpers.
- Static tails of `GR/four-corners.jsx:15-43`, `relay-race.jsx:15-25`, `trivia-champ.jsx:15-33`, `scattergories.jsx:15-46`.
- Shared printable snapshots: `E/static-game-content.js:9-21`; generated root/static/UI structure: `shared/src/element-renderers.js:903-916`.

**Remove after equivalent native cutover**
- Four wrappers’ lazy play branches/imports at `:2-13`.
- Four cached getters in `GR/shared.jsx:5-24`.
- `GR/jeopardy-renderer.jsx:3,29-30` interactive import/branch; five obsolete play implementations.
- Fresh search found only play consumers for wager/score/presenter helpers; question modal also has tests. Migrate behavior assertions before retiring helpers.
- Do not delete `shared.jsx` wholesale: name-picker loading and Poll/Cloud/Matching connection helpers remain consumers. Update obsolete path entries in `client/src/utils/tailwind-inline-style-audit.test.js:53-56,110-114`.

**Behavior assertions worth retaining/migrating**
- Jeopardy zero-floor then +200: `GR/jeopardy-interactive-board.test.jsx:35-79`—does not cover funded deduction, DD, duplicate scoring, or terminal lifecycle.
- Cell selection/DD identity after category movement; reordered canonical answer/media/explanation across question kinds: `GR/canonical-consumers.test.jsx:12-35`.
- Authored Trivia/zero buzz, canonical jackpot reveal, reordered Four Corners correctness: `GI/canonical-readers.test.jsx:13-29,44-55`.
- Keyboard team selection/cell opening: `client/src/components/primary-interaction-semantics.test.jsx:43-77`.
- Persistence/domain/authoring contracts: `shared/tests/education-game-domain.test.js:13-89`, `education-trivia-defaults.test.js:7-29`; `client/src/components/properties/game-authoring-identity.test.jsx:46-70`, `game-authoring-settings.test.jsx:37-75`.
- Generation/clock and real socket contracts remain independent safeguards: `shared/tests/education-runtime-session.test.js:28-110`; `server/services/game-canonical-question-socket.test.js:60-163`.

No dedicated Relay or Scatter scoring-transition suite surfaced in the scoped searches.

## Limited module boundaries

Proposed boundaries only; coordinator owns shared integration and verification:

- `games/jeopardy.js`: lifecycle/adjudication; separate `jeopardy-wager.js` for exact bounds. DOM board and question/wager controls split.
- `games/four-corners.js`: participant selections, accepted reveal, score/elimination state; one input/review presenter.
- `games/relay-race.js`: ID-keyed lanes, baton policy, terminal transition; presenter handles lanes and actual answer controls.
- `games/trivia-champ.js`: authored round/question progression; `trivia-score-policy.js` separates buzz and answer award identities. Presenter round/answer controls separate from bonus displays.
- `games/scattergories.js`: letter/response/review/reset lifecycle; `scattergories-scoring.js` preserves category-local normalization. Presenter owns team/category forms.

Keep each module below 200 LOC. Reuse existing evaluator/session/deadline APIs; no second timer or generic scoring authority. Accepted award keys need generation plus cell/round/question/team identity; buzz and answer must use different award identities (`P05:47,104,130`).

**Coordinator decisions requiring receipts:** Relay opponent finish and disabled-policy timeout; Four Corners participant/elimination lifetime; Scatter `all` scoring and letter eligibility; Trivia answer-bonus arithmetic. Source above establishes current behavior and gaps, not reproduced runtime failures.
## Findings

**Preserve four different submission policies—not one generic quiz reducer.** HotPotato awards once per player/question; Poll replaces one vote per participant; WordCloud counts every accepted submission, including repeated phrases; Matching replaces a participant’s scored mapping without adding leaderboard points.

Read-only source inspection completed. No edits, delegation, tests, builds, browser, or git commands.

### Canonical configuration

| Game | Config and defaults | Validation |
|---|---|---|
| HotPotato | `title`, canonical `questions`, `allowLate:false`, `showLeaderboard:true`, `shuffleQuestions:false`. Default question: single-choice, 10 points, 30 seconds. | HotPotato points must be integer `1..1000`. Question deadline is `null` or finite `5..300` seconds, including fractions. Local schema permits all seven canonical question kinds; current **live** admission explicitly requires single-choice. |
| Poll | `title`, `prompt`, stable-ID `options`, `showResults:true`, `allowVoteChange:true`, `timerDuration:30`. | `2..6` uniquely identified options; optional safe media. |
| WordCloud | `title`, `prompt`, `maxPhraseLength:40`, `maxSubmissionsPerPlayer:5`, `displayLimit:50`, `timerDuration:30`. | Integer limits: phrase `1..40`, submissions `1..5`, display `1..50`. |
| Matching | `title`, `prompt`, `pairs[{promptId,prompt,targetId,target}]`, `timerDuration:60`. | `2..8` pairs; unique prompt IDs and unique target IDs; optional `promptMedia`/`targetMedia`. No authored points or attempt-limit field. |

Evidence: `shared/src/education/game-defaults.js:9-13,26,37-40`; `shared/src/education/game-schema.js:15-18,33`; `shared/src/education/game-field-rules.js:1,5,11-13`; `shared/src/education/game-content-validation.js:15-40`; `shared/src/education/question-shape.js:3-7,57-59`; `server/services/game-room-manager-singleton-service.js:130-146`.

Nested subtype config overrides flat authored values before defaults fill missing fields. Runtime state is stripped from persisted config; do not store votes, answers, mappings, deadlines, or scores back into the element.  
`shared/src/education/normalize-game-config.js:17-31`; `shared/src/education/game-config-projection.js:2-13,26-50`.

## Exact submission policies

### HotPotato

**Scoring and timing**

Let `B = question.points`, `L = timeLimit × 1000`, and `E = max(0, serverNow − questionStartedAt)`:

- Wrong accepted answer: **0 points**, but consumes the player/question answer.
- Correct untimed answer: **B**.
- Correct timed answer:  
  `B + round(max(0, L − min(E,L)) / L × B)`.
- Thus immediate correct = `2B`; exact deadline = `B`; allowed late correct = `B`.
- With `allowLate:false`, expiry rejection is strictly **`E > L`**, not `>=`.
- Client `timeSpentMs` never determines scoring. If supplied, it must nevertheless be a finite, nonnegative number.
- Expired or invalid first answers do not consume an answer or change score.

**Validation/duplicate precedence**

Session → active question lookup → required question ID → supplied timing validation → valid start timestamp → existing answer → expiry → answer-index validation → evaluator.

Consequences:

- An existing answer returns its original correctness, selected/correct option IDs, awarded points, and current total score—even after expiry or when the repeated answer index changes.
- Invalid supplied timing still fails **before** duplicate recovery.
- A stale question ID fails before duplicate recovery.
- Duplicate handling does not award again.

Evidence: `server/services/game-room-manager-singleton-service.js:565-638`.

**Question lifecycle and transport**

- Room starts at question index `-1`; `nextQuestion` advances sequentially, sets start time, and activates the room. Advancing beyond the final question ends the game.
- Live answers still send `questionId` plus **display `answerIndex`**. Server resolves that index to a stable option ID and calls `evaluateAnswer`.
- Answer receipts go only to the submitter; new accepted answers broadcast the full leaderboard. Duplicate receipts do not rebroadcast a score delta.
- Leaderboard sorts descending by score.
- `shuffleQuestions` is authored/stored, but current server progression does not shuffle.

Evidence: `server/services/game-room-manager-singleton-service.js:166-169,608-618,675-719`; `server/services/game-socket-handler.js:220-271,485-515`; `client/src/hooks/use-game-player.js:108-120`.

**State/commands needed:** question-ID order, current question, round timing, participant identities, scores, per-participant/question receipts; start/next, typed answer submission, end, replay. Local answers must use canonical payloads and the existing evaluator rather than copying live’s single-choice-only restriction.

### Poll

- Requires an active room, existing participant, valid session, and exact configured option ID.
- Storage is `playerId → optionId`; another accepted vote **replaces** the previous vote.
- Same-option resubmission leaves aggregate counts unchanged.
- Total votes counts participant identities, not submissions.
- No answer-history entry, correctness, points, bonus, or authored `maxSubmissions`.
- Disconnect preserves the vote; explicit leave removes it.
- Start activates without clearing votes. Reveal only emits the current aggregate; it does not close voting or create a revealed phase.
- **Current live behavior ignores `allowVoteChange` and `showResults`.** Its normalized poll state retains only prompt/options, and every accepted vote broadcasts results. Local phase05 must honor the authored flags without silently changing preserved live semantics.

Evidence: `server/services/game-room-manager-singleton-service.js:216-261,736-763`; `server/services/game-socket-handler.js:274-327`.

**State/commands needed:** participant-ID votes, aggregate, active/result-visibility state, timer; start, vote, reveal, replay. `allowVoteChange:false` is an accepted local requirement, not an existing enforced server policy.

### WordCloud

Normalization is exactly:

```text
String(text || '')
→ NFKC
→ trim
→ collapse /\s+/g to one space
→ locale-independent lowercase
→ slice(0, maxPhraseLength)
```

- Truncation happens **after lowercase expansion**, using JavaScript UTF-16 string slicing—not grapheme count.
- Empty normalized text is rejected before consuming quota.
- Every accepted submission increments both participant quota and phrase count. Repeated normalized phrases, including from the same participant, are valid submissions.
- Quota is per stable participant ID. Explicit leave/rejoin does **not** restore quota or remove their accumulated words.
- Entries sort by count descending, then deterministic text comparison ascending; only displayed entries are capped. `totalSubmissions` includes all counts.
- Clear empties counts **and** participant quotas.
- Start only activates; reveal refreshes the aggregate. Neither clears existing submissions.
- No answer history or score.

Evidence: `server/services/game-room-manager-singleton-service.js:270-336,736-752`; `server/services/game-socket-handler.js:330-402`.

**State/commands needed:** normalized phrase counts, participant quotas, aggregate, active state, timer; start, submit phrase, reveal/refresh, clear, replay. Command deduplication must distinguish a repeated delivery of one action from a deliberately new submission of the same phrase.

**Existing learner mismatch:** React hardcodes 40 characters/5 submissions and displays only 20 entries. Its counter resets on `started`, whereas server start preserves quota; accepted events increment the counter, but aggregate clear does not reset it. Do not copy that counter as authoritative state.  
`client/src/pages/game-player-join-page.jsx:169-210`; `client/src/hooks/use-game-player.js:260-275`.

### Matching

- Public targets are deterministically rotated left by one—not randomly shuffled.
- Each supplied pair is normalized to string IDs. Unknown IDs, repeated prompt IDs, or repeated target IDs reject the whole submission.
- **Server accepts incomplete mappings and even `[]`.** There is no completeness guard.
- Score is the number of supplied pairs whose exact `promptId → targetId` equals the authored mapping; `total` is the authored pair count; `correct = score === total`.
- Submission order and display labels do not affect equality.
- A later valid submission **replaces** that participant’s stored mapping/result. Submission count remains the number of participant identities.
- It does not increment `player.score` or append answer history. Do not turn `score/total` into cumulative quiz points.
- Reveal persists in public state and late-join hydration; submission remains possible after reveal.
- Start clears submissions, hides the answer key, and reactivates the room, including after end. Target order remains unchanged.
- Explicit leave removes that participant’s submission; disconnect preserves it.

Evidence: `server/services/game-room-manager-singleton-service.js:361-453,736-763`; `server/services/game-socket-handler.js:405-465`.

**Important evaluator boundary:** canonical **question-kind** matching requires complete one-to-one `{leftId,rightId}` pairs and returns Boolean correctness. Existing **game-subtype** Matching uses `{promptId,targetId}`, permits partial submissions, and returns a correct-pair count. Applying the question validator directly would change accepted live behavior.  
`shared/src/education/question-answer-payload.js:23-36,68-70`; `shared/src/education/answer-evaluator.js:35-36`.

**State/commands needed:** selected prompt, draft stable-ID mapping, target order, per-participant accepted mapping/result, reveal state, timer; start, select/assign, submit, reveal, replay. React’s complete-only submit button and used-target disabling are useful presenter behavior, not proof that server rejects partial mappings.  
`client/src/pages/game-player-join-page.jsx:233-306`.

## Consumer cutover and preserved-live risks

- **Four React branches:** imports/dispatch in `client/src/components/canvas/element-renderers/game-element-renderer.jsx:16,22-24,49-66`. Preserve inert previews; remove presenting socket branches from `poll.jsx:4-24,49-65`, `word-cloud.jsx:4-26,58-81`, and `matching.jsx:4-23,60-85` after DOM equivalents are reachable.
- HotPotato React only displays question one and media; it has no play reducer. Generic START/SPIN is also inert—no click handler.  
  `client/src/components/canvas/element-renderers/game-renderers/hot-potato.jsx:2-17`; `client/src/components/canvas/element-renderers/game-renderers/game-controls.jsx:3-32`.
- **Shared mount is the integration chokepoint:** currently rejects every local subtype except NamePicker and selects only its reducer/presenter. Catalog likewise advertises only NamePicker local capability.  
  `shared/src/education/browser/mount.js:27-42`; `shared/src/education/game-registry.js:22-28`.
- Native Try already mounts that shared surface; generated game HTML already emits config/static/UI roots. No second React playback path is needed.  
  `client/src/components/education/native-game-try-adapter.jsx:10-26,31-35`; `shared/src/element-renderers.js:903-916`.
- **Do not delete live hooks/player page:** `use-game-socket` still has an editor-observer consumer; `use-game-player` and the learner page consume these four protocols.  
  `client/src/hooks/use-editor-game-leaderboard.js:17-20`; `client/src/pages/game-player-join-page.jsx:432-435,495-528`.
- **Native live event mismatch:** `live-host-session.js` subscribes to `game-poll-state`, `game-word-cloud-state`, and `game-matching-state`; server emits `*-started`/`*-results`. Those `*-state` names had no producer in searched client/shared/server source. It also stores the whole `game-question` envelope under `state.question`, while presenters read that slot as a question object. These are source-established contract mismatches; resulting UI failure remains **[INFERENCE]**, not browser-reproduced.  
  `shared/src/education/browser/live-host-session.js:32-35`; `shared/src/education/browser/live-host-presenter.js:28-30`; `shared/src/education/browser/live-transport.js:11-14`; `server/services/game-socket-handler.js:117-122,313,369,450`.
- Native host controls currently omit WordCloud clear, and its host-command map has no clear action. Preserve that existing live control during cutover.  
  `shared/src/education/browser/live-host-presenter.js:2-6`; `shared/src/education/browser/live-host-commands.js:1-6`.

Keep live transport authorization/redaction intact: required room/session/question identity, host capability checks, submitter-only HotPotato receipts, aggregate-only Poll/Cloud state, and Matching answer-key release only through reveal. Live snapshots replace state; they must not trigger local awards.  
`server/services/game-socket-handler.js:108-143,220-293,423-465`; `server/services/game-room-manager-singleton-service.js:370-388`.

## Useful existing behavioral tests

All below were **read, not executed**:

- `server/services/game-canonical-question-socket.test.js:57-173`: real sockets; stable-ID grading after reorder, invalid answers without consumption, original duplicate receipt, own-only reconnect hydration, host recovery, exact speed/expiry precedence, fractional deadline, late bounds, admission rejection.
- `server/services/game-engine-singleton-room-management-join-leave-answer-scoring-random-picker-leaderboard-cleanup.test.js:410-630`: Poll replacement/reconnect/inactive rejection; Cloud normalization, truncation, quota persistence, lowercase expansion, sorting, clear.
- Same file `:634-712`: Matching full/partial/wrong scores, stale/invalid/duplicate IDs, rotated targets, reveal redaction.
- `server/services/game-socket-end-to-end.test.js:777-1071`: actual Poll/Cloud/Matching start, submit, authorization, room binding, aggregate delivery, leave/clear, late hydration/reveal.
- `server/services/game-matching-reveal-persistence.test.js:50-131`: mocked socket harness—not real multiplayer proof; retained reveal and restart clearing.
- `shared/tests/answer-evaluator.test.js:6-62`: seven-kind correctness, reorder invariance, malformed/incomplete matching rejection.
- `client/src/pages/game-player-matching-card.test.jsx:19-65`: click mapping, label-based reveal display, duplicate-target prevention. Preserve while learner page remains; port behaviors if that consumer migrates.
- `shared/tests/education-runtime-session.test.js:29-124`: root isolation, immutable snapshots, replay/stale-callback invalidation, local pause, live continuing deadline, restart/destroy cancellation.

## Proposed interfaces — each module under 200 LOC

```js
createHotPotatoState(config, inputs)
reduceHotPotato(config, state, command, inputs)
// Corresponding factory/reducer for Poll, WordCloud, Matching.

presentHotPotato({ root, config, session, reset, clock, random })
// Corresponding native presenter:
// { render(state), pause(), resume() }
```

- Follow existing factory/reducer and `{render}` presenter conventions; keep immutable config separate from plain-object session state.
- `inputs` supplies monotonic timing and injected randomness; HotPotato uses `evaluateAnswer` and its own bonus policy. Matching retains its explicit correct-pair-count policy.
- Commands carry generation, participant identity, applicable question/round identity, and action identity. **Existing session guards generation but has no accepted-command ledger**; game reducers must provide semantic duplicate handling. Do not impose an invented attempt limit on Poll, Cloud, or Matching.
- Reuse `createRuntimeSession` for owned listeners, pending work, replay, and teardown; reuse `node/listen/button` for text-safe, generation-bound native controls.  
  `shared/src/education/runtime-session.js:11-20,35-63`; `shared/src/education/browser/dom.js:1-15`.
- Own/destroy each `createDeadlineClock` through the session. Coordinator must forward presenter pause/resume: current mount pauses session-scheduled callbacks, **not a separately created deadline clock**. Preserve local remaining time and live continuation.  
  `shared/src/education/browser/deadline-clock.js:6-58`; `shared/src/education/browser/mount.js:61-66`.
- Exact HotPotato deadline equality and `allowLate` must remain submission-policy decisions, not be replaced by a blanket “expired means reject” UI flag.
- Local presenters provide participant identity plus actual answer/vote/text/mapping forms, results, and replay. Live presenters emit transport commands only and render authoritative receipts/snapshots.

Coordinator owns mount/catalog/generated-entry wiring, live event projection, clock lifecycle forwarding, and consumer/test cutover. No fallback or additional product policy is proposed.
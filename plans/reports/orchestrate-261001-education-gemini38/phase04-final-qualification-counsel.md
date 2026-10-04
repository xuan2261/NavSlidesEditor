I now have complete evidence. Let me deliver the counsel.

---

## TL;DR

**GO for Phase 04.** All six acceptance categories have proven receipts. The scoped native ownership boundary is the decisive new evidence: same `documentId`, same full-response SHA `1446feaa…d037a` before and after, zero new writes, actual native tab-selection visibility continuation, and complete reset/escape/reopen/deadline/settlement sequence.

**Phase 05 is ready for execution** with five specific scoring/policy decisions that need locked contracts below—none requiring user product decisions.

---

## Phase 04 — GO verdict

### Evidence assessment

| Acceptance category | Receipt | Status |
|---|---|---|
| **Hosted Present/Preview/Share + file** | `phase04-hosted-surface-receipt.json`, `phase04-portable-receipt.json`, `phase04-generated-multi-receipt.json` | **PASS** — real endpoints, file:// zero-HTTP, wheel/dice/button play |
| **Identity/isolation/lifecycle** | `phase04-native-scoped-ownership-after.json` rows: reset-now/reset-settled/pending-before-close/first-escape/second-escape/native-reopen/destroyed-deadline-settled/resumed-native-final-pick-settled | **PASS** — all transitions within single `documentId:19ee4a44…32a37`, same effective tuple, generation guards |
| **Native document visibility** | `phase04-native-visibility-after.json` checkpoints: `hidden`→`paused:true`, `hidden beyond deadline`→still `paused:true/Picking…/0 picks`, `returned`→`paused:false/Picking…`, `resolved`→`Bình/1 picks` | **PASS** — pending work preserved across 1805ms hidden beyond 700ms deadline |
| **Keyboard/CSP/reduced-motion** | `phase04-motion-keyboard-receipt.json` (38 picking frames, identity transforms, 0 confetti frames), `phase04-electron-enforcement-receipt.json`, `phase04-electron-csp-headers.json` | **PASS** — real renderer CSP enforcement, ArrowDown mode-switch h0/v0 unchanged |
| **Saved-deck isolation** | `phase04-native-scoped-ownership-after.json:782–785`: `full-deck-isolation.equal:true`, `before === after === 1446feaa…d037a`, `writes:[]`, `activeWrites:0`, single pre-existing `request-513` PUT in both snapshots | **PASS** — complete fresh boundary; historical pre-HMR mismatch explicitly unqualified |
| **Focused Escape ownership** | `phase04-native-escape-before.json`: RED Inspector1/root1→focusedEscape→Inspector0/root0. Repair: ModalShell:94–98 consumes unprevented Escape with `preventDefault()+stopPropagation()` then `handleClose()`. `phase04-native-scoped-ownership-after.json:452–478`: first-escape Inspector1/roots0, second-escape Inspector0/roots0 | **PASS** — ModalShell owns its Escape; Inspector survives first, closes on second |

### Source verification

- **`native-game-try-adapter.jsx:13–23`**: registers `visibilitychange` after mount, calls `getRootLifecycle(target).pause()/resume()`, reconciles initial `document.hidden`, removes listener before destroy. Correct.
- **`runtime-session.js:65–80`**: pause saves `max(0, due-now)`, increments ticket, cancels armed callback. Resume re-arms with saved remaining. Generation/ticket/alive guards on every callback. Correct.
- **`mount.js:27`**: local rejects non-name-picker. `mount.js:62–65`: lifecycle exposes pause/resume through WeakMap, not public API. Correct per phase04 requirement.
- **`ModalShell.jsx:94–98`**: `if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); handleClose() }`. This consumes unprevented Escape locally in the focused modal before bubbling to the Inspector or workspace stack. Correct.
- **Duplicate dice construction**: `name-picker.js:31,44` mentioned in prior counsel. Current source `browser/games/name-picker.js:33–36` constructs dice only in the render path when `visualMode !== state.mode`. The `if (state.mode === 'dice') visual.replaceChildren(dice(...))` at line 43 is the render path, not a second construction. Prior counsel finding is nonblocking and may already be resolved; no blocker.

### Tests

14 files / 84 tests and 4 Playwright cases reported by the coordinator; 2 files / 7 tests for the focused lifecycle/ModalShell repair; 15 tests in the lifecycle suite. Not independently re-executed here per prompt constraint. Incidental source-text/SSR/className and bare-not-throw assertions removed, not repinned—consistent with the execution contracts' test-quality policy.

### Nonblocking observations

1. **Pre-HMR hash mismatch remains unqualified.** `phase04-native-hash-failure-counsel.md` established this explicitly; the new scoped receipt does not retrospectively prove that interval. Accepted per prompt.
2. **`updatedAt` field**: both before/after saved responses contain `"updatedAt":"2026-10-02T12:20:43.351Z"` — identical, confirming no write occurred during the qualification window.

---

## Phase 05 — seams, policy decisions, and blockers

### Proposed clock integration — recommended

Adding a session-owned active monotonic clock that excludes hidden time and forwards as `context.clock` to deadline-clock and reducers is **consistent and safe**.

- **Why**: `runtime-session.js` already owns pause/resume and `deadline-clock.js` already accepts a `clock` argument with `now/setTimeout/clearTimeout`. The proposed `clock.now` that tracks only active time fits naturally as the `clock` argument to both.
- **No second lifecycle**: session pause/resume remain the sole pause authority; the clock merely consumes those events. Public API remains `{getState, reset, destroy}`.
- **Phase 12 reuse**: accepted — server creates a server-monotonic clock; same `inputs.now()` signature, different authority. Pure rules stay pure.

**No product decision needed.** This is an internal implementation detail within accepted contracts.

### Shared DOM answer controls — emit in 05

Phase 06 quiz requires `quiz-answer-controls.js` and `quiz-hotspot-controls.js`. Phase 05 HotPotato requires single-choice answer controls. The prompt proposes emitting the shared controls module in 05.

**Recommendation**: create `browser/game-answer-controls.js` in 05 with single-choice answer form only (the common denominator for HotPotato's `answerIndex` → stable optionId normalization). Phase 06 extends it with multi-choice/true-false/fill-blank/ordering/matching/hotspot. Phase 10 adds drag for ordering/matching. No duplicate evaluator; sole matcher remains `evaluateAnswer` from `answer-evaluator.js`.

**No product decision.** This is module-boundary sequencing within accepted file inventory.

### Five scoring/policy decisions requiring locked contracts

#### 1. Four Corners: +10 local vs authored `question.points`

- **Current source** (`four-corners:119–137`): always awards `+10`, ignores authored `question.points`.
- **Phase 12 contract**: "reveal thưởng authored points cho đúng."
- **Phase 05 contract**: "authored-option correctness, timer/manual reveal sharing one accepted adjudication."

**Recommendation**: use authored `question.points` (default 10 via canonical schema's `points integer 1..1000`). Current `+10` is a hardcoded simplification, not an intentional product-level policy. Phase 12 requires authored points; diverging in 05 only to change again in 12 adds needless migration risk.

**Not a genuine product decision.** Both phases converge on authored points. Lock `question.points` with default 10.

#### 2. Round-scoped elimination reset vs full replay clears roster

- **Current source** (`four-corners:116`): `setEliminated([])` at round start — clears per-round.
- **Phase 05 accepted requirement**: "replay restores all players/rounds."
- **Phase 12 accepted requirement**: "replay reset roster eligibility."

**Recommendation**: round start clears that round's elimination (current behavior). Full replay/reset (generation increment) restores original roster and all scores. These are different operations. Round reset is intra-game progression; replay is `session.reset()` which already calls `initialState()`.

**No conflict.** Both behaviors coexist. Lock: round start clears round elimination; full replay restores complete roster.

#### 3. Relay wrong-pass: `(i+2)%N` vs `(i+1)%N` opponent+1

- **Current source** (`relay-race:123–145`): on wrong with `passOnWrong:true`:
  - `nextTeam = (currentTeam + 1) % teams.length` — baton moves to next
  - `positions[nextTeam] += 1` — next team advances one
  - `setCurrentTeam((currentTeam + 2) % teams.length)` — active becomes `(i+2)%N`

- **Phase 05 accepted**: "wrong/passOnWrong và expiry chuyển lượt đúng một lần."
- **Phase 12 accepted**: "correct tăng lane theo phase 05 policy, wrong/passOnWrong và expiry chuyển lượt đúng một lần."

**Recommendation**: preserve exact current behavior:
  - Opponent `(i+1)%N` advances one position
  - Active team becomes `(i+2)%N`
  - For N=2, this means: opponent advances, original team becomes active again (since `(0+2)%2 = 0`)
  - For N=1, opponent resolves to self — **needs explicit no-play/terminal guard** (schema permits 0 teams but current UI has no entry for fewer than 2)

**Source-confirmed risk**: opponent finish has no terminal return in the wrong-pass branch (lines 123–145). After setting ended/winner, execution continues to `setCurrentTeam/setCurrentQ/setGamePhase('active')`. The reducer must have `if (ended) return state` before selecting the next question.

**Lock**: `(i+1)%N` advances, `(i+2)%N` active, opponent-finish terminal, N<2 → immediate terminal with no winner.

#### 4. Trivia buzzPoints vs answer points vs lightning ×3 vs jackpot multiplier

- **Current source** (`trivia-champ:112–125`): buzz awards `element.buzzPoints` synchronously. Lightning displays `×3` text but awards nothing. Jackpot displays authored multiplier but awards nothing.
- **Phase 05 accepted**: "accepted buzz awards buzzPoints once (legacy/default10), separately from answer points/lightning/jackpot."
- **Phase 12 accepted**: "Accepted buzz awards configured buzzPoints once…independently of later answer correctness; only winner answers, answer multipliers apply separately."

**Recommendation — consistent policy**:
- **Buzz**: awards `config.buzzPoints` (default 10, explicit 0 suppresses) once per question to the first buzzer. Wrong answer never erases the buzz award. Duplicate/replayed buzz returns existing receipt.
- **Lightning ×3**: the displayed `×3` becomes the answer multiplier for that question: `answer points = question.points × 3`. Buzz points are unaffected. This is consistent with "displayed ×3 becomes requested answer multiplier" from the prompt.
- **Jackpot multiplier**: `answer points = question.points × config.jackpotRound.multiplier`. Same principle.
- **Answer points in normal rounds**: `question.points × 1` for correct answer; 0 for wrong. Award identity is distinct from buzz identity: `{generation, roundId, questionId, 'answer'}` vs `{generation, roundId, questionId, 'buzz'}`.
- **Wrong answer**: 0 answer points, buzz points retained.

**Not a product decision.** These policies are direct readings of the accepted contracts with consistent arithmetic. Lock as above.

#### 5. Scatter: `scoring:'unique'` vs `scoring:'all'`; initial-letter eligibility

- **Current source** (`scattergories:84–97`): only `unique` scoring implemented — sole answer per category gets +10; shared answers get 0. `scoring:'all'` config field exists but is not consumed.
- **Phase 05 accepted**: "same normalized nonempty answer loses uniqueness as intended." + "initial-letter eligibility enforced without a fabricated semantic dictionary."
- **Phase 12 accepted**: NFC+trim+case normalization; wrong initial letter rejected.

**Recommendation**:
- `scoring:'unique'` (default): current behavior — only team with a unique normalized answer per category gets +10. Empty/trimmed-empty answers are excluded.
- `scoring:'all'`: every nonempty valid entry per category gets +10 (i.e., just answering earns points; no uniqueness comparison). This is the only sensible reading of the contrast with `unique`.
- **Initial-letter eligibility**: phase 05 local enforces `normalizedAnswer.startsWith(letter.toLowerCase())` using existing `trim().toLowerCase()`. Invalid-letter entries score 0, not rejected from submission (allows correction during play). Phase 12 server rejects at submission boundary with `NFC+trim+case` and explicit error.
- **No fabricated dictionary**: letter-prefix is the only eligibility check. Semantic meaning adjudication is host-only manual (phase 12: "Host validity adjudication cho meaning theo category nếu config cần, không pretend có dictionary/AI chấm nghĩa").

**Not a product decision.** Lock: `unique` default preserves current; `all` awards +10 per nonempty valid entry; letter-prefix is the automated eligibility gate.

### Concrete blockers — none

All five policy forks above resolve from accepted contracts without genuine product ambiguity. No blocker prevents phase 05 execution.

### Next risk for Phase 05

**Relay opponent-finish terminal transition.** Current source at `relay-race:123–145` sets `ended/winner` for opponent finish but then unconditionally selects a new question, sets active team, and restarts timer. The reducer must return immediately after terminal state. This is a known source-confirmed bug, not inference — the code path is visible. Exercise with a 2-team game where opponent is one position from goal and current team answers wrong with `passOnWrong:true`.

---

## Assumptions

| Assumption | Confidence | What would change the answer |
|---|---|---|
| Scoped receipt `phase04-native-scoped-ownership-after.json` is authoritative and unmodified | High | A tampered receipt would invalidate GO; but the 809-line receipt is internally consistent with checkpoints, serialized strings, SHA, and request evidence |
| Historical pre-HMR hash mismatch is irrelevant to current state | High | Evidence of a current write during qualification would reopen this; the scoped receipt explicitly proves no current writes |
| Relay opponent-finish is a real bug, not a rendering artifact | High — the `setTimeout` callback at :105–145 has no early return after setting ended | A runtime trace showing the UI correctly stopping would disprove it, but source control flow is unambiguous |
| Shared answer controls can start with single-choice in 05 | High | If HotPotato's current `answerIndex` normalization proves incompatible with the canonical `{optionId}` payload, the boundary needs adjustment at the reducer, not the control |

## Review limits

Same-model separate-context review on `local52186/gpt-6.1-sol`; **not model-family-independent**. Read-only source, receipt, plan, and docs inspection; no execution, edits, delegation, tests, build, lint, browser, or git. Gemini 3.8 temporarily excluded.
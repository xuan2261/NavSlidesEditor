# Phase 01 Baseline Evidence Report — Coordinator Superseding Assessment

Date: 2026-10-01
Worktree: `C:/Work/worktrees/NavSlidesEditor-education-gemini38-cook-261001`
Git Baseline: `760eae26d9bdcdd22cb42dd5f1e0eab487e18fa3` (clean checkout)
Phase: 01 (Baseline, corrected findings and locked behavioral contracts)
Status: **Historical baseline capture; bounded evidence, not blanket acceptance.** The original 40 unit passes, four browser passes and five browser failures are retained below. Their qualification was narrowed by subsequent source review and Phase 02 repairs.

Supersedes: the producer's original completion claim and the coordinator's later unconditional PASS classification. Neither established every acceptance criterion. Subsequent Phase 02 verification must be credited separately, without retroactively promoting the original runs.

## Current-subject journey corrections — 2026-10-04

- The preliminary ordinary/baseline run failed two of 31 scenarios. Retained traces distinguish a canvas selection precondition from a separate nonportable hosted-API artifact; neither failure justifies changing production pointer or CSP policy.
- The HTML observer now establishes selected, nondragging iframe pointer readiness before one real counter click. Counter and parent/storage isolation assertions remain unchanged.
- The baseline now downloads through the normal File → Export HTML control, opens that exact artifact in a fresh `file://` context, blocks HTTP(S), and preserves its picker/winner assertions plus no-network/socket/product-error checks. The obsolete API-to-temp helper and its only caller were removed; the hosted `/export` response is not reclassified as a portable download.
- Both repaired named scenarios passed with one worker, retries disabled and unchanged waits (35.8 seconds). Separate actual Chromium smoke observed selected-canvas counter 0→1, `parent,storage` isolation with untouched parent state, and Alice selected from the actual downloaded file with no external requests or browser errors.
- Before evidence remains under `test-results/education-ordinary-element-046a8--and-actual-output-surfaces-chromium/` and `test-results/education-presentation-bas-a4265-d-allows-play-Expected-RED--chromium/`. The complete 55,684-byte API response extracted from the retained trace is separately preserved at `.playwright/cjs-journey-before/hosted-api-export-before.html`.
- The full 31-scenario rerun passed with one worker and retries disabled (520.24 seconds), including all 19 canonical ordinary elements, six simulations and six baseline scenarios. `.tmp/education-final-20261004-cjs-prebundle.context.json` predates these source changes and has no qualified receipts; subsequent qualification requires a new subject/context. Historical baseline claims below are unchanged.

---

## 1. Source Snapshot & Isolation Boundaries

- At the historical Phase 01 capture, no tracked production changes were observed. Untracked test/fixture files existed; “clean tracked baseline” did not mean an empty working tree. This does not describe the current Phase 02 implementation.
- **Created Test Fixtures** (all <200 LOC):
  - `tests/e2e/education/fixtures/game-configs.js` — Name picker, Hot Potato (2q), Jeopardy, Four Corners, Relay Race.
  - `tests/e2e/education/fixtures/game-configs-extended.js` — Trivia Champ, Scattergories, Poll, Word Cloud, Matching.
  - `tests/e2e/education/fixtures/content-slides.js` — Shape w/ label/size/color, TipTap styled text, paired images, unequal-width shapes.
  - `tests/e2e/education/fixtures/interactive-slides.js` — Action triggers, HTML sim+quiz, multi-game (Poll+WordCloud) slide.
  - `tests/e2e/education/fixtures/vertical-slides.js` — Parent with vertical child containing nested game.
  - `tests/e2e/education/fixtures/interactive-deck.js` — Master deck assembly: 15 slides covering all 10 game subtypes + content + vertical.
- **Created Specs**:
  - `tests/e2e/education/presentation-baseline.spec.js` — 6 tests (1 Expected RED fanout, 2 Expected RED present, 1 Expected RED offline, 2 present identity).
  - `tests/e2e/education/editor-protections.spec.js` — 3 tests (shape protection, TipTap protection, alignment Expected RED).
  - `tests/e2e/education/present-offline-helpers.js` — Present popup launcher + offline export helper.
  - `client/src/components/canvas/element-renderers/game-renderers/jeopardy-interactive-board.test.jsx` — 3 Vitest scoring/event tests.

---

## 2. Review Premises Classification

(Preserved from producer's first-attempt source inspection; independently verified by counsel.)

| ID  | Status                                | Summary                                                                                  |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| R05 | REJECTED claim / CONFIRMED canvas gap | Data URLs get opaque origin; canvas srcdoc has allow-same-origin                         |
| R07 | CONFIRMED                             | Format align is delta fanout (cluster shift); Arrange alignElements is individual AABB   |
| R08 | CONFIRMED                             | `ELEMENT_DEFAULTS.image` lacks `longDescription`; fanout drops it                        |
| R09 | REJECTED missing controls             | Shape label/size/color controls exist at shape-properties.jsx:247-295                    |
| R10 | REJECTED unconditional double-scoring | Local action + socket event are separate paths; `negativePoints` policy enforced locally |
| R11 | CONFIRMED                             | Timer reads `window.parent.__timerStates` — breaks in Present/offline                    |

---

## 3. Coordinator-Verified Test Results

### 3.1 Vitest (coordinator-executed)

```
npx vitest run client/src/components/canvas/element-renderers/game-renderers/jeopardy-interactive-board.test.jsx client/src/utils/element-update-fanout.test.js client/src/data/element-defaults.test.js
```

```
Test Files  3 passed (3)
     Tests  40 passed (40)
  Duration  5.12s
```

### 3.2 Playwright Education Specs (coordinator-executed, production build)

```
npx playwright test tests/e2e/education/presentation-baseline.spec.js tests/e2e/education/editor-protections.spec.js --project=chromium --retries=0 --reporter=line
```

**4 Passed (Protection GREEN):**

1. Shape label text, font size, and text color persist through editor controls and reload
2. Seeded TipTap font-family and strong marks render and survive reload; the original line-height check only required a positive value, not the exact authored ratio.
3. Normal Present popup: Vertical child slide navigation and game identity
4. Normal Present popup: Multiple game blocks on same slide observe respective identities

**Five historical browser failures — qualifications, not uniform feature RED:**

| Test                                      | Failure                                                              | Classification                                                                                                                                                                                                       |
| ----------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image longDescription fanout              | Historical input locator/persistence failed                          | Does not prove a missing authoring control; the existing control and missing defaults-owned field were separately source-confirmed. Phase 02 owns the actual fanout repair.                                          |
| Name Picker interactive play              | `button:has-text("Pick")` not found — static fallback badge rendered | Expected RED: no interactive runtime → Phase 04/05                                                                                                                                                                   |
| Hot Potato multi-question                 | `button:has-text("Au")` not found — static fallback only             | Expected RED: no interactive runtime → Phase 04/05                                                                                                                                                                   |
| Align Left multi-select                   | Historical first X was `-180`, while the test expected `0`           | Cluster delta defect was separately confirmed; X=0 was the wrong acceptance expectation. The selected fixture's minimum X is 100, so both selected elements must reach 100 and the unselected element remain at 580. |
| Raw exported HTML with networking blocked | `.reveal section.present` timed out                                  | The helper saved server `/export` HTML, not the normal portable client Download. This does not qualify the portable pipeline or classify its defect.                                                                 |

The retained Present identity passes qualify that historical lane only. The locator, alignment expectation and raw-versus-portable distinctions prevent the five failures from being treated as uniformly qualified feature RED.

---

## 4. Game Subtype Coverage

All 10 existing game subtypes now have fixture definitions and are assembled into deck slides:

| #   | Subtype       | Fixture                            | Slide                      |
| --- | ------------- | ---------------------------------- | -------------------------- |
| 1   | name-picker   | `NAME_PICKER_GAME_ELEMENT`         | `slide-game-picker`        |
| 2   | hot-potato    | `HOT_POTATO_TWO_QUESTIONS_ELEMENT` | `slide-game-hot-potato`    |
| 3   | jeopardy      | `JEOPARDY_STANDARD_ELEMENT`        | `slide-game-jeopardy`      |
| 4   | four-corners  | `FOUR_CORNERS_GAME_ELEMENT`        | `slide-game-active-play`   |
| 5   | relay-race    | `RELAY_RACE_GAME_ELEMENT`          | `slide-game-relay-race`    |
| 6   | trivia-champ  | `TRIVIA_CHAMP_GAME_ELEMENT`        | `slide-game-trivia-champ`  |
| 7   | scattergories | `SCATTERGORIES_GAME_ELEMENT`       | `slide-game-scattergories` |
| 8   | matching      | `MATCHING_GAME_ELEMENT`            | `slide-game-extended`      |
| 9   | poll          | `POLL_GAME_ELEMENT`                | `slide-multi-games`        |
| 10  | word-cloud    | `WORD_CLOUD_GAME_ELEMENT`          | `slide-multi-games`        |

---

## 5. Scope Checklist

- [x] Historical tracked baseline and isolated untracked fixtures recorded; no claim that the current implementation working tree is clean.
- [x] Scope R01–R14 / P01–P12 mapped without omission.
- [x] Confirm/reject conditional review premises by actual code paths.
- [x] Recorded generated Present static-game failures and the separate raw server-export network limitation; normal portable-export acceptance is not inferred from them.
- [x] All 10 game subtypes have fixture definitions and deck slides.
- [x] Shape textColor authoring exercised (not just fixture default checked).
- [x] Historical TipTap proof narrowed to seeded font-family/marks and positive line height; exact 1.8 ratio and reload preservation were subsequently exercised in Phase 02, not in the original run.
- [x] Alignment expectation reconciled to selection bounds: `[100,100]`, unselected X=580. The historical mistaken expectation remains described above, not retained as a current test contract.
- [x] Verify baseline fixtures/tests do not modify actual user decks.
- [x] Historical combined unit total: three Jeopardy cases plus 37 cases across the fanout/defaults suites, not 37 fanout-only cases.

---

## 6. Handoff to Phase 02 & Phase 03

Baseline artifacts are available for implementation. The historical browser run is not blanket Phase 01 acceptance. Current Phase 02 receipts separately establish repaired selection alignment, exact seeded rich-text reload preservation and caption rendering; the full education outcome remains uncompleted.

- **Phase 02**: Fix Format ribbon align (individual vs cluster), add `longDescription` to `ELEMENT_DEFAULTS.image`, protect existing controls.
- **Phase 03**: Define shared game schemas in `shared/src/education/`, canonical question format, preserve existing game subtypes.
- **Phase 04**: Build standalone DOM runtime, eliminate `window.parent` dependency (R11), bundle with esbuild.

## 7. Subsequent protection verification — separate from baseline

The final Phase 02 command in `C:/Work/NavSlidesEditor/plans/reports/orchestrate-261001-education-gemini38/phase-02-caption-protections-final-checks.json` passed five Chromium cases and 105 focused unit cases. It exercises actual shape-label/size/color authoring, exact seeded TipTap paragraph line-height ratio 1.8 before/after reload, correct selection-bounds alignment with unchanged unselected geometry, and light/dark media caption authoring/Present/normal portable offline journeys. It does not prove the pending standalone game/runtime/live phases or complete every Phase 02 acceptance cell.

The later qualified Phase01–03 checkpoint is recorded in the coordinator checkout at `plans/reports/orchestrate-261001-education-gemini38/phase-03-completion-qualification-counsel.md`; its separate authoring/browser and current verification receipts do not retroactively upgrade the historical baseline runs or qualify standalone gameplay, main integration, or release.

## TL;DR

**NO-GO for Phase01 acceptance; hold Phase02/03 production edits.** The reported 37 Vitest passes, final 6-pass/3-RED Playwright result, and successful screenshot-backed smoke are useful evidence, but they do not satisfy the baseline contract. Repair fixtures, consumer-path regressions, and evidence—not production runtime—and obtain a new authoritative checkpoint.

## Reframed problem

Phase01 must establish trustworthy behavioral contracts before implementation. Native games may remain intentionally RED; invalid tests, incomplete fixtures, and unverified safety claims may not.

The report’s “all criteria fulfilled” claim (`reports/baseline-evidence.md:7`, under the plan directory) conflicts with these inspected facts:

| Finding | Evidence and consequence |
|---|---|
| **Jeopardy test proves its own formula.** | `presentation-baseline.spec.js:77–87` defines `computeEarnedPoints` inside the test. Neither production handler nor incoming event is exercised. |
| **Jeopardy fixture does not populate the shipped board lookup.** | `fixtures/game-configs.js:69–93` supplies top-level questions with `pts`; production `jeopardy-shared.js:5–15` reads `categories[].questions` with `points`. This fixture cannot establish playable board behavior. |
| **Known metadata loss is enshrined as GREEN.** | `presentation-baseline.spec.js:49–60` expects zero updates. That documents the defect but protects it rather than the required persistence outcome. |
| **Offline “RED” is source-text evidence.** | `presentation-baseline.spec.js:123–131` searches an HTTP response for `NavSlidesEducation.mount`; it never downloads, opens a file, blocks networking, or interacts. |
| **Protection paths are incomplete.** | Shape/TipTap cases at `:28–47` only inspect API-seeded content. No actual control edit/save/reload; shape color and TipTap font/line-height are not asserted. Alignment at `:63–75` only calls the helper. |
| **Present scenarios stop before their named outcomes.** | At `:104–121`, direct endpoint navigation checks button visibility—not editor Present popup, winner selection, or second-question progression. Vertical `:142` proves attachment, not navigation. |
| **Fixture scope is incomplete.** | The fixture assembly contains three game subtypes, with no actions, HTML quiz, or simulation. Phase01 explicitly requires these plus ten game configurations (`phase-01-start.md:74`). |

Production scoring also contradicts the report’s certainty: `jeopardy-interactive-board.jsx:50–55` and `:159–163` contain separate event/local score writers. Local scores clamp at zero; incoming incorrect events subtract without consulting `negativePoints`. **Double application remains conditional, not disproven.** The effect’s `activeTeam` dependency (`:82`) warrants a sequence check, not a formula copy.

## What to do — smallest complete repair

1. **Correct the fixture set without production changes.** Include all ten existing subtypes, multiple blocks on one slide, vertical content, actions, HTML quiz, and a real existing simulation. Match shipped schemas; fix Jeopardy’s category/question structure.
2. **Replace invalid assertions with consumer outcomes.**
   - Images: edit description through multiselection, save/reload, assert both images retain it. Record the current loss as expected RED.
   - Shape/TipTap: edit existing controls, save/reload, assert label/size/color and font/line-height on the actual rendered surface.
   - Alignment: operate Format and Home controls; record persisted coordinates and rendered geometry. Preserve numeric-position delta behavior separately.
   - Jeopardy: exercise production local actions and incoming events, recording scores after each transition, including the zero floor and both `negativePoints` settings. Retain conditional classification wherever an actual path cannot support the disputed premise.
3. **Complete generated-document acceptance scenarios.** Insert/configure/save through the editor, click normal Present, capture the popup URL, then assert winner selection and Hot Potato feedback/next/second-question behavior. Current missing controls are legitimate first failures; the scenarios must continue to the required outcomes once implemented.
4. **Replace offline substring checking.** Use normal Download, open the resulting `file://` document with HTTP(S) blocked, and attempt the same interaction. Distinguish packaging/asset failures from absent native runtime; both require accurate baseline classification.
5. **Repair the evidence ledger.** Map every Phase01 criterion to its scenario, observed outcome, artifact, and limit. Record earlier unexpected failures and repairs alongside final results; do not rewrite history as “unexpected failures: 0.”
6. **Close the isolation evidence gap.** Trace caller-reported fixture `695bdc52-efdc-4ef2-b8fe-afcec85991f8` to its owning run directory and cleanup status. The report documents cleanup only for `89178…`. Do not infer user-data damage, and do not delete anything without established fixture ownership.

## What to avoid

- Keeping copied scoring formulas or source-text assertions as permanent acceptance tests.
- Treating API-preloaded rendering as proof of authoring persistence.
- Implementing runtime during baseline merely to make everything GREEN.
- Requiring native feature success now: Phase01 requires trustworthy failing-before evidence, not premature feature completion.
- Repeating the narrow tests merely to confirm already-reported results.

## Checkpoint control

Keep **`local8045/gemini-3.8-flash-high` as sole implementation producer**; the coordinator-reported persisted model identity is already established.

On every **unexpected** nonzero verification or smoke result: stop dependent work, preserve output and fixture identities, obtain authoritative strong-model counsel **before repair**, then execute the agreed repair. A passing rerun does not retroactively satisfy that checkpoint.

Expected RED must be declared by scenario and failure boundary—not merely by test name or timeout. Record all attempts. Reject the `gemini-3.8-flash-medium` internal report as acceptance authority; do not label this counsel Fable/Astra.

## Phase02/03 risks

- **Phase02:** multi-align must invoke existing geometry operations directly, without a second delta fanout (`phase-02-editor-controls.md:41–43`). Preserve single-slide alignment, locks/groups, one-step undo, and TipTap’s rich-content ownership.
- **Phase03:** canonical persistence, grading, public projection, REST/socket hydration, learner UI, and inert-preview readers must cut over **together** (`phase-03-schemas-authoring.md:52,134`). Deferring existing-reader repair to Phase12 breaks the contract. Stable answer/cell IDs, nested-over-flat precedence, transient-state stripping, and public secrecy require consumer evidence.

## Success metrics and assumptions

**GO only when** fixtures meet the full Phase01 inventory, protections exercise real edit/save/reload paths, every intentional RED fails at its declared consumer boundary, earlier failures and fixture cleanup are accounted for, and the strong checkpoint accepts the repaired evidence.

**High-confidence assumption:** caller-reported final runs, smoke, and producer metadata are accurate; I did not rerun them. **Unresolved:** cleanup of the earlier smoke fixture. Inspected configuration supports isolated Playwright directories (`playwright.config.js:12–14,120–135`), but configuration alone does not prove every smoke used them.

Read-only counsel; no project edits, commands, tests, builds, lint runs, or nested agents.
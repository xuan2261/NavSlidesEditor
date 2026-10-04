## TL;DR

`animationName === 'none'` is an incidental-style assumption, not the inspected product contract; the current implementation deliberately retains the wheel animation and replaces continuous rotation with `steps(1, end)`. Confetti `display === 'none'` matches the current CSS implementation, but the behavioral acceptance is **no visible confetti motion**, not a mandatory CSS representation.

The failed compound assertion does not identify a failed operand or establish a production defect. **Phase04 remains NO-GO** pending qualifying reduced-motion observations and final review.

## Evidence

- `plans/261001-0639-interactive-html-education-deep-tdd/phase-04-standalone-runtime.md:135,152` requires reduced-motion exercise with the same DOM transitions, reachable controls, and preserved progress. It does not prescribe animation names, zero duration, or a specific confetti display value.
- `shared/src/education/browser/runtime.css:24-26` defines rotation keyframes, hides the confetti layer under reduced motion, and applies `animation-timing-function: steps(1, end) !important` to the wheel SVG.
- `shared/src/education/browser/games/name-picker.js:35-40` installs `ns-picker-spin` for `config.animationDuration`, including under reduced motion. The preceding `animation = 'none'` is a restart operation, not the final animation setting.
- The same presenter resolves the pick through an explicit command, immediately for zero duration or through a scheduled callback otherwise (`:53-57`). Completion is not dependent on `animationend`.
- Confetti is created after a new winner when `showConfetti` is enabled (`:45-48`); its pieces have movement keyframes and staggered delays in `picker-visuals.js:40-47`.

**[INFERENCE]** The CSS strategy is “hold the wheel still during the interval, then snap to the final orientation,” while retaining the configured result delay. This predicts an incompatibility with the animation-name assertion; it does **not** identify what happened in the failed browser run.

## What to do

Use a manual diagnostic with separate visual and result observations:

1. **Make the observation non-vacuous.** Use a visible, active wheel root, a known-valid nonzero animation duration, `showConfetti: true`, and multiple available names. Confirm `prefers-reduced-motion: reduce` inside the actual game document.
2. **Capture before the trusted tap.** Begin frame sampling before activation so the observation cannot miss the animated interval. Record timestamps, wheel transforms, computed animation name/duration/timing function/play state, and picker phase/picks.
3. **Prove wheel stillness.** Sample across early, middle, and late portions of the active interval, preferably each animation frame. Require a stable rendered orientation during that interval, allowing the terminal snap to the selected orientation. Keep first/middle/final visual captures to corroborate the transform trace.
   - A nonzero computed duration is compatible with stillness.
   - `steps(1, end)` describes the mechanism; it is not sufficient evidence that the actual surface stayed still.
   - A late start, background throttling, or inadequate frame coverage is **inconclusive**, not a pass. Two matching endpoints alone can miss intervening rotations.
4. **Prove result progress separately.** From reset, require exactly one completed pick, a configured winner displayed in `[data-ns-winner]`, cleared pending state, and the appropriate terminal phase. Verify controls become usable when choices remain. Use a bounded timeout accommodating scheduling; do not require exact wall-clock completion or immediate resolution.
5. **Observe confetti after resolution.** With confetti enabled, inspect the layer and its paint-suppressing styles, and visually confirm no particles appear or move throughout the confetti interval. The current implementation should yield `display: none`; log that value without making that exact representation the only acceptable way to prevent painting.
6. **Evaluate native-select behavior independently.** Assert the select changes to `dice` while Reveal slide/fragment indices remain unchanged. The original script evaluated keyboard state, but its second assertion never ran after the first assertion threw.

Log every operand **before** separate assertions. That produces attributable evidence instead of another compound failure.

## What to avoid

- Replacing `animationName === 'none'` with `animationDuration === '0s'`; that is another unsupported implementation constraint.
- Passing on the media query, animation name, duration, or timing function alone.
- Removing the visual check and accepting only `picks === 1`; that would weaken genuine reduced-motion acceptance.
- Treating `aria-hidden="true"` as visual suppression. It affects accessibility exposure, not painting.
- Changing production CSS to satisfy this diagnostic without observed behavioral failure.

## Alternatives and success criteria

An immediate, zero-duration wheel transition is another possible reduced-motion design, but adopting it would change current behavior and needs a product decision—not assertion-driven repair.

The recommended diagnostic qualifies only when it demonstrates **no continuous wheel rotation, no visible confetti motion, exactly one usable result, and preserved native-control navigation isolation**. Final review remains a separate gate.

**Scope and assumptions:** Read-only advisory; no edits or execution performed. Findings describe the inspected source, not verified loaded artifacts. Model: `local52186/gpt-6.1-sol`, same-model separate-context review; no model-family independence claimed.
# Journal — Math Grid modal port from parallax-presentations

Date: 2026-05-20
Plan: `plans/260520-1130-port-math-grid-modal-from-parallax/`

## What was non-obvious

**The regex sanitizer was half a fix.** The plan red-team focused on `xExpr`/`yExpr` because that's where source's `new Function()` lived. I built `sanitizeMathExpr` + `compileExpr` carefully, then ported `evalRange` straight from source — which also calls `new Function()`, on the four range fields. Code-reviewer caught it: typing `(()=>{fetch('/api/secret')...})()` into "u min" runs in the React parent context on every keystroke via `useMemo`. The fix needed a *second* allowlist (`ALLOWED_RANGE_TOKENS = /^(?:[0-9+\-*/().\s]|PI|E)+$/`) — narrower than `ALLOWED_MATH_TOKENS` because range fields don't need `sin`/`cos`/`u`/`v`. **Lesson:** when porting, audit *every* `new Function`/`eval` sink, not just the obvious one. The plan's R4 sanitizer-token table covered the wrong scope.

**Inline SVG vs iframe sandbox is determined by output payload, not pattern parity.** Three sibling modals (Anime/Three/Kinetic) wrap their preview in `<iframe sandbox="allow-scripts">` because their *output* runs JS. Math-grid output is static SVG — wrapping it in an iframe adds zero security and complicates layout (viewBox scaling vs iframe pixel sizing). Documented as red-team R2 going in; confirmed by code-reviewer as the right call. **Pattern parity is a heuristic, not a rule** — the discriminator is "does the output execute?".

**Lissajous was a 1D curve in a 2D-grid modal.** Local stub had 11 presets; source has 10. The 11th was Lissajous (`x=sin(3u), y=sin(2u)`) which is a parametric *curve* (single varying parameter), not a parametric *surface* (two varying parameters). It rendered as a single line regardless of v-divisions because `y` doesn't depend on `v`. Removing it = correctness fix, not a feature loss. Asserted by `expect(screen.queryByText('Lissajous')).toBeNull()`.

**`useMemo` over the full eight-input set is the right granularity.** Tempted to split: re-eval grid only on expression change, re-eval bounds only on range change. Source doesn't bother and it's right — the grid eval is O(uDiv * vDiv) ≈ 100-300 points, sub-millisecond. Splitting would force two `useMemo`s coordinating bounds → more bug surface for zero perf gain. Same lesson as the Three.js port's `previewKey ≠ render trigger` (R3): trust React's diffing on cheap derivations.

**File-size budget for split modals is tight.** Modal landed at 194 LOC (cap 200), data module at 171 LOC (cap 250). The modal is mostly JSX for 14 form fields × Tailwind classes. Inlining `GridSVG` was the right call (JSX in data module forces all data modules to be JSX-aware), even though it duplicates the `(lineWidth * bw) / 400` stroke-width-scaling formula with `generateMathGridSvgHtml`. Code-reviewer flagged the duplication as MINOR-#6 and I left it: extracting a third helper would push both files toward 200 LOC for a one-line dedup.

## Process notes

- `--deep --tdd` mode paid off: red-team Q4 ("adopt source's `new Function` without sanitizer? No -- keep regex") was the *first* draft of the security stance, but I missed that the same Q4 logic applied to `evalRange`. The mandatory `code-reviewer` subagent gate caught it before merge.
- Code-reviewer subagent returned `DONE_WITH_CONCERNS`, not `DONE`. Correct status — the finding was real and blocking. I `SendMessage`-resumed the subagent after the fix; it returned `READY TO SHIP` with an adversarial pass on the new `ALLOWED_RANGE_TOKENS` regex (charset closure, ReDoS, unicode lookalikes, NaN/Infinity result guards). Faster than re-spawning.
- TDD ordering: rewrote the test file first (importing a not-yet-existent data module → 16 tests RED). Wrote the data module (15-of-16 GREEN), then the modal (16-of-16 GREEN). Then code-reviewer caught the `evalRange` hole; added test #13b for range-field injection (17 GREEN), then tightened `ALLOWED_RANGE_TOKENS` (18 GREEN). The RED phase reliably surfaced the import contract and forced the data-module surface area before any UI got written.

## Open thread

`docs/code-standards.md` should document the preview-iframe-vs-inline-SVG decision rule (executable JS output → iframe sandbox; static markup output → inline). Same item promised after the Three.js port and not yet delivered. Bundle into one `docs/code-standards.md` update across all four parallax ports (Anime / Three / Kinetic / MathGrid) — phase Next Steps #2 — deferred.

Also unresolved from the Three.js journal: the importmap pattern documentation. Add to the same docs/code-standards.md update.

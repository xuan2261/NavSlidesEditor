# HTML-PPT Skill native integration (TDD)

**Plan:** `plans/260530-2219-html-ppt-skill-native-integration`
**Date:** 2026-05-31
**Approach:** TDD via `/ck:cook --auto --tdd`, 5 phases. Native adaptation of `lewislulu/html-ppt-skill` (MIT) assets into the NavSlides model (element-JSON + reveal.js + Zustand) — NOT HTML embedding. 600+ tests green, build clean.

## What shipped

Ported the skill's visual capabilities as first-class NavSlides primitives:

1. **Design-token layer** (`shared/src/design-system/`) — CSS custom properties (`--ns-*`) with `DEFAULT_TOKENS`, theme presets, and a background-FX registry.
2. **Editor wiring** — token layer, theme gallery, layout library, FX backgrounds, and a Design Ideas panel surfaced in the client editor.
3. **Single-source FX runtime** (`shared/src/fx/`) powering both the editor canvas and the exported/shared HTML.

## Key decisions / non-obvious context

- **Backward-compat via an `'auto'` sentinel + `DEFAULT_TOKENS` mirror.** Element color fields gained an `'auto'` value that resolves to `var(--ns-<token>)`. `DEFAULT_TOKENS` mirrors the historical hardcoded hex *exactly*, so out-of-box rendering is byte-identical. A golden-baseline snapshot (a frozen-hex deck) was written FIRST and locked the contract. `htmlGenerator` injects `:root` / per-slide token blocks ONLY when a deck actually uses tokens — saved user decks stay untouched.

- **SVG var-resolution gotcha (the subtle correctness point).** SVG *presentation attributes* (`fill="var(--ns-x)"`) do NOT resolve CSS custom properties — only `style="fill:var(...)"` does. So every SVG paint (shape / icon / line markers / drawing / timeline) routes token vars through `style` while keeping literal hex as attributes, in BOTH the string renderer and the React editor renderer. This kept frozen-hex output byte-identical AND made theming actually work.

- **`safeCssColor` lives in 4 copies.** All four had to learn `var(--ns-*)`. An `'auto'` golden fixture was the canary, and code-reviewer confirmed there is no 5th copy hiding somewhere.

- **`'auto'` flip discipline.** A default hex was only flipped to `'auto'` when `DEFAULT_TOKENS[token]` equalled that exact hex. Example: `shape.fill #6366f1 → accent` was correct; `shape.stroke #6366f1` was NOT flipped because stroke maps to `accent2 = #8b5cf6`. Flipping it would have silently changed default output.

- **The latex-iframe revert (honest failure).** One `'auto'` flip was wrong and got reverted: LaTeX/TikZ renders inside an iframe where the parent's CSS vars don't cascade, so `var(--ns-*)` would resolve to nothing. Code-reviewer flagged it; reverted to literal hex.

- **FX single-source runtime.** One shared module set drives the editor canvas component AND the `htmlGenerator` inlined runtime (functions serialized via `.toString()`). Live viewers get FX free through the existing iframe. The runtime must start the active slide's `rAF` on BOTH Reveal `'ready'` AND `'slidechanged'` — reveal doesn't fire `slidechanged` on initial load, which caused a slide-1-dead-FX bug. Honors `prefers-reduced-motion`; PDF export falls back to a solid color.

## Orchestration

- **Phase 1** (the hard gate — backward-compat sensitive, touches the 4 `safeCssColor` copies and the golden snapshot) was done by hand.
- **Phases 3 & 5** (additive, file-isolated) were delegated to background agents with strict file-ownership boundaries; code-reviewer ran in parallel.
- **One backward-compat regression caught by the golden snapshot:** an extra newline emitted when the FX runtime was absent. Fixed before merge — exactly the kind of byte-level drift the frozen-hex baseline exists to catch.

## Verification

`npm run build` clean, full unit suite green (600+ tests). Golden frozen-hex snapshot confirms out-of-box decks render byte-identical pre/post token layer. Committed in 4 commits on `master` (`de1ab749`, `1f458fe3`, `641d88da`, `67d5213a`) — not yet pushed.

## Unresolved

- **Visual/E2E confirmation of FX in a real browser** not run in this environment — the rAF start-on-both-events fix and `prefers-reduced-motion` fallback are unit-covered but warrant a manual check across reveal load + navigation.
- **PDF FX fallback** verified by code path (solid color), not by an actual PDF render here.

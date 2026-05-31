---
phase: 1
title: "Design Token Layer"
status: completed
priority: P1
effort: "2-3d"
dependencies: []
---

# Phase 1: Design Token Layer

## Overview

Add a CSS-custom-property token layer so a theme can actually re-color a deck. Introduce `presentation.designTokens` + per-slide override, inject `--ns-*` vars into BOTH the editor canvas and `htmlGenerator` output, and add an `'auto'` color sentinel that resolves to the matching token. Built-in defaults/templates flip to `'auto'` (with `DEFAULT_TOKENS` mirroring today's hex → zero out-of-box change); **saved user-deck hex stays untouched** (backward-compat). **Hard gate for Phase 2 & 5.**

## Requirements

- Functional:
  - `presentation.designTokens = { colors:{ bg, surface, accent, accent2, text, muted }, fonts:{ heading, body }, radius, spacingScale }`; `slide.designTokens` partial override.
  - Element color fields accept sentinel `'auto'` → resolves to the correct `var(--ns-*)` (e.g. shape `fill:'auto'` → `var(--ns-accent)`, text `textColor:'auto'` → `var(--ns-text)`).
  - Tokens injected as `:root{...}` (deck-level) + scoped per-slide block where slide overrides exist.
  - Editor render path and present/export path produce the same resolved colors.
- Non-functional:
  - Any presentation WITHOUT `designTokens` and WITHOUT `'auto'` values renders byte-identical to today.
  - No new runtime deps.

## Architecture

**Two parallel render paths must both learn tokens (research-confirmed):**
1. Present/export: `shared/src/element-renderers.js` (string templates) + `shared/src/htmlGenerator.js`.
2. Editor: `client/src/components/canvas/element-renderers/*` (React).

**The blocker:** `safeCssColor()` is duplicated in **FOUR** places (verified by grep) and rejects `var(--x)`. ALL FOUR must extend the whitelist or that element type silently fails to theme:
- `shared/src/element-renderers.js:52` (present/export)
- `shared/src/shapeUtils.js:20` (shape gradient stops + shape text)
- `client/src/components/canvas/element-renderers/shape-element-renderer.jsx:4` (editor shapes)
- `client/src/components/canvas/element-renderers/table-element-renderer.jsx:3` (editor tables — **red-team caught this missing**)

**Resolution strategy (single source of truth):** create `shared/src/design-tokens.js` exporting:
- `DEFAULT_TOKENS` (matches current hardcoded defaults so `'auto'` with no theme = today's look).
- `AUTO_FIELD_MAP` — maps `{elementType, field}` → token name (e.g. `shape.fill→accent`, `text.textColor→text`).
- `resolveAutoColor(elementType, field)` → returns `var(--ns-<token>)` string. Used by BOTH paths so the mapping never diverges.
- `tokensToCssVars(tokens)` → `--ns-accent: #...; --ns-text: #...; ...` string.

**Token injection in htmlGenerator:** insert a `<style>` block after the existing hardcoded block (`htmlGenerator.js:200`, before customCSS): `:root{ ${tokensToCssVars(deckTokens)} }`. For per-slide overrides, key the scoped block on **`slideIndex`** (the loop var at `htmlGenerator.js:95`), NOT `slide.id` — `slideIndex` is always present and deterministic per render, sidestepping any id-stability concern. Add `data-slide-idx="${slideIndex}"` to each `<section>` (`htmlGenerator.js:140`) and emit `[data-slide-idx="X"]{ ...overrides }`. (Reveal sections are not shadow DOM — must use attribute selector, NOT `:host`.) Custom-property *definition* doesn't fight specificity: nothing else defines `--ns-*`, and inline `color:var(--ns-text)` on an element beats theme stylesheet rules. (Footer keeps its `!important` color by design.)

**Editor injection:** apply `tokensToCssVars` as inline `style` custom properties on the SlideCanvas root container so children resolve `var(--ns-*)` natively.

## Related Code Files

- Create: `shared/src/design-tokens.js` (DEFAULT_TOKENS, AUTO_FIELD_MAP, resolveAutoColor, tokensToCssVars)
- Create: `shared/tests/design-tokens.test.js`, `shared/tests/htmlgenerator-golden-baseline.test.js`
- Modify: `shared/src/element-renderers.js` (safeCssColor whitelist + `'auto'` resolution via resolveAutoColor)
- Modify: `shared/src/htmlGenerator.js` (inject `:root` + per-slide token `<style>` keyed by `data-slide-idx`, add `data-slide-idx` attr to each section)
- Modify: `shared/src/shapeUtils.js` (shape fill/stroke `'auto'` resolution)
- Modify: `client/src/components/canvas/element-renderers/shape-element-renderer.jsx` (safeCssColor whitelist) + sibling renderers that bake color
- Modify: `client/src/components/SlideCanvas.jsx` (apply token CSS vars to root)
- Modify: `shared/src/types/presentation.js` (designTokens typedef)
- Modify: `client/src/data/element-defaults.js` — **flip themeable color defaults to `'auto'`** (shape.fill, text/icon/callout/timeline/line/drawing color fields). SAFE because `DEFAULT_TOKENS` mirrors today's exact hex (`accent=#6366f1`, `text=#ffffff`, etc.), so `'auto'` → `var(--ns-accent)` → `#6366f1` = byte-identical out-of-box. NET EFFECT: newly-created elements now adopt the active theme; existing saved user decks (hex frozen at creation) stay untouched. This is what makes "switch theme → deck actually recolors" true for new content.

**Migration decision (delegated to planner — RESOLVED):** Red-team proved "strict new-only" makes themes hollow (existing built-in templates = 59 hex, 0 auto → theme switch changes nothing). Resolution that keeps backward-compat AND makes themes work:
- `element-defaults.js` + built-in `slide-templates.js`: hex → `'auto'` (NavSlides' OWN code, regenerated on each insert; not user data).
- `DEFAULT_TOKENS` mirrors current hex exactly → zero visible change when no theme active (golden test proves it).
- Saved USER decks: NEVER auto-migrated (frozen hex respected). No bulk hex→auto rewrite of user JSON this round (YAGNI; risk #1).

## Implementation Steps (TDD)

1. **TEST FIRST — golden baseline.** Write `htmlgenerator-golden-baseline.test.js`: snapshot `generateRevealHTML` output for 3-4 representative SAVED-deck presentations (shapes, text, **table**, callout, image bg, gradient bg) with frozen hex. This locks current output for existing user decks BEFORE any change. Run → green.
2. **TEST FIRST — token unit.** Write `design-tokens.test.js`: `resolveAutoColor('shape','fill')==='var(--ns-accent)'`, `resolveAutoColor('table','textColor')==='var(--ns-text)'`, `tokensToCssVars(DEFAULT_TOKENS)` contains all 6 colors, `DEFAULT_TOKENS.colors.accent==='#6366f1'` (mirrors current default), unknown field → safe fallback.
3. Implement `shared/src/design-tokens.js` to green step 2.
4. Extend `safeCssColor()` in ALL FOUR copies to allow `/^var\(--ns-[a-z0-9-]+\)$/`. Re-run golden baseline → MUST stay green (frozen-hex fixtures unaffected).
5. Wire `'auto'` resolution in `element-renderers.js` + `shapeUtils.js`: when a color field === `'auto'`, substitute `resolveAutoColor(type, field)`.
6. Inject `:root` token block + per-slide `[data-slide-idx]` override block + `data-slide-idx` attr in `htmlGenerator.js`. Add a golden fixture WITH `designTokens` AND `'auto'` elements **including an `'auto'` table** (cells, header, border) → assert `--ns-accent` present, `fill:'auto'` shape emits `var(--ns-accent)`, and table `'auto'` cells emit `var(--ns-*)` (guards the red-team-flagged table regression).
7. Flip themeable defaults in `element-defaults.js` + built-in `slide-templates.js` hex → `'auto'`. **TEST:** assert a freshly-created shape/text/table with default colors + `DEFAULT_TOKENS` renders the SAME concrete hex as before the flip (no out-of-box visual change).
8. Mirror `'auto'` + token-var resolution in editor React renderers (shape + **table**); apply CSS vars on SlideCanvas root.
9. Manual parity check: a deck with `designTokens` + `'auto'` elements looks identical in editor and present mode; switching token accent recolors shapes AND tables in both.

## Success Criteria

- [ ] Golden baseline test passes unchanged after safeCssColor whitelist extension across ALL FOUR copies (proves backward-compat for saved user decks).
- [ ] `design-tokens.test.js` green; `DEFAULT_TOKENS` hex mirrors pre-change defaults.
- [ ] A `fill:'auto'` shape AND an `'auto'` table + deck `designTokens.colors.accent='#e11d48'` render `#e11d48` in BOTH editor and present/export (table regression explicitly covered).
- [ ] Flipping `element-defaults.js`/built-in templates to `'auto'` produces ZERO out-of-box visual change (default-token render == old hex).
- [ ] Per-slide `designTokens` override (keyed by `data-slide-idx`) beats deck tokens for that slide only.
- [ ] Saved user deck without tokens = byte-identical to pre-change output.

## Risk Assessment

- **Risk:** a 5th/missed `safeCssColor` copy or color-guard silently drops `var(--ns-*)`. **Mitigation:** grep-verified 4 copies; the `'auto'` table golden fixture (step 6) is the canary — if any copy is missed, that test fails in CI instead of escaping silently.
- **Risk:** two color paths drift. **Mitigation:** both import `resolveAutoColor`/`AUTO_FIELD_MAP` from `shared/src/design-tokens.js` — single source.
- **Risk:** silent color regression (no existing golden tests). **Mitigation:** step 1 golden baseline is the gate; CI runs it.
- **Risk:** flipping defaults to `'auto'` shifts out-of-box look if DEFAULT_TOKENS ≠ current hex. **Mitigation:** step 7 test asserts default-token render == old hex, byte-for-byte.
- **Risk:** per-slide scoped CSS specificity wars with reveal theme. **Mitigation:** nothing else defines `--ns-*`; attribute selector `[data-slide-idx]` + token block placed after theme link; verified in golden fixture.
- **Risk:** PDF/print export ignores CSS vars. **Mitigation:** vars resolve to concrete colors at paint; verify print path in step 9.

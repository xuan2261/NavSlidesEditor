---
phase: 4
title: "Background Canvas FX"
status: completed
priority: P3
effort: "2d"
dependencies: []
---

# Phase 4: Background Canvas FX

## Overview

Add a new slide background type `'fx'` driving an animated canvas (ported from html-ppt-skill's canvas FX modules). Render in the editor (live, pausable) and in `htmlGenerator` output. Because live viewers render the identical htmlGenerator HTML in an iframe, FX appears for live viewers automatically — no LiveViewPage change. Must honor `prefers-reduced-motion` and offer a disable toggle.

## Requirements

- Functional:
  - `slide.background = { type:'fx', fx:{ name, params } }`.
  - Port ~8-10 FX modules into `shared/src/fx/`: matrix-rain, particle-burst, constellation, gradient-blob, knowledge-graph, starfield, sparkle-trail, orbit-ring (+2 optional).
  - `BackgroundControls` gains an `'fx'` tab: pick module + tune params + preview.
  - htmlGenerator emits a per-slide `<canvas>` + init script that starts/stops the rAF loop on `slidechanged`.
  - Editor SlideCanvas renders the same FX live, pausable when slide not focused / editor idle.
- Non-functional:
  - 60fps target on a single active slide; only the active slide animates.
  - `prefers-reduced-motion: reduce` → static first-frame (no animation) on every client incl. live viewers.
  - PDF/print export → static fallback color (canvas can't print).

## Architecture

**FX modules** (`shared/src/fx/<name>.js`): each exports `{ name, defaultParams, draw(ctx, state, t) }` or an `init(canvas, params) → { start, stop }` handle. Keep each module < 200 LOC. A small `shared/src/fx/index.js` registry maps name → module + an inlineable init runtime string for htmlGenerator.

**htmlGenerator emission** (research-confirmed):
- Extend `getBackgroundAttrs` (`htmlGenerator.js:359-368`): for `type:'fx'` emit no reveal bg attr (transparent), instead inject inside the `<section>` (built ~line 140): `<canvas data-fx-name=".." data-fx-params='..' style="position:absolute;inset:0;z-index:0;pointer-events:none">`.
- Extend `getBgPrintStyle` (`htmlGenerator.js:388-398`): `'fx'` → solid fallback color. **NOTE (red-team):** current signature is `getBgPrintStyle(bg)` with NO token access. Must widen to `getBgPrintStyle(bg, deckTokens)` (or resolve `bg.fx.fallbackColor` baked at author time) so the print fallback can use the theme bg color. Update the one call site at `htmlGenerator.js:440`.
- Add ONE inlined FX runtime `<script>` (near existing Reveal init ~line 234). **CRITICAL (red-team):** reveal does NOT fire `slidechanged` on initial load — it fires `ready` (existing `Reveal.on('ready')` at line 234). So the runtime MUST start the current slide's FX in BOTH the `ready` handler AND `slidechanged`, else slide 1's FX stays dead until you navigate away and back. On each, read `data-fx-*` of the active section, start its rAF loop, stop others. Respect `matchMedia('(prefers-reduced-motion: reduce)')`.

**Editor** (`SlideCanvas.jsx`): for `bg.type==='fx'` set container background transparent (`getBgStyle` ~line 23-28) and mount a React canvas component that calls the same `shared/src/fx` module — single FX source for editor + export.

**Live viewers:** none. They get the htmlGenerator iframe (`LiveViewPage.jsx:111-113,336-341`, `allow-scripts`) which runs the inlined runtime as-is.

## Related Code Files

- Create: `shared/src/fx/<name>.js` ×~8-10, `shared/src/fx/index.js` (registry + inlinable runtime), `shared/tests/fx-registry.test.js`
- Create: `client/src/components/canvas/slide-background-fx-canvas.jsx` (editor canvas mount)
- Modify: `shared/src/htmlGenerator.js` (`getBackgroundAttrs`, `getBgPrintStyle`, section canvas inject, runtime script)
- Modify: `client/src/components/ribbon/design-tab-content.jsx` (`BackgroundControls` `'fx'` tab + type picker `+'fx'`)
- Modify: `client/src/components/SlideCanvas.jsx`, `client/src/components/SlidePanel.jsx`, `client/src/components/SlideSorterView.jsx` (handle `'fx'` in bg-style switch → transparent + optional static preview)
- Modify: `shared/src/types/presentation.js` (background.fx typedef)

## Implementation Steps (TDD)

1. **TEST FIRST** — `fx-registry.test.js`: every registered FX has `name`, `defaultParams`, a draw/init contract; registry lookup by name works; unknown name → null (no throw). Assert htmlGenerator with `type:'fx'` emits a `<canvas data-fx-name>` and the runtime script exactly once per deck, AND that the runtime wires BOTH `ready` and `slidechanged` (string-match the inlined script — guards the slide-1-dead-FX bug).
2. Implement registry + 2 cheap FX first (gradient-blob, starfield) to green step 1.
3. Extend htmlGenerator bg branches; widen `getBgPrintStyle(bg, deckTokens)` + update call site (line 440); inject canvas + runtime that starts active-slide FX on `ready` AND `slidechanged`; add golden fixture for an `'fx'` slide (assert canvas markup + reduced-motion guard + `ready` hook present).
4. Build editor `slide-background-fx-canvas.jsx` using the same module; wire SlideCanvas/SlidePanel/SorterView `'fx'` branches.
5. Add `BackgroundControls` `'fx'` tab (module dropdown + param sliders + live preview + "disable animation" note + fallback-color picker for print).
6. Port remaining FX modules in batches; keep each < 200 LOC.
7. Manual: editor preview animates + pauses when idle; present mode animates **on slide 1 without navigating**; a 2nd browser as live viewer shows FX; toggle OS reduced-motion → static.

## Success Criteria

- [ ] ≥ 8 FX modules registered; registry test green.
- [ ] `'fx'` background animates in editor, present (**including slide 1 on initial load, no navigation needed**), AND live viewer (no LiveViewPage edit).
- [ ] Only the active slide animates; others idle.
- [ ] `prefers-reduced-motion` → static first frame everywhere.
- [ ] PDF/print → solid fallback, no broken canvas.

## Risk Assessment

- **Risk:** CPU/battery drain on weak live-viewer devices. **Mitigation:** only active slide animates; reduced-motion honored per-client; explicit disable toggle; cap fps.
- **Risk:** inlined runtime bloats every export even when no FX used. **Mitigation:** inject runtime script ONLY when ≥1 slide uses `type:'fx'`.
- **Risk:** editor and export FX diverge. **Mitigation:** both call the same `shared/src/fx` module.
- **Risk:** iframe sandbox blocks inline script. **Mitigation:** research confirms `allow-scripts allow-same-origin` is set — inline JS runs.

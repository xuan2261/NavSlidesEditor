---
phase: 5
title: "Design Ideas Engine"
status: completed
priority: P3
effort: "2d"
dependencies: [2, 3]
---

# Phase 5: Design Ideas Engine

## Overview

A PowerPoint-Designer-style side panel that analyzes the current slide with **heuristics only** (no AI this round) and suggests 3-5 design ideas — re-layout candidates (reposition content into a matching Phase-3 layout) + theme/token pairings (from Phase-2 presets). Each suggestion shows a thumbnail; clicking applies it as one undoable history step.

## Requirements

- Functional:
  - Analyze active slide: element count, types present, text length buckets, has-image, has-chart/table/code, aspect of content (title-only vs dense).
  - Map analysis → 3-5 ranked suggestions: (a) layout re-fit using existing Phase-3 templates, (b) theme/token pairing using Phase-2 presets.
  - Side panel renders suggestion thumbnails; click applies (re-layout repositions existing content into the chosen template's slots; theme suggestion sets tokens).
  - Apply = single history step (undo restores prior slide).
  - "Refresh ideas" re-runs analysis after edits.
- Non-functional:
  - Pure client-side heuristic; no network/API call.
  - Suggestion generation < 100ms for a typical slide.

## Architecture

**Depends on Phase 2 (theme presets) + Phase 3 (layouts).** Heuristic-only by decision.

- `client/src/lib/design-ideas/analyze-slide.js` — pure fn: slide → `{ elementCount, types, textLen, hasImage, density, ... }`.
- `client/src/lib/design-ideas/suggest.js` — pure fn: analysis + available layouts + presets → ranked `Suggestion[]` `{ kind:'layout'|'theme', templateId?|presetId?, score, preview }`. Rule table, not ML.
- `client/src/components/design-ideas-panel.jsx` — side panel UI (thumbnails, apply, refresh).
- Re-layout mapping: match current content elements to target template slots by type/order; preserve content, adopt position/size from template. Conservative — if mapping is ambiguous, offer theme-only suggestions rather than risk scrambling content.
- Apply routes through the same history mechanism used elsewhere (undoable).

## Related Code Files

- Create: `client/src/lib/design-ideas/analyze-slide.js`, `client/src/lib/design-ideas/suggest.js`, `client/src/components/design-ideas-panel.jsx`
- Create: `client/src/lib/design-ideas/analyze-slide.test.js`, `client/src/lib/design-ideas/suggest.test.js`
- Modify: ribbon/panel host to mount the Design Ideas panel (Design tab or a side dock) — confirm host during impl
- Reuse: Phase-2 `theme-presets.js`, Phase-3 `slide-templates.js`

## Implementation Steps (TDD)

1. **TEST FIRST** — `analyze-slide.test.js`: known slide fixtures → expected analysis (count, types, density buckets, hasImage).
2. Implement `analyze-slide.js` to green.
3. **TEST FIRST** — `suggest.test.js`: analysis fixtures → expected ranked suggestions (e.g. title+subtitle only → suggests title/section-header layouts + 2 theme pairings; dense bullets → suggests two-column/agenda). Assert 3-5 results, deterministic ordering, no crash on empty slide.
4. Implement `suggest.js` rule table to green.
5. Build `design-ideas-panel.jsx`: render thumbnails, apply handler (one history step), refresh.
6. Wire re-layout apply: map content→slots conservatively; theme apply sets tokens.
7. Manual: open several slide shapes; verify suggestions are sensible, apply + undo clean, refresh updates after edits.

## Success Criteria

- [ ] Analysis + suggest unit tests green with deterministic output.
- [ ] Panel shows 3-5 suggestions per slide with thumbnails.
- [ ] Applying a layout suggestion preserves content and is one undo step.
- [ ] Applying a theme suggestion sets tokens (one undo step).
- [ ] Empty/degenerate slide → graceful (theme-only or "no ideas"), no crash.

## Risk Assessment

- **Risk:** re-layout scrambles content. **Mitigation:** conservative type/order mapping; fall back to theme-only when ambiguous; everything undoable.
- **Risk:** heuristic suggestions feel dumb. **Mitigation:** tune rule table against real slide fixtures in tests; AI-assist deferred to a future round (out of scope).
- **Risk:** depends on 2 & 3 landing. **Mitigation:** phase dependencies declared; can ship theme-only suggestions first if Phase 3 slips.

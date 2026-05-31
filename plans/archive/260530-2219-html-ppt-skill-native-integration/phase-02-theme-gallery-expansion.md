---
phase: 2
title: "Theme Gallery Expansion"
status: completed
priority: P2
effort: "1-2d"
dependencies: [1]
---

# Phase 2: Theme Gallery Expansion

## Overview

Translate the palettes + typography of html-ppt-skill's 36 themes into NavSlides token presets (`designTokens` objects), then surface them in BOTH theme surfaces: the deck-starter `PRESET_THEMES` (HomePage) and the live-switch `ThemeGallery` (Design ribbon). Add an "Apply theme to all slides" action routed through history (undoable).

## Requirements

- Functional:
  - ~35-40 token presets, each = `{ id, label, category, tokens: {colors, fonts, radius, spacingScale}, revealTheme }`. `revealTheme` keeps the closest existing reveal CSS for non-tokenized chrome.
  - Live-switch from `ThemeGallery` updates `presentation.designTokens` (and optionally `theme`) without reload.
  - "Apply theme to all" = set deck tokens + clear per-slide token overrides, as ONE history step (undo restores prior tokens). Recolors all `'auto'` elements (new decks + built-in templates flipped in Phase 1). NOTE: a deck of frozen-hex user content won't visibly recolor — that's the backward-compat contract, not a bug.
  - Preset picker shows a live token-driven thumbnail (accent/bg/text swatch), not just a name.
- Non-functional:
  - Selecting a preset is < 200ms, no reload.
  - Attribution: source palette credit to lewislulu in `NOTICE`.

## Architecture

**Depends on Phase 1** (tokens must resolve). Presets are pure data.

- Create `shared/src/theme-presets.js` — array of token presets. Only the palette/typography VALUES are ported (MIT data), expressed in NavSlides token shape. No html-ppt CSS files copied.
- `ThemeGallery` (`design-tab-content.jsx:26-50`) currently lists 11 reveal theme strings. Extend it to render token presets: clicking calls `onUpdatePresentation({ designTokens: preset.tokens, theme: preset.revealTheme })`.
- `PRESET_THEMES` (`HomePage.jsx:51`) currently maps reveal theme + transition + thumbnail. Add `tokens` to each entry so a new deck starts with the matching token set.
- "Apply theme to all": add an action in the Design ribbon that dispatches a single store update wrapped in the existing history mechanism (same undo path used by other slide-bulk ops).

## Related Code Files

- Create: `shared/src/theme-presets.js`, `shared/tests/theme-presets.test.js`
- Create/Modify: `NOTICE` (MIT attribution for ported palettes)
- Modify: `client/src/components/ribbon/design-tab-content.jsx` (ThemeGallery → token presets + Apply-to-all button)
- Modify: `client/src/pages/HomePage.jsx` (`PRESET_THEMES` entries gain `tokens`)
- Modify: store action for bulk token apply (presentation-store) — confirm history wrapping during impl

## Implementation Steps (TDD)

1. **TEST FIRST** — `theme-presets.test.js`: every preset has 6 colors + 2 fonts + radius + spacingScale; ids unique; each `tokens` shape validates against the Phase-1 token contract; `revealTheme` ∈ known reveal themes.
2. Author `shared/src/theme-presets.js` (start ~15 high-value themes: minimal-white, editorial-serif, dracula, tokyo-night, nord, corporate-clean, pitch-deck-vc, swiss-grid, neo-brutalism, glassmorphism, cyberpunk-neon, academic-paper, sunset-warm, blueprint, magazine-bold). Expand toward ~40 after the surface works.
3. Wire `ThemeGallery` to render presets with token-swatch thumbnails; click updates `designTokens` live.
4. Add `tokens` to `PRESET_THEMES`; verify new-deck creation seeds tokens.
5. Implement "Apply theme to all" as one undoable history step (test undo restores prior tokens).
6. Add `NOTICE` attribution entry.
7. Manual: cycle several presets in editor; confirm < 200ms, no reload, present mode matches.

## Success Criteria

- [ ] ≥ 35 token presets validate via test.
- [ ] Live-switch in ThemeGallery recolors a deck of **`'auto'` content** instantly (editor + present parity). Verified on a new deck / built-in template — NOT on frozen-hex user decks (those keep their colors by design).
- [ ] New deck from a `PRESET_THEMES` entry starts with that preset's tokens.
- [ ] "Apply theme to all" is a single undo step.
- [ ] `NOTICE` credits lewislulu/html-ppt-skill (MIT).

## Risk Assessment

- **Risk:** presets reference tokens Phase 1 doesn't resolve. **Mitigation:** test step 1 validates against the Phase-1 contract; Phase 2 blocked by Phase 1.
- **Risk:** two theme surfaces drift (HomePage vs ribbon). **Mitigation:** both consume the same `theme-presets.js`; no duplicated palette literals.
- **Risk:** copying CSS could raise license concerns. **Mitigation:** port only palette/typography VALUES (facts), express in our shape, attribute in NOTICE.

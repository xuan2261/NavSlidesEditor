---
phase: 2
title: "Critical Fixes — Context Menu + Sparkles Separation"
status: completed
priority: P1
effort: "2-2.5h"
dependencies: [1]
---

<!-- Merged from old phase-02 + phase-03 per Red Team F4 (collapse to 4 phases). -->
<!-- Updated: Validation Session 3 — 2026-05-21: dropped phase-numbered test file, scenario-named + co-located per project convention. -->

# Phase 2: Critical Fixes — Context Menu + Sparkles Separation

## Overview

Two Critical/High fixes:

1. **Issue #1 (Critical):** Replace every emoji and unicode-arrow icon in the canvas right-click context menu (`canvas-right-click-context-menu-for-slide-elements.jsx`) with the matching Lucide icon.
2. **Issue #2 (High):** Split `Sparkles` overload into 3 distinct icons — `Sparkles` (AI only), `Wand2` (animation/effect/transition/Auto-Animate/Kinetic Text/Transitions tab), `LayoutTemplate` (Insert Template).

Single test file covers both; one phase, one TDD pass.

## Requirements

### Functional — Context Menu (Issue #1)
- Top-level Button labels render Lucide icons sized 14px.
- Snap Reference 9-cell grid replaces unicode arrows with directional Lucide icons sized 14px (`aria-hidden="true"`; existing `aria-label` on Button is the accessible name).
- Item text/labels unchanged.
- Keyboard navigation behavior unchanged.

### Functional — Sparkles separation (Issue #2)
- AI-related sites keep `Sparkles` (regression guarded).
- Animation Effect picker → `Wand2`.
- SlidePanel Auto-Animate badge (line 249) → `Wand2`.
- SlidePanel Insert Template button (line 469) → `LayoutTemplate`.
- SlidePanel Auto-Animate ctx-menu item (line 572) → `Wand2`.
- Insert tab Advanced dropdown "Kinetic Text" item (`ribbon-insert-tab-element-galleries-panel.jsx:391`) → `Wand2`.
- Transitions ribbon tab icon (`ribbon-tabs-config.js:16`) → `Wand2`.
- Tooltips and aria-labels unchanged everywhere.

### Non-functional
- No layout shift in the context menu (Lucide 14px ≈ emoji visual cell).
- Bundle delta: new icons (`Wand2`, `LayoutTemplate`, plus directional arrows) tree-shaken; expected ~1–2 KB gzipped.

## Architecture

### Context menu icon mapping (verified call sites)

| Item | Before | After |
|---|---|---|
| Copy (Ctrl+C) | `📋` | `<Copy size={14} />` |
| Cut (Ctrl+X) | `✂` | `<Scissors size={14} />` |
| Paste (Ctrl+V) | `📌` | `<Clipboard size={14} />` |
| Duplicate (Ctrl+D) | `⧉` | `<CopyPlus size={14} />` (probe; fallback `<Copy size={14} />`) |
| Crop (image) | `✂` | `<Crop size={14} />` |
| Reset crop | `↺` | `<Undo2 size={14} />` |

### Snap Reference 9-cell grid

| Cell | Before | After |
|---|---|---|
| ul | `↖` | `ArrowUpLeft` |
| uc | `↑` | `ArrowUp` |
| ur | `↗` | `ArrowUpRight` |
| ml | `←` | `ArrowLeft` |
| mc | `⊕` | `Crosshair` (probe; fallback `Target`) |
| mr | `→` | `ArrowRight` |
| ll | `↙` | `ArrowDownLeft` |
| lc | `↓` | `ArrowDown` |
| lr | `↘` | `ArrowDownRight` |

### Sparkles → Wand2 / LayoutTemplate sites

| File | Line | Before | After |
|---|---|---|---|
| `ribbon-element-animation-effect-controls-tab-content.jsx` | 71 | `Sparkles` | `Wand2` |
| `SlidePanel.jsx` | 249 | `Sparkles size={9}` | `Wand2 size={9}` |
| `SlidePanel.jsx` | 469 | `Sparkles size={14}` | `LayoutTemplate size={14}` |
| `SlidePanel.jsx` | 572 | `Sparkles size={14}` | `Wand2 size={14}` |
| `ribbon-insert-tab-element-galleries-panel.jsx` | 391 | `icon: Sparkles` | `icon: Wand2` |
| `ribbon-tabs-config.js` | 16 | `icon: Sparkles` | `icon: Wand2` |

AI files keep Sparkles: `ribbon-header-bar.jsx`, `AIGeneratorModal.jsx`, `AICopywriterModal.jsx`, `HomePage.jsx`. Test fixtures (`ribbon-dropdown-menu-group-trigger.test.jsx`) keep Sparkles — not user-facing.

## Related Code Files

### Modify
- `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.jsx`
- `client/src/components/ribbon/ribbon-element-animation-effect-controls-tab-content.jsx`
- `client/src/components/ribbon/ribbon-insert-tab-element-galleries-panel.jsx`
- `client/src/components/ribbon/ribbon-tabs-config.js`
- `client/src/components/SlidePanel.jsx`

### Create
- `client/src/__tests__/sparkles-icon-semantic-separation.test.jsx` (cross-cutting; spans Animations Effect picker, SlidePanel ×3, Insert Advanced, ribbon-tabs-config — not co-locatable)

### Append (existing test files)
- `client/src/components/canvas/canvas-right-click-context-menu-for-slide-elements.test.jsx` — add a new `describe('icon consistency pass — Lucide ctx-menu', () => ...)` block

## Implementation Steps

### TDD: Tests first
1. **Append to `canvas-right-click-context-menu-for-slide-elements.test.jsx`** — add `describe('icon consistency pass — Lucide ctx-menu', ...)` with `it` blocks that render the menu with mock props (image element selected to exercise Crop/Reset crop branch). Assert no emoji code points and no unicode arrows in rendered HTML; assert Lucide SVG present in each top-level item and each SNAP cell; assert each SNAP Button keeps its `aria-label`.
2. **Create `client/src/__tests__/sparkles-icon-semantic-separation.test.jsx`** with 6+1 `it` blocks — Animations Effect picker uses `Wand2`; SlidePanel autoAnimate badge uses `Wand2`; SlidePanel ctx-menu Auto-Animate item uses `Wand2`; SlidePanel Insert Template uses `LayoutTemplate`; Insert Advanced "Kinetic Text" item uses `Wand2`; `RIBBON_TABS` Transitions entry icon === `Wand2`; AI dropdown / AI Copywriter still uses `Sparkles` (regression guard).
3. Run — both new test surfaces fail.

### Implementation
4. Update `canvas-right-click-context-menu-for-slide-elements.jsx`: replace emoji string prefixes with Lucide JSX; replace `SNAP_ICONS` string map with a Lucide-component map; render `<Icon size={14} aria-hidden="true" />` inside each grid Button.
5. Update Animations Effect picker: swap `Sparkles` → `Wand2`.
6. Update Insert tab Advanced dropdown: swap `Sparkles` → `Wand2` for the `Kinetic Text` item.
7. Update `ribbon-tabs-config.js`: swap `Sparkles` → `Wand2` import + Transitions tab icon.
8. Update `SlidePanel.jsx`: split 3 Sparkles call sites — line 249 → `Wand2`; line 469 → `LayoutTemplate`; line 572 → `Wand2`; update the top-level lucide import (remove `Sparkles`, add `Wand2`, `LayoutTemplate`).
9. Probe `CopyPlus` and `Crosshair` from `lucide-react`. Verified present in `client/src/data/icon-paths.json` (CopyPlus, Crosshair both = 1 hit). Fall back to `Copy`/`Target` only if a runtime import error appears.

### Green
10. `npm run lint` clean.
11. `npm run test -- canvas-right-click-context-menu-for-slide-elements` passes (existing + new describe).
12. `npm run test -- sparkles-icon-semantic-separation` passes.
13. `npm run test -- icon-policy-invariants` — the canvas-emoji and Sparkles-confined assertions go green; the others remain red until Phase 3.
14. Manual smoke: open editor, right-click slide element (rect/text and image), verify each icon visually matches; render a slide with Auto-Animate ON and confirm badge changed; open Transitions ribbon tab.

## Test Strategy

| Test | Type | Asserts |
|---|---|---|
| `canvas-right-click-context-menu-for-slide-elements.test.jsx` (append) | Vitest component | Lucide ctx-menu render + SNAP grid + aria-label retention |
| `sparkles-icon-semantic-separation.test.jsx` (new, central) | Vitest component | All 6 Sparkles call-site separations + AI regression guard |
| `icon-policy-invariants.test.js` | Vitest source-scan | 2 of 5 `it` blocks flip green |

## Success Criteria

- [x] Zero emoji + unicode-arrow chars remain in canvas ctx-menu file
- [x] Top-level menu items + 9 SNAP cells render Lucide icons at 14px; aria-labels intact
- [x] `Sparkles` only in AI JSX + test fixtures (verified by Phase 1 regression test)
- [x] `Wand2` used in Animations Effect picker + Auto-Animate badge + Auto-Animate ctx-menu item + Kinetic Text item + Transitions ribbon tab
- [x] `LayoutTemplate` used for Insert Template button
- [x] AI dropdown + AI menu items retain `Sparkles`
- [x] Appended ctx-menu describe + new sparkles separation test both pass; two `icon-policy-invariants` `it` blocks now green

## Risk Assessment

| Risk | Mitigation |
|---|---|
| `CopyPlus` / `Crosshair` missing in installed lucide-react | Verified present in `icon-paths.json`; runtime probe with fallbacks `Copy` / `Target` |
| User confusion ("Sparkles changed for animations / Transitions") | Tooltip + tab label text unchanged; visual still magic-wand vibe |
| Missed Sparkles call site | Phase 1 regression test catches stragglers |
| `LayoutTemplate` size mismatch with peer SlidePanel footer icons | Match `size={14}` to peer Plus button |

## Notes

- This is the only Critical-tier change; merging with the Sparkles High fix keeps the surface coherent (Sparkles touches SlidePanel which is also Critical-adjacent).
- Auto-Animate is reveal.js terminology, not AI — keeping `Wand2` avoids reinforcing the AI-Sparkles overload.
- Original 2-phase split rejected per Red Team F4 (over-phasing).

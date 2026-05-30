---
phase: 3
title: "Layout Library Expansion"
status: completed
priority: P2
effort: "1-2d"
dependencies: []
---

# Phase 3: Layout Library Expansion

## Overview

Add ~15 new slide layouts (translated from html-ppt-skill's single-page layouts) into `client/src/data/slide-templates.js` as element-JSON, on the 960×540 grid. Use `'auto'` colors so they adopt the active theme once Phase 1 lands (and fall back to defaults until then — independent of Phase 1).

## Requirements

- Functional:
  - New layouts: KPI grid, timeline, roadmap, mindmap, gantt, big-quote, agenda/TOC, two-column-compare, code-diff, arch-diagram, stat-callout, process-flow, quote-with-author, image-grid, closing/CTA. (~15.)
  - Each = valid entry in `SLIDE_TEMPLATES` with `label`, `icon`, `category`, `elements[]`.
  - Structural chrome uses `shape` elements with `locked:true`; editable content uses `text`.
  - Decorative colors use `'auto'` so they theme; concrete-by-design accents may use explicit hex where theming would harm legibility.
  - New category grouping in the template picker so the list stays navigable.
- Non-functional:
  - Every element fits within 960×540, no overflow/overlap that breaks the layout.

## Architecture

Independent of Phase 1 — `'auto'` is inert (renders default) until tokens exist, so layouts work standalone and improve once Phase 1 ships.

**Coordination with Phase 1 (shared file `slide-templates.js`):** both phases edit this file — P1 flips existing-entry hex → `'auto'`, P3 adds new entries. To avoid a merge collision when run in parallel: P3 authors NEW layouts with `'auto'` from the start (no hex to flip later), and if P3 splits the file into `slide-templates/` modules, P1's flip must target the new module locations. Sequence P1's flip AFTER P3's split if both land close together, or have whichever lands first own the split.

Schema (research-confirmed, `slide-templates.js`):
- `text`: `{ type:'text', x, y, width, height, zIndex, content:'<html>' }`
- `shape`: `{ type:'shape', shape:'rect'|'circle'|..., x, y, width, height, zIndex, fill, stroke, strokeWidth, locked? }`

Translate html-ppt layout proportions → 960×540 px. Keep each layout's element count modest (KISS). Group related layouts via the existing `category` field; add a couple of new category labels (e.g. `data`, `structure`) and surface them in `TemplatePickerModal.jsx`.

## Related Code Files

- Modify: `client/src/data/slide-templates.js` (+~15 entries) — watch file size; if it exceeds ~200 LOC growth, split into `slide-templates/` modules re-exported from an index.
- Modify: `client/src/components/TemplatePickerModal.jsx` (new category filters/labels)
- Create: `client/src/data/slide-templates.test.js` (schema + bounds validation)

## Implementation Steps (TDD)

1. **TEST FIRST** — `slide-templates.test.js`: for every template, each element has required fields for its type; all `x/y/width/height` keep `x+width ≤ 960` and `y+height ≤ 540`; `zIndex` present; ids/labels unique. (Covers existing + new.)
2. Author layouts in small batches (KPI grid, timeline, roadmap first); run schema test after each batch.
3. If `slide-templates.js` grows too large, split into `slide-templates/<group>.js` + index re-export (keep public import path stable).
4. Add category labels + filters in `TemplatePickerModal.jsx`.
5. Manual: insert each new layout onto a blank slide; verify visual fit at 960×540 and that `'auto'` elements adopt theme color after Phase 1 (or default before).

## Success Criteria

- [ ] ≥ 15 new layouts added; schema/bounds test green for all templates.
- [ ] Layouts render within 960×540 without clipping.
- [ ] `'auto'`-colored chrome themes correctly once Phase 1 is present; renders sane default before.
- [ ] Template picker groups new layouts under clear categories.

## Risk Assessment

- **Risk:** coordinate drift / overlap when porting proportions. **Mitigation:** bounds test in step 1 + manual visual check step 5.
- **Risk:** `slide-templates.js` blows past file-size rule. **Mitigation:** split into modules behind a stable index export.
- **Risk:** `'auto'` looks wrong before Phase 1. **Mitigation:** `'auto'` falls back to current defaults (Phase 1 DEFAULT_TOKENS mirror today's hex), so pre-Phase-1 look is unchanged.

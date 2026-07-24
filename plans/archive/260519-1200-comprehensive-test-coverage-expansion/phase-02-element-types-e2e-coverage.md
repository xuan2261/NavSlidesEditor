---
phase: 2
title: "Phase 2a — Element Types Core (Text/Image/Shape/Code/Math/Markdown/Chart/Table)"
status: completed
priority: P1
effort: "5-7d"
dependencies: [0]
tdd: true
---

<!-- Updated: Validation Session 1 — split into 2a (this file) + 2b (phase-02b-element-types-drawing-games-qr.md) -->

# Phase 2a — Element Types Core E2E Coverage

## Status (completed 2026-05-19)
- 8 spec files under `tests/e2e/elements/` (all kebab-case + descriptive names per file-naming hook):
  - `chart-types-smoke.spec.js` — 7 tests (6 chart types + property switch)
  - `code-element-syntax-highlighting-and-language-switching.spec.js` — 9 tests (6 languages + 3 controls)
  - `image-and-media-element-rendering-with-object-fit-and-filters.spec.js` — 5 tests (image/video/audio + filters)
  - `markdown-rendering-and-html-embed-sanitization-and-persistence.spec.js` — 6 tests
  - `math-latex-tikz-element-rendering-with-katex-iframe.spec.js` — 4 tests
  - `slide-element-shape-variants-render-and-gallery-insertion.spec.js` — 14 tests (13 shape variants + multi-render)
  - `table-element-interactions-row-col-add-and-cell-edit-and-styling.spec.js` — 7 tests (row/col/cell/style)
  - `text-element-rich-formatting-and-prosemirror-editing-and-persistence.spec.js` — 6 tests (rich format + editing)
- **58/58 passing** in ~66s wall (workers=2)
- Pattern: API-seed (`apiUpdatePresentation`) for deterministic content + DOM render verify; UI insert kept minimal (already covered in `elements.spec.js`)
- Each spec ≤ 200 LOC

## Overview
Phủ e2e cho 16 element types thuộc nhóm core: text/rich-formatting, image+media, shape variants, code, math/LaTeX/TikZ, markdown/HTML embed, chart, table. Mỗi spec ≤ 200 LOC. **Phase 2b xử lý drawing/games/qr/icon/callout/divider.**

## Red-team patches incorporated
- Patch-06: split Phase 2 → 2a (this file, 5-7d) + 2b (phase-02b, 3-4d) per user validation answer.

## Element backlog (Phase 2a only)

### P1 — Missing or significantly partial
- Inline math
- Image crop / filter / round-corners
- Shape: circle, triangle, arrow (only rect+star tested)
- Code theme + lang switching
- LaTeX/TikZ render verify
- Markdown render output
- Chart 6 types smoke
- Video/Audio trim + speed
- Table drag-resize cells, row/col ops

### Already covered (no work)
- Text basic, HTML embed, SVG, Timeline

### Deferred to Phase 2b
- Divider, QR, Icon, Callout, Drawing, Line/Arrow style, Game per-type smoke

## Requirements

### Functional
- Each of 16 covered element types has ≥ 1 spec verifying insert + render + persist.
- Property panel exercises 3-5 top controls per type.
- 0 flaky.

### Non-functional
- Each spec ≤ 200 LOC.
- Per-test execution < 30s.
- Use API seed (`apiUpdatePresentation`) for deterministic content; UI insert tested separately.

## Architecture
Spec layout under `tests/e2e/elements/` (Phase 2a only):
- `text-and-rich-formatting.spec.js`
- `image-and-media.spec.js`
- `shape-variants.spec.js`
- `code-syntax-highlighting.spec.js`
- `math-latex-tikz.spec.js`
- `markdown-html-embed.spec.js`
- `chart-types-smoke.spec.js`
- `table-interactions.spec.js`

## Related Code Files
- **Create:** 8 specs above + helpers in `tests/e2e/pages/`
- **Modify:** `tests/e2e/pages/RibbonInsertHelper.js`, `PropertiesPanelHelper.js`
- **Read-only:** `client/src/components/canvas/element-renderers/**`, `shared/src/element-renderers.js`
- **NOT in this phase:** `tests/e2e/games/per-game-type-smoke.spec.js`, `drawing-and-svg.spec.js`, `qr-icon-callout-divider.spec.js` — owned by Phase 2b.

## Implementation Steps (TDD)

### Step 1 — Red
- Write skeleton spec for each of 8 spec files with one failing assertion (insert → expect element count). Initial run: all fail.

### Step 2 — Green per element
- Wire insert flow via Insert tab (RibbonInsertHelper).
- Add property panel exercise (PropertiesPanelHelper).
- Verify render via DOM selector + API state via `apiGetPresentation`.

### Step 3 — Refactor
- Extract repeated patterns to helpers (e.g., `insertAndSelectElement(type)`).
- Ensure each spec file ≤ 200 LOC; split if larger.

### Step 4 — Verify
- Full e2e green; coverage report shows `client/src/components/canvas/element-renderers/**` ≥ 80% for 16 covered types.

## Success Criteria
- [ ] 8 new spec files, 0 fail / 0 flaky.
- [ ] 16 core element types have insert+render+persist coverage.
- [ ] Coverage `element-renderers/**` ≥ 80% (Phase 2b raises to ≥ 90% after drawing/games land).
- [ ] All specs ≤ 200 LOC.

## Risk Assessment
- **R-01**: KaTeX/TikZJax render async. Mitigation: `expect.poll` with 5s timeout (use `waitWithLastSample` from Phase 4 helpers if landed first).
- **R-02**: Chart.js v4 lazy-loads renderer per chart type. Mitigation: pre-warm by rendering all types in fixture seed.
- **R-03**: Image crop UI uses canvas → mouse events flaky. Mitigation: API seed `crop` field; verify render only via UI.

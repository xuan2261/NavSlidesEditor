---
phase: 4
title: "Per-cell table border extraction"
status: pending
priority: P1
effort: "2d"
dependencies: [1]
---

# Phase 4 — Per-Cell Table Border Extraction

Hardcoded `borderColor: '#d1d5db'`, `borderWidth: 1` at `mapper.js:414-415` discard per-cell, per-side, and table-theme borders. Table property coverage capped at 90%. Pure mapper feature add — no breaking change.

## Context Links

- Brainstorm: P1-G
- Source: `mapper.js:414-415` (hardcoded constants), `mapTable` at line ~332
- pptxtojson docs: table parser output contains `borderType`, `borderColor`, `borderWidth` per cell side.

## Overview

- Priority: P1
- Brief: Add per-cell border parsing to `mapTable`. Each `cell` gains `borders: { top, right, bottom, left }` shape with `{ color, width, style }` per side. Mapper passes through pptxtojson's parsed structure with sensible defaults.

## Key Insights

- pptxtojson exposes `cell.borders` already (verified in `pptxtojson` cell output structure); current code discards it.
- Schema change: add per-cell `borders` to element output. Backward-compatible additive field; renderer can ignore until updated.
- Renderer side (`shared/src/element-renderers.js`) needs follow-up to actually paint these — but mapper-side is independent.

## File Inventory

| Path | Action | Est LOC delta |
|---|---|---|
| `server/services/pptx-import/mapper.js` (mapTable region) | Modify | +50/-2 |
| `server/services/pptx-import/mapper.test.js` (mapTable tests) | Modify | +120 |
| `shared/src/element-renderers.js` (table renderer) | Modify | +30 |
| `client/src/data/element-defaults.js` | Verify | (no change expected; borders field already optional) |

## Test Scenario Matrix

| Existing test | Touched? | Notes |
|---|---|---|
| `mapper.test.js` — table tests (~line 230-450 approx) | Yes | Replace hardcoded-color assertions; add per-cell border cases |
| `mapper-golden-master.test.js` — table snapshot | Re-baseline | Borders structure expands |
| `roundtrip-matching.test.js` (155 LOC) | Verify still green | Table round-trip should improve |
| `property-mapping.test.js` (245 LOC) | Verify still green | |

New tests: +5-8 cases (per-cell single border, per-side different colors, theme inheritance, no-border, dotted style).

## Function/Interface Checklist

- `mapTable(element, context)` in `mapper.js:~332`:
  - Read `element.tableRows[i].cells[j].borders` (or pptxtojson equivalent — verify in scout step).
  - Build per-cell `borders` object: `{ top: { color, width, style }, right: {...}, bottom: {...}, left: {...} }`.
  - Default per-side to inherited from `element.borders` (table-level), then fall back to `{ color: '#d1d5db', width: 1, style: 'solid' }` only if both missing.
- Remove hardcoded `mapper.js:414-415` constants.
- New helper `parseCellBorder(side)` -> `{ color, width, style }`. Keep in same file for now; move to `map-table.js` in Phase 7.

## Dependency Map

- Blocks: Phase 7 (extracting `map-table.js` requires this code in place), Phase 9 (acceptance gate)
- Blocked by: Phase 1 (golden masters)

## Tests Before (Characterization Gate)

- [ ] Confirm `npm test` green
- [ ] Identify table tests in `mapper.test.js` asserting `borderColor: '#d1d5db'` — these will need updating
- [ ] Find pptxtojson sample output for a known table fixture; document per-cell border shape

## Refactor / Implement

- [ ] In `mapTable`, after current row/cell mapping, parse per-cell borders:
  ```js
  const cellBorders = parseCellBorder(rawCell?.borders ?? element?.borders ?? null)
  cell.borders = cellBorders
  ```
- [ ] Remove `mapper.js:414-415` hardcoded color/width.
- [ ] Add `parseCellBorder(rawBorders)` helper:
  ```js
  function parseCellBorder(raw) {
    return ['top','right','bottom','left'].reduce((acc, side) => {
      const s = raw?.[side]
      acc[side] = {
        color: s?.color ?? '#d1d5db',
        width: s?.width ?? 1,
        style: s?.style ?? 'solid'
      }
      return acc
    }, {})
  }
  ```
- [ ] Update `shared/src/element-renderers.js` table renderer to use `cell.borders.{side}.{color,width,style}` when rendering HTML.

## Tests After (New Unit Tests)

- [ ] `mapper.test.js` new cases:
  - `it('extracts per-side cell borders from pptxtojson output')`
  - `it('inherits table-level borders when cell-level missing')`
  - `it('falls back to default gray when both missing')`
  - `it('supports dashed border style')`
  - `it('supports per-cell border color variation')`
- [ ] Renderer test (in `shared/tests/`): table with mixed borders renders correct CSS.

## Regression Gate

- [ ] `npm test` — full suite green
- [ ] `npm test -- --coverage` — thresholds preserved
- [ ] LOC budget: `mapper.js` net positive (~+48) — still under 200 LOC after Phase 7 split; for now `mapper.js` may temporarily exceed (acceptable since Phase 7 fixes)
- [ ] `npm run test:corpus` — table property coverage on Bai_2_2 increases from 90% to >= 98%; re-baseline `corpus-baseline.json`
- [ ] Re-baseline table snapshots in `mapper-golden-master.test.js`

## Success Criteria

- Table property coverage on Bai_2_2 >= 98%.
- Tables with per-cell borders in test fixtures render with correct color and width.
- No regression on `Bai_2_5` table count.

## Risk Assessment

- Risk: pptxtojson border output shape differs from assumption. Mitigation: scout pptxtojson output first; write characterization test for sample fixture.
- Risk: schema change breaks existing presentations loaded from disk. Mitigation: additive `borders` field; renderer falls back to default if absent.
- Risk: renderer change in `shared/` cascades to PPTX export round-trip. Mitigation: verify `roundtrip-matching.test.js` green.

## Rollback Plan

- Revert `mapper.js` (mapTable region) and `shared/src/element-renderers.js` table block. Snapshots: `git checkout`. No data migration required since field is additive.

## Unresolved Questions

1. Should `borders` be normalized when all four sides match (collapse to single object) or always nest? Recommend always-nest for predictability.
2. Table theme inheritance from PPTX (`tblStyle` references) — out of scope here; document gap.
3. Renderer change in `shared/`: any breaking change to existing exported HTML? Verify with `roundtrip-matching.test.js`.

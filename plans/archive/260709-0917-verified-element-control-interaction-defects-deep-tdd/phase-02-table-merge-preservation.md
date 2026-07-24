---
phase: 2
title: "Table Merge Preservation"
status: pending
priority: P1
effort: "1-1.5d"
dependencies: [1]
---

# Phase 2: Table Merge Preservation

## Overview

Stop **silent total wipe** of `mergedCells` on every table shape change (`normalizeTableShape`). Preserve merges that remain fully inside the new row/col bounds; drop or clamp only invalid merges. Update existing tests that currently **require** wipe.

## Requirements

- Functional:
  - **Add row** (append): existing merges that do not extend past new bounds stay.
  - **Add column** (append): same.
  - **Remove last row/col:** drop merges that reference removed indices or whose span no longer fits; keep unaffected merges.
  - **Remove col in middle of a merge:** drop that merge (no half-broken colspan).
  - `cellStyles` / `colWidths` / `rowHeights` sync behavior **unchanged**.
  - Canvas + shared `resolveMergedCells` still pure consumers — no API change required if data stays valid.
- Non-functional:
  - Pure helper unit tests; no E2E required for Phase 2.
  - Keep function under file size budget; extract `remapMergedCells(prevMerges, oldRows, oldCols, newRows, newCols)` if needed.

## Architecture

```
normalizeTableShape(update, current)
  data → rows, cols
  cellStyles sync (existing)
  colWidths/rowHeights pad (existing)
  mergedCells = preserveValidMerges(current.mergedCells, rows, cols)
                 // NOT []

preserveValidMerges(list, rows, cols):
  for each merge:
    row, col, rowSpan, colSpan normalized like resolveMergedCells
    if row < 0 || col < 0: drop
    if row + rowSpan > rows || col + colSpan > cols: drop
    if rowSpan < 1 || colSpan < 1: drop
    else keep { row, col, rowSpan, colSpan }
```

Optional v2 (only if time): when deleting column `i`, shift merges with `col > i` left by 1 and shrink spans that cover `i`. **Phase 2 MVP = append-safe preserve + drop-invalid only** (properties UI only adds/removes last row/col today).

Verify properties UI paths:

```js
// table-properties.jsx
normalizeTableShape({ data: d }, element)  // +row
normalizeTableShape({ data: data.slice(0,-1) }, element)  // -row
normalizeTableShape({ data: data.map(r => [...r, '']) }, element)  // +col
normalizeTableShape({ data: data.map(r => r.slice(0,-1)) }, element)  // -col
```

## Related Code Files

- Modify: `client/src/components/properties/table-properties-utils.js`
- Modify: `client/src/components/properties/table-properties-utils.test.js` (**rewrite wipe expects**)
- Optional parity: shared tests if any assert wipe
- Do not change: `shared/src/table-merge-resolver.js` (unless invalid data still slips through)

## TDD — Tests First (RED)

Rewrite / add in `table-properties-utils.test.js`:

```js
it('preserves in-bounds merge when appending a row')
// prev 2x2 merge r0c0 rs2 cs2; add row → still one merge

it('preserves in-bounds merge when appending a column')

it('drops merge that exceeds bounds after removing last column')
// e.g. colSpan reaches into deleted col

it('keeps unaffected merge when removing last row that was outside merge')
// merge only on rows 0-1; remove row 2 → merge kept

it('still syncs cellStyles matrices after shape edit') // existing behavior

it('still pads colWidths/rowHeights') // existing
```

**Replace** tests named like `drops imported merged-cell metadata whenever rows are added` — those encode the **bug/old policy**.

**RED proof:** After changing expects to preserve, current impl returns `[]` → fail.

## Implementation Steps

1. Inventory all callers of `normalizeTableShape` and `mergedCells: []`.
2. Write new preserve tests; flip old wipe tests; confirm RED.
3. Implement `preserveValidMerges` (or inline) in `normalizeTableShape`.
4. Green unit tests.
5. Spot-check `TableRenderer` with merge + add row (manual or existing table component tests).
6. Ensure PPTX/import paths that call normalize still safe (import may rely on wipe — if so, branch only for properties shape edits OR ensure preserve-valid is always correct).

## Success Criteria

- [ ] Appending row/col does not clear valid merges
- [ ] Out-of-bounds merges after shrink are dropped (not half-applied)
- [ ] Style matrix sync still correct
- [ ] No broken colspan/rowspan reaches canvas (resolver covers covered cells)
- [ ] `npx vitest run client/src/components/properties/table-properties-utils.test.js` pass
- [ ] Related table renderer tests still pass

## VERIFY Gate

```bash
npx vitest run client/src/components/properties/table-properties-utils.test.js
npx vitest run client/src/components/properties/table-properties.test.jsx
npx vitest run client/src/components/canvas/element-renderers/table-element-renderer.test.jsx
npx vitest run shared/tests/  # if table merge tests live here — scope to table if slow
```

Manual: create 2×2 merge → Add Row → merge still visually merged.

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Old tests intentionally wiped for import safety | preserve-valid is safer than wipe-all; invalid still dropped |
| Mid-table delete later | Document MVP = last row/col only; add remap later |
| Overlapping merges after preserve | Resolver last-wins; optional validate uniqueness in helper |

## Risk: Medium | Blast: Table authoring data integrity

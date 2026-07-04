---
phase: 3
title: "Table Selected Cell Bounds Safety"
status: completed
priority: P0
dependencies: [1]
---

# Phase 03: Table Selected Cell Bounds Safety

## Overview

Prevent `TableProperties` from crashing when the selected cell points outside the table after row or column deletion.

## Requirements

- Functional: after deleting rows or columns, cell-style controls apply to the nearest valid cell or remain a no-op when no cell exists.
- Non-functional: preserve existing table data normalization, merged-cell reset behavior, and per-cell style matrix sync.

## Architecture

Add a small clamp helper around `{ row, col }` and table dimensions in `table-properties-utils.js`. Use it both for display and style updates so state and mutation path agree.

## Related Code Files

- Modify: `client/src/components/properties/table-properties.jsx`
- Modify: `client/src/components/properties/table-properties.test.jsx`
- Modify: `client/src/components/properties/table-properties-utils.js`
- Modify: `client/src/components/properties/table-properties-utils.test.js`

## Implementation Steps

1. Confirm Phase 01 D2 row and column tests fail with `TypeError` or stale-cell behavior.
2. Record D2 red evidence in `reports/implementation-evidence.md`: command, failing assertion, old-bug reason, and setup-noise exclusion.
3. Add a pure `clampSelectedCell(selectedCell, data)` helper in `table-properties-utils.js` and unit tests in `table-properties-utils.test.js`.
4. Clamp before `getCellStyle()` reads and before `updateCellStyle()` writes.
5. On `-Row` and `-Col`, update `selectedCell` to a valid cell in the same event path, or rely on a `useEffect` that clamps when dimensions change.
6. Preserve `normalizeTableShape()` use for `data`, `cellStyles`, `colWidths`, `rowHeights`, and `mergedCells`.
7. Tests:
   - use a stateful component harness that applies `onUpdate` into the rendered `element` prop.
   - selected last row, delete row, rerender, change cell background, assert exact clamped `cellStyles` coordinate.
   - selected last column, delete column, rerender, change alignment, assert exact clamped `cellStyles` coordinate.
   - repeated delete to 1x1 then style controls still work.
   - add row/col still preserves current selected cell if valid.
8. Run table targeted test and record green evidence in `reports/implementation-evidence.md`.

## Success Criteria

- [x] No crash after row deletion with stale row selection.
- [x] No crash after column deletion with stale column selection.
- [x] Style updates apply to the expected clamped cell, not a silent no-op.
- [x] Selected cell label reflects a valid existing cell.
- [x] Existing table structure/style tests remain green.
- [x] D2 red/green evidence is recorded in `reports/implementation-evidence.md`.

## Risk Assessment

Risk: clamping selection in render causes repeated setState. Mitigation: compute a safe local selected cell for reads/writes, and only set state on explicit structural button actions or guarded effects.

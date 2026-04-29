---
phase: 3
title: "Table Full Support"
status: complete
priority: P1
effort: "3-4 days"
dependencies: [phase-00-sanitizer-hardening, phase-01-rich-html-preservation, phase-02-shape-line-image-enhancement]
---

# Phase 3: Table Full Support

## Overview

Add full table support: merged cells (colSpan/rowSpan), per-cell styling, borders, and header row detection. **Scope increased from 2 to 3-4 days** per plan review — table phase touches canvas renderer, properties panel, AND export, not just the mapper.

## Context Links

- Review finding: `plans/reports/debug-260425-1102-pptx-full-fidelity-plan-review.md` — P1-B Table underestimated
- Existing mapper: `server/services/pptx-import/mapper.js`
- Existing table renderer: `client/src/components/SlideCanvas.jsx` — TableRenderer function
- Existing table properties: `client/src/components/properties/table-properties.jsx`
- Existing table export: `client/src/utils/export-pptx-basic-renderers.js`
- Schema: `client/src/data/element-defaults.js` — table defaults
- pptxtojson schema: `plans/reports/researcher-260425-0946-pptxtojson-schema.md` §5d

## Requirements

**Phase 0 contract change applies:** `mapElement()` returns array. Table handler must return `[element]`.

**Import mapping:**
- Preserve merged cells: `colSpan > 1`, `rowSpan > 1`, `vMerge === 0` (continuation)
- Preserve per-cell text color, fill color, bold
- Preserve per-cell text alignment (left/center/right)
- Preserve per-cell vertical alignment (top/middle/bottom)
- Preserve table borders (per-side: top/bottom/left/right with color/width)
- Preserve column widths and row heights
- Detect header row from pptxtojson `hasHeaderRow` or first-row style
- Filter vMerge continuation rows (hidden cells in merged columns)

**Canvas rendering:**
- Render merged cells (colSpan/rowSpan attributes on `<td>`)
- Render per-cell text color and background
- Render per-cell text alignment
- Support header row styling (background, bold)

**Properties panel:**
- Allow editing per-cell text (existing)
- Allow editing header row toggle
- Allow editing cell background colors
- Allow editing border colors and width
- Allow editing text alignment per row/column

**Export:**
- Generate pptxgenjs table from enhanced schema
- Apply per-cell styles (color, fill, bold, alignment)
- Reconstruct merged cells with colSpan/rowSpan
- Apply border styles per side

## Architecture

**Table element schema extension** (`client/src/data/element-defaults.js`):

```js
table: {
  // Existing
  rows: 3, cols: 3,
  data: [['', '', ''], ['', '', ''], ['', '', '']],
  headerRow: true,
  // NEW — extended schema
  headerBgColor: 'rgba(99,102,241,0.18)',
  headerTextColor: '#1e40af',
  headerIsBold: true,
  borderColor: '#d1d5db',
  borderWidth: 1,
  textColor: '#111827',
  cellBgColor: 'transparent',
  // Per-cell styling (2D arrays indexed by [row][col])
  cellStyles: {
    textColors: [[]],     // null = inherit from header/default
    bgColors: [[]],
    isBold: [[]],
    aligns: [[]],         // 'left' | 'center' | 'right'
    vAligns: [[]],        // 'top' | 'middle' | 'bottom'
  },
  // Merged cells
  mergedCells: [],        // [{ row, col, rowSpan, colSpan }]
  // Sizing (optional)
  colWidths: [],
  rowHeights: [],
}
```

**HTML table for canvas renderer:**
```jsx
<table style={{ borderCollapse: 'collapse', width: '100%' }}>
  {data.map((row, ri) => (
    <tr>
      {row.map((cell, ci) => {
        const mc = mergedCells.find(m => m.row === ri && m.col === ci)
        const bg = cellStyles.bgColors?.[ri]?.[ci] || (headerRow && ri === 0 ? headerBgColor : cellBgColor)
        return <td
          colSpan={mc?.colSpan}
          rowSpan={mc?.rowSpan}
          style={{ background: bg, textAlign: cellStyles.aligns?.[ri]?.[ci] || 'left' }}
        >
          {cell}
        </td>
      })}
    </tr>
  ))}
</table>
```

## Related Code Files

**Modify:**
- `client/src/data/element-defaults.js` — extend table schema
- `server/services/pptx-import/mapper.js` — rewrite `mapTable()` to extract all cell data
- `client/src/components/SlideCanvas.jsx` — update TableRenderer for merged cells + per-cell styling
- `client/src/components/properties/table-properties.jsx` — add per-cell styling controls
- `client/src/utils/export-pptx-basic-renderers.js` — generate table with merged cells + per-cell styles
- `server/services/pptx-import/mapper.test.js` — comprehensive table tests

## Implementation Steps

1. **Extend table schema in `element-defaults.js`**
   - Add: `cellStyles` object, `mergedCells[]`, `colWidths[]`, `rowHeights[]`
   - Add: `headerTextColor`, `headerIsBold`
   - Add: `borderWidth`
   - Keep backward compat: existing `{ data, rows, cols, headerRow, borderColor, textColor, cellBgColor, headerBgColor }` still work

2. **Rewrite `mapTable()` in `mapper.js`**
   - Iterate `element.data` (TableCell[][])
   - Extract `cell.fontColor` → `cellStyles.textColors[ri][ci]`
   - Extract `cell.fillColor` → `cellStyles.bgColors[ri][ci]`
   - Extract `cell.fontBold` → `cellStyles.isBold[ri][ci]`
   - Extract paragraph alignment → `cellStyles.aligns[ri][ci]`
   - Extract vAlign → `cellStyles.vAligns[ri][ci]`
   - Build `mergedCells[]`: for each cell with `rowSpan > 1 || colSpan > 1`, add to array
   - Filter vMerge continuation rows: if `vMerge > 0` (start of merge), include; if `vMerge === 0` (continuation), skip
   - `headerRow`: from `element.hasHeaderRow || element.headerRow || true`
   - `colWidths[]`, `rowHeights[]` from pptxtojson
   - Return `[tableElement]` (array per Phase 0 contract)

3. **Update TableRenderer in SlideCanvas**
   - Render HTML `<table>` with `colSpan`/`rowSpan` attributes
   - Apply per-cell background colors from `cellStyles.bgColors`
   - Apply per-cell text alignment from `cellStyles.aligns`
   - Apply per-cell text color from `cellStyles.textColors`
   - Render merged cells visually (spanning cells)
   - Apply header row styling (bold, background)
   - Existing TipTap editing for cell content should still work (verify)

4. **Enhance table properties panel (`table-properties.jsx`)**
   - Add header row toggle
   - Add header background color picker
   - Add table border color + width
   - Add per-row/per-column alignment controls
   - Verify existing per-cell text editing still works

5. **Update table export (`export-pptx-basic-renderers.js`)**
   - Generate pptxgenjs table from extended schema
   - Apply per-cell styles via `tableOptions.rowH`
   - Handle merged cells: `rowSpan`/`colSpan` in cell options
   - Apply border styles: outer + inner borders

6. **Add tests in `mapper.test.js`**
   - Test basic table → 2D data array
   - Test table with merged cells → `mergedCells` array populated
   - Test table with per-cell text colors → `cellStyles.textColors` populated
   - Test table with vMerge continuation → cell skipped
   - Test table with header row detection → `headerRow` from pptxtojson
   - Test table with border styles → `borderColor`/`borderWidth` set
   - Test table with per-cell alignment → `cellStyles.aligns` populated
   - Test round-trip: import → export → re-import table structure matches

## Success Criteria

- [ ] Table with merged cells (colSpan > 1, rowSpan > 1) → rendered correctly in canvas
- [ ] Table with per-cell text colors → colors rendered
- [ ] Table with header row → header styling applied (background, bold)
- [ ] Table export → PPTX generates correct merged cell structure
- [ ] Edit cell in properties panel → canvas updates
- [ ] vMerge continuation cells → not duplicated in rendered table
- [ ] All existing table tests pass (backward compat)
- [ ] Table thumbnails (shared renderer) render correctly

## Risk Assessment

**Risk:** SlideCanvas TableRenderer may conflict with existing TipTap cell editing.
**Mitigation:** Keep cell content editable via existing mechanism. Only add styling rendering, not editing behavior change.
**Risk:** pptxtojson may not output colSpan/rowSpan reliably for all merged cells.
**Mitigation:** Validate merged spec: ensure start cell exists. Skip invalid merges with warning. Use placeholder for complex cases.

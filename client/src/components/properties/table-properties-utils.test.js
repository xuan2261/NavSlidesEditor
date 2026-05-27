import { describe, expect, it } from 'vitest'
import { normalizeTableShape } from './table-properties-utils'

describe('table properties utilities', () => {
  it('keeps style matrices and row/column dimensions aligned after shape edits', () => {
    const next = normalizeTableShape(
      { data: [['A', 'B'], ['C', 'D'], ['E', 'F']] },
      {
        data: [['A', 'B']],
        colWidths: [80, 120],
        rowHeights: [40],
        mergedCells: [{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }],
        cellStyles: {
          textColors: [['#111111', '#222222']],
          fontSizes: [[24, 16]],
          fontFamilies: [['Arial', 'Aptos']],
        },
      }
    )

    expect(next.cellStyles.fontSizes).toEqual([[24, 16], [null, null], [null, null]])
    expect(next.cellStyles.fontFamilies).toEqual([['Arial', 'Aptos'], [null, null], [null, null]])
    expect(next.colWidths).toEqual([80, 120])
    expect(next.rowHeights).toEqual([40, 40, 40])
    expect(next.mergedCells).toEqual([])
  })
})

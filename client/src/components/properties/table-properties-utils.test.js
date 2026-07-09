import { describe, expect, it } from 'vitest'
import {
  clampTableCell,
  normalizeTableShape,
  preserveValidMerges,
} from './table-properties-utils'

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
    // In-bounds colspan merge is preserved when appending rows
    expect(next.mergedCells).toEqual([{ row: 0, col: 0, rowSpan: 1, colSpan: 2 }])
  })

  it('preserves in-bounds merge when appending a row', () => {
    const next = normalizeTableShape(
      {
        data: [
          ['A', 'B'],
          ['C', 'D'],
          ['', ''],
        ],
      },
      {
        data: [
          ['A', 'B'],
          ['C', 'D'],
        ],
        mergedCells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }],
      }
    )

    expect(next.mergedCells).toEqual([{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }])
    expect(next.cellStyles.textColors).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ])
  })

  it('preserves in-bounds merge when appending a column', () => {
    const next = normalizeTableShape(
      { data: [['A', 'B', ''], ['C', 'D', '']] },
      {
        data: [['A', 'B'], ['C', 'D']],
        mergedCells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }],
      }
    )
    expect(next.mergedCells).toEqual([{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }])
  })

  it('drops merge that exceeds bounds after removing last column', () => {
    const next = normalizeTableShape(
      { data: [['A', 'B'], ['C', 'D']] },
      {
        data: [['A', 'B', 'C'], ['D', 'E', 'F']],
        colWidths: [80, 120, 160],
        mergedCells: [{ row: 0, col: 1, rowSpan: 2, colSpan: 2 }],
      }
    )

    expect(next.mergedCells).toEqual([])
    expect(next.colWidths).toEqual([80, 120])
  })

  it('keeps unaffected merge when removing last row outside the merge', () => {
    const next = normalizeTableShape(
      {
        data: [
          ['A', 'B'],
          ['C', 'D'],
        ],
      },
      {
        data: [
          ['A', 'B'],
          ['C', 'D'],
          ['E', 'F'],
        ],
        mergedCells: [{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }],
      }
    )
    expect(next.mergedCells).toEqual([{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }])
  })

  it('preserveValidMerges drops degenerate and OOB entries', () => {
    expect(
      preserveValidMerges(
        [
          { row: 0, col: 0, rowSpan: 2, colSpan: 2 },
          { row: 5, col: 0, rowSpan: 1, colSpan: 1 },
          { row: -1, col: 0, rowSpan: 1, colSpan: 1 },
        ],
        2,
        2
      )
    ).toEqual([{ row: 0, col: 0, rowSpan: 2, colSpan: 2 }])
  })

  it('clamps selected cells to the nearest existing table cell', () => {
    expect(clampTableCell({ row: 3, col: 4 }, [['A', 'B'], ['C']])).toEqual({ row: 1, col: 0 })
    expect(clampTableCell({ row: -1, col: -1 }, [['A']])).toEqual({ row: 0, col: 0 })
  })
})

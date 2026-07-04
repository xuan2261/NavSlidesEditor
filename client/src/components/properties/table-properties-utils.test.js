import { describe, expect, it } from 'vitest'
import { clampTableCell, normalizeTableShape } from './table-properties-utils'

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

  it('drops imported merged-cell metadata whenever rows are added', () => {
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

    expect(next.mergedCells).toEqual([])
    expect(next.cellStyles.textColors).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ])
  })

  it('drops imported merged-cell metadata whenever columns are removed', () => {
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

  it('clamps selected cells to the nearest existing table cell', () => {
    expect(clampTableCell({ row: 3, col: 4 }, [['A', 'B'], ['C']])).toEqual({ row: 1, col: 0 })
    expect(clampTableCell({ row: -1, col: -1 }, [['A']])).toEqual({ row: 0, col: 0 })
  })
})
